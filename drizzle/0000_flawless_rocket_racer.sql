CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"anon_session_id" text,
	"length_tier" integer NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"overall_score" numeric(5, 2),
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "attempts_length_tier_check" CHECK ("attempts"."length_tier" in (10, 30, 50)),
	CONSTRAINT "attempts_status_check" CHECK ("attempts"."status" in ('in_progress', 'completed')),
	CONSTRAINT "attempts_identity_check" CHECK ("attempts"."user_id" is not null or "attempts"."anon_session_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "attribute_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"psychometric_attribute" text NOT NULL,
	"score" numeric(5, 2) NOT NULL,
	"max_score" numeric(5, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"psychometric_attribute" text NOT NULL,
	"difficulty" integer DEFAULT 1 NOT NULL,
	"scenario_type" text NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"answer" jsonb NOT NULL,
	"trace" jsonb,
	"is_correct" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribute_scores" ADD CONSTRAINT "attribute_scores_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempts_user_id_idx" ON "attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "attempts_anon_session_id_idx" ON "attempts" USING btree ("anon_session_id");--> statement-breakpoint
CREATE INDEX "attribute_scores_attempt_id_idx" ON "attribute_scores" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "responses_attempt_id_idx" ON "responses" USING btree ("attempt_id");