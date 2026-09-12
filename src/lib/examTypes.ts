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

export type QuestionContent = ExecutionContent | ReasoningContent;

export interface QuestionRow {
  id: string;
  label: string;
  psychometricAttribute: string;
  difficulty: number;
  scenarioType: "execution" | "reasoning";
  content: QuestionContent;
}
