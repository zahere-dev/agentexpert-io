# A third question format: block arranger

## Why a third format, not a variant of the other two

Some scenarios are neither "run code and check the trace" nor "write prose
and self-assess" -- they're "put these in the right order," which is
exact-match checkable (no LLM jury needed, unlike reasoning) but has no
code to run and no tool trace (unlike execution). Forcing an ordering
question into either existing format would be dishonest: prose grading
would lose the fact that this is objectively checkable, and there's no
mock-tool harness that makes sense for "sequence these five steps."

The example seeded: **arrange the ReAct loop itself** (receive the goal →
reason → act → observe → decide) -- a nice fit, since it's the exact
reasoning pattern the whole exam concept is built around.

## Design

`BlockArrangerContent` (`examTypes.ts`): `instructions`, a set of `blocks`
(id/label/description), and `correctOrder` (an array of block ids). Grading
is exact array equality against `correctOrder` -- no partial credit for
"3 of 5 in the right position," matching the same all-or-nothing choice
already made for execution questions.

**Interaction**: real HTML5 drag-and-drop (drag handle, `draggable`,
`onDragStart`/`onDragOver`/`onDrop`) *plus* up/down arrow buttons on every
block. The buttons aren't a fallback bolted on for accessibility alone --
they're also what makes this reliably testable (a Playwright script can't
easily simulate a real drag gesture, but clicking a button is trivial), and
they're a completely normal pattern in real reorderable-list UIs. Built
both from the start rather than shipping drag-only and adding buttons later.

**Shuffle-once, not shuffle-per-render**: the initial order is generated
once when a block-arranger question first loads and stored in
`blockOrders` state, not regenerated on every re-render -- otherwise
navigating away and back (or any parent re-render) would scramble the
candidate's in-progress arrangement.

## Where it plugs into the existing structure

- `questions.content` gets a third shape; `scenarioType` gets a third value
  (`'blockArranger'`). No schema migration needed -- `content` is already
  jsonb, `scenarioType` is already a free-text column, not an enum
  constrained at the DB level.
- The scenario pane's "Agent's Available Tools" / "Important Constraints" /
  "What You Need to Do" cards don't apply here (arrangement questions have
  no tools or constraints) -- swapped for a single "Instructions" card.
  This also exposed that those three cards were previously reading
  `question.content.tools` etc. unconditionally, which would have thrown
  on any content shape that doesn't have them -- worth having caught now,
  before a fourth format makes the same mistake easier to miss.
- Grading result reuses the same `.exam-check-item` / pass-fail icon
  pattern as execution questions' checks list, so the visual language
  stays consistent across all three formats rather than inventing a new
  result style per type.
- `isCorrect` is a real boolean here (unlike reasoning's `null`) --
  block-arranger responses *do* count toward the attribute score.

## Verified

Real browser run: question loads with blocks in shuffled order (confirmed
different from `correctOrder`), "Check Order" correctly reports failure on
the shuffled arrangement, using only the up/down buttons to reorder into
the correct sequence, then "Check Order" correctly reports success -- no
console errors throughout.
