import type { APIRoute } from "astro";
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../../../db/client";
import { attempts } from "../../../db/schema";
import { verifyAuthToken } from "../../../lib/verifyAuthToken";

export const prerender = false;

const bodySchema = z.object({
  anonSessionId: z.string().min(1),
});

export const POST: APIRoute = async ({ request }) => {
  let userId: string;
  try {
    ({ userId } = await verifyAuthToken(request.headers.get("authorization")));
  } catch (err) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { anonSessionId } = parsed.data;

  // Only claims attempts that are (a) tied to this browser's anon session
  // and (b) not already claimed by someone -- so a stale/shared
  // anonSessionId can never hijack another account's attempt.
  const claimed = await db
    .update(attempts)
    .set({ userId, anonSessionId: null })
    .where(and(eq(attempts.anonSessionId, anonSessionId), isNull(attempts.userId)))
    .returning({ id: attempts.id });

  return new Response(JSON.stringify({ claimed: claimed.map((row) => row.id) }), {
    headers: { "Content-Type": "application/json" },
  });
};
