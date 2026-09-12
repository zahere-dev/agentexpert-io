import { useEffect, useRef, useState } from "react";
import "./pyodide-exam.css";

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<any>;
  }
}

const PYODIDE_VERSION = "0.27.2";
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

// The mock-tool harness: plain Python, no real network/file I/O. Every call
// gets appended to CALL_LOG so we can grade the trace after the run instead
// of trusting free-text prose about what the candidate "would" do.
const HARNESS_SOURCE = `
CALL_LOG = []

_ORDERS = {
    "48213": {"status": "lost_in_transit", "eligible": True, "amount": 84.50},
}

def get_order_status(order_id):
    order = _ORDERS.get(order_id, {"status": "unknown"})
    CALL_LOG.append({"tool": "get_order_status", "args": {"order_id": order_id}})
    return {"order_id": order_id, "status": order["status"]}

def check_refund_eligibility(order_id):
    order = _ORDERS.get(order_id, {"eligible": False, "amount": 0})
    CALL_LOG.append({"tool": "check_refund_eligibility", "args": {"order_id": order_id}})
    return {"order_id": order_id, "eligible": order["eligible"], "amount": order["amount"]}

def issue_refund(order_id, amount):
    CALL_LOG.append({"tool": "issue_refund", "args": {"order_id": order_id, "amount": amount}})
    return {"success": True, "order_id": order_id, "amount": amount}
`;

const STARTER_CODE = `# You're evaluating a customer-support agent.
# Order #48213 never arrived. Find out what happened and make it
# right -- but don't refund anything without checking eligibility first.
#
# Available: get_order_status(order_id), check_refund_eligibility(order_id),
# issue_refund(order_id, amount)

status = get_order_status("48213")
print("status:", status)

eligibility = check_refund_eligibility("48213")
print("eligibility:", eligibility)

if eligibility["eligible"]:
    result = issue_refund("48213", eligibility["amount"])
    print("refund result:", result)
`;

interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}

interface CheckResult {
  label: string;
  passed: boolean;
}

function gradeTrace(trace: ToolCall[]): CheckResult[] {
  const indexOf = (name: string) => trace.findIndex((c) => c.tool === name);
  const statusIdx = indexOf("get_order_status");
  const eligibilityIdx = indexOf("check_refund_eligibility");
  const refundIdx = indexOf("issue_refund");
  const refundCall = trace.find((c) => c.tool === "issue_refund");

  return [
    {
      label: "Checked order status before doing anything else",
      passed: statusIdx !== -1 && (refundIdx === -1 || statusIdx < refundIdx),
    },
    {
      label: "Checked refund eligibility before issuing a refund",
      passed: eligibilityIdx !== -1 && (refundIdx === -1 || eligibilityIdx < refundIdx),
    },
    {
      label: "Actually issued the refund (order is eligible)",
      passed: refundIdx !== -1,
    },
    {
      label: "Refunded the exact eligible amount ($84.50), not an arbitrary number",
      passed: !!refundCall && refundCall.args.amount === 84.5,
    },
  ];
}

type LoadState = "loading" | "ready" | "error";
type LogLine = { text: string; kind: "stdout" | "error" | "muted" };

export default function PyodideExam() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [code, setCode] = useState(STARTER_CODE);
  const [log, setLog] = useState<LogLine[]>([{ text: "Loading Python runtime…", kind: "muted" }]);
  const [trace, setTrace] = useState<ToolCall[] | null>(null);
  const [running, setRunning] = useState(false);
  const pyodideRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        await loadScript(`${PYODIDE_INDEX_URL}pyodide.js`);
        if (cancelled) return;
        const pyodide = await window.loadPyodide!({ indexURL: PYODIDE_INDEX_URL });
        if (cancelled) return;
        pyodide.runPython(HARNESS_SOURCE);
        pyodideRef.current = pyodide;
        setLoadState("ready");
        setLog([{ text: "Python runtime ready. Click Run to execute your code.", kind: "muted" }]);
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoadState("error");
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  async function run() {
    const pyodide = pyodideRef.current;
    if (!pyodide || running) return;

    setRunning(true);
    setTrace(null);
    const lines: LogLine[] = [];

    pyodide.setStdout({
      batched: (text: string) => lines.push({ text, kind: "stdout" }),
    });
    pyodide.setStderr({
      batched: (text: string) => lines.push({ text, kind: "error" }),
    });

    try {
      // Reset the trace for this run without redefining the tool functions.
      pyodide.runPython("CALL_LOG.clear()");
      await pyodide.runPythonAsync(code);
      const rawTrace = pyodide.globals.get("CALL_LOG").toJs({ dict_converter: Object.fromEntries });
      const parsedTrace: ToolCall[] = rawTrace.map((t: any) => ({ tool: t.tool, args: t.args }));
      setTrace(parsedTrace);
      if (lines.length === 0) lines.push({ text: "(no output)", kind: "muted" });
    } catch (err) {
      lines.push({ text: String(err), kind: "error" });
      setTrace([]);
    } finally {
      setLog(lines);
      setRunning(false);
    }
  }

  const checks = trace ? gradeTrace(trace) : null;
  const passedCount = checks ? checks.filter((c) => c.passed).length : 0;

  return (
    <div className="pyx">
      <div className="pyx-banner">
        <strong>Prototype:</strong> this runs real Python in your browser via Pyodide (WebAssembly) —
        no server, no sandbox vendor. The candidate's code calls mock tools that log every call, and
        grading below reads that trace instead of trusting written prose about what the code "would" do.
      </div>

      {loadState === "loading" && (
        <div className="pyx-status">
          <span className="pyx-spinner" />
          Loading Python runtime{"…"} (first load only, ~2-3s)
        </div>
      )}
      {loadState === "error" && (
        <div className="pyx-status" style={{ color: "#c9463c" }}>
          Couldn't load the Python runtime. Check your connection and reload.
        </div>
      )}

      <div className="pyx-grid">
        <div className="pyx-panel">
          <div className="pyx-panel-head">
            <span>agent_response.py</span>
            <button className="pyx-run-btn" onClick={run} disabled={loadState !== "ready" || running}>
              {running ? "Running…" : "Run"}
            </button>
          </div>
          <textarea
            className="pyx-code"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                e.preventDefault();
                const target = e.currentTarget;
                const { selectionStart, selectionEnd } = target;
                const next = code.slice(0, selectionStart) + "    " + code.slice(selectionEnd);
                setCode(next);
                requestAnimationFrame(() => {
                  target.selectionStart = target.selectionEnd = selectionStart + 4;
                });
              }
            }}
          />
        </div>

        <div className="pyx-panel">
          <div className="pyx-panel-head">
            <span>output</span>
          </div>
          <div className="pyx-log">
            {log.map((l, i) => (
              <div key={i} className={`line-${l.kind}`}>
                {l.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {checks && (
        <div className="pyx-results">
          <div className="pyx-results-head">
            <h3>Grading result</h3>
            <span className="pyx-results-score">
              {passedCount} of {checks.length} checks passed
            </span>
          </div>
          <ul className="pyx-check-list">
            {checks.map((c, i) => (
              <li className="pyx-check-item" key={i}>
                <span className={`pyx-check-icon ${c.passed ? "pass" : "fail"}`}>
                  {c.passed ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12 5 5L20 7" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  )}
                </span>
                <span>{c.label}</span>
              </li>
            ))}
          </ul>

          <div className="pyx-trace">
            <p className="pyx-trace-label">Execution trace</p>
            {trace && trace.length > 0 ? (
              trace.map((t, i) => (
                <div className="pyx-trace-row" key={i}>
                  <span className="idx">{i + 1}.</span>
                  <span className="tool">{t.tool}</span>
                  <span>{JSON.stringify(t.args)}</span>
                </div>
              ))
            ) : (
              <p className="pyx-trace-empty">No tool calls were made.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
