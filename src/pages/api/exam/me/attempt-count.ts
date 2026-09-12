import type { APIRoute } from "astro";
import { verifyAuthToken } from "../../../../lib/verifyAuthToken";
import { countSignedInAttempts, MAX_SIGNED_IN_ATTEMPTS } from "../../../../lib/attemptLimit";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  let userId: string;
  try {
    ({ userId } = await verifyAuthToken(request.headers.get("authorization")));
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const used = await countSignedInAttempts(userId);
  return new Response(
    JSON.stringify({ used, limit: MAX_SIGNED_IN_ATTEMPTS, remaining: Math.max(0, MAX_SIGNED_IN_ATTEMPTS - used) }),
    { headers: { "Content-Type": "application/json" } }
  );
};
