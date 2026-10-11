import type { ToolKey } from "./brand-icons";

/**
 * Agent board fixtures. The connectors, conversations and replies are simulated for this concept:
 * nothing is sent to Gmail, HubSpot, Teams or any other service.
 */
export type CategoryKey = "communication" | "public" | "customer" | "delivery";
export type BoardStatus = "queued" | "working" | "review" | "done";

export const CATEGORIES: { key: CategoryKey; label: string; description: string }[] = [
  { key: "communication", label: "Communication", description: "Internal channels, mailboxes and stakeholder updates" },
  { key: "public", label: "Public & market", description: "Owner communities, press and public reviews" },
  { key: "customer", label: "Customer & dealer", description: "CRM, dealer feedback and support tickets" },
  { key: "delivery", label: "Engineering delivery", description: "Requirements, Jira traceability and release gates" },
];

export const STATUSES: { key: BoardStatus; label: string; description: string }[] = [
  { key: "queued", label: "Queued", description: "Scheduled, not started" },
  { key: "working", label: "Working", description: "Calling tools now" },
  { key: "review", label: "Needs you", description: "Waiting for a PM decision" },
  { key: "done", label: "Done", description: "Finished this cycle" },
];

export type BoardAgent = {
  id: string;
  name: string;
  category: CategoryKey;
  role: string;
  autonomy: "A1" | "A2";
  tools: ToolKey[];
  status: BoardStatus;
  task: string;
  updated: string;
  peers: string[];
  suggestions: string[];
};

export const BOARD_AGENTS: BoardAgent[] = [
  {
    id: "teams-liaison",
    name: "Teams Liaison",
    category: "communication",
    role: "Follows the programme channels in Microsoft Teams and turns decisions into tracked follow-ups.",
    autonomy: "A1",
    tools: ["teams", "outlook", "sharepoint"],
    status: "working",
    task: "Summarise this week's launch-readiness channel",
    updated: "2 min ago",
    peers: ["requirement-scribe", "inbox-triage"],
    suggestions: ["Summarise today's launch-readiness thread", "Draft the Friday stakeholder digest", "Who is blocking the USB-C decision?"],
  },
  {
    id: "inbox-triage",
    name: "Inbox Triage",
    category: "communication",
    role: "Reads the product-feedback mailbox, tags every email by topic and routes it to the right agent.",
    autonomy: "A1",
    tools: ["gmail", "outlook", "slack"],
    status: "review",
    task: "14 dealer emails tagged · 3 need a PM decision",
    updated: "8 min ago",
    peers: ["dealer-voice", "crm-analyst"],
    suggestions: ["What came into the feedback inbox today?", "Show the 3 emails that need me", "Route the seat-comfort emails to Dealer Voice"],
  },
  {
    id: "social-listener",
    name: "Social Listener",
    category: "public",
    role: "Tracks owner communities on Reddit, YouTube and X for recurring themes and sentiment shifts.",
    autonomy: "A1",
    tools: ["reddit", "youtube", "x"],
    status: "working",
    task: "Weekly owner sentiment sweep",
    updated: "just now",
    peers: ["press-scout", "requirement-scribe"],
    suggestions: ["What are owners complaining about this week?", "Is the infotainment lag getting worse?", "Compare sentiment with last month"],
  },
  {
    id: "press-scout",
    name: "Press & Review Scout",
    category: "public",
    role: "Collects professional reviews and press coverage and extracts each verdict with its source link.",
    autonomy: "A1",
    tools: ["news", "web", "youtube"],
    status: "done",
    task: "Pulled 9 new US reviews of the 5 Series",
    updated: "41 min ago",
    peers: ["social-listener"],
    suggestions: ["What do reviewers criticise most?", "Find reviews that mention rear-seat space", "Summarise the Car and Driver verdict"],
  },
  {
    id: "crm-analyst",
    name: "CRM Analyst",
    category: "customer",
    role: "Mines HubSpot and Salesforce for lost-deal reasons and configuration requests.",
    autonomy: "A1",
    tools: ["hubspot", "salesforce", "sheets"],
    status: "working",
    task: "Lost-deal reasons Q3, US East region",
    updated: "5 min ago",
    peers: ["dealer-voice", "inbox-triage"],
    suggestions: ["Why did we lose deals in Q3?", "Which options do buyers ask for most?", "Export lost deals to a sheet"],
  },
  {
    id: "dealer-voice",
    name: "Dealer Voice",
    category: "customer",
    role: "Clusters dealer and support tickets from Zendesk into recurring customer requests.",
    autonomy: "A1",
    tools: ["zendesk", "gmail", "sheets"],
    status: "queued",
    task: "Cluster September service tickets",
    updated: "Scheduled 14:00",
    peers: ["crm-analyst", "inbox-triage"],
    suggestions: ["Start the September ticket clustering", "Top 5 dealer requests this month", "Any safety-related tickets?"],
  },
  {
    id: "requirement-scribe",
    name: "Requirement Scribe",
    category: "delivery",
    role: "Turns reviewed evidence into Jira-ready requirements with acceptance criteria and source links.",
    autonomy: "A2",
    tools: ["jira", "confluence", "bmw"],
    status: "review",
    task: "Draft: rear-seat USB-C 100 W · awaiting PM",
    updated: "12 min ago",
    peers: ["teams-liaison", "release-guard", "social-listener"],
    suggestions: ["Show me the USB-C draft", "Which drafts are waiting for me?", "Create a Jira story from the approved draft"],
  },
  {
    id: "release-guard",
    name: "Release Guard",
    category: "delivery",
    role: "Checks that approved requirements trace to Jira epics, code and release notes before a gate.",
    autonomy: "A2",
    tools: ["jira", "github", "teams"],
    status: "queued",
    task: "Pre-gate trace check for the MY27 software drop",
    updated: "Scheduled tomorrow",
    peers: ["requirement-scribe"],
    suggestions: ["Run the pre-gate trace check now", "Which approved requirements have no epic?", "Post the gate status to Teams"],
  },
];

export const agentById = new Map(BOARD_AGENTS.map((agent) => [agent.id, agent]));

export type ChatItem =
  | { id: string; kind: "user"; text: string; at: string }
  | { id: string; kind: "agent"; agent: string; text: string; at: string }
  | { id: string; kind: "tool"; agent: string; tool: ToolKey; action: string; detail: string; result: string; state: "running" | "done"; at: string }
  | { id: string; kind: "handoff"; from: string; to: string; text: string; at: string };

export type Step =
  | { type: "tool"; agent: string; tool: ToolKey; action: string; detail: string; result: string }
  | { type: "say"; agent: string; text: string }
  | { type: "handoff"; from: string; to: string; text: string };

/** Conversation key for the shared channel every agent reads. */
export const CHANNEL = "channel";

type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;
let seedCounter = 0;
const seed = (items: WithoutId<ChatItem>[]): ChatItem[] =>
  items.map((item) => ({ ...item, id: `seed-${++seedCounter}` }) as ChatItem);

export function seedConversations(): Record<string, ChatItem[]> {
  return {
    "teams-liaison": seed([
      { kind: "user", text: "What did the launch-readiness channel decide yesterday?", at: "08:41" },
      { kind: "tool", agent: "teams-liaison", tool: "teams", action: "Read channel messages", detail: "#launch-readiness · last 24 h", result: "63 messages · 4 decisions · 2 open questions", state: "done", at: "08:41" },
      { kind: "tool", agent: "teams-liaison", tool: "sharepoint", action: "Open file", detail: "Launch_Readiness_v7.xlsx › Decisions", result: "Sheet updated 18:42 · 4 rows added", state: "done", at: "08:41" },
      { kind: "agent", agent: "teams-liaison", text: "Three decisions landed: the ambient-light package moves to the base trim, the OTA window stays at 02:00 local, and dealer demo cars ship with the winter package. Two questions are open. One of them is rear-seat USB-C charging, so I asked Requirement Scribe whether a requirement already covers it.", at: "08:42" },
      { kind: "handoff", from: "teams-liaison", to: "requirement-scribe", text: "Does a requirement already cover rear-seat USB-C fast charging for the US trim?", at: "08:42" },
      { kind: "handoff", from: "requirement-scribe", to: "teams-liaison", text: "A draft exists: 100 W USB-C PD in the rear console, score 3.8, grade B. It is waiting for a PM decision, so nothing is approved yet.", at: "08:43" },
      { kind: "agent", agent: "teams-liaison", text: "Summary: covered by a draft, not approved. I'll flag it in Friday's digest unless you decide on it first.", at: "08:43" },
    ]),
    "inbox-triage": seed([
      { kind: "tool", agent: "inbox-triage", tool: "gmail", action: "Search mail", detail: "label:product-feedback newer_than:1d", result: "14 new threads", state: "done", at: "07:58" },
      { kind: "tool", agent: "inbox-triage", tool: "outlook", action: "Read shared mailbox", detail: "dealer-feedback@ · Inbox", result: "6 new messages · 2 with attachments", state: "done", at: "07:59" },
      { kind: "agent", agent: "inbox-triage", text: "I tagged 20 messages: 7 seat comfort, 5 infotainment, 4 charging, 4 other. Three need you because they ask for a commitment: two dealers want a date for the rear-seat USB-C update and one fleet buyer asks about a 7-seat option.", at: "08:00" },
      { kind: "handoff", from: "inbox-triage", to: "dealer-voice", text: "Sending you 7 seat-comfort emails for this afternoon's clustering run.", at: "08:00" },
      { kind: "tool", agent: "inbox-triage", tool: "slack", action: "Post message", detail: "#pm-inbox-digest", result: "Posted digest · 3 items flagged for review", state: "done", at: "08:01" },
    ]),
    "social-listener": seed([
      { kind: "tool", agent: "social-listener", tool: "reddit", action: "Search posts", detail: "r/BMW, r/5Series · \"G60\" · 7 days", result: "212 posts · 1,940 comments", state: "done", at: "09:10" },
      { kind: "tool", agent: "social-listener", tool: "youtube", action: "Read comments", detail: "Top 12 owner reviews · 30 days", result: "3,480 comments analysed", state: "done", at: "09:11" },
      { kind: "tool", agent: "social-listener", tool: "x", action: "Search posts", detail: "\"5 Series\" OR #G60 lang:en", result: "860 posts · sentiment −0.12", state: "done", at: "09:12" },
      { kind: "agent", agent: "social-listener", text: "Two themes are rising. Infotainment start-up lag is mentioned 38% more than last week, mostly after the September OTA. Rear-seat charging keeps appearing in family-buyer threads. Press & Review Scout is checking whether reviewers see the same lag.", at: "09:13" },
      { kind: "handoff", from: "social-listener", to: "press-scout", text: "Owners report slower infotainment start-up since the September OTA. Do any recent professional reviews mention it?", at: "09:13" },
    ]),
    "press-scout": seed([
      { kind: "handoff", from: "social-listener", to: "press-scout", text: "Owners report slower infotainment start-up since the September OTA. Do any recent professional reviews mention it?", at: "09:13" },
      { kind: "tool", agent: "press-scout", tool: "news", action: "Search news", detail: "\"BMW 5 Series\" review · US · 30 days", result: "9 reviews · 4 publications", state: "done", at: "09:14" },
      { kind: "tool", agent: "press-scout", tool: "web", action: "Fetch and extract", detail: "9 review pages · verdict paragraphs", result: "9 verdicts extracted with source links", state: "done", at: "09:15" },
      { kind: "handoff", from: "press-scout", to: "social-listener", text: "Two of nine reviews mention a slow first boot of iDrive. Neither ties it to the OTA. Source links are attached in the evidence import.", at: "09:16" },
      { kind: "agent", agent: "press-scout", text: "Done for this cycle. Reviewers praise ride comfort and the cabin. The most common criticisms are the touch-only climate controls (5 of 9) and rear-seat space for tall passengers (3 of 9).", at: "09:16" },
    ]),
    "crm-analyst": seed([
      { kind: "tool", agent: "crm-analyst", tool: "hubspot", action: "Query deals", detail: "pipeline=retail · stage=closed lost · Q3 · US East", result: "184 lost deals", state: "done", at: "08:20" },
      { kind: "tool", agent: "crm-analyst", tool: "salesforce", action: "Read opportunity notes", detail: "184 opportunities · loss reason fields", result: "151 with a recorded reason", state: "done", at: "08:22" },
      { kind: "agent", agent: "crm-analyst", text: "Early read: price is the top recorded reason (34%), then delivery time (19%) and missing options (16%). Within missing options, a third-row seat and rear-seat charging come up most. I'm asking Dealer Voice whether service tickets show the same pattern.", at: "08:23" },
      { kind: "handoff", from: "crm-analyst", to: "dealer-voice", text: "Lost deals cite missing rear-seat charging. Can you check whether service tickets mention it too when you run the clustering?", at: "08:23" },
    ]),
    "dealer-voice": seed([
      { kind: "handoff", from: "inbox-triage", to: "dealer-voice", text: "Sending you 7 seat-comfort emails for this afternoon's clustering run.", at: "08:00" },
      { kind: "handoff", from: "crm-analyst", to: "dealer-voice", text: "Lost deals cite missing rear-seat charging. Can you check whether service tickets mention it too when you run the clustering?", at: "08:23" },
      { kind: "agent", agent: "dealer-voice", text: "Queued for 14:00. I'll cluster the September Zendesk tickets, include the 7 forwarded emails and report back on rear-seat charging to CRM Analyst.", at: "08:24" },
    ]),
    "requirement-scribe": seed([
      { kind: "tool", agent: "requirement-scribe", tool: "bmw", action: "Read evidence", detail: "Topic: rear-seat charging · 5 series G60 · US", result: "23 evidence items · 4 sources · 2 conflicting", state: "done", at: "08:30" },
      { kind: "tool", agent: "requirement-scribe", tool: "confluence", action: "Read page", detail: "Interior electrics › Charging standards", result: "USB-C PD 3.1 guidance · rev. 12", state: "done", at: "08:31" },
      { kind: "agent", agent: "requirement-scribe", text: "Draft ready: \"Rear console provides two USB-C ports with up to 100 W PD.\" It carries three acceptance criteria and links all 23 evidence items, including the two that conflict. Score 3.8, grade B. A PM needs to accept this exact version before I create the Jira story.", at: "08:33" },
      { kind: "handoff", from: "teams-liaison", to: "requirement-scribe", text: "Does a requirement already cover rear-seat USB-C fast charging for the US trim?", at: "08:42" },
      { kind: "handoff", from: "requirement-scribe", to: "teams-liaison", text: "A draft exists: 100 W USB-C PD in the rear console, score 3.8, grade B. It is waiting for a PM decision, so nothing is approved yet.", at: "08:43" },
    ]),
    "release-guard": seed([
      { kind: "agent", agent: "release-guard", text: "Scheduled for tomorrow 07:00. I'll check that every approved requirement in the MY27 drop links to a Jira epic, a merged pull request and a release-note entry, then post the result to the release channel in Teams.", at: "07:30" },
      { kind: "handoff", from: "release-guard", to: "requirement-scribe", text: "Send me any requirements approved after 18:00 today so they're included in the gate check.", at: "07:31" },
    ]),
    [CHANNEL]: seed([
      { kind: "handoff", from: "inbox-triage", to: "dealer-voice", text: "Sending you 7 seat-comfort emails for this afternoon's clustering run.", at: "08:00" },
      { kind: "handoff", from: "crm-analyst", to: "dealer-voice", text: "Lost deals cite missing rear-seat charging. Can you check whether service tickets mention it too when you run the clustering?", at: "08:23" },
      { kind: "handoff", from: "teams-liaison", to: "requirement-scribe", text: "Does a requirement already cover rear-seat USB-C fast charging for the US trim?", at: "08:42" },
      { kind: "handoff", from: "requirement-scribe", to: "teams-liaison", text: "A draft exists: 100 W USB-C PD in the rear console, score 3.8, grade B. It is waiting for a PM decision, so nothing is approved yet.", at: "08:43" },
      { kind: "handoff", from: "social-listener", to: "press-scout", text: "Owners report slower infotainment start-up since the September OTA. Do any recent professional reviews mention it?", at: "09:13" },
      { kind: "handoff", from: "press-scout", to: "social-listener", text: "Two of nine reviews mention a slow first boot of iDrive. Neither ties it to the OTA. Source links are attached in the evidence import.", at: "09:16" },
    ]),
  };
}

/** What one call to a connector looks like in a reply. */
const TOOL_ACTIONS: Record<ToolKey, { action: string; result: (n: number) => string }> = {
  gmail: { action: "Search mail", result: (n) => `${n} matching threads` },
  outlook: { action: "Search mailbox", result: (n) => `${n} messages · ${Math.max(1, n % 5)} unread` },
  teams: { action: "Search channels", result: (n) => `${n} messages in 3 channels` },
  sharepoint: { action: "Search documents", result: (n) => `${Math.max(2, n % 9)} documents` },
  slack: { action: "Search messages", result: (n) => `${n} messages` },
  hubspot: { action: "Query CRM", result: (n) => `${n * 3} records` },
  salesforce: { action: "Run report", result: (n) => `${n * 2} opportunities` },
  zendesk: { action: "Search tickets", result: (n) => `${n * 4} tickets` },
  sheets: { action: "Write rows", result: (n) => `${n} rows written` },
  reddit: { action: "Search posts", result: (n) => `${n * 6} posts` },
  youtube: { action: "Read comments", result: (n) => `${n * 40} comments` },
  x: { action: "Search posts", result: (n) => `${n * 12} posts` },
  news: { action: "Search news", result: (n) => `${Math.max(3, n % 11)} articles` },
  web: { action: "Search the web", result: (n) => `${Math.max(4, n % 13)} pages` },
  jira: { action: "Search issues", result: (n) => `${Math.max(2, n % 17)} issues` },
  confluence: { action: "Search pages", result: (n) => `${Math.max(2, n % 7)} pages` },
  github: { action: "Search pull requests", result: (n) => `${Math.max(2, n % 12)} pull requests` },
  bmw: { action: "Search evidence", result: (n) => `${n} evidence items with source links` },
};

const SUMMARIES: Record<CategoryKey, string[]> = {
  communication: [
    "Most of the discussion is about launch timing; nobody has committed to a date yet. I'd keep this in the Friday digest and flag it to the programme lead.",
    "The thread converges on one ask: a clear owner for the charging decision. I've drafted a two-line follow-up you can send.",
  ],
  public: [
    "The theme is real but concentrated: a few long threads drive most mentions. It's worth tracking, not yet strong enough to justify a requirement on its own.",
    "Sentiment is slightly negative and stable. The loudest posts are from early owners after the September OTA.",
  ],
  customer: [
    "The pattern holds across regions: price first, then missing options. Rear-seat charging appears in both deals and tickets, which makes it a good candidate for the evidence base.",
    "Dealers report the same requests as buyers, which gives us two independent sources for the same need.",
  ],
  delivery: [
    "Traceability is mostly complete. Two items still need a PM decision before I can link them to an epic.",
    "Nothing moves to Jira without a PM accepting the exact version. I've prepared the story so it's one click once you decide.",
  ],
};

const hash = (text: string) => [...text].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 7);
const quote = (text: string) => (text.length > 52 ? `${text.slice(0, 50).trimEnd()}…` : text);

/** Agent ids named as @mentions, in order. `@all` names every agent. */
export function mentionsIn(text: string): string[] {
  const lower = text.toLowerCase();
  if (/(^|\s)@all\b/.test(lower)) return BOARD_AGENTS.map((agent) => agent.id);
  return BOARD_AGENTS.filter((agent) => lower.includes(`@${agent.name.toLowerCase()}`)).map((agent) => agent.id);
}

/** The message with @mentions read as plain names, so it can be quoted in a handoff. */
export function withoutMentions(text: string): string {
  let rest = text.replace(/(^|\s)@all\b/gi, "$1");
  for (const agent of BOARD_AGENTS) rest = rest.replace(new RegExp(`@(${agent.name})`, "gi"), "$1");
  return rest.replace(/\s+/g, " ").trim() || text;
}

/** One agent's own work on a request: a call to each of its first two connectors and a summary. */
function ownWork(agentId: string, text: string, toolCount = 2): Step[] {
  const agent = agentById.get(agentId)!;
  const n = 8 + (hash(agentId + text) % 40);
  const steps: Step[] = agent.tools.slice(0, toolCount).map((tool, index) => ({
    type: "tool",
    agent: agentId,
    tool,
    action: TOOL_ACTIONS[tool].action,
    detail: index === 0 ? `"${quote(text)}"` : "Related items · 30 days",
    result: TOOL_ACTIONS[tool].result(n + index * 7),
  }));
  const options = SUMMARIES[agent.category];
  steps.push({ type: "say", agent: agentId, text: options[hash(text + agentId) % options.length] });
  return steps;
}

/** Steps for a message sent to one agent. Mentioned agents are consulted through visible handoffs. */
export function planReply(agentId: string, text: string): Step[] {
  const agent = agentById.get(agentId)!;
  const peers = mentionsIn(text).filter((id) => id !== agentId);
  const ask = withoutMentions(text);
  const steps: Step[] = ownWork(agentId, ask).slice(0, -1);
  for (const peerId of peers.slice(0, 3)) {
    const peer = agentById.get(peerId)!;
    steps.push({ type: "handoff", from: agentId, to: peerId, text: `Can you check this from your side? "${quote(ask)}"` });
    steps.push(...ownWork(peerId, ask, 1).filter((step) => step.type === "tool"));
    const peerSummary = SUMMARIES[peer.category][hash(peerId + text) % 2];
    steps.push({ type: "handoff", from: peerId, to: agentId, text: peerSummary });
  }
  const close = ownWork(agentId, ask).at(-1)!;
  if (peers.length && close.type === "say")
    close.text = `I combined my results with ${peers.map((id) => agentById.get(id)!.name).join(" and ")}. ${close.text}`;
  steps.push(close);
  if (agent.autonomy === "A2")
    steps.push({ type: "say", agent: agentId, text: "This is a proposal. It waits for you on the board under Needs you." });
  return steps;
}

/** Steps for a message in the shared channel: mentioned agents answer, otherwise one agent per category. */
export function planChannel(text: string): Step[] {
  const mentioned = mentionsIn(text);
  const responders = mentioned.length
    ? mentioned
    : CATEGORIES.map((category) => {
        const members = BOARD_AGENTS.filter((agent) => agent.category === category.key);
        return members[hash(text + category.key) % members.length].id;
      });
  const ask = withoutMentions(text);
  const steps: Step[] = [];
  responders.forEach((id, index) => {
    const work = ownWork(id, ask, 1);
    steps.push(...work);
    const next = responders[index + 1];
    if (next) steps.push({ type: "handoff", from: id, to: next, text: "Over to you. Anything that contradicts this?" });
  });
  return steps;
}
