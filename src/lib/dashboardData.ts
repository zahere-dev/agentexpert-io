import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { attempts, attributeScores } from "../db/schema";

export interface AttemptHistoryRow {
  id: string;
  lengthTier: number;
  overallPercent: number;
  completedAt: string;
}

export interface AttributeBreakdownRow {
  attribute: string;
  correct: number;
  total: number;
  percent: number;
}

export interface DashboardData {
  attempts: AttemptHistoryRow[];
  attributeBreakdown: AttributeBreakdownRow[];
}

/**
 * Everything a signed-in user's dashboard needs, aggregated across *all*
 * their completed attempts -- not just the most recent one. A single
 * attempt's per-attribute score is noisy (few questions per attribute); the
 * dashboard's "areas to improve" is meant to be the more stable signal you'd
 * actually act on, so it sums correct/max across every attempt before
 * computing a percent, rather than averaging per-attempt percentages.
 */
export async function getDashboardData(userId: string): Promise<DashboardData> {
  const attemptRows = await db
    .select({
      id: attempts.id,
      lengthTier: attempts.lengthTier,
      overallScore: attempts.overallScore,
      completedAt: attempts.completedAt,
    })
    .from(attempts)
    .where(and(eq(attempts.userId, userId), eq(attempts.status, "completed")))
    .orderBy(desc(attempts.completedAt));

  const attemptHistory: AttemptHistoryRow[] = attemptRows.map((a) => ({
    id: a.id,
    lengthTier: a.lengthTier,
    overallPercent: Number(a.overallScore ?? 0),
    completedAt: a.completedAt?.toISOString() ?? "",
  }));

  const breakdownRows = await db
    .select({
      attribute: attributeScores.psychometricAttribute,
      correct: sql<string>`sum(${attributeScores.score})`,
      total: sql<string>`sum(${attributeScores.maxScore})`,
    })
    .from(attributeScores)
    .innerJoin(attempts, eq(attempts.id, attributeScores.attemptId))
    .where(and(eq(attempts.userId, userId), eq(attempts.status, "completed")))
    .groupBy(attributeScores.psychometricAttribute);

  const attributeBreakdown: AttributeBreakdownRow[] = breakdownRows
    .map((r) => {
      const correct = Number(r.correct);
      const total = Number(r.total);
      return { attribute: r.attribute, correct, total, percent: total > 0 ? Math.round((correct / total) * 100) : 0 };
    })
    .sort((a, b) => a.percent - b.percent);

  return { attempts: attemptHistory, attributeBreakdown };
}
