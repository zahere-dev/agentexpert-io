import { useRef, useState } from "react";
import "./exam-room.css";
import { usePyodide } from "../lib/usePyodide";
import { runChecks, type ToolCall, type CheckResult } from "../lib/examChecks";
import type { QuestionRow, ExecutionContent, ReasoningContent } from "../lib/examTypes";
import { getAnonSessionId } from "../lib/anonSession";
import { authClient } from "../lib/authClient";
import AuthPanel from "./AuthPanel";

type Phase = "picker" | "quiz" | "results";
type LengthTier = 10 | 30 | 50;

interface LogLine {
  text: string;
  kind: "stdout" | "error" | "muted";
}

interface AttributeResult {
  attribute: string;
  correct: number;
  total: number;
  percent: number;
}

interface Results {
  overallPercent: number;
  attributeResults: AttributeResult[];
  ungradedCount: number;
}

const ICON_CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12 5 5L20 7" />
  </svg>
);
const ICON_CROSS = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const { data } = await authClient.token();
    return data?.token ? { Authorization: `Bearer ${data.token}` } : {};
  } catch {
    return {};
  }
}

function wrapSelection(textarea: HTMLTextAreaElement, before: string, after: string, value: string) {
  const { selectionStart, selectionEnd } = textarea;
  const selected = value.slice(selectionStart, selectionEnd);
  const next = value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd);
  return next;
}

export default function ExamRoom() {
  const { loadState: pyodideState, pyodideRef } = usePyodide();

  const [phase, setPhase] = useState<Phase>("picker");
  const [lengthTier, setLengthTier] = useState<LengthTier>(10);
  const [starting, setStarting] = useState(false);

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [examQuestions, setExamQuestions] = useState<QuestionRow[]>([]);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const [marked, setMarked] = useState<Set<number>>(new Set());

  // Execution-question state
  const [code, setCode] = useState("");
  const [log, setLog] = useState<LogLine[]>([]);
  const [checks, setChecks] = useState<CheckResult[] | null>(null);
  const [running, setRunning] = useState(false);

  // Reasoning-question state
  const [reasoningAnswers, setReasoningAnswers] = useState<Record<string, string>>({});
  const [sampleOpen, setSampleOpen] = useState<Record<string, boolean>>({});
  const answerTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [results, setResults] = useState<Results | null>(null);

  const question = examQuestions[index];

  async function startExam() {
    setStarting(true);
    try {
      const res = await fetch("/api/exam/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
        body: JSON.stringify({ lengthTier, anonSessionId: getAnonSessionId() }),
      });
      if (!res.ok) throw new Error("Could not start exam");
      const data = await res.json();
      setAttemptId(data.attemptId);
      setExamQuestions(data.questions);
      setIndex(0);
      setAnswered({});
      setMarked(new Set());
      setReasoningAnswers({});
      setPhase("quiz");
      loadQuestion(data.questions[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setStarting(false);
    }
  }

  function loadQuestion(q: QuestionRow) {
    setChecks(null);
    if (q.scenarioType === "execution") {
      const content = q.content as ExecutionContent;
      setCode(content.starterCode);
      setLog([{ text: "Ready. Click Run to execute your code.", kind: "muted" }]);
      if (pyodideRef.current) {
        pyodideRef.current.runPython(content.harnessSource);
      }
    }
  }

  async function saveResponse(q: QuestionRow, answer: unknown, trace: ToolCall[] | null, isCorrect: boolean | null) {
    if (!attemptId) return;
    setAnswered((prev) => ({ ...prev, [q.id]: true }));
    try {
      await fetch(`/api/exam/attempts/${attemptId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: q.id, answer, trace, isCorrect }),
      });
    } catch (err) {
      console.error("Failed to save response:", err);
    }
  }

  async function run() {
    const pyodide = pyodideRef.current;
    if (!pyodide || running || !question || question.scenarioType !== "execution") return;
    const content = question.content as ExecutionContent;

    setRunning(true);
    setChecks(null);
    const lines: LogLine[] = [];

    pyodide.setStdout({ batched: (text: string) => lines.push({ text, kind: "stdout" }) });
    pyodide.setStderr({ batched: (text: string) => lines.push({ text, kind: "error" }) });

    let trace: ToolCall[] = [];
    let isCorrect = false;

    try {
      pyodide.runPython("CALL_LOG.clear()");
      await pyodide.runPythonAsync(code);
      const rawTrace = pyodide.globals.get("CALL_LOG").toJs({ dict_converter: Object.fromEntries });
      trace = rawTrace.map((t: any) => ({ tool: t.tool, args: t.args }));
      const checkResults = runChecks(trace, content.checks);
      setChecks(checkResults);
      isCorrect = checkResults.every((r) => r.passed);
      if (lines.length === 0) lines.push({ text: "(no output)", kind: "muted" });
    } catch (err) {
      lines.push({ text: String(err), kind: "error" });
      setChecks([]);
    } finally {
      setLog(lines);
      setRunning(false);
    }

    await saveResponse(question, code, trace, isCorrect);
  }

  function maybeSaveReasoningAnswer() {
    if (!question || question.scenarioType !== "reasoning") return;
    const text = reasoningAnswers[question.id];
    if (text && text.trim().length > 0) {
      saveResponse(question, text, null, null);
    }
  }

  function goTo(i: number) {
    if (i < 0 || i >= examQuestions.length) return;
    maybeSaveReasoningAnswer();
    setIndex(i);
    loadQuestion(examQuestions[i]);
  }

  function applyFormat(cmd: "bold" | "italic" | "list") {
    const ta = answerTextareaRef.current;
    if (!ta || !question) return;
    const value = reasoningAnswers[question.id] ?? "";
    let next = value;
    if (cmd === "bold") next = wrapSelection(ta, "**", "**", value);
    else if (cmd === "italic") next = wrapSelection(ta, "*", "*", value);
    else if (cmd === "list") next = wrapSelection(ta, "- ", "", value);
    setReasoningAnswers((prev) => ({ ...prev, [question.id]: next }));
  }

  function toggleMark() {
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function endExam() {
    if (!attemptId) return;
    maybeSaveReasoningAnswer();
    const res = await fetch(`/api/exam/attempts/${attemptId}/complete`, { method: "POST" });
    const data = await res.json();
    setResults(data);
    setPhase("results");
  }

  if (phase === "picker") {
    return (
      <div className="exam-room">
        <div className="exam-picker">
          <p className="exam-picker-title">Where are you in your agent-building journey?</p>
          <p className="exam-picker-desc">
            Real scenarios -- some graded by running your code, some by your written reasoning. Pick how many
            questions.
          </p>
          <div className="exam-length-options">
            {[10, 30, 50].map((n) => (
              <button
                key={n}
                className={"exam-length-btn" + (lengthTier === n ? " selected" : "")}
                onClick={() => setLengthTier(n as LengthTier)}
              >
                {n} questions
                <small>{n === 10 ? "~15 min" : n === 30 ? "~45 min" : "~75 min"}</small>
              </button>
            ))}
          </div>
          <button className="exam-start-btn" onClick={startExam} disabled={starting || pyodideState !== "ready"}>
            {pyodideState !== "ready" ? "Loading Python runtime…" : starting ? "Starting…" : "Start the exam"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "results" && results) {
    return (
      <div className="exam-room">
        <div className="exam-results">
          <div className="exam-results-head">
            <div
              className="exam-ring"
              style={{ background: `conic-gradient(var(--ax-accent) ${results.overallPercent * 3.6}deg, var(--ax-border) 0deg)` }}
            >
              <div className="exam-ring-inner">
                <span className="exam-ring-score">{results.overallPercent}%</span>
                <span className="exam-ring-label">Score</span>
              </div>
            </div>
          </div>
          <div className="exam-attr-grid">
            {results.attributeResults.map((a) => (
              <div key={a.attribute}>
                <div className="exam-attr-row-head">
                  <span>{a.attribute}</span>
                  <span>
                    {a.correct}/{a.total} {"·"} {a.percent}%
                  </span>
                </div>
                <div className="exam-bar-track">
                  <div className="exam-bar-fill" style={{ width: `${a.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
          {results.ungradedCount > 0 && (
            <p className="exam-ungraded-note">
              {results.ungradedCount} written response{results.ungradedCount > 1 ? "s" : ""} recorded and queued for
              rubric review -- not included in the score above yet.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!question) return null;

  const progressPct = Math.round(((index + 1) / examQuestions.length) * 100);
  const passedCount = checks?.filter((c) => c.passed).length ?? null;
  const isExecution = question.scenarioType === "execution";
  const reasoningContent = !isExecution ? (question.content as ReasoningContent) : null;
  const isSampleOpen = sampleOpen[question.id] ?? false;

  return (
    <div className="exam-room">
      <div className="exam-topbar">
        <div className="exam-topbar-left">
          <div className="exam-brand">
            <div className="exam-brand-mark">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="2.5" />
                <path d="M12 7.5V12" />
                <circle cx="6" cy="17" r="2.5" />
                <circle cx="18" cy="17" r="2.5" />
                <path d="M12 12 6 14.7M12 12l6 2.7" />
              </svg>
            </div>
            <span className="exam-brand-name">agentexpert.io</span>
          </div>
          <span className="exam-topbar-divider" />
          <span className="exam-page-title">Scenario Question</span>
        </div>
        <div className="exam-topbar-right">
          <div className="exam-progress-block">
            <span className="exam-progress-label">
              Question {index + 1} of {examQuestions.length}
            </span>
            <div className="exam-progress-track">
              <div className="exam-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <AuthPanel />
          <button className="exam-end-btn" onClick={endExam}>
            End Exam
          </button>
        </div>
      </div>

      <div className="exam-workspace">
        <aside className="exam-sidebar">
          <div>
            <p className="exam-sidebar-heading">EXAM NAVIGATION</p>
            <div className="exam-nav-grid">
              {examQuestions.map((q, i) => {
                const isCurrent = i === index;
                const isAnswered = answered[q.id];
                return (
                  <button
                    key={q.id}
                    className={"exam-nav-dot" + (isCurrent ? " current" : isAnswered ? " answered" : "")}
                    onClick={() => goTo(i)}
                  >
                    {isCurrent ? i + 1 : isAnswered ? ICON_CHECK : i + 1}
                    {marked.has(i) && <span className="flag" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="exam-meta-item">
            <span className="exam-meta-label">SKILL AREA</span>
            <span className="exam-meta-value">{question.psychometricAttribute}</span>
          </div>
          <div className="exam-meta-item">
            <span className="exam-meta-label">DIFFICULTY</span>
            <span className={`exam-difficulty-pill d${question.difficulty}`}>{question.difficulty}/5</span>
          </div>
          <div className="exam-meta-item">
            <span className="exam-meta-label">FORMAT</span>
            <span className="exam-meta-value">{isExecution ? "Run code" : "Written answer"}</span>
          </div>
        </aside>

        <section className="exam-scenario-pane">
          <div className="exam-card">
            <div className="exam-card-head">
              <span className="exam-icon-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
                </svg>
              </span>
              <h3>Scenario</h3>
            </div>
            <div className="exam-request-box">
              <div className="exam-request-avatar">U</div>
              <p className="exam-request-quote">{question.content.request}</p>
            </div>
          </div>

          <div className="exam-card">
            <div className="exam-card-head">
              <span className="exam-icon-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L4 16.7V20h3.3l5.3-5.3a4 4 0 0 0 5.1-5.4l-2.8 2.8-2-.6-.6-2z" />
                </svg>
              </span>
              <h3>Agent's Available Tools</h3>
            </div>
            <div className="exam-tools-grid">
              {question.content.tools.map((t) => (
                <div className="exam-tool-card" key={t.name}>
                  <span className="exam-tool-name">{t.name}</span>
                  <p className="exam-tool-desc">{t.description}</p>
                  {t.params.map((p) => (
                    <span className="exam-param-tag" key={p}>
                      {p}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="exam-constraints-box">
            <div className="exam-constraints-head">Important Constraints</div>
            <ul>
              {question.content.constraints.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>

          <div className="exam-card">
            <div className="exam-card-head">
              <h3>What You Need to Do</h3>
            </div>
            <ul className="exam-todo-list">
              {question.content.todo.map((t, i) => (
                <li key={i}>
                  <span className="exam-todo-num">{i + 1}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="exam-answer-pane">
          {isExecution ? (
            <>
              <div className="exam-answer-head">
                <h3>Your Answer</h3>
                <p>Write the agent's response as real Python -- it runs against the tools above.</p>
              </div>

              <div className="exam-editor-shell">
                <div className="exam-editor-topbar">
                  <span>agent_response.py</span>
                  <button className="exam-run-btn" onClick={run} disabled={running}>
                    {running ? "Running…" : "Run"}
                  </button>
                </div>
                <textarea className="exam-code" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} />
                <div className="exam-output">
                  {log.map((l, i) => (
                    <div key={i} className={`line-${l.kind}`}>
                      {l.text}
                    </div>
                  ))}
                </div>
              </div>

              {checks && (
                <div className="exam-checks-box">
                  <div className="exam-checks-head">
                    Grading result
                    <span className="exam-checks-score">
                      {passedCount} of {checks.length} checks passed
                    </span>
                  </div>
                  {checks.map((c, i) => (
                    <div className="exam-check-item" key={i}>
                      <span className={`exam-check-icon ${c.passed ? "pass" : "fail"}`}>{c.passed ? ICON_CHECK : ICON_CROSS}</span>
                      <span>{c.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="exam-answer-head">
                <h3>Your Answer</h3>
                <p>Provide your response to the scenario.</p>
              </div>

              <div className="exam-editor-shell exam-editor-shell-light">
                <div className="exam-format-toolbar">
                  <button onClick={() => applyFormat("bold")} title="Bold">
                    <strong>B</strong>
                  </button>
                  <button onClick={() => applyFormat("italic")} title="Italic">
                    <em>I</em>
                  </button>
                  <button onClick={() => applyFormat("list")} title="Bulleted list">
                    &bull;
                  </button>
                </div>
                <textarea
                  ref={answerTextareaRef}
                  className="exam-reasoning-textarea"
                  placeholder="Walk through what the agent should do, what it must avoid, and what a strong final response looks like…"
                  value={reasoningAnswers[question.id] ?? ""}
                  onChange={(e) => setReasoningAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))}
                  onBlur={maybeSaveReasoningAnswer}
                />
              </div>

              <div className="exam-great-box">
                <div className="exam-great-head">What a Great Answer Looks Like</div>
                <ul>
                  {reasoningContent!.great.map((g, i) => (
                    <li key={i}>
                      <span className="exam-check-icon pass">{ICON_CHECK}</span>
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className="exam-sample-toggle"
                  onClick={() => setSampleOpen((prev) => ({ ...prev, [question.id]: !isSampleOpen }))}
                >
                  {isSampleOpen ? "Hide sample answer" : "Show sample answer →"}
                </button>
                {isSampleOpen && <div className="exam-sample-body">{reasoningContent!.sampleAnswer}</div>}
              </div>
            </>
          )}
        </section>
      </div>

      <div className="exam-footerbar">
        <button className="exam-nav-btn" onClick={() => goTo(index - 1)} disabled={index === 0}>
          Previous
        </button>
        <button className={"exam-nav-btn" + (marked.has(index) ? " marked" : "")} onClick={toggleMark}>
          Mark for Review
        </button>
        {index === examQuestions.length - 1 ? (
          <button className="exam-nav-btn primary" onClick={endExam}>
            Finish
          </button>
        ) : (
          <button className="exam-nav-btn primary" onClick={() => goTo(index + 1)}>
            Next Question
          </button>
        )}
      </div>
    </div>
  );
}
