import type { Check } from "./examChecks";

export interface ToolSpec {
  name: string;
  description: string;
  params: string[];
}

/** Shape of `questions.content` for scenarioType = 'execution'. */
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

export interface QuestionRow {
  id: string;
  label: string;
  psychometricAttribute: string;
  difficulty: number;
  scenarioType: string;
  content: ExecutionContent;
}
