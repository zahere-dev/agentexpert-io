import { eq, count } from "drizzle-orm";
import { db } from "../db/client";
import { attempts } from "../db/schema";

/**
 * 5 attempts, counted only for signed-in attempts -- anonymous plays are
 * free and uncapped (see thoughtprocess/00-vision-and-decisions.md). "For
 * now": a deliberately adjustable policy, not a permanent rule.
 */
export const MAX_SIGNED_IN_ATTEMPTS = 5;

export async function countSignedInAttempts(userId: string): Promise<number> {
  const [row] = await db.select({ value: count() }).from(attempts).where(eq(attempts.userId, userId));
  return row?.value ?? 0;
}
