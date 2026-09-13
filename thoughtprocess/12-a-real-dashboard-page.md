# A real, persistent `/dashboard`

The user asked "Where is the dashboard?" -- the honest answer was that
"dashboard" in every prior doc and in the product vision meant the post-exam
results screen (score ring + attribute breakdown), not a page you can
navigate back to later. There was no persistent view of progress across
multiple attempts. This phase builds that: a real `/dashboard` page.

## What it shows

For a signed-in user with at least one completed attempt:

- **Score over time** -- a bar per completed attempt, oldest to newest,
  colored by band (red under 50%, purple 50-74%, green 75%+).
- **Areas to improve** -- per-attribute performance aggregated across *all*
  completed attempts, worst attribute first. Deliberately summed
  (`sum(correct) / sum(max)` across every attempt) rather than averaged
  per-attempt percentages, since a single attempt's per-attribute sample is
  small (often 1-2 questions per attribute) and noisy -- aggregating is the
  more stable signal someone would actually act on.
- **Attempt history** -- a simple table: date, length tier, score.
- The 5-attempt cap usage ("3 of 5 attempts used"), reusing the same
  `countSignedInAttempts()` from
  [08-results-gating-and-attempt-cap.md](./08-results-gating-and-attempt-cap.md).

A signed-out visitor sees a short prompt and the same `AuthPanel` sign-in
buttons used everywhere else -- no data leaves the server until there's a
valid token, same principle as the results-gating work.

## Where it lives, and how it's reached

`/dashboard` (`src/pages/dashboard.astro` → `src/components/Dashboard.tsx`),
backed by one new endpoint, `GET /api/exam/me/dashboard`, and one new data
reader, `src/lib/dashboardData.ts::getDashboardData()`, which does the
aggregation in SQL (a `group by` on `attribute_scores.psychometric_attribute`
joined to the user's completed `attempts`) rather than pulling every row and
summing in JS.

It's not part of the exam's full-screen app shell -- this is a page you
revisit outside of taking an exam, so it gets its own `dashboard.css` with
the same purple palette as `exam-room.css` (copied, not shared, since the
exam's variables are scoped under `.exam-room` and this page isn't one) but
a normal scrollable layout instead of the exam's `overflow: hidden` viewport
lock.

Linked from two places once signed in: the picker screen's footer (next to
Downloads/YouTube/Newsletter, gated on `attemptCount !== null` as a proxy for
"we know this person is signed in," reusing the effect that was already
fetching attempt counts there), and a "See your full progress across
attempts" line under a *full* (non-blurred) results screen.

## Verified

Signed-out state: real headless browser load of `/dashboard`, confirmed
`AuthPanel` renders with no console errors, and `GET /api/exam/me/dashboard`
returns `401 Unauthorized` via curl with no token.

Signed-in populated state was harder to verify honestly. Mocking Better
Auth's client-side network calls (`get-session`, then the JWT `token()` call)
turned out not to be enough -- `get-session` could be faked directly (its
response shape is just `{user, session}`, not the `{data, error}` envelope
the client wraps it in), but `token()` never fired a request at all when
mocked this way, meaning it depends on internal client state beyond a single
network response. Rather than sink more time into faking Better Auth's
internals, the actual JSX was verified directly: a temporary `?__previewData`
query-param branch was added to `Dashboard.tsx` that short-circuits straight
to hardcoded sample data (three attempts, three attributes), screenshotted
in a real browser, then the branch was deleted before committing (confirmed
gone via `grep`). This is the same category of workaround as the 5-attempt
cap's testing gap in phase 08 -- a real constraint (can't script a real
OAuth login, can't easily fake this client's internals either) worked around
by testing the actual rendering logic directly instead of pretending it was
fully exercised end-to-end.

One thing that screenshot caught: the first pass at the sample data was
listed oldest-first, and the component's `.reverse()` (which assumes the API
gives newest-first, matching the real `orderBy(desc(completedAt))` query)
turned it backwards -- Sep 5 on the left, Aug 20 on the right. That was a
mistake in the *test data*, not the component, caught by actually looking at
the chart rather than trusting the reverse() call was obviously correct;
re-ordering the mock to match the real API's actual contract (newest-first)
confirmed the chart renders chronologically left-to-right as intended.
