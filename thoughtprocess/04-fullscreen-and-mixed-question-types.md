# Full-screen app + reasoning questions alongside the simulator

## Two changes, one message

1. **True full-screen app**, matching the published artifact -- not a card
   floating in a normally-scrolling page.
2. **The code simulator doesn't fit every skill area.** System design and
   multi-agent coordination questions are about a design decision, not a
   tool-call sequence -- there's no honest mock-tool harness to build for
   "how would you split responsibility across three specialists." Those
   stay as written-answer questions using the *original* mockup's format
   (light editor, formatting toolbar, "What a Great Answer Looks Like",
   sample-answer self-assessment), while tool-use/constraint/guardrail
   questions keep the real Pyodide simulator. One exam, two question
   formats, chosen per question by what's actually being tested.

## Full-screen: the mechanics

`html, body { height: 100%; overflow: hidden }` plus `.exam-room { height:
100% }` with the topbar/footer at `flex: 0 0 auto` and the workspace at
`flex: 1 1 auto; min-height: 0` -- standard app-shell flex layout. The one
non-obvious part: Astro's `client:only` wrapper renders as a real DOM
element (`<astro-island>`), which by default doesn't stretch to fill a flex
parent -- it needed its own `flex: 1 1 auto; display: flex; flex-direction:
column` or the whole chain collapses to content height and you get a
short exam room on a mostly-empty page instead of a real full-screen app.
Verified by comparing `.exam-room`'s bounding box to `window.innerHeight`
directly in a real browser, not just eyeballing a screenshot -- they match
exactly.

## The `ReasoningContent` type and why it's not auto-graded

`questions.content` now has two shapes (`ExecutionContent` |
`ReasoningContent`), same table, same jsonb column -- `scenarioType`
decides which one the client renders and which panel it gets. A reasoning
answer is recorded (`responses.answer` = the written text) with `trace =
null` and `isCorrect = null`. `isCorrect = null` isn't "wrong" or "not yet
run" -- it means *no grader exists yet* for this type, and `complete.ts`
treats it accordingly: excluded from the attribute score entirely rather
than silently counted as a failure, with the results screen naming how
many written responses were "recorded and queued for rubric review" --
reusing the original exam mockup's own framing for exactly this situation,
because auto-grading free text is the LLM-jury layer from the original
design doc, deliberately still deferred.

## A real bug this surfaced, not just a UI gap

Wiring up `onBlur` on the reasoning textarea (to save as you navigate away)
alongside the existing `goTo()`-triggered save meant **the same answer got
written twice** -- clicking "Next Question" blurs the focused textarea
(triggering one save) and then `goTo` fires its own save on top. Caught
this because the results screen's "queued for rubric review" count came
back as 4 when only 2 reasoning questions existed in a 5-question attempt.

This wasn't just a reasoning-panel bug -- the same flaw existed for
execution questions too: clicking **Run** more than once on the same
question would have inserted a new `responses` row each time rather than
overwriting, silently double-counting that question in `complete.ts`'s
aggregation. Fixed at the schema level, not just patched in the handler:
added `responses_attempt_question_unique` (a unique index on
`(attempt_id, question_id)`), migrated it onto the dev branch, and changed
the responses route from a blind `insert` to `insert ... onConflictDoUpdate`.
A candidate can now re-run code or re-save a written answer any number of
times and it always overwrites the same row -- the database itself
prevents the double-count, not just the client's intent to avoid it.

Migrating that unique constraint onto a branch that already had duplicate
test data from the bug failed silently on the first attempt (Postgres
rejected the `CREATE UNIQUE INDEX`, `drizzle-kit migrate` didn't surface it
clearly) -- caught by directly querying `pg_indexes` afterward instead of
trusting the CLI's exit output, found the index was never created, cleared
the dev branch's test attempts, and reapplied. Worth remembering: after any
migration that adds a constraint, verify the constraint actually exists
before trusting that "no error printed" meant "it worked."

## Verified

Full loop end-to-end again after the fix, in a real browser: 5 questions
(3 execution, 2 reasoning) in a single attempt, all five nav-dot states
correct, sample-answer toggle works, results screen shows the right
ungraded count (2, not 4), and a direct Postgres query confirms zero
duplicate `(attempt_id, question_id)` pairs exist.
