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

export type QuestionContent = ExecutionContent | ReasoningContent | BlockArrangerContent;

export interface QuestionRow {
  id: string;
  label: string;
  psychometricAttribute: string;
  difficulty: number;
  scenarioType: "execution" | "reasoning" | "blockArranger";
  content: QuestionContent;
}
