import type { APIRoute } from "astro";
import { verifyAuthToken } from "../../../../lib/verifyAuthToken";
import { getDashboardData } from "../../../../lib/dashboardData";
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

  const [data, used] = await Promise.all([getDashboardData(userId), countSignedInAttempts(userId)]);

  return new Response(
    JSON.stringify({ ...data, attemptCount: { used, limit: MAX_SIGNED_IN_ATTEMPTS } }),
    { headers: { "Content-Type": "application/json" } }
  );
};
