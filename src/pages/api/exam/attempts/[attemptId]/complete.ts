import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db } from "../../../../../db/client";
import { attempts, responses, questions, attributeScores } from "../../../../../db/schema";
import { readAttemptResults } from "../../../../../lib/examResults";
import { tryVerifyAuthToken } from "../../../../../lib/verifyAuthToken";

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  const attemptId = params.attemptId;
  if (!attemptId) {
    return new Response(JSON.stringify({ error: "Missing attempt id" }), { status: 400 });
  }

  const rows = await db
    .select({
      isCorrect: responses.isCorrect,
      psychometricAttribute: questions.psychometricAttribute,
    })
    .from(responses)
    .innerJoin(questions, eq(responses.questionId, questions.id))
    .where(eq(responses.attemptId, attemptId));

  // One question = one point toward its attribute for now (isCorrect is
  // "passed every check for that question"). Partial credit per-check
  // would need responses to carry a score, not just a boolean -- a
  // deliberate simplification for this phase, see thoughtprocess.
  //
  // Written ("reasoning") answers have isCorrect = null -- there's no
  // auto-grader for them yet (that's the LLM-jury layer, deliberately
  // deferred), so they're recorded but excluded from the numeric score
  // rather than silently counted as wrong.
  const byAttribute = new Map<string, { correct: number; total: number }>();
  for (const row of rows) {
    if (row.isCorrect === null) continue;
    const bucket = byAttribute.get(row.psychometricAttribute) ?? { correct: 0, total: 0 };
    bucket.total += 1;
    if (row.isCorrect) bucket.correct += 1;
    byAttribute.set(row.psychometricAttribute, bucket);
  }

  const attributeResults = Array.from(byAttribute.entries()).map(([attribute, { correct, total }]) => ({
    attribute,
    correct,
    total,
  }));

  const totalCorrect = attributeResults.reduce((sum, a) => sum + a.correct, 0);
  const totalQuestions = attributeResults.reduce((sum, a) => sum + a.total, 0);
  const overallPercent = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  if (attributeResults.length > 0) {
    await db.insert(attributeScores).values(
      attributeResults.map((a) => ({
        attemptId,
        psychometricAttribute: a.attribute,
        score: a.correct.toString(),
        maxScore: a.total.toString(),
      }))
    );
  }

  await db
    .update(attempts)
    .set({ status: "completed", overallScore: overallPercent.toString(), completedAt: new Date() })
    .where(eq(attempts.id, attemptId));

  // Anonymous callers get the score but not the attribute breakdown --
  // that's the thing worth signing in for. If they're already signed in
  // by the time they finish, no reason to make them ask twice.
  const auth = await tryVerifyAuthToken(request.headers.get("authorization"));
  const results = await readAttemptResults(attemptId, !!auth);

  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" },
  });
};
