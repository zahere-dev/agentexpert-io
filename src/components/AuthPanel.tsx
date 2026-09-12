import { useEffect, useState } from "react";
import "./auth-panel.css";
import { authClient } from "../lib/authClient";
import { getAnonSessionId } from "../lib/anonSession";

interface SessionUser {
  email: string;
  name: string;
}

export default function AuthPanel() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<"google" | "github" | null>(null);

  useEffect(() => {
    let cancelled = false;

    authClient.getSession().then(async (result) => {
      if (cancelled) return;
      const sessionUser = result.data?.user ?? null;
      setUser(sessionUser);
      setLoading(false);

      if (sessionUser) {
        await claimAnonymousAttempt();
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function claimAnonymousAttempt() {
    try {
      const { data, error } = await authClient.token();
      if (error || !data?.token) return;

      await fetch("/api/attempts/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.token}`,
        },
        body: JSON.stringify({ anonSessionId: getAnonSessionId() }),
      });
    } catch (err) {
      // Non-fatal: worst case, an anonymous attempt just stays unclaimed.
      console.error("Failed to claim anonymous attempt:", err);
    }
  }

  async function signIn(provider: "google" | "github") {
    setPending(provider);
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: window.location.href,
      });
    } catch (err) {
      console.error(`${provider} sign-in failed:`, err);
      setPending(null);
    }
  }

  async function signOut() {
    await authClient.signOut();
    setUser(null);
  }

  if (loading) {
    return <div className="auth-loading">Checking sign-in status…</div>;
  }

  if (user) {
    return (
      <div className="auth-session">
        <span>
          Signed in as <strong>{user.name || user.email}</strong>
        </span>
        <button className="auth-signout" onClick={signOut}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="auth-panel">
      <div className="auth-buttons">
        <button className="auth-btn" onClick={() => signIn("google")} disabled={pending !== null}>
          <svg viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {pending === "google" ? "Redirecting…" : "Sign in with Google"}
        </button>
        <button className="auth-btn" onClick={() => signIn("github")} disabled={pending !== null}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.79-.25.79-.55 0-.27-.01-1-.02-1.96-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.8 1.18 1.83 1.18 3.09 0 4.42-2.69 5.4-5.25 5.68.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.66.8.55C20.21 21.38 23.5 17.08 23.5 12c0-6.35-5.15-11.5-11.5-11.5z" />
          </svg>
          {pending === "github" ? "Redirecting…" : "Sign in with GitHub"}
        </button>
      </div>
    </div>
  );
}
