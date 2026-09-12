import type { APIRoute } from "astro";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../../../db/client";
import { attempts, questions } from "../../../db/schema";
import { tryVerifyAuthToken } from "../../../lib/verifyAuthToken";

export const prerender = false;

const bodySchema = z.object({
  lengthTier: z.union([z.literal(10), z.literal(30), z.literal(50)]),
  anonSessionId: z.string().min(1).optional(),
});

export const POST: APIRoute = async ({ request }) => {
  const auth = await tryVerifyAuthToken(request.headers.get("authorization"));

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { lengthTier, anonSessionId } = parsed.data;

  if (!auth && !anonSessionId) {
    return new Response(JSON.stringify({ error: "anonSessionId is required when not signed in" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Question bank is still small (see thoughtprocess/03-phase-3-exam-ux.md)
  // -- select up to lengthTier across both scenario types, randomized,
  // rather than requiring an exact count that doesn't exist yet.
  const selected = await db.select().from(questions).orderBy(sql`random()`).limit(lengthTier);

  if (selected.length === 0) {
    return new Response(JSON.stringify({ error: "No questions available" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [attempt] = await db
    .insert(attempts)
    .values({
      userId: auth?.userId,
      anonSessionId: auth ? undefined : anonSessionId,
      lengthTier,
      status: "in_progress",
    })
    .returning({ id: attempts.id });

  return new Response(
    JSON.stringify({
      attemptId: attempt.id,
      questions: selected.map((q) => ({
        id: q.id,
        label: q.label,
        psychometricAttribute: q.psychometricAttribute,
        difficulty: q.difficulty,
        scenarioType: q.scenarioType,
        content: q.content,
      })),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};
