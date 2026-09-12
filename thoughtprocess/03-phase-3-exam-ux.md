# Phase 3: the real exam room

## What "matches the artifact" means here

The published Artifact mockup (purple/indigo theme, exam-navigation
sidebar, scenario/tools/constraints panels, timed progress, mark-for-review,
end-exam flow) was built around a **free-text prose answer** with a
rich-text toolbar, graded by an imagined LLM call. That was never the
mechanism we actually built and proved -- the real mechanism, proven in
Phase... (the `exam-preview` prototype), is Pyodide executing real Python
against a mock-tool harness, graded on the trace.

So "match the artifact" meant: keep its visual language (the chrome,
layout, colors, navigation, footer), and swap its answer panel for the real
one -- a dark code editor + live output + a grading checklist -- instead of
reverting to a prose box we know isn't the actual product. The result is a
light purple dashboard shell around a dark IDE-style panel, which is a
completely ordinary pairing (this is how every "coding exercise embedded in
a dashboard" product looks) rather than a compromise between two designs.

## What got built

- **A generic check DSL** (`src/lib/examChecks.ts`) instead of stored code:
  a question's rubric is data (`{ type: 'calledBefore', before, after,
  label }`, etc.), not a function. One interpreter runs every question's
  checks. Adding a new question is a data change; adding a new *kind* of
  check is a code change -- the right line to draw, matching how the
  content model already treats question `content` as schemaless JSON.
- **Three real, fully-working scenarios**, seeded via
  `src/db/seed-questions.ts`, deliberately chosen to exercise different
  check *shapes* rather than three variations on one shape:
  - Tool Use & Execution (order/refund) -- ordering + argument-matching
  - Constraint Handling (Slack digest) -- ordering across three tools
  - Guardrails & Safety (HR data request) -- a *restraint* check
    (correct answer is **not** calling a tool at all, not just calling
    the right ones in the right order)
- **The exam room itself** (`ExamRoom.tsx` + `exam-room.css`): length
  picker (10/30/50) → scenario/tools/constraints/answer workspace, matching
  the artifact's layout → results screen with a real per-attribute
  breakdown, not the mockup's illustrative one.
- **Three new API routes** wired to real Postgres:
  `POST /api/exam/attempts` (creates the attempt, selects up to
  `lengthTier` questions -- capped to what actually exists, see below),
  `POST /api/exam/attempts/:id/responses` (records each answer + trace as
  it happens, not batched at the end), `POST /api/exam/attempts/:id/complete`
  (aggregates responses into `attribute_scores`, marks the attempt
  completed).
- **`usePyodide`** (`src/lib/usePyodide.ts`): extracted the loader out of
  the original `PyodideExam.tsx` prototype into a shared hook so the real
  exam room doesn't duplicate it. Left the original prototype file as-is
  (it's done its job and still works) rather than retrofitting it to use
  the new hook -- not worth touching working, already-verified code for
  pure tidiness right now.

## The honest gap: only 3 questions exist

The product decision was 10/30/50-question tiers. We have 3 real,
hand-authored scenarios. `POST /api/exam/attempts` selects **up to**
`lengthTier`, capped to what's actually in the bank -- so picking "50
questions" today still gives you 3, all of them, once. This is the
scaling problem flagged all the way back in the original brainstorm: hand-authoring
enough unique, well-tested scenarios for real 10/30/50-length exams (times
however many of the 5 allowed attempts should feel different) is a real
content-authoring project, not a coding task, and it's the same argument
for eventually building the procedural flaw-generator instead of continuing
to hand-write every scenario. Not solved here -- correctly scoped as a
known gap, not silently papered over with fake variety.

**Scoring simplification worth naming**: a response's `is_correct` is a
single boolean (did the question's checks *all* pass), not a partial-credit
score, even though a question can have several checks. Each question
contributes one point to its attribute's total, all-or-nothing. Fine for a
first version and matches how the earlier multiple-choice quiz scored;
partial credit would need `responses` to carry a score instead of a
boolean, which is a schema change if it turns out to matter.

## Verified against the live dev branch, not just the UI

Ran the full loop for real (Playwright, headed through an actual browser,
not asserting HTML shape) and then queried Postgres directly afterward to
confirm the UI wasn't just displaying a plausible-looking lie:

- The attempt row: `length_tier=10`, `status='completed'`,
  `overall_score='100.00'`, a real `anon_session_id`, `user_id` correctly
  null (not signed in for this run).
- All three `responses` rows carry the **actual execution trace** Python
  produced for that run -- not a mock, not the request payload echoed
  back, the real `CALL_LOG` contents (e.g. the refund scenario's trace
  shows `get_order_status` → `check_refund_eligibility` → `issue_refund`
  with `amount: 84.5`, in that order, exactly as the starter code executes).
  Also ran a deliberately-wrong answer earlier for the refund scenario and
  confirmed the checks correctly failed the specific broken rule instead of
  failing everything or passing everything.
- `attribute_scores` shows one row per skill area, `1.00 / 1.00` each,
  matching a clean run through all three questions.
- Nav-dot states update correctly (`current` → `answered` after grading),
  mark-for-review toggles, Previous/Next/Finish all behave as the artifact
  specified.

## Open for Phase 4 (unchanged from the original plan)

- The anonymous/signed-in split: score-only + blurred dashboard for
  anonymous, full unblurred breakdown for signed-in. The results screen
  currently always shows the full breakdown regardless of auth state --
  that gating is real product behavior we designed and haven't wired in
  yet, not forgotten, just not in scope for "match the artifact's UX."
- The 5-attempt cap (signed-in only).
- Registering production domains with Neon Auth before deploy.
- GitHub OAuth app credentials (still pending, see Phase 2 doc).
- Homepage rebuild: video + this exam replacing the current 20-question quiz.
