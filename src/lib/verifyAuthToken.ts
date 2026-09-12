import { jwtVerify, createRemoteJWKSet } from "jose";

// Our app and Neon's auth server are separate origins (an Astro app on
// Vercel vs. a *.neon.tech auth host), so server-side session checks can't
// rely on a shared cookie the way a same-origin Next.js app would -- this
// is exactly the "separate frontend and backend domains" case Neon's own
// JWT plugin docs call out. The client fetches a short-lived JWT
// (authClient.token()) and sends it as a bearer token; we verify it here
// against Neon Auth's public JWKS rather than trusting anything the client
// asserts about who it is.
const NEON_AUTH_BASE_URL = import.meta.env.NEON_AUTH_BASE_URL;
const JWKS = createRemoteJWKSet(new URL(import.meta.env.NEON_AUTH_JWKS_URL));

export interface AuthTokenPayload {
  userId: string;
  email: string;
  name: string;
}

/**
 * Verifies a Neon Auth JWT and returns the authenticated user's identity.
 * Throws if the token is missing, expired, or fails signature verification.
 */
export async function verifyAuthToken(authorizationHeader: string | null): Promise<AuthTokenPayload> {
  const token = authorizationHeader?.match(/^Bearer (.+)$/)?.[1];
  if (!token) {
    throw new Error("Missing bearer token");
  }

  const { payload } = await jwtVerify(token, JWKS, {
    issuer: new URL(NEON_AUTH_BASE_URL).origin,
  });

  if (typeof payload.sub !== "string") {
    throw new Error("Token missing subject");
  }

  return {
    userId: payload.sub,
    email: typeof payload.email === "string" ? payload.email : "",
    name: typeof payload.name === "string" ? payload.name : "",
  };
}

/** Same as verifyAuthToken, but returns null instead of throwing -- for
 * routes where signing in is optional (e.g. starting an exam attempt
 * anonymously is allowed; we still want the userId if they happen to
 * already be signed in). */
export async function tryVerifyAuthToken(authorizationHeader: string | null): Promise<AuthTokenPayload | null> {
  try {
    return await verifyAuthToken(authorizationHeader);
  } catch {
    return null;
  }
}
