import { createAuthClient } from "@neondatabase/neon-js/auth";

// Our app and Neon's managed auth server are different origins, so the
// session cookie Better Auth sets isn't automatically sent on our own
// fetches -- `credentials: 'include'` opts every authClient call into
// sending it cross-origin (the domain still has to be trusted server-side,
// see `neon neon-auth domain add`).
export const authClient = createAuthClient(import.meta.env.PUBLIC_NEON_AUTH_URL, {
  fetchOptions: { credentials: "include" },
});
