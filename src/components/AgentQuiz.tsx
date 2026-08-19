import { useState, type FormEvent } from "react";
import "./agent-quiz.css";
import {
  CATEGORIES,
  CATEGORY_COLOR,
  CATEGORY_TIP,
  QUIZ_QUESTIONS,
  levelForScore,
  type QuizCategory,
} from "../lib/quizData";

type Phase = "intro" | "quiz" | "results";

interface CategoryScore {
  category: QuizCategory;
  correct: number;
  total: number;
  percent: number;
}

export default function AgentQuiz() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<number | null>(null);

  const question = QUIZ_QUESTIONS[index];
  const total = QUIZ_QUESTIONS.length;

  function start() {
    setPhase("quiz");
    setIndex(0);
    setAnswers({});
    setSelected(null);
  }

  function choose(optionIndex: number) {
    if (selected !== null) return;
    setSelected(optionIndex);
    const nextAnswers = { ...answers, [question.id]: optionIndex };
    setAnswers(nextAnswers);

    setTimeout(() => {
      if (index + 1 < total) {
        setIndex(index + 1);
        setSelected(null);
      } else {
        setPhase("results");
      }
    }, 350);
  }

  const categoryScores: CategoryScore[] = CATEGORIES.map((category) => {
    const questions = QUIZ_QUESTIONS.filter((q) => q.category === category);
    const correct = questions.filter((q) => answers[q.id] === q.correctIndex).length;
    return {
      category,
      correct,
      total: questions.length,
      percent: Math.round((correct / questions.length) * 100),
    };
  });

  const overallCorrect = categoryScores.reduce((sum, c) => sum + c.correct, 0);
  const overallPercent = Math.round((overallCorrect / total) * 100);
  const level = levelForScore(overallPercent);

  const weakestCategories = [...categoryScores].sort((a, b) => a.percent - b.percent).slice(0, 2);

  if (phase === "intro") {
    return (
      <div className="quiz">
        <div className="quiz-intro">
          <p className="quiz-intro-title">Where are you on the agent-building journey?</p>
          <p className="quiz-intro-desc">
            {total} questions across four skill areas. Answer honestly — the score maps
            you to a level and shows exactly what to work on next.
          </p>
          <div className="quiz-intro-cats">
            {CATEGORIES.map((c) => (
              <span key={c} className="quiz-cat-chip" style={{ color: CATEGORY_COLOR[c] }}>
                {c}
              </span>
            ))}
          </div>
          <button className="quiz-start-btn" onClick={start}>
            Start the assessment
          </button>
        </div>
      </div>
    );
  }

  if (phase === "quiz") {
    const progressPct = Math.round((index / total) * 100);
    return (
      <div className="quiz">
        <div className="quiz-question">
          <div className="quiz-progress-row">
            <span className="quiz-progress-text">
              Question {index + 1} of {total}
            </span>
            <span
              className="quiz-cat-badge"
              style={{ background: CATEGORY_COLOR[question.category] }}
            >
              {question.category}
            </span>
          </div>
          <div className="quiz-progress-bar">
            <div className="quiz-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>

          <p className="quiz-question-text">{question.question}</p>

          <div className="quiz-options">
            {question.options.map((option, i) => (
              <button
                key={i}
                className={"quiz-option" + (selected === i ? " selected" : "")}
                disabled={selected !== null}
                onClick={() => choose(i)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz">
      <div className="quiz-results">
        <div className="quiz-results-head">
          <div
            className="quiz-ring"
            style={{
              background: `conic-gradient(var(--text) ${overallPercent * 3.6}deg, var(--border) 0deg)`,
            }}
          >
            <div className="quiz-ring-inner">
              <span className="quiz-ring-score">{overallPercent}%</span>
              <span className="quiz-ring-label">Score</span>
            </div>
          </div>
          <p className="quiz-level-label">Your level</p>
          <p className="quiz-level-value">{level}</p>
        </div>

        <div className="quiz-cat-grid">
          {categoryScores.map((c) => (
            <div key={c.category}>
              <div className="quiz-cat-row-head">
                <span className="quiz-cat-row-name">
                  <span className="quiz-cat-dot" style={{ background: CATEGORY_COLOR[c.category] }} />
                  {c.category}
                </span>
                <span className="quiz-cat-row-pct">
                  {c.correct}/{c.total} · {c.percent}%
                </span>
              </div>
              <div className="quiz-bar-track">
                <div
                  className="quiz-bar-fill"
                  style={{ width: `${c.percent}%`, background: CATEGORY_COLOR[c.category] }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="quiz-focus">
          <p className="quiz-focus-title">Where to focus next</p>
          {weakestCategories.map((c) => (
            <p className="quiz-focus-item" key={c.category}>
              <strong>
                <span className="quiz-cat-dot" style={{ background: CATEGORY_COLOR[c.category] }} />
                {c.category} ({c.percent}%):
              </strong>{" "}
              {CATEGORY_TIP[c.category]}
            </p>
          ))}
        </div>

        <LeadForm level={level} overallPercent={overallPercent} categoryScores={categoryScores} />
      </div>
    </div>
  );
}

function LeadForm({
  level,
  overallPercent,
  categoryScores,
}: {
  level: string;
  overallPercent: number;
  categoryScores: CategoryScore[];
}) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/quiz-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, company, level, overallPercent, categoryScores }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong");
      }

      setSent(true);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (sent) {
    return (
      <div className="quiz-lead">
        <p className="quiz-lead-sent">Please check your inbox — your results and next steps are on the way.</p>
      </div>
    );
  }

  return (
    <div className="quiz-lead">
      <p className="quiz-lead-title">Want the roadmap that matches your level?</p>
      <p className="quiz-lead-desc">Drop your email and I'll send your results plus what to learn next.</p>
      <form onSubmit={handleSubmit} className="quiz-lead-form">
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          className="quiz-hidden"
          aria-hidden="true"
        />
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="quiz-lead-input"
        />
        <button type="submit" disabled={status === "loading"} className="quiz-lead-btn">
          {status === "loading" ? "Sending..." : "Learn more"}
        </button>
      </form>
      {status === "error" && <p className="quiz-lead-error">{errorMessage}</p>}
    </div>
  );
}
