import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { attempts, attributeScores, responses } from "../db/schema";

export interface AttributeResultRow {
  attribute: string;
  total: number;
  correct?: number;
  percent?: number;
}

export interface AttemptResults {
  overallPercent: number;
  attributeResults: AttributeResultRow[];
  ungradedCount: number;
}

/**
 * Reads back an already-completed attempt's results. `full` controls
 * whether per-attribute correct-counts/percentages are included -- the
 * overall score is always safe to reveal (anonymous play explicitly shows
 * a score, per the product design), but the *breakdown* is the thing
 * worth signing in for, so anonymous callers get attribute names and
 * question counts only, never the numbers that make them meaningful.
 */
export async function readAttemptResults(attemptId: string, full: boolean): Promise<AttemptResults | null> {
  const [attempt] = await db.select().from(attempts).where(eq(attempts.id, attemptId));
  if (!attempt || attempt.status !== "completed") return null;

  const scores = await db.select().from(attributeScores).where(eq(attributeScores.attemptId, attemptId));
  const responseRows = await db
    .select({ isCorrect: responses.isCorrect })
    .from(responses)
    .where(eq(responses.attemptId, attemptId));
  const ungradedCount = responseRows.filter((r) => r.isCorrect === null).length;

  const attributeResults: AttributeResultRow[] = scores.map((s) => {
    const total = Number(s.maxScore);
    const correct = Number(s.score);
    if (!full) return { attribute: s.psychometricAttribute, total };
    return {
      attribute: s.psychometricAttribute,
      total,
      correct,
      percent: total > 0 ? Math.round((correct / total) * 100) : 0,
    };
  });

  return {
    overallPercent: Number(attempt.overallScore ?? 0),
    attributeResults,
    ungradedCount,
  };
}
