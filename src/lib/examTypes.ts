import type { Check } from "./examChecks";

export interface ToolSpec {
  name: string;
  description: string;
  params: string[];
}

/**
 * Shape of `questions.content` for scenarioType = 'execution' -- a real
 * tool-use scenario, graded on the execution trace.
 */
export interface ExecutionContent {
  request: string;
  tools: ToolSpec[];
  constraints: string[];
  todo: string[];
  great: string[];
  harnessSource: string;
  starterCode: string;
  checks: Check[];
}

/**
 * Shape of `questions.content` for scenarioType = 'reasoning' -- a written
 * answer, self-assessed against a sample answer. No auto-grading exists
 * for this type yet (that's the LLM-jury layer from the original design
 * doc, deliberately deferred) -- these responses are recorded but excluded
 * from the numeric score, same as the original exam mockup's own framing
 * ("queued for rubric review").
 */
export interface ReasoningContent {
  request: string;
  tools: ToolSpec[];
  constraints: string[];
  todo: string[];
  great: string[];
  sampleAnswer: string;
}

export interface ArrangeBlock {
  id: string;
  label: string;
  description: string;
}

/**
 * Shape of `questions.content` for scenarioType = 'blockArranger' -- put a
 * shuffled set of labeled steps into the correct order (e.g. the ReAct
 * loop). Auto-graded, unlike 'reasoning', because "is this the right
 * order" is exact-match checkable -- no LLM jury needed for this one.
 */
export interface BlockArrangerContent {
  request: string;
  instructions: string;
  blocks: ArrangeBlock[];
  correctOrder: string[]; // block ids, in the correct sequence
  great: string[];
}

export interface TraceLogLine {
  text: string;
  kind: "action" | "observation" | "muted";
}

/**
 * What accompanies a multiple-choice question, if anything: nothing (a
 * plain MCQ), an inline diagram to read, or a pre-baked execution log to
 * diagnose. The log variant is deliberately not the same thing as the
 * 'execution' type -- here the agent has already run and failed, and the
 * skill being tested is reading a trace and diagnosing it, not producing
 * one yourself. Both are real, different skills.
 */
export type QuestionVisual = { kind: "diagram"; svg: string } | { kind: "trace"; lines: TraceLogLine[] };

/**
 * Shape of `questions.content` for scenarioType = 'multipleChoice' -- a
 * single correct option, exact-match graded, with an explanation shown
 * immediately after answering regardless of whether the answer was right.
 */
export interface MultipleChoiceContent {
  request: string;
  visual?: QuestionVisual;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export type QuestionContent = ExecutionContent | ReasoningContent | BlockArrangerContent | MultipleChoiceContent;

export interface QuestionRow {
  id: string;
  label: string;
  psychometricAttribute: string;
  difficulty: number;
  scenarioType: "execution" | "reasoning" | "blockArranger" | "multipleChoice";
  content: QuestionContent;
}
