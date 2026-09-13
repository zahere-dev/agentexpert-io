import { useEffect, useState } from "react";
import "./dashboard.css";
import { authClient } from "../lib/authClient";
import AuthPanel from "./AuthPanel";

interface SessionUser {
  email: string;
  name: string;
}

interface AttemptRow {
  id: string;
  lengthTier: number;
  overallPercent: number;
  completedAt: string;
}

interface AttributeRow {
  attribute: string;
  correct: number;
  total: number;
  percent: number;
}

interface DashboardPayload {
  attempts: AttemptRow[];
  attributeBreakdown: AttributeRow[];
  attemptCount: { used: number; limit: number };
}

function scoreColor(percent: number): string {
  if (percent >= 75) return "var(--ax-success)";
  if (percent >= 50) return "var(--ax-accent)";
  return "var(--ax-danger)";
}

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Dashboard() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    authClient.getSession().then(async (session) => {
      if (cancelled) return;
      const sessionUser = session.data?.user ?? null;
      setUser(sessionUser);
      if (!sessionUser) {
        setLoading(false);
        return;
      }
      const { data: tokenData } = await authClient.token();
      if (!tokenData?.token) {
        setLoading(false);
        return;
      }
      const res = await fetch("/api/exam/me/dashboard", { headers: { Authorization: `Bearer ${tokenData.token}` } });
      if (!cancelled && res.ok) {
        setData(await res.json());
      }
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="exam-dashboard" />;
  }

  if (!user) {
    return (
      <div className="exam-dashboard">
        <div className="dash-wrap">
          <div className="dash-signin">
            <p className="dash-title" style={{ marginBottom: "0.5rem" }}>
              Your Progress
            </p>
            <p>Sign in to see your attempt history, score trend, and areas to improve.</p>
            <AuthPanel />
          </div>
        </div>
      </div>
    );
  }

  const attemptsChronological = data ? [...data.attempts].reverse() : [];

  return (
    <div className="exam-dashboard">
      <div className="dash-wrap">
        <div className="dash-header">
          <span className="dash-title">Your Progress</span>
          <a className="dash-back" href="/">
            ← Take the exam
          </a>
        </div>
        <p className="dash-subline">
          Signed in as {user.name || user.email}
          {data && (
            <>
              {" "}
              · {data.attemptCount.used} of {data.attemptCount.limit} attempts used
            </>
          )}
        </p>

        {!data || data.attempts.length === 0 ? (
          <div className="dash-card dash-empty">
            <p>You haven't completed an exam yet.</p>
            <a href="/">Start your first attempt →</a>
          </div>
        ) : (
          <>
            <div className="dash-card">
              <p className="dash-card-title">Score over time</p>
              <div className="dash-trend">
                {attemptsChronological.map((a) => (
                  <div className="dash-trend-bar-wrap" key={a.id}>
                    <span className="dash-trend-pct">{a.overallPercent}%</span>
                    <div
                      className="dash-trend-bar"
                      style={{ height: `${Math.max(4, a.overallPercent)}%`, background: scoreColor(a.overallPercent) }}
                    />
                    <span className="dash-trend-date">{formatDate(a.completedAt)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="dash-card">
              <p className="dash-card-title">Areas to improve</p>
              {data.attributeBreakdown.map((a) => (
                <div className="dash-attr-row" key={a.attribute}>
                  <div className="dash-attr-head">
                    <span className="dash-attr-name">{a.attribute}</span>
                    <span className="dash-attr-pct">
                      {a.correct}/{a.total} · {a.percent}%
                    </span>
                  </div>
                  <div className="dash-attr-track">
                    <div
                      className={"dash-attr-fill" + (a.percent < 50 ? " weak" : a.percent >= 75 ? " strong" : "")}
                      style={{ width: `${a.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="dash-card">
              <p className="dash-card-title">Attempt history</p>
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Length</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {data.attempts.map((a) => (
                    <tr key={a.id}>
                      <td>{formatDate(a.completedAt)}</td>
                      <td>{a.lengthTier} questions</td>
                      <td>
                        <span className="dash-score-pill" style={{ background: "var(--ax-accent-soft)", color: scoreColor(a.overallPercent) }}>
                          {a.overallPercent}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
