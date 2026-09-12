import {
  pgSchema,
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Neon Auth (Managed Better Auth) owns and migrates this schema itself —
 * we only reference it, never create or alter it here.
 */
const neonAuth = pgSchema("neon_auth");
export const authUsers = neonAuth.table("user", {
  id: uuid("id").primaryKey(),
});

export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
  // Named psychometric attribute, not a loose category -- this is what
  // makes calibrated/adaptive scoring possible later without a rework.
  psychometricAttribute: text("psychometric_attribute").notNull(),
  // 1-5. Not used for adaptive branching yet, but every question needs one
  // from day one so that door isn't closed later.
  difficulty: integer("difficulty").notNull().default(1),
  // 'execution' (Pyodide + trace grading) | 'multiple_choice' | future types.
  scenarioType: text("scenario_type").notNull(),
  // Shape varies by scenarioType: scenario text, mock-tool harness source,
  // rubric/options, sample answer, etc. Deliberately schemaless here --
  // question content iterates faster than the assessment engine does.
  content: jsonb("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable: an attempt exists before anyone signs in. This is what
    // makes "play anonymously, claim on signup" possible without a retake --
    // see thoughtprocess/01-phase-1-schema.md.
    userId: uuid("user_id").references(() => authUsers.id),
    // Set for anonymous attempts so a later sign-in can find and claim them.
    // Null once claimed (userId gets set instead).
    anonSessionId: text("anon_session_id"),
    lengthTier: integer("length_tier").notNull(),
    status: text("status").notNull().default("in_progress"),
    overallScore: numeric("overall_score", { precision: 5, scale: 2 }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("attempts_user_id_idx").on(table.userId),
    index("attempts_anon_session_id_idx").on(table.anonSessionId),
    check("attempts_length_tier_check", sql`${table.lengthTier} in (10, 30, 50)`),
    check("attempts_status_check", sql`${table.status} in ('in_progress', 'completed')`),
    check(
      "attempts_identity_check",
      sql`${table.userId} is not null or ${table.anonSessionId} is not null`
    ),
  ]
);

export const responses = pgTable(
  "responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id),
    // Candidate's submitted answer -- code, selected option, free text.
    answer: jsonb("answer").notNull(),
    // Execution trace for scenarioType='execution' questions (tool calls in
    // order, with args) -- null for question types that don't execute.
    trace: jsonb("trace"),
    // Deterministic Layer-A verdict where one applies. LLM-jury grading
    // (Layer B) and its per-attribute contribution live in attributeScores,
    // not here -- a response can factor into more than one attribute.
    isCorrect: boolean("is_correct"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("responses_attempt_id_idx").on(table.attemptId)]
);

export const attributeScores = pgTable(
  "attribute_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    psychometricAttribute: text("psychometric_attribute").notNull(),
    score: numeric("score", { precision: 5, scale: 2 }).notNull(),
    maxScore: numeric("max_score", { precision: 5, scale: 2 }).notNull(),
  },
  (table) => [index("attribute_scores_attempt_id_idx").on(table.attemptId)]
);
