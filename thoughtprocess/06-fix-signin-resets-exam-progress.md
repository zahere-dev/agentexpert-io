# Fix: signing in mid-exam looked like it reset to the homepage

## The report

"When I click on Gmail login after logging it takes me to the old home
page." Diagnosed by asking exactly what the address bar showed afterward
rather than guessing -- it was `http://localhost:4321/exam?neon_auth_session_verifier=...`,
i.e. the *correct* page, not a redirect bug.

## Root cause

Signing in is a real OAuth round trip: the browser navigates away to
Google's own domain and back. That's a genuine full-page reload, not a
client-side route change -- every bit of React state (`ExamRoom`'s
in-progress attempt, current question index, answers, marks) is wiped and
the component remounts from scratch, landing back on the picker/intro
screen. That's what read as "the old home page": not a routing bug, a
state-loss bug.

## A dead end worth recording, because it looked like the real bug at first

Initially suspected the `?neon_auth_session_verifier=...` query param meant
sign-in itself was failing to complete -- `@neondatabase/neon-js/auth`
seemed like a thin client with no handling for it. Traced it further:
`@neondatabase/neon-js/auth` is literally a re-export of `@neondatabase/auth`
(`export * from "@neondatabase/auth"`), and that package's `getSession()`
already has this verifier handling built into its fetch hooks
(`beforeFetch`/`onRequest`/`onSuccess` in `adapter-core-*.mjs`) --
it consumes the verifier on the next `getSession()` call and cleans the
URL via `history.replaceState` on success. This isn't Next.js-specific
middleware; it's baked into the browser client itself. So the sign-in
mechanism was very likely already correct, and chasing it further would
have been fixing a bug that wasn't there. Confirmed by reading the actual
package source rather than trusting an assumption from the file layout.

## The real fix: persist exam progress across the reload

New `src/lib/examSession.ts` -- `sessionStorage` (not `localStorage`,
deliberately: this should survive one reload/tab-lifetime, not linger into
an unrelated future visit) holding `attemptId`, `lengthTier`, the question
list, current index, `answered`, `marked`, and both question-types' answer
state (`reasoningAnswers`, `blockOrders`).

Three effects in `ExamRoom.tsx`:
1. On mount, check for a saved session; if present, restore all of it and
   jump straight to the `quiz` phase instead of the picker.
2. On every relevant state change while `phase === 'quiz'`, write the
   current state to `sessionStorage`.
3. Because Pyodide reboots from scratch on the reload too, a restored
   execution-type question needs its mock-tool harness reloaded once the
   runtime finishes booting (which may well be *after* the restore effect
   runs) -- a third effect watches `pyodideState` and reloads the current
   question's harness the moment it becomes `'ready'`.

Cleared on `endExam()`, since a completed attempt has nothing left to
resume.

**Known, accepted gap**: an in-progress, *unsaved* code edit on the
question you were actively looking at when you clicked sign-in isn't
preserved -- only responses that were already `Run`/saved are. Persisting
live draft code per question was judged not worth the complexity for what
is, after all, a browser-reload edge case, not the main flow.

## Verified

Couldn't complete a real Google login myself (needs a human + real
credentials), so verified the actual mechanism instead: answered question
1, moved to question 2, marked it for review, then simulated exactly what
an OAuth round trip does to the page -- navigated to `about:blank` and
back to `/exam` in the same tab (this is a faithful simulation:
`sessionStorage` is per-origin-per-tab and survives an intermediate
navigation to a different origin, exactly like the real trip to
accounts.google.com and back). After the reload: still on question 2,
question 1 still shows answered (green), the mark-for-review flag is
still set, and progress reads "Question 2 of 6" -- not reset to the
picker. No console errors.
