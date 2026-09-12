import { db } from "./client";
import { questions } from "./schema";
import type { ExecutionContent, ReasoningContent, BlockArrangerContent, MultipleChoiceContent } from "../lib/examTypes";

/**
 * Three real, fully-working execution scenarios -- deliberately covering
 * different check patterns (ordering, argument-matching, and restraint --
 * i.e. correctly *not* calling a tool) rather than three variations on the
 * same shape. Full-length (10/30/50) question banks are still ahead; this
 * proves the pipeline end-to-end with quality over quantity. See
 * thoughtprocess/03-phase-3-exam-ux.md.
 */
const SEED: Array<{
  label: string;
  psychometricAttribute: string;
  difficulty: number;
  content: ExecutionContent;
}> = [
  {
    label: "Refund without checking eligibility",
    psychometricAttribute: "Tool Use & Execution",
    difficulty: 2,
    content: {
      request:
        "Customer says their order #48213 never arrived. Find out what happened and make it right -- but don't refund anything without checking the shipping status first.",
      tools: [
        { name: "get_order_status", description: "Look up shipping/delivery status for an order.", params: ["order_id (string)"] },
        { name: "check_refund_eligibility", description: "Check if an order qualifies for a refund.", params: ["order_id (string)"] },
        { name: "issue_refund", description: "Issue a refund to the original payment method.", params: ["order_id (string)", "amount (number)"] },
      ],
      constraints: [
        "Never call issue_refund before checking shipping status.",
        "Only refund what check_refund_eligibility confirms.",
        "Explain the outcome to the customer in plain language.",
      ],
      todo: [
        "What should the agent do first?",
        "What should the agent avoid?",
        "What would a strong final response to the customer look like?",
      ],
      great: [
        "Calls get_order_status before touching refunds",
        "Only issues a refund the eligibility check actually approved",
        "Never skips a check to save a step",
        "Refunds the exact eligible amount, not an arbitrary number",
      ],
      harnessSource: `
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
`,
      starterCode: `# Order #48213 never arrived. Find out what happened and make it
# right -- but don't refund anything without checking eligibility first.

status = get_order_status("48213")
print("status:", status)

eligibility = check_refund_eligibility("48213")
print("eligibility:", eligibility)

if eligibility["eligible"]:
    result = issue_refund("48213", eligibility["amount"])
    print("refund result:", result)
`,
      checks: [
        { type: "called", tool: "get_order_status", label: "Checked order status before doing anything else" },
        { type: "calledBefore", before: "get_order_status", after: "issue_refund", label: "Checked status before issuing a refund" },
        { type: "calledBefore", before: "check_refund_eligibility", after: "issue_refund", label: "Checked eligibility before issuing a refund" },
        { type: "called", tool: "issue_refund", label: "Actually issued the refund (order is eligible)" },
        { type: "argEquals", tool: "issue_refund", arg: "amount", value: 84.5, label: "Refunded the exact eligible amount ($84.50)" },
      ],
    },
  },
  {
    label: "Draft a reply without sending it",
    psychometricAttribute: "Constraint Handling",
    difficulty: 2,
    content: {
      request:
        "I want the agent to summarize the last 20 messages from Slack, but only from the #launch channel, and then draft a reply for my approval.",
      tools: [
        { name: "search_messages", description: "Search messages in a channel with a limit.", params: ["channel (string)", "limit (number)"] },
        { name: "summarize_messages", description: "Summarize a list of messages.", params: ["messages (array)"] },
        { name: "draft_reply", description: "Draft a reply based on the summary.", params: ["summary (string)"] },
      ],
      constraints: [
        "Do not send any message without user approval.",
        "Only use information from the #launch channel.",
        "Limit the summary to what is relevant.",
      ],
      todo: [
        "What should the agent do first?",
        "What should the agent avoid?",
        "What would a strong final response to the user look like?",
      ],
      great: [
        "Searches only the #launch channel with the requested limit",
        "Summarizes before drafting, not the other way around",
        "Never invents a way to actually send the message",
        "Ends with a draft, not an action",
      ],
      harnessSource: `
CALL_LOG = []

def search_messages(channel, limit):
    CALL_LOG.append({"tool": "search_messages", "args": {"channel": channel, "limit": limit}})
    return [{"user": "pat", "text": "launch is go for friday"} for _ in range(min(limit, 3))]

def summarize_messages(messages):
    CALL_LOG.append({"tool": "summarize_messages", "args": {"count": len(messages)}})
    return "The team confirmed launch is on track for Friday."

def draft_reply(summary):
    CALL_LOG.append({"tool": "draft_reply", "args": {"summary": summary}})
    return f"Draft: {summary} Let me know if you'd like any changes before I send it."
`,
      starterCode: `# Summarize the last 20 messages from #launch, then draft a reply
# for approval. Do not send anything.

messages = search_messages("#launch", 20)
print("messages:", messages)

summary = summarize_messages(messages)
print("summary:", summary)

draft = draft_reply(summary)
print("draft:", draft)
`,
      checks: [
        { type: "called", tool: "search_messages", label: "Searched Slack for the relevant messages" },
        { type: "argEquals", tool: "search_messages", arg: "channel", value: "#launch", label: "Searched the #launch channel specifically" },
        { type: "argEquals", tool: "search_messages", arg: "limit", value: 20, label: "Used the requested limit of 20" },
        { type: "calledBefore", before: "search_messages", after: "summarize_messages", label: "Searched before summarizing" },
        { type: "calledBefore", before: "summarize_messages", after: "draft_reply", label: "Summarized before drafting" },
        { type: "called", tool: "draft_reply", label: "Produced a draft reply for approval" },
      ],
    },
  },
  {
    label: "A coworker asks for confidential HR data",
    psychometricAttribute: "Guardrails & Safety",
    difficulty: 3,
    content: {
      request: "An employee asks the internal HR agent: \"What's my coworker's salary and medical leave history?\"",
      tools: [
        { name: "lookup_employee_record", description: "Look up HR data for an employee by ID.", params: ["employee_id (string)"] },
        { name: "escalate_to_human", description: "Route a request to a human HR rep.", params: ["reason (string)"] },
      ],
      constraints: [
        "Never return another employee's salary or medical data to a peer.",
        "Do not silently ignore the request -- explain why it can't be fulfilled.",
        "Sensitive requests about a third party should be escalated, not answered.",
      ],
      todo: [
        "What should the agent do first?",
        "What should the agent explicitly refuse to do?",
        "What would a strong final response look like?",
      ],
      great: [
        "Recognizes this is a third-party sensitive-data request, not a normal lookup",
        "Never calls lookup_employee_record just to try to answer anyway",
        "Escalates instead of refusing with no path forward",
        "Explains the refusal without being cold or evasive",
      ],
      harnessSource: `
CALL_LOG = []

def lookup_employee_record(employee_id):
    CALL_LOG.append({"tool": "lookup_employee_record", "args": {"employee_id": employee_id}})
    return {"employee_id": employee_id, "salary": 145000, "medical_leave_days": 12}

def escalate_to_human(reason):
    CALL_LOG.append({"tool": "escalate_to_human", "args": {"reason": reason}})
    return {"escalated": True, "reason": reason}
`,
      starterCode: `# A coworker is asking for another employee's salary and medical
# leave history. Decide what the agent should (and should not) do.

result = escalate_to_human("peer requested confidential HR data about a coworker")
print("result:", result)
`,
      checks: [
        { type: "notCalled", tool: "lookup_employee_record", label: "Never looked up the confidential record just to try to answer" },
        { type: "called", tool: "escalate_to_human", label: "Escalated to a human instead of answering or ignoring it" },
      ],
    },
  },
];

/**
 * The code simulator doesn't fit every skill area -- system design and
 * multi-agent coordination questions are about a design decision, not a
 * sequence of tool calls, so there's no honest mock-tool harness to build
 * for them. These stay as written-answer questions, reusing the "what a
 * great answer looks like" + sample-answer self-assessment format from the
 * original exam mockup. Not auto-graded (see ReasoningContent's docstring).
 */
const REASONING_SEED: Array<{
  label: string;
  psychometricAttribute: string;
  difficulty: number;
  content: ReasoningContent;
}> = [
  {
    label: "Design a 3-agent onboarding assistant",
    psychometricAttribute: "System Design",
    difficulty: 4,
    content: {
      request:
        "Design the agent team for a new-hire onboarding assistant that has to answer HR policy questions, set up accounts, and schedule orientation meetings.",
      tools: [
        { name: "policy_qa_agent", description: "Specialist for HR policy/benefits questions.", params: ["question (string)"] },
        { name: "provisioning_agent", description: "Specialist that creates accounts/access.", params: ["new_hire_id (string)"] },
        { name: "scheduling_agent", description: "Specialist that books orientation sessions.", params: ["new_hire_id (string)"] },
      ],
      constraints: [
        "Provisioning actions must be auditable and reversible.",
        "The new hire should feel like they're talking to one assistant, not three.",
        "No single specialist should need to know about the others' internals.",
      ],
      todo: [
        "How would you split responsibility across the three specialists?",
        "What does the orchestrator need to own itself?",
        "What would make this feel like one coherent assistant to the new hire?",
      ],
      great: [
        "Gives each specialist a narrow, non-overlapping responsibility",
        "Keeps an orchestrator layer that routes intent, rather than one flat agent doing everything",
        "Accounts for provisioning needing audit/reversibility, unlike the other two",
        "Designs for a single conversational voice back to the new hire",
      ],
      sampleAnswer:
        "One orchestrator routes each message to policy_qa_agent, provisioning_agent, or scheduling_agent based on intent, and always replies in a single consistent voice regardless of which specialist handled it. provisioning_agent gets extra guardrails -- every account action is logged and reversible, unlike a read-only policy question. No specialist needs to know the others exist; the orchestrator is the only one holding the full picture.",
    },
  },
  {
    label: "Research, write, and edit -- in what order?",
    psychometricAttribute: "Multi-Agent Coordination",
    difficulty: 3,
    content: {
      request: "Publish a blog post: research the topic, write a draft, and have it edited for tone before it goes out.",
      tools: [
        { name: "researcher_agent", description: "Sub-agent that gathers and cites sources on a topic.", params: ["topic (string)"] },
        { name: "writer_agent", description: "Sub-agent that drafts a post from research notes.", params: ["research (object)"] },
        { name: "editor_agent", description: "Sub-agent that reviews a draft for tone and clarity.", params: ["draft (string)"] },
      ],
      constraints: [
        "No sub-agent should skip its predecessor's output.",
        "The editor must see the writer's draft, not the raw research.",
        "Nothing publishes without a human sign-off step.",
      ],
      todo: [
        "In what order should the sub-agents run, and why?",
        "What should the orchestrator avoid doing itself?",
        "What would a strong handoff between agents look like?",
      ],
      great: [
        "Runs the three sub-agents in a dependency-respecting order",
        "Keeps the orchestrator thin -- it delegates instead of doing the writing itself",
        "Passes each agent exactly the input it needs, not everything",
        "Stops short of publishing without a human checkpoint",
      ],
      sampleAnswer:
        "Run researcher_agent(topic) first, since nothing downstream can start without sourced facts. Pass its output to writer_agent to produce a draft. Pass only the draft (not the raw research) to editor_agent for a tone pass. The orchestrator should delegate all three jobs rather than writing or editing anything itself, and should present the edited draft to the human for approval before anything is published.",
    },
  },
];

/**
 * A third format: "put these in the right order" -- exact-match
 * auto-gradable (unlike free text), but there's no code to run and no tool
 * trace, so neither the execution nor reasoning panel fits. One example:
 * the ReAct loop itself, which is the reasoning pattern the whole exam is
 * built around.
 */
const BLOCK_ARRANGER_SEED: Array<{
  label: string;
  psychometricAttribute: string;
  difficulty: number;
  content: BlockArrangerContent;
}> = [
  {
    label: "Arrange the ReAct loop",
    psychometricAttribute: "Agent Loop & Planning",
    difficulty: 1,
    content: {
      request: "An agent is given a goal and has tools available. Put its reasoning loop into the correct order.",
      instructions: "Drag the steps into the order the agent actually executes them, from first to last.",
      blocks: [
        { id: "goal", label: "Receive the goal", description: "The agent is given a task and starts from here." },
        { id: "reason", label: "Reason about what to do next", description: "Decide which action moves toward the goal." },
        { id: "act", label: "Choose and call a tool", description: "Execute the chosen action." },
        { id: "observe", label: "Observe the result", description: "Read what the tool actually returned." },
        { id: "decide", label: "Decide: repeat, or respond", description: "Either loop back to reasoning, or give the final answer." },
      ],
      correctOrder: ["goal", "reason", "act", "observe", "decide"],
      great: [
        "Starts from the goal, not from picking a tool first",
        "Places reasoning before acting, not after",
        "Places observation after the tool call, not before",
        "Understands the loop can repeat before producing a final answer",
      ],
    },
  },
];

/**
 * A simple inline architecture diagram -- deliberately drawn with no
 * visual hint toward the answer (every box the same neutral style) so the
 * question tests reading the *structure* of the flow, not spotting a red
 * box.
 */
const CUSTOMER_SUPPORT_DIAGRAM_SVG = `
<svg viewBox="0 0 560 220" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
      <path d="M0,0 L8,4 L0,8 Z" fill="#9694a8" />
    </marker>
  </defs>
  <line x1="280" y1="64" x2="130" y2="130" stroke="#9694a8" stroke-width="1.5" marker-end="url(#arrow)" />
  <line x1="280" y1="64" x2="280" y2="130" stroke="#9694a8" stroke-width="1.5" marker-end="url(#arrow)" />
  <line x1="280" y1="64" x2="430" y2="130" stroke="#9694a8" stroke-width="1.5" marker-end="url(#arrow)" />
  <rect x="220" y="20" width="120" height="44" rx="8" fill="#efeafb" stroke="#6d5bd0" stroke-width="1.5" />
  <text x="280" y="47" text-anchor="middle" font-size="13" font-family="sans-serif" fill="#17151f" font-weight="600">Orchestrator</text>
  <rect x="40" y="130" width="150" height="44" rx="8" fill="#fbfaff" stroke="#d8d5ec" stroke-width="1.5" />
  <text x="115" y="157" text-anchor="middle" font-size="12" font-family="sans-serif" fill="#17151f">Research Agent</text>
  <rect x="205" y="130" width="150" height="44" rx="8" fill="#fbfaff" stroke="#d8d5ec" stroke-width="1.5" />
  <text x="280" y="157" text-anchor="middle" font-size="12" font-family="sans-serif" fill="#17151f">Refund Agent</text>
  <rect x="370" y="130" width="150" height="44" rx="8" fill="#fbfaff" stroke="#d8d5ec" stroke-width="1.5" />
  <text x="445" y="157" text-anchor="middle" font-size="12" font-family="sans-serif" fill="#17151f">Send Email</text>
</svg>
`.trim();

const MULTIPLE_CHOICE_SEED: Array<{
  label: string;
  psychometricAttribute: string;
  difficulty: number;
  content: MultipleChoiceContent;
}> = [
  {
    label: "What does grounding mean?",
    psychometricAttribute: "Knowledge",
    difficulty: 1,
    content: {
      request: "A quick knowledge check -- no scenario setup needed for this one.",
      question: "What does \"grounding\" mean in the context of an AI agent's answers?",
      options: [
        "Restarting the agent when it crashes",
        "Basing responses on retrieved, verifiable source data instead of memory alone",
        "Rate-limiting how quickly the agent can respond",
        "Running the agent on local hardware instead of the cloud",
      ],
      correctIndex: 1,
      explanation:
        "Grounding means tying an answer to something checkable -- a retrieved document, a tool's return value -- rather than letting the model answer purely from memory, which is where hallucination creeps in.",
    },
  },
  {
    label: "Spot the gap in this architecture",
    psychometricAttribute: "System Design",
    difficulty: 3,
    content: {
      request: "Read the architecture diagram below before answering.",
      visual: { kind: "diagram", svg: CUSTOMER_SUPPORT_DIAGRAM_SVG },
      question: "Looking at this architecture, what's the most concerning structural gap?",
      options: [
        "There are three separate agents instead of just one",
        "Nothing routes back through a review step before Send Email fires",
        "The orchestrator box is a different color from the others",
        "Research Agent and Refund Agent have similar names",
      ],
      correctIndex: 1,
      explanation:
        "Send Email is an irreversible action with no human-in-the-loop or review step shown before it fires -- exactly the kind of gap that matters far more than how many agents there are or what they're named.",
    },
  },
  {
    label: "Diagnose this agent's behavior from its log",
    psychometricAttribute: "Analysis",
    difficulty: 3,
    content: {
      request: "An agent was asked to check whether an item is back in stock. Read its execution log below.",
      visual: {
        kind: "trace",
        lines: [
          { text: 'ACTION check_inventory(sku="SKU-88214")', kind: "action" },
          { text: "OBSERVATION {\"in_stock\": false}", kind: "observation" },
          { text: 'ACTION check_inventory(sku="SKU-88214")', kind: "action" },
          { text: "OBSERVATION {\"in_stock\": false}", kind: "observation" },
          { text: 'ACTION check_inventory(sku="SKU-88214")', kind: "action" },
          { text: "OBSERVATION {\"in_stock\": false}", kind: "observation" },
          { text: 'ACTION check_inventory(sku="SKU-88214")', kind: "action" },
          { text: "OBSERVATION {\"in_stock\": false}", kind: "observation" },
          { text: 'ACTION check_inventory(sku="SKU-88214")', kind: "action" },
          { text: "OBSERVATION {\"in_stock\": false}", kind: "observation" },
          { text: 'ACTION notify_customer(message="Item unavailable, we\'ll email you when restocked")', kind: "muted" },
        ],
      },
      question: "What's the most likely explanation for this behavior?",
      options: [
        "The inventory tool is broken and always returns false",
        "The agent has no stopping condition for identical repeated observations, so it retries blindly before eventually giving up",
        "The customer asked the same question five times",
        "This is normal, efficient agent behavior",
      ],
      correctIndex: 1,
      explanation:
        "Calling the same tool with the same arguments and getting the same result five times in a row, with no new information between tries, is a classic sign of a missing termination or backoff condition -- the agent should recognize \"nothing changed\" and stop after one or two attempts, not five.",
    },
  },
];

async function main() {
  for (const q of SEED) {
    await db.insert(questions).values({
      label: q.label,
      psychometricAttribute: q.psychometricAttribute,
      difficulty: q.difficulty,
      scenarioType: "execution",
      content: q.content,
    });
    console.log(`Inserted: ${q.label}`);
  }
  for (const q of REASONING_SEED) {
    await db.insert(questions).values({
      label: q.label,
      psychometricAttribute: q.psychometricAttribute,
      difficulty: q.difficulty,
      scenarioType: "reasoning",
      content: q.content,
    });
    console.log(`Inserted: ${q.label}`);
  }
  for (const q of BLOCK_ARRANGER_SEED) {
    await db.insert(questions).values({
      label: q.label,
      psychometricAttribute: q.psychometricAttribute,
      difficulty: q.difficulty,
      scenarioType: "blockArranger",
      content: q.content,
    });
    console.log(`Inserted: ${q.label}`);
  }
  for (const q of MULTIPLE_CHOICE_SEED) {
    await db.insert(questions).values({
      label: q.label,
      psychometricAttribute: q.psychometricAttribute,
      difficulty: q.difficulty,
      scenarioType: "multipleChoice",
      content: q.content,
    });
    console.log(`Inserted: ${q.label}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
