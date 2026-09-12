# Phase 2: auth + the claim flow

## The architectural decision this phase turns on

Neon Auth's own docs default to same-origin, cookie-based sessions (the
Next.js server SDK reads a session cookie set on your app's own domain).
That doesn't fit here: our app runs on `agentexpert.io` / Vercel, and
Neon's managed auth server runs on its own `*.neon.tech` host. A cookie set
on the auth domain is invisible to our own server.

Neon's docs name this exact situation -- "separate frontend and backend
domains" -- as the intended use case for their **JWT plugin**, not the
default cookie flow. So: the client calls `authClient.token()` to get a
short-lived signed JWT, sends it as a bearer token to our own API routes,
and our server verifies it independently against Neon Auth's public JWKS
(`jose` + `createRemoteJWKSet`) rather than trusting anything the client
asserts about who it is. This is the documented pattern for this setup,
not a workaround.

## What got built

- `src/lib/authClient.ts` -- the browser-side client
  (`@neondatabase/neon-js/auth`), `credentials: 'include'` so session
  requests actually cross the origin boundary.
- `src/lib/verifyAuthToken.ts` -- server-side JWT verification. Throws on
  anything invalid; never trusts a client-supplied user id.
- `src/lib/anonSession.ts` -- a per-browser UUID in `localStorage`, created
  on first use. This is the thing an anonymous attempt is tied to before
  anyone signs in, and the thing sent back at claim time to find it again.
- `src/components/AuthPanel.tsx` -- Google/GitHub buttons when signed out;
  identity + sign-out when signed in. On mount, if a session already
  exists, it calls the claim endpoint automatically -- claiming isn't a
  separate user action, it just happens the moment a session is detected.
- `src/pages/api/attempts/claim.ts` -- verifies the bearer JWT first
  (fails closed on anything invalid, before even looking at the request
  body), then runs a single scoped update: claim only attempts matching
  *this* anonymous session id that aren't *already* claimed. That second
  condition matters -- it's what stops a stale or shared anon-session
  value from ever hijacking an attempt that already belongs to someone.

## Domains

Registered `http://localhost:4321` (Astro's dev port) as a trusted domain
on the `agent-architect-exam` Neon branch via `neon neon-auth domain add`,
plus `allow-localhost`. **Production domains still need registering before
deploy** -- this is the "invalid domain" gotcha the Neon skill docs call
out explicitly: sign-in silently fails with a redirect error on any origin
that isn't on the trusted list, so agentexpert.io's real domain(s) need
adding before this goes live, not after something breaks.

## Providers: one works today, one needs real credentials

- **Google** works right now with Neon's shared development credentials --
  no setup needed to test locally.
- **GitHub** needs a real GitHub OAuth App (client id + secret), registered
  against this Neon branch with `neon neon-auth oauth-provider add`. Not
  done yet -- clicking "Sign in with GitHub" today will reach Neon's OAuth
  proxy and fail there until real credentials exist. Needs a GitHub OAuth
  App created (callback URL: `{NEON_AUTH_BASE_URL}/callback/github`) with
  access to a real GitHub account, which isn't something to do
  unilaterally.

## Verified

- The Google sign-in button, clicked in a real browser, lands on a genuine
  Google OAuth consent screen with the correct `redirect_uri` pointing at
  Neon's callback -- the client-side half of the flow is provably correct.
- `POST /api/attempts/claim` returns 401 for a missing bearer token, an
  invalid/garbage token, and a well-formed token-shaped string that still
  fails signature verification -- the auth guard runs and rejects before
  the request body is even parsed.
- The underlying claim `UPDATE` (match on `anon_session_id`, only where
  `user_id is null`) was already proven correct against the live branch in
  Phase 1.

**Not yet verified**: the full happy path end-to-end (real human sign-in →
session appears → claim fires → a real anonymous attempt's `user_id`
actually flips). Completing a real Google login requires a human in the
loop (consent screen, possibly 2FA) -- next step is to actually do that in
a browser and confirm an anonymous attempt gets claimed for real.

## Open for Phase 3

- Register agentexpert.io's real domain(s) as trusted before any
  production deploy.
- Create a GitHub OAuth App and register its credentials on this branch.
- Do the real end-to-end human sign-in test.
- Build the actual exam UX: length picker, question flow, anonymous
  score-only view, blurred dashboard, unblur + attribute breakdown once
  signed in, the 5-attempt cap (signed-in attempts only).
