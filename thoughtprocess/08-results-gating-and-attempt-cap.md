# Anonymous results gating + the 5-attempt cap, for real

Turning "a nice exam" back into the free-tier product actually designed in
[00-vision-and-decisions.md](./00-vision-and-decisions.md): anonymous takers
see a score only, signed-in takers see the full breakdown, and signed-in
takers get at most 5 attempts.

## The real design decision: minimize on the server, don't blur on the client

The obvious-looking approach is to send the full result to the browser and
apply CSS blur to hide it. That's not a gate, it's a suggestion — anyone
opening devtools' network tab reads the real numbers straight out of the
response body. If this is meant to be the thing that makes signing up worth
it, the boundary has to be where the data leaves the server, not where it's
painted on screen.

So `POST /api/exam/attempts/:id/complete` still computes and stores the full
per-attribute `attribute_scores` row in the DB unconditionally (nothing about
grading changes) — but the JSON it *returns* is shaped by whether the caller
presents a valid auth token. Anonymous callers get attribute names and each
attribute's question count, but never `correct` or `percent`. There's no real
percentage to leak, so the client can't blur a true number — it renders a
fixed, fake-width bar instead (currently 60%, deliberately not derived from
anything real) purely as a visual "there's something here" cue.

Both `complete.ts` (the initial grading response) and the new
`GET /api/exam/attempts/:id/results` (fetched after sign-in, ownership-checked
against `attempts.user_id`) read through one shared function,
`readAttemptResults(attemptId, full)` in `src/lib/examResults.ts`, so the
full/minimal shape logic exists in exactly one place instead of drifting
between two endpoints that happen to return similar JSON.

## Persisting through the results phase, not just the quiz

[06](./06-fix-signin-resets-exam-progress.md) already solved "OAuth is a real
page reload that wipes React state" for the in-progress quiz. The same
problem exists on the results screen: an anonymous user finishes the exam,
sees the blurred teaser, clicks sign in, and the reload would previously drop
them straight back to the picker with the finished attempt orphaned in
`sessionStorage`-less limbo.

Extended `examSession.ts`'s saved shape with a `phase: 'quiz' | 'results'`
tag and an optional `results` snapshot; the restore-on-mount effect in
`ExamRoom.tsx` now lands on whichever phase was saved. A new effect fires
once restored into `results` phase with a non-full result: it checks for a
session via `authClient.getSession()`, and if one exists, fetches
`/api/exam/attempts/:id/results` with the JWT and swaps in the full result —
so the unblur happens automatically the moment the reload completes, no
extra click needed. `endExam()` no longer clears the session immediately on
completion (it used to); it's cleared only when a *new* attempt starts, since
an already-signed-in user finishing an exam sends the auth header on
`complete.ts` directly and gets the full result in one round trip, while an
anonymous user needs the saved attempt id to survive until they sign in.

## The 5-attempt cap

`src/lib/attemptLimit.ts` — `countSignedInAttempts(userId)` counts rows in
`attempts` by `user_id` (signed-in attempts only; anonymous attempts were
deliberately never meant to count against this, per the original "up to 5
tests" spec, which was about accounts, not devices). `POST /api/exam/attempts`
checks this against `MAX_SIGNED_IN_ATTEMPTS = 5` right after the existing
anon-session validation and before question selection, returning
`403 { error: 'attempt_limit_reached', used, limit }` when exhausted.
`GET /api/exam/me/attempt-count` exposes the same count so the picker screen
can show "3 of 5 attempts used" and disable Start before the user hits the
403 at all.

## Verified

**Anonymous gating**, end to end with a real browser: Playwright completed a
full 9-question anonymous exam, screenshotted the results screen
(`.exam-results-blurred` applied, attribute rows reading `?? / 1` instead of
a real percent, `.exam-blur-overlay` showing "Sign in to see your full
breakdown by skill area and what to work on next." with working Google/GitHub
buttons, real overall score "43%" still shown since that part is intentionally
not gated). Confirmed via curl that both `GET /api/exam/attempts/:id/results`
and `GET /api/exam/me/attempt-count` return `401 { error: 'Unauthorized' }`
for missing or garbage bearer tokens — the gate rejects at the HTTP layer,
not just in the UI.

**The attempt cap has an honest gap.** A real Neon Auth JWT is signed with a
private key only Neon holds — there's no way to fabricate a valid one from
outside to drive a true end-to-end test of "the 6th `POST /api/exam/attempts`
call gets a 403." What *was* verified: the 401-rejection path for bad/missing
tokens (above, shared code path with the cap check), and the cap's actual
business logic in isolation — created a synthetic user directly in
`neon_auth.user` with 5 fake completed `attempts` rows, called
`countSignedInAttempts()` directly against that user id (bypassing the JWT
layer entirely, which is already proven separately), and confirmed it
returns `5`, correctly triggering the `>= MAX_SIGNED_IN_ATTEMPTS` block. Test
data was deleted afterward — nothing synthetic left in the dev branch. The
remaining gap is real human OAuth login plus 6 real attempts, which needs a
live browser session against real Google credentials and hasn't been done.

## Bonus fix while testing

Astro's CSRF protection rejects a bare `curl -X POST` to any API route with
"Cross-site POST form submissions are forbidden" (403) because curl sends no
`Origin` header by default — not a bug in this code, just something to know
when testing API routes by hand: add `-H "Origin: http://localhost:4321"`.
