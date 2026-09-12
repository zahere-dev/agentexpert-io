import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db } from "../../../../../db/client";
import { attempts } from "../../../../../db/schema";
import { readAttemptResults } from "../../../../../lib/examResults";
import { verifyAuthToken } from "../../../../../lib/verifyAuthToken";

export const prerender = false;

/**
 * Called after sign-in to fetch the full attribute breakdown for an
 * attempt that was completed anonymously. Requires a valid session *and*
 * that the attempt actually belongs to this user -- if the claim hasn't
 * gone through yet (or never will), this quietly falls back to the same
 * minimal shape an anonymous caller gets, not an error.
 */
export const GET: APIRoute = async ({ params, request }) => {
  const attemptId = params.attemptId;
  if (!attemptId) {
    return new Response(JSON.stringify({ error: "Missing attempt id" }), { status: 400 });
  }

  let userId: string;
  try {
    ({ userId } = await verifyAuthToken(request.headers.get("authorization")));
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [attempt] = await db.select().from(attempts).where(eq(attempts.id, attemptId));
  if (!attempt) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const owns = attempt.userId === userId;
  const results = await readAttemptResults(attemptId, owns);

  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" },
  });
};
