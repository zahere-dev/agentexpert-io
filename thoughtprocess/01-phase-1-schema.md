# Phase 1: schema

## Goal

Everything else (auth wiring, the exam UX, attempt limits) depends on one
thing being right: an attempt has to be able to exist *before* anyone has
signed in, and get claimed by an account afterward without a retake. Get
that wrong and every later phase inherits the problem.

## Tooling decision: Drizzle + Neon

Neon's own guidance is explicit: pair Neon with an ORM, Drizzle by
preference, and run migrations against the **direct/unpooled** connection
string, never the pooled one. Followed both. `drizzle.config.ts` points at
`DATABASE_URL_UNPOOLED`; the app's runtime client (`src/db/client.ts`) uses
the pooled `DATABASE_URL` instead.

## Neon branch, not production

Created a Neon branch (`agent-architect-exam`, auto-expires in 7 days per
the `neon.ts` TTL policy for non-default branches) matching the git feature
branch, via `neon checkout agent-architect-exam --create`. All schema work
in this phase happened there — `production`'s Postgres was never touched.

## The schema

Four tables in `public`, one reference to a table we don't own:

- **`questions`** — `label`, a named `psychometric_attribute` (not a loose
  category — see the vision doc for why), `difficulty` (1-5, unused for now
  but present from day one so adaptive scoring doesn't require a migration
  later), `scenario_type` (`execution` | `multiple_choice` | future), and a
  `content` jsonb blob. Content is deliberately schemaless: scenario text,
  harness source, rubric, and sample answers all vary by `scenarioType`, and
  question content will iterate far faster than this table's shape does.

- **`attempts`** — the load-bearing table. `user_id` is **nullable** and
  `anon_session_id` is a plain text column set for anonymous attempts. A
  CHECK constraint (`attempts_identity_check`) requires at least one of the
  two to be set, so an attempt can never exist with neither — but it can
  exist with only `anon_session_id`, which is exactly the anonymous-play
  case. **Claiming** an attempt is a two-column update: set `user_id`,
  clear `anon_session_id`. Verified this actually works against a live
  insert during this phase (see Verification below).

  `length_tier` is constrained to `(10, 30, 50)` at the database level, not
  just in application code — the CHECK constraint means a bug upstream
  can't silently write an invalid tier.

- **`responses`** — one row per question answered within an attempt.
  Carries the candidate's raw `answer`, an execution `trace` (nullable --
  only populated for `execution`-type questions), and `is_correct` for the
  deterministic Layer-A verdict where one applies. Deliberately does *not*
  carry the LLM-jury qualitative grading — that's a property of the
  attribute, not the individual response, and lives in `attribute_scores`
  instead, because a single response can inform more than one psychometric
  attribute.

- **`attribute_scores`** — per-attempt, per-attribute `score` / `maxScore`.
  This is what the dashboard's per-attribute breakdown reads from, and
  what a future adaptive-scoring pass would recalibrate against.

- **`neon_auth.user`** — referenced, not created. Managed Better Auth owns
  this schema entirely (it also has `session`, `account`, `verification`,
  `organization`, `jwks`, and more — the full Better Auth table set).
  `attempts.user_id` is a genuine foreign key into it (`neon_auth.user.id`
  is a real `uuid` primary key, confirmed by querying the live branch
  before writing the schema, not assumed).

## The one mistake worth recording, because it would have been bad

`drizzle-kit generate` doesn't know `neon_auth.user` is externally owned —
it saw a table referenced in our schema file and generated
`CREATE TABLE "neon_auth"."user" (...)` for it, as a **one-column stub**,
in the same migration. Running that as-is would have collided with (or in
a worse ordering, clobbered) the real, eleven-column table Neon Auth
already manages. Caught this by reading the generated SQL before applying
it, not after. Fix: manually stripped the `CREATE TABLE "neon_auth"."user"`
statement from the generated `.sql` file before running `drizzle-kit
migrate`, keeping only the tables we actually own plus the foreign key
that references the real one. This is a one-time hand-edit per fresh
`generate` that touches this reference table — worth checking the diff
every time a future migration mentions `neon_auth`, not just this once.

## Verification

Ran against the live dev branch, not assumed from reading the SQL:

- `public` now has exactly `attempts`, `attribute_scores`, `questions`,
  `responses` — nothing else.
- The foreign key from `attempts.user_id` resolves to `neon_auth."user"`
  in `pg_constraint`, confirmed via a direct catalog query.
- `neon_auth.user` still has all 11 of its original columns — untouched.
- `length_tier = 15` is rejected by the database (`attempts_length_tier_check`).
- An attempt with neither `user_id` nor `anon_session_id` is rejected
  (`attempts_identity_check`).
- A valid anonymous attempt (`anon_session_id` only) inserts successfully.
- No real users exist in `neon_auth.user` yet (auth isn't wired up until
  Phase 2), so the actual claim-update (set `user_id`, clear
  `anon_session_id`) against a real user row is still open to verify --
  the constraint logic is confirmed, the live claim flow isn't yet.

## Open for Phase 2

- Wire Neon Auth (GitHub + Google) into the Astro app, register trusted
  domains for `localhost` and production.
- Build the actual claim flow: on sign-in, look up any `attempts` row
  matching the browser's `anon_session_id` cookie/value and run the claim
  update for real, against a real signed-in user.
- Decide where `anon_session_id` values come from on the client (a
  generated UUID set in a long-lived cookie on first visit, most likely)
  and how long an unclaimed anonymous attempt is allowed to live before
  it's eligible for cleanup.
