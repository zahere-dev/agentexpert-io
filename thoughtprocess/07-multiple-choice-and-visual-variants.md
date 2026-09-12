# A fourth question type: multiple choice, plain and visual

## What got added

One new `scenarioType: 'multipleChoice'`, but not a single rigid shape --
`MultipleChoiceContent` has an optional `visual` field that's either
absent (a plain knowledge-check MCQ), a `{ kind: 'diagram', svg }` (an
inline architecture diagram to read), or a `{ kind: 'trace', lines }` (a
pre-baked execution log to diagnose). One type, one rendering branch, three
concrete flavors -- rather than three separate scenario types for what's
fundamentally the same interaction (pick one option, get immediate
right/wrong feedback plus an explanation).

Three examples seeded, one per flavor:
- **Plain**: "What does grounding mean?" -- a straight knowledge check.
- **Diagram**: an inline SVG of a 3-agent customer-support architecture
  (Orchestrator → Research Agent / Refund Agent / Send Email), asking what
  the most concerning structural gap is. Deliberately drawn with *no*
  visual hint toward the answer -- every box the same neutral style -- so
  the question tests reading the flow's structure, not spotting a
  highlighted box.
- **Trace**: a genuinely new and, I think, the most interesting addition
  -- a pre-baked execution log (an inventory check repeated five times
  with an identical result before the agent gives up) and the question is
  to diagnose *why*, from reading the log alone. This is deliberately not
  the same skill as the 'execution' type: there, the candidate produces a
  trace by writing code; here, the agent has already run and failed, and
  the skill is reading and diagnosing a trace you didn't write. Both are
  real, distinct parts of working with agents, and worth testing
  separately.

## Why an inline SVG, not an uploaded image

No external asset pipeline needed, nothing to host, and it stays inside
the same `content` jsonb blob as everything else -- consistent with how
every other question type keeps its content self-contained and versioned
alongside the question itself, not referencing files that live elsewhere.

## Grading

Exact match against `correctIndex`, immediate feedback on click (options
lock after the first selection, correct option highlights green, an
incorrect selection highlights red alongside it, explanation always shows
regardless of whether the answer was right) -- same one-shot pattern as
block-arranger's "Check Order," and it counts toward the attribute score
like block-arranger does (unlike 'reasoning', there's no ambiguity to
defer to a future grader here).

## A real bug caught before shipping, not after

The trace-log renderer mapped `TraceLogLine.kind` to display style with a
ternary that put `"muted"` lines into the CSS `error` (red) class by
accident -- the final `notify_customer(...)` line in the seeded trace
example rendered in red, implying an error that wasn't there. Caught by
actually looking at the rendered screenshot rather than trusting that
"the test passed" (the Playwright run only checked the *grading* result,
which was unaffected by this purely visual bug). Fixed the mapping so only
genuine `"action"` lines get the bright/stdout treatment; `"observation"`
and `"muted"` both render dim. Worth remembering: an automated pass/fail
check on grading logic doesn't catch a misleading visual, only looking at
the actual pixels does.

## Verified

Full run through all 9 questions (now spanning all four scenario types),
each MCQ variant located and screenshotted at least once, correct answers
selected and confirmed to show "Correct!" with the right explanation, no
console errors. Fixed the trace-color bug and re-verified visually before
committing.
