# The home page is now the exam

Closes the original ask from way back in [00-vision-and-decisions.md](./00-vision-and-decisions.md):
"replace the current home page with an agent architect exam."

## What changed

`/` used to render `AgentQuiz.tsx` — an earlier, simpler 20-question
level/category quiz built before the Neon-backed exam existed, with its own
lead-capture endpoint (`/api/quiz-lead`). `/exam` was the real, full-screen,
auth-gated exam built in phases 3 through 8. Now `/` renders `ExamRoom`
directly (the same full-screen layout `/exam` used), and `/exam` 301-redirects
to `/` in case it's bookmarked or linked anywhere.

`AgentQuiz.tsx`, `agent-quiz.css`, and `api/quiz-lead.ts` were deleted rather
than left in place — nothing else referenced them (checked with grep before
deleting), and keeping a dead, unlinked quiz mechanism around next to the
real one is exactly the kind of half-finished duplication worth avoiding.

## The video

The product spec calls for "a video about the tool and the features" on the
home page. There's no video yet — rather than guess a YouTube URL or fabricate
a placeholder asset, the picker screen (the exam's landing state, i.e. what
anyone hits at `/` before starting) now has a clearly-labeled dashed-border
placeholder block above the title where the real video will go. Swapping it
for a real `<iframe>` embed later is a one-line change in `ExamRoom.tsx`'s
picker JSX.

## Site navigation didn't disappear

The old home page had a footer linking to `/downloads`, the YouTube channel,
and the newsletter — the only way to reach `/downloads` from anywhere on the
site (confirmed by grep: nothing else links to it except a 404 page's "back
to homepage" link). Losing that would've orphaned a real page. Rather than
attach a persistent site-wide footer (which would fight the exam's genuine
full-screen requirement during the quiz/results phases), the same three links
now live under the Start button on the picker screen only — visible exactly
where the old footer was, gone once you're actually taking the exam.

## Verified

Dev server restarted, curled `/exam` (301 → `/`, confirmed via `curl -I`),
and loaded `/` in a real headless browser: picker renders with the video
placeholder, title/description, length-tier buttons, Start button, and the
Downloads/YouTube/Newsletter row, zero console errors. Screenshot taken and
reviewed before calling this done.
