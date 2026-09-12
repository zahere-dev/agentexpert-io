# Thought Process

A running record of the decisions behind the Agent Architect Exam — not what
the code does (the code says that), but *why* it's shaped this way, what was
considered and rejected, and what's still open. Written as we go, not
reconstructed after the fact.

## Index

- [00-vision-and-decisions.md](./00-vision-and-decisions.md) — the full
  product direction as decided before any of this code existed: why this
  exists, what was rejected (B2B platform, Convex, mandatory upfront auth),
  and the product model we're actually building toward.
- [01-phase-1-schema.md](./01-phase-1-schema.md) — the data model: why
  `attempts.user_id` is nullable, how anonymous attempts get claimed on
  sign-in, and the schema itself.
- [02-phase-2-auth-and-claim.md](./02-phase-2-auth-and-claim.md) — Neon
  Auth wired up (Google working today, GitHub pending real OAuth app
  credentials), why this had to be JWT-based rather than cookie-based, and
  the claim flow that connects an anonymous attempt to a real account.
- [03-phase-3-exam-ux.md](./03-phase-3-exam-ux.md) — the real exam room:
  the artifact's visual design paired with the actual working mechanism
  (Pyodide execution + trace grading, not the mockup's prose answer), a
  generic check DSL instead of stored code, and the honest gap that only
  3 real questions exist against a 10/30/50-question product decision.
- [04-fullscreen-and-mixed-question-types.md](./04-fullscreen-and-mixed-question-types.md) —
  true full-screen app layout, written-answer questions alongside the
  code simulator for scenarios that aren't a tool-call sequence, and a
  real double-save bug this surfaced (fixed with a DB-level unique
  constraint + upsert, not just a client-side patch).
- [05-block-arranger-question-type.md](./05-block-arranger-question-type.md) —
  a third question format for "put these in the right order" scenarios
  (e.g. the ReAct loop) — exact-match auto-gradable, drag-and-drop plus
  up/down buttons, no code and no prose involved.
- [06-fix-signin-resets-exam-progress.md](./06-fix-signin-resets-exam-progress.md) —
  why signing in mid-exam looked like it reset to the homepage (a real
  full-page reload wiping React state, not a routing bug), a dead end
  worth recording (the session-verifier param turned out to already be
  handled), and the sessionStorage-based fix that resumes progress.
- [07-multiple-choice-and-visual-variants.md](./07-multiple-choice-and-visual-variants.md) —
  a fourth question type covering plain MCQ, an inline-SVG diagram
  variant, and a pre-baked execution-log variant for diagnosing a trace
  you didn't write yourself — plus a real color-mapping bug caught by
  actually looking at the render, not just the grading logic.

New entries get added as `NN-short-name.md`, numbered in the order decisions
were made. Don't edit old entries to reflect later reversals — add a new
entry that supersedes it and say so; the history of *changing your mind* is
part of what this folder is for.
