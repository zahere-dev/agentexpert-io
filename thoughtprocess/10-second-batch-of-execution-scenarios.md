# Ten more execution scenarios, weighted toward failure modes

Grows the question bank from 9 to 19, closing part of the honest gap flagged
back in [03-phase-3-exam-ux.md](./03-phase-3-exam-ux.md) (only 3 real
questions against a 10/30/50-question product decision) and acting on the
standing feedback that maintaining agents -- not building them -- is where
the real difficulty lives.

## What got added, and why these ten

All ten are `execution` type (Pyodide + trace grading, same mechanism as the
original three), deliberately *not* three more variations on "call tools in
the right order for a normal request." Each one is built around a distinct
failure mode instead:

- **Retry a flaky shipping-label service** (Debugging & Resilience) -- a
  transient timeout that succeeds on retry; tests retrying once instead of
  giving up, and not escalating a problem the retry already fixed.
- **Don't resend a welcome email on a replayed webhook** (Idempotency &
  Safety) -- a duplicate event; tests checking state before acting instead
  of acting blind.
- **A non-admin asks the ops agent to delete an account** (Authorization &
  Access Control) -- a permission boundary; tests checking authorization
  before a destructive action, and denying clearly rather than silently.
- **Check quota before an expensive re-embedding job** (Cost Awareness) --
  tests checking a budget/limit before triggering something costly.
- **A malformed email address in a calendar invite request** (Input
  Validation) -- tests validating input before it reaches a downstream tool,
  and asking rather than guessing a fix.
- **Booking a 1:1 that's already taken** (Scheduling & Coordination) --
  tests checking availability before booking, and proposing an alternative
  instead of silently failing.
- **Filing a bug report without leaking a customer's email** (Privacy &
  Compliance) -- tests redacting PII before it crosses a trust boundary
  (an external tool), not after.
- **"The export button is broken" -- diagnose before acting** (Debugging &
  Troubleshooting) -- the closest one to a "maintaining agents" question
  directly: logs point to a code bug, not an outage, so the correct move is
  *not* the heavy hammer (restarting a service) despite that tool being
  available and tempting.
- **Primary payment provider is down -- fall back correctly** (Error
  Handling & Resilience) -- tests trying the primary first and falling back
  only after a real failure, not skipping straight to the backup.
- **A webpage tries to smuggle in an instruction** (Guardrails & Safety) --
  a prompt-injection scenario: a tool's *returned content* contains an
  embedded `[SYSTEM: ...]` directive trying to get the agent to email
  results externally. Tests treating tool output as data, not as new
  instructions -- a genuinely current agent-security failure mode, not a
  contrived one.

## A real gap this surfaced in the seed script itself

The original `seed-questions.ts` unconditionally inserted every question in
every array on every run -- fine when it only ever ran once, but re-running
it to add this batch would have duplicated the existing 9. Rather than write
a one-off script for just the new batch (which would've left the seeding
story inconsistent for whoever adds question #30), `main()` now checks by
`label` before each insert (`insertIfNew()`), skipping anything already
present. Labels aren't a DB-level unique constraint -- deliberately, per the
original schema doc, since question content iterates faster than that's
worth enforcing -- so this is an application-level safeguard, not a
database one. Running it now safely no-ops on all 9 existing questions and
inserts only the 10 new ones; the next batch gets to do the same.

## Verified

Two layers, not just one:

1. **Logical correctness of every new question's own model solution.** Wrote
   a script that pulls each new question's stored `harnessSource` +
   `starterCode` from Postgres, runs them for real through `python3` (the
   same CPython Pyodide runs via WASM), captures the resulting `CALL_LOG`,
   and re-runs it through a JS port of the actual `runChecks()` interpreter
   from `examChecks.ts`. All 10 questions' starter/model solutions pass
   100% of their own checks -- this catches a wrong `argEquals` value or an
   impossible check combination before a real user ever hits it, which
   eyeballing the JSON would not have caught reliably.
2. **Real UI rendering**, with a headless browser: started a 50-question
   attempt (the bank only has 19 total, so it correctly serves all of
   them -- confirmed via the "Question 1 of 19" header), clicked through
   until hitting one of the new scenarios by its actual on-screen content
   (question `label` is an internal/admin field and isn't rendered to the
   user -- only `content.request` is, which is what the check had to match
   on), and screenshotted it: scenario, tools, constraints, "what you need
   to do," skill area, and difficulty all render correctly through the
   existing execution-question panel with no code changes needed.
