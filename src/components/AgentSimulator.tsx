import { useState } from "react";
import "./agent-simulator.css";

type LineType = "goal" | "obs" | "action" | "fail" | "reflect";

interface LogLine {
  type: LineType;
  text: string;
}

interface StepOption {
  label: string;
  correct: boolean;
  result: string; // shown as the next observation/fail line
}

interface Step {
  observation: string; // what the agent currently knows, shown before options
  options: StepOption[];
}

const MISSION =
  "Research the top 3 AI agent frameworks and publish a one-paragraph summary.";

const STEPS: Step[] = [
  {
    observation: "No research done yet. You know only the goal.",
    options: [
      {
        label: "Write the summary from what I already know",
        correct: false,
        result:
          "Hallucination risk — you invented details instead of grounding them in real sources.",
      },
      {
        label: "Search the web for current agent frameworks",
        correct: true,
        result: "Found 11 frameworks, unranked: LangGraph, AutoGen, CrewAI, and 8 others.",
      },
      {
        label: "Call a weather API",
        correct: false,
        result: "Wrong tool for the job — nothing here moves the mission forward.",
      },
    ],
  },
  {
    observation: "11 frameworks found, no ranking, goal asks for top 3.",
    options: [
      {
        label: "Summarize all 11 in detail",
        correct: false,
        result: "Goal said top 3 — you just tripled the reader's workload for nothing.",
      },
      {
        label: "Reason about adoption, docs, and community size to shortlist 3",
        correct: true,
        result: "Shortlisted: LangGraph, CrewAI, AutoGen.",
      },
      {
        label: "Pick 3 at random",
        correct: false,
        result: "Random isn't a selection criterion — that's a dice roll, not reasoning.",
      },
    ],
  },
  {
    observation: "3 framework names shortlisted, but no details to summarize yet.",
    options: [
      {
        label: "Recall what I already know about each",
        correct: false,
        result: "Memory drifts — you'd risk describing a version that's a year out of date.",
      },
      {
        label: "Look up each framework's docs/repo individually",
        correct: true,
        result: "Gathered purpose, strengths, and one caveat for each framework.",
      },
      {
        label: "Skip this — just list the names",
        correct: false,
        result: "That's a list, not a summary. The goal asked for more.",
      },
    ],
  },
  {
    observation: "Solid notes on all three frameworks are ready.",
    options: [
      {
        label: "Paste the raw notes as the summary",
        correct: false,
        result: "Unedited notes aren't a summary — the reader still has to do the work.",
      },
      {
        label: "Write a structured one-paragraph summary",
        correct: true,
        result: "Draft summary written.",
      },
      {
        label: "Ask the user to write it themselves",
        correct: false,
        result: "That was the one job you were given.",
      },
    ],
  },
  {
    observation: "Draft summary is ready to ship.",
    options: [
      {
        label: "Ship it immediately",
        correct: false,
        result: "It works, but skipping verification is how confident-sounding errors slip through.",
      },
      {
        label: "Re-read the draft against your sources, then ship",
        correct: true,
        result: "Verified — one minor error caught and fixed before sending.",
      },
      {
        label: "Ask a colleague to check it forever, never ship",
        correct: false,
        result: "Perfect is the enemy of shipped. Reflect once, not infinitely.",
      },
    ],
  },
];

function scoreTier(score: number): { tier: string; note: string } {
  if (score >= 100) {
    return {
      tier: "Agent Architect",
      note: "Clean run, no wasted turns. This is what a well-designed ReAct loop looks like: ground, reason, act, reflect.",
    };
  }
  if (score >= 70) {
    return {
      tier: "Solid Engineer",
      note: "You shipped it and mostly picked the right tool for the job. A little more discipline on grounding and you're production-ready.",
    };
  }
  if (score >= 40) {
    return {
      tier: "Enthusiastic Intern",
      note: "You got there, but with detours — the kind of agent that needs a human reviewing its output before it ships anything real.",
    };
  }
  return {
    tier: "Confidently Wrong Chatbot",
    note: "Fast and sure of itself, occasionally right. This is the failure mode most agent demos hide until production.",
  };
}

export default function AgentSimulator() {
  const [log, setLog] = useState<LogLine[]>([
    { type: "goal", text: MISSION },
  ]);
  const [stepIndex, setStepIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [finished, setFinished] = useState(false);

  const step = STEPS[stepIndex];

  function choose(option: StepOption) {
    const nextLog: LogLine[] = [
      ...log,
      { type: "action", text: option.label },
    ];

    if (option.correct) {
      nextLog.push({ type: "obs", text: option.result });
      setLog(nextLog);
      if (stepIndex === STEPS.length - 1) {
        setFinished(true);
      } else {
        setStepIndex(stepIndex + 1);
      }
    } else {
      nextLog.push({ type: "fail", text: option.result });
      setLog(nextLog);
      setMistakes(mistakes + 1);
    }
  }

  function reset() {
    setLog([{ type: "goal", text: MISSION }]);
    setStepIndex(0);
    setMistakes(0);
    setFinished(false);
  }

  const score = Math.max(0, 100 - mistakes * 15);
  const { tier, note } = scoreTier(score);

  return (
    <div className="sim">
      <div className="sim-topbar">
        <span className="sim-dot" />
        <span className="sim-dot" />
        <span className="sim-dot" />
        <span className="sim-title">agent-loop — thought / action / observation</span>
      </div>

      <div className="sim-log">
        {log.map((line, i) => (
          <LogLineView key={i} line={line} />
        ))}
        {!finished && (
          <div className="sim-line">
            <span className="sim-tag tag-obs">OBSERVATION</span>
            <span className="sim-text">{step.observation}</span>
          </div>
        )}
      </div>

      {!finished ? (
        <div className="sim-options">
          {step.options.map((opt, i) => (
            <button key={i} className="sim-option" onClick={() => choose(opt)}>
              <span className="sim-option-index">{i + 1}</span>
              {opt.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="sim-result">
          <div className="sim-score">{score}/100</div>
          <div className="sim-tier">{tier}</div>
          <p className="sim-result-note">{note}</p>
          <button className="sim-retry" onClick={reset}>
            Run it again
          </button>
        </div>
      )}

      <div className="sim-footer">
        <span>mistakes: {mistakes}</span>
        <div className="sim-progress">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={
                "sim-progress-dot " +
                (i < stepIndex || finished ? "done" : i === stepIndex ? "active" : "")
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function LogLineView({ line }: { line: LogLine }) {
  const tagClass: Record<LineType, string> = {
    goal: "tag-goal",
    obs: "tag-obs",
    action: "tag-action",
    fail: "tag-fail",
    reflect: "tag-reflect",
  };
  const tagLabel: Record<LineType, string> = {
    goal: "GOAL",
    obs: "OBSERVATION",
    action: "ACTION",
    fail: "FAILED",
    reflect: "REFLECT",
  };
  return (
    <div className="sim-line">
      <span className={"sim-tag " + tagClass[line.type]}>{tagLabel[line.type]}</span>
      <span className={line.type === "fail" ? "sim-text" : "sim-text"}>{line.text}</span>
    </div>
  );
}
