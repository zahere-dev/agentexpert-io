# Real bug: "starter" code was the answer key

Caught directly by the user looking at a screenshot: every execution
question's editor loaded pre-filled with the fully worked solution, not a
skeleton. Clicking Run with zero edits passed the question outright. This
existed since the very first three questions in
[03-phase-3-exam-ux.md](./03-phase-3-exam-ux.md) and was copied unquestioned
into all 10 questions added in
[10-second-batch-of-execution-scenarios.md](./10-second-batch-of-execution-scenarios.md) --
13 questions, every one of them gradable without writing a line of code.

## Root cause

`starterCode` is loaded verbatim into the editor
(`src/components/ExamRoom.tsx:243`, `setCode(content.starterCode)`) as the
candidate's starting point. Every seed question's `starterCode` was written
as a demonstration of the correct tool-call sequence -- useful while building
and testing the check DSL itself (you want to see a passing run while
authoring a question), but never swapped out for a genuine blank skeleton
before shipping. The content authoring process had no explicit distinction
between "the reference solution used to validate the checks" and "what the
candidate actually sees" -- they were the same string.

## The fix

All 13 execution questions' `starterCode` in `seed-questions.ts` now keep
only the leading comment restating the task (plus, where the request itself
hands the candidate a literal piece of data to work with -- like the
malformed email address or the raw bug report text -- that data stays, since
typing it back in isn't the skill being tested) and drop every line that
actually calls a tool or branches on a result. The scenario/tools/constraints
panel already gives the candidate everything they need to write the real
answer themselves.

`seed-questions.ts`'s sync logic also changed: it previously only inserted
questions with a new label and silently skipped anything that already
existed (`insertIfNew`), which is exactly why this bug survived past
`npx tsx src/db/seed-questions.ts` being re-run in phase 10 -- the fix
wouldn't have reached the database with that behavior. `upsertByLabel`
now updates an existing question's content to match the file, since this
question bank is still being tuned and content is the source of truth to
sync toward, not a one-time seed.

## Verified

Ran the updated `seed-questions.ts` against the dev database -- confirmed
all 19 questions (13 execution, 6 other types) synced with an `Updated:`
line for each, not `Skipped`. Then in a real headless browser: loaded
question 1, read the editor's actual content (only the two-line comment,
confirmed by printing the textarea's value), clicked Run with no edits, and
screenshotted the grading result -- **0 of 5 checks passed**. Previously
this same action would have shown 5 of 5 passed, since the "starter" was the
full solution.
