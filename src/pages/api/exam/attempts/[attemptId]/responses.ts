import type { APIRoute } from "astro";
import { z } from "zod";
import { db } from "../../../../../db/client";
import { responses } from "../../../../../db/schema";

export const prerender = false;

const bodySchema = z.object({
  questionId: z.string().uuid(),
  answer: z.unknown(),
  trace: z.array(z.object({ tool: z.string(), args: z.record(z.string(), z.unknown()) })).nullable(),
  isCorrect: z.boolean().nullable(),
});

export const POST: APIRoute = async ({ request, params }) => {
  const attemptId = params.attemptId;
  if (!attemptId) {
    return new Response(JSON.stringify({ error: "Missing attempt id" }), { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { questionId, answer, trace, isCorrect } = parsed.data;

  // A candidate can re-run code or re-save a written answer any number of
  // times -- overwrite this question's response within the attempt rather
  // than accumulating duplicate rows (which would double-count toward the
  // score). Enforced at the DB level by responses_attempt_question_unique.
  await db
    .insert(responses)
    .values({ attemptId, questionId, answer, trace, isCorrect })
    .onConflictDoUpdate({
      target: [responses.attemptId, responses.questionId],
      set: { answer, trace, isCorrect },
    });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
