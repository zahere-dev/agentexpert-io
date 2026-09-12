import type { QuestionRow } from "./examTypes";

const STORAGE_KEY = "aax_exam_session";

interface AttributeResultSnapshot {
  attribute: string;
  total: number;
  correct?: number;
  percent?: number;
}

interface ResultsSnapshot {
  overallPercent: number;
  attributeResults: AttributeResultSnapshot[];
  ungradedCount: number;
}

export interface ExamSessionState {
  phase: "quiz" | "results";
  attemptId: string;
  lengthTier: number;
  questions: QuestionRow[];
  index: number;
  answered: Record<string, boolean>;
  marked: number[];
  reasoningAnswers: Record<string, string>;
  blockOrders: Record<string, string[]>;
  mcqSelected: Record<string, number>;
  results?: ResultsSnapshot;
}

/**
 * Signing in mid-exam is a real browser navigation (out to Google, back
 * again) -- that's a full page reload, not a client-side route change, so
 * every bit of React state would otherwise vanish and the candidate lands
 * back on the picker screen looking like nothing happened. sessionStorage
 * (not localStorage) is deliberate: this should survive exactly one
 * reload/tab-lifetime, not linger as stale state in a future unrelated
 * visit.
 */
export function saveExamSession(state: ExamSessionState): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore -- worst case, a sign-in mid-exam loses progress
  }
}

export function loadExamSession(): ExamSessionState | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearExamSession(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
