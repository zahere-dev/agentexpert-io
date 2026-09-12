export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}

export type Check =
  | { type: "called"; tool: string; label: string }
  | { type: "notCalled"; tool: string; label: string }
  | { type: "calledBefore"; before: string; after: string; label: string }
  | { type: "argEquals"; tool: string; arg: string; value: unknown; label: string };

export interface CheckResult {
  label: string;
  passed: boolean;
}

/**
 * A small, serializable rubric DSL instead of stored code: question content
 * (including its checks) lives entirely as data in Postgres, and this is
 * the one interpreter every question's rubric runs through. Adding a new
 * question never requires a code change; adding a new *kind* of check does.
 */
export function runChecks(trace: ToolCall[], checks: Check[]): CheckResult[] {
  const indexOf = (tool: string) => trace.findIndex((c) => c.tool === tool);

  return checks.map((check) => {
    switch (check.type) {
      case "called":
        return { label: check.label, passed: indexOf(check.tool) !== -1 };
      case "notCalled":
        return { label: check.label, passed: indexOf(check.tool) === -1 };
      case "calledBefore": {
        const beforeIdx = indexOf(check.before);
        const afterIdx = indexOf(check.after);
        return {
          label: check.label,
          passed: beforeIdx !== -1 && (afterIdx === -1 || beforeIdx < afterIdx),
        };
      }
      case "argEquals": {
        const call = trace.find((c) => c.tool === check.tool);
        return { label: check.label, passed: !!call && call.args[check.arg] === check.value };
      }
    }
  });
}
