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

interface SessionQuestion {
  id: string;
  category: QuizCategory;
  question: string;
  options: string[];
  correctIndex: number;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildSessionQuestions(): SessionQuestion[] {
  return QUIZ_QUESTIONS.map((q) => {
    const order = shuffle(q.options.map((_, i) => i));
    return {
      id: q.id,
      category: q.category,
      question: q.question,
      options: order.map((i) => q.options[i]),
      correctIndex: order.indexOf(q.correctIndex),
    };
  });
}

export default function AgentQuiz() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [sessionQuestions, setSessionQuestions] = useState<SessionQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [leadName, setLeadName] = useState<string | null>(null);

  const question = sessionQuestions[index];
  const total = QUIZ_QUESTIONS.length;

  function start() {
    setSessionQuestions(buildSessionQuestions());
    setPhase("quiz");
    setIndex(0);
    setAnswers({});
    setSelected(null);
    setLeadName(null);
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
        setShowModal(true);
      }
    }, 350);
  }

  const categoryScores: CategoryScore[] = CATEGORIES.map((category) => {
    const questions = sessionQuestions.filter((q) => q.category === category);
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
      <div className={"quiz-results" + (showModal ? " quiz-results-blurred" : "")}>
        <div className="quiz-results-head">
          {leadName && <p className="quiz-results-greeting">Nice work, {leadName}!</p>}
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

      </div>

      {showModal && (
        <ResultModal
          level={level}
          overallPercent={overallPercent}
          categoryScores={categoryScores}
          onClose={() => setShowModal(false)}
          onSubmitted={(name) => {
            setLeadName(name);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

function ResultModal({
  level,
  overallPercent,
  categoryScores,
  onClose,
  onSubmitted,
}: {
  level: string;
  overallPercent: number;
  categoryScores: CategoryScore[];
  onClose: () => void;
  onSubmitted: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/quiz-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company, level, overallPercent, categoryScores }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong");
      }

      onSubmitted(name);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="quiz-modal-backdrop" onClick={onClose}>
      <div className="quiz-modal" onClick={(e) => e.stopPropagation()}>
        <button className="quiz-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <p className="quiz-modal-title">Please enter your name and email to see your result</p>
        <p className="quiz-modal-desc">
          We'll show your personalized breakdown here and send a copy to your inbox.
        </p>
        <form onSubmit={handleSubmit} className="quiz-modal-form">
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
            type="text"
            required
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="quiz-lead-input"
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
            {status === "loading" ? "Submitting..." : "See my results"}
          </button>
        </form>
        {status === "error" && <p className="quiz-lead-error">{errorMessage}</p>}
      </div>
    </div>
  );
}
