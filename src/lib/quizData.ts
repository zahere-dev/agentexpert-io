export type QuizCategory = "Knowledge" | "Application" | "Analysis" | "Creativity";

export interface QuizQuestion {
  id: string;
  category: QuizCategory;
  question: string;
  options: string[];
  correctIndex: number;
}

export const CATEGORIES: QuizCategory[] = ["Knowledge", "Application", "Analysis", "Creativity"];

export const CATEGORY_COLOR: Record<QuizCategory, string> = {
  Knowledge: "#2563eb",
  Application: "#16a34a",
  Analysis: "#d97706",
  Creativity: "#9333ea",
};

export const CATEGORY_TIP: Record<QuizCategory, string> = {
  Knowledge:
    "Brush up on the core vocabulary — memory, tool use, RAG, and protocols like MCP. Solid recall makes every other skill faster.",
  Application:
    "Practice turning theory into implementation choices — when to reach for RAG vs. fine-tuning, memory vs. stateless calls, one agent vs. many.",
  Analysis:
    "Work on diagnosing failure modes — runaway cost, hallucination, and tool-selection breakdowns — before they hit production.",
  Creativity:
    "Push past textbook patterns — design novel agent architectures, guardrails, and team structures for problems with no established playbook.",
};

export type Level = "Beginner" | "Intermediate" | "Proficient" | "Expert";

export function levelForScore(percent: number): Level {
  if (percent >= 85) return "Expert";
  if (percent >= 65) return "Proficient";
  if (percent >= 40) return "Intermediate";
  return "Beginner";
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // Knowledge
  {
    id: "k1",
    category: "Knowledge",
    question: "In agent architectures, what does the ReAct pattern combine?",
    options: [
      "Reasoning and Acting in an interleaved loop",
      "Retrieval and Caching for faster responses",
      "React.js and a backend API",
      "Redundancy and Accuracy checks",
    ],
    correctIndex: 0,
  },
  {
    id: "k2",
    category: "Knowledge",
    question: "What is the primary role of a system prompt for an LLM agent?",
    options: [
      "It stores the conversation history permanently",
      "It sets persistent instructions, role, and constraints for the model's behavior",
      "It's the same as a user message, just sent first",
      "It compresses the model's weights for faster inference",
    ],
    correctIndex: 1,
  },
  {
    id: "k3",
    category: "Knowledge",
    question: "What does \"grounding\" mean in the context of an AI agent's answers?",
    options: [
      "Rate-limiting the agent so it can't respond too quickly",
      "Restarting the agent when it crashes",
      "Basing responses on retrieved, verifiable source data instead of memory alone",
      "Running the agent on local hardware instead of the cloud",
    ],
    correctIndex: 2,
  },
  {
    id: "k4",
    category: "Knowledge",
    question: "What is the Model Context Protocol (MCP) primarily used for?",
    options: [
      "A standardized way for agents to discover and call external tools/data sources",
      "A protocol for compressing model checkpoints",
      "A billing standard for LLM API usage",
      "A UI framework for chat interfaces",
    ],
    correctIndex: 0,
  },
  {
    id: "k5",
    category: "Knowledge",
    question: "What's the key difference between short-term and long-term memory in an agent?",
    options: [
      "Short-term memory is faster hardware; long-term memory is slower hardware",
      "Short-term memory lives within a session/thread; long-term memory persists across sessions",
      "There is no meaningful difference, both mean the same thing",
      "Short-term memory is for images; long-term memory is for text",
    ],
    correctIndex: 1,
  },

  // Application
  {
    id: "a1",
    category: "Application",
    question: "You need an agent to answer questions using your company's internal documents. What's the most direct approach?",
    options: [
      "Fine-tune the base model on every document from scratch",
      "Ask the user to paste the relevant document into every message",
      "Set up retrieval-augmented generation (RAG) over an indexed document store",
      "Increase the model's temperature setting",
    ],
    correctIndex: 2,
  },
  {
    id: "a2",
    category: "Application",
    question: "Your agent keeps calling the same tool in a loop and never finishes. What's the most direct fix?",
    options: [
      "Switch to a bigger model",
      "Add a max-iteration limit and a clear stop/completion condition",
      "Remove all tools from the agent",
      "Increase the context window size",
    ],
    correctIndex: 1,
  },
  {
    id: "a3",
    category: "Application",
    question: "You want an agent to remember a user's preferences across separate sessions, days apart. What should you use?",
    options: [
      "A larger system prompt repeated every time",
      "A persistent long-term memory store keyed to the user",
      "A bigger context window with the full chat history",
      "Nothing — LLMs remember automatically",
    ],
    correctIndex: 1,
  },
  {
    id: "a4",
    category: "Application",
    question: "An agent can book flights but should never do so without explicit user approval first. What pattern applies?",
    options: [
      "Fully autonomous execution",
      "Human-in-the-loop approval before irreversible actions",
      "Disable the booking tool entirely",
      "Run the booking twice to confirm",
    ],
    correctIndex: 1,
  },
  {
    id: "a5",
    category: "Application",
    question: "A task needs deep research plus polished writing. What architecture best fits?",
    options: [
      "One agent doing both jobs with a single generic prompt",
      "Multiple specialized agents (researcher, writer) coordinated by an orchestrator",
      "A single tool call with no LLM involved",
      "Running the same prompt twice and picking the longer output",
    ],
    correctIndex: 1,
  },

  // Analysis
  {
    id: "an1",
    category: "Analysis",
    question: "An agent's token cost is unpredictable, sometimes making 20 tool calls for a simple task. What's the most likely root cause?",
    options: [
      "The model provider is overcharging",
      "Missing iteration limits or a weak planning/completion-check step",
      "The user's internet connection is slow",
      "The tools are too well documented",
    ],
    correctIndex: 1,
  },
  {
    id: "an2",
    category: "Analysis",
    question: "Users report the agent gives confident, detailed, but factually wrong answers. What's the most likely root cause?",
    options: [
      "The UI font is too small",
      "The agent is answering from memory without grounding in retrieved sources",
      "The agent's temperature is set to 0",
      "The server region is too far from the user",
    ],
    correctIndex: 1,
  },
  {
    id: "an3",
    category: "Analysis",
    question: "Tool-calling accuracy drops noticeably after you add more tools to an agent. What's the most likely explanation?",
    options: [
      "More tools always improve accuracy, so this shouldn't happen",
      "Too many similar tools with vague descriptions make selection harder for the model",
      "The agent framework has a hard limit of exactly 3 tools",
      "Tools should never be added after initial setup",
    ],
    correctIndex: 1,
  },
  {
    id: "an4",
    category: "Analysis",
    question: "A framework claims strong \"zero-shot planning,\" but the agent breaks on tasks with several dependent steps. What evaluation would expose this?",
    options: [
      "A single-step Q&A benchmark",
      "A multi-step task requiring each step's output to feed the next",
      "A typing speed test",
      "A UI accessibility audit",
    ],
    correctIndex: 1,
  },
  {
    id: "an5",
    category: "Analysis",
    question: "Comparing two agent frameworks — one uses JSON-schema tool calls, the other uses native typed methods (object-oriented agents). What's the key tradeoff to analyze?",
    options: [
      "Font rendering differences in their docs",
      "Schema/token overhead and rigidity vs. native type-safety and flexibility",
      "Which one has a nicer logo",
      "There is no meaningful tradeoff between the two",
    ],
    correctIndex: 1,
  },

  // Creativity
  {
    id: "c1",
    category: "Creativity",
    question: "You're designing an agent for a small business owner with no technical background. What should you prioritize?",
    options: [
      "Exposing every configuration option and raw model parameter",
      "A narrow, opinionated workflow with sensible defaults and plain-language confirmations",
      "Requiring them to write their own prompts",
      "A command-line interface for maximum control",
    ],
    correctIndex: 1,
  },
  {
    id: "c2",
    category: "Creativity",
    question: "You're designing a guardrail system from scratch for a new agent. What's the strongest approach?",
    options: [
      "Trust the model to self-regulate with no external checks",
      "Layer independent checks: input validation, action allow-lists, and a review step before irreversible actions",
      "Only rely on a longer system prompt asking it to \"be careful\"",
      "Disable all tools so nothing can go wrong",
    ],
    correctIndex: 1,
  },
  {
    id: "c3",
    category: "Creativity",
    question: "You want to test an agent's reasoning without relying only on hardcoded test cases. What's the most creative, effective approach?",
    options: [
      "Only ever test with the same three prompts",
      "Generate novel, randomized task variations and have another model or rubric grade the reasoning trace",
      "Assume it works if it doesn't crash",
      "Skip testing and rely on user complaints",
    ],
    correctIndex: 1,
  },
  {
    id: "c4",
    category: "Creativity",
    question: "You're combining voice, agents, and robotics. What's the most interesting problem to tackle first?",
    options: [
      "Making the robot's plastic shell a different color",
      "Grounding spoken intent into safe, verifiable physical actions with fallback to human confirmation",
      "Picking the loudest speaker for the voice output",
      "Avoiding robotics entirely and staying text-only",
    ],
    correctIndex: 1,
  },
  {
    id: "c5",
    category: "Creativity",
    question: "If agents formed a 3-agent team for customer support like a human team would, what's the most effective role split?",
    options: [
      "Three identical agents all doing the same thing redundantly",
      "A triager to classify/route, a specialist to resolve, and a reviewer to catch mistakes before sending",
      "One agent per keyboard key pressed by the user",
      "No role split — whichever agent responds fastest wins",
    ],
    correctIndex: 1,
  },
];
