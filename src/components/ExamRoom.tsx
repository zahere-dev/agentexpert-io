import { useEffect, useRef, useState } from "react";
import "./exam-room.css";
import { usePyodide } from "../lib/usePyodide";
import { runChecks, type ToolCall, type CheckResult } from "../lib/examChecks";
import type { QuestionRow, ExecutionContent, ReasoningContent, BlockArrangerContent } from "../lib/examTypes";
import { getAnonSessionId } from "../lib/anonSession";
import { authClient } from "../lib/authClient";
import { shuffle } from "../lib/shuffle";
import { saveExamSession, loadExamSession, clearExamSession } from "../lib/examSession";
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

  // Block-arranger state
  const [blockOrders, setBlockOrders] = useState<Record<string, string[]>>({});
  const [arrangeResult, setArrangeResult] = useState<Record<string, boolean>>({});
  const dragBlockId = useRef<string | null>(null);

  const [results, setResults] = useState<Results | null>(null);
  const [restoring, setRestoring] = useState(true);

  const question = examQuestions[index];

  // Restore an in-progress attempt after a full-page reload (e.g. signing
  // in mid-exam navigates away to Google and back) instead of silently
  // dropping the candidate back to the picker screen.
  useEffect(() => {
    const saved = loadExamSession();
    if (saved) {
      setAttemptId(saved.attemptId);
      setLengthTier(saved.lengthTier as LengthTier);
      setExamQuestions(saved.questions);
      setIndex(saved.index);
      setAnswered(saved.answered);
      setMarked(new Set(saved.marked));
      setReasoningAnswers(saved.reasoningAnswers);
      setBlockOrders(saved.blockOrders);
      setPhase("quiz");
    }
    setRestoring(false);
  }, []);

  // Persist progress on every change while the quiz is in progress.
  useEffect(() => {
    if (phase !== "quiz" || !attemptId || examQuestions.length === 0) return;
    saveExamSession({
      attemptId,
      lengthTier,
      questions: examQuestions,
      index,
      answered,
      marked: Array.from(marked),
      reasoningAnswers,
      blockOrders,
    });
  }, [phase, attemptId, lengthTier, examQuestions, index, answered, marked, reasoningAnswers, blockOrders]);

  // A restored question needs its Pyodide harness (re)loaded once the
  // runtime is ready -- on a fresh start this is already true by the time
  // startExam() runs, but after a reload-restore, Pyodide is booting from
  // scratch and may not be ready yet when the question list comes back.
  useEffect(() => {
    if (pyodideState === "ready" && phase === "quiz" && question) {
      loadQuestion(question);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pyodideState]);

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
      setBlockOrders({});
      setArrangeResult({});
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
    } else if (q.scenarioType === "blockArranger") {
      setBlockOrders((prev) => {
        if (prev[q.id]) return prev; // preserve arrangement when navigating back
        const content = q.content as BlockArrangerContent;
        return { ...prev, [q.id]: shuffle(content.blocks.map((b) => b.id)) };
      });
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

  function moveBlock(questionId: string, fromIndex: number, toIndex: number) {
    setBlockOrders((prev) => {
      const order = [...(prev[questionId] ?? [])];
      if (toIndex < 0 || toIndex >= order.length) return prev;
      const [moved] = order.splice(fromIndex, 1);
      order.splice(toIndex, 0, moved);
      return { ...prev, [questionId]: order };
    });
  }

  function checkArrangement() {
    if (!question || question.scenarioType !== "blockArranger") return;
    const content = question.content as BlockArrangerContent;
    const order = blockOrders[question.id] ?? [];
    const isCorrect = order.length === content.correctOrder.length && order.every((id, i) => id === content.correctOrder[i]);
    setArrangeResult((prev) => ({ ...prev, [question.id]: isCorrect }));
    saveResponse(question, order, null, isCorrect);
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
    clearExamSession();
    setResults(data);
    setPhase("results");
  }

  if (restoring) {
    return <div className="exam-room" />;
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
  const isReasoning = question.scenarioType === "reasoning";
  const isArranger = question.scenarioType === "blockArranger";
  const reasoningContent = isReasoning ? (question.content as ReasoningContent) : null;
  const arrangerContent = isArranger ? (question.content as BlockArrangerContent) : null;
  const isSampleOpen = sampleOpen[question.id] ?? false;
  const currentOrder = arrangerContent ? blockOrders[question.id] ?? [] : [];
  const orderedBlocks = arrangerContent
    ? currentOrder.map((id) => arrangerContent.blocks.find((b) => b.id === id)!).filter(Boolean)
    : [];
  const formatLabel = isExecution ? "Run code" : isArranger ? "Arrange steps" : "Written answer";

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
            <span className="exam-meta-value">{formatLabel}</span>
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

          {isArranger ? (
            <div className="exam-card">
              <div className="exam-card-head">
                <h3>Instructions</h3>
              </div>
              <p className="exam-instructions-text">{arrangerContent!.instructions}</p>
            </div>
          ) : (
            <>
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
                  {(question.content as ExecutionContent | ReasoningContent).tools.map((t) => (
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
                  {(question.content as ExecutionContent | ReasoningContent).constraints.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>

              <div className="exam-card">
                <div className="exam-card-head">
                  <h3>What You Need to Do</h3>
                </div>
                <ul className="exam-todo-list">
                  {(question.content as ExecutionContent | ReasoningContent).todo.map((t, i) => (
                    <li key={i}>
                      <span className="exam-todo-num">{i + 1}</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>

        <section className="exam-answer-pane">
          {isArranger ? (
            <>
              <div className="exam-answer-head">
                <h3>Your Answer</h3>
                <p>{arrangerContent!.instructions}</p>
              </div>

              <ul className="exam-block-list">
                {orderedBlocks.map((block, i) => (
                  <li
                    key={block.id}
                    className="exam-block-item"
                    draggable
                    onDragStart={() => (dragBlockId.current = block.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      const fromId = dragBlockId.current;
                      if (!fromId || fromId === block.id) return;
                      const fromIndex = currentOrder.indexOf(fromId);
                      moveBlock(question.id, fromIndex, i);
                    }}
                  >
                    <span className="exam-block-handle" title="Drag to reorder">
                      &#8942;&#8942;
                    </span>
                    <span className="exam-block-index">{i + 1}</span>
                    <div className="exam-block-text">
                      <span className="exam-block-label">{block.label}</span>
                      <span className="exam-block-desc">{block.description}</span>
                    </div>
                    <div className="exam-block-arrows">
                      <button onClick={() => moveBlock(question.id, i, i - 1)} disabled={i === 0} title="Move up">
                        &uarr;
                      </button>
                      <button
                        onClick={() => moveBlock(question.id, i, i + 1)}
                        disabled={i === orderedBlocks.length - 1}
                        title="Move down"
                      >
                        &darr;
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <button className="exam-check-order-btn" onClick={checkArrangement}>
                Check Order
              </button>

              {arrangeResult[question.id] !== undefined && (
                <div className="exam-checks-box">
                  <div className="exam-check-item">
                    <span className={`exam-check-icon ${arrangeResult[question.id] ? "pass" : "fail"}`}>
                      {arrangeResult[question.id] ? ICON_CHECK : ICON_CROSS}
                    </span>
                    <span>{arrangeResult[question.id] ? "Correct order!" : "Not quite the right order yet."}</span>
                  </div>
                </div>
              )}

              <div className="exam-great-box">
                <div className="exam-great-head">What a Great Answer Looks Like</div>
                <ul>
                  {arrangerContent!.great.map((g, i) => (
                    <li key={i}>
                      <span className="exam-check-icon pass">{ICON_CHECK}</span>
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : isExecution ? (
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
