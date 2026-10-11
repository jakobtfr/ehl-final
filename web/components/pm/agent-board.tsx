"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  LoaderCircle,
  Maximize2,
  MessagesSquare,
  Minimize2,
  RotateCcw,
  SendHorizontal,
  UsersRound,
  X,
} from "lucide-react";
import { TOOL_NAMES, ToolLogo, type ToolKey } from "./brand-icons";
import {
  BOARD_AGENTS,
  CATEGORIES,
  CHANNEL,
  STATUSES,
  agentById,
  planChannel,
  planReply,
  seedConversations,
  type BoardAgent,
  type BoardStatus,
  type CategoryKey,
  type ChatItem,
  type Step,
} from "./agent-board-data";
import { useWorkspace } from "./context";

type GroupBy = "status" | "category";
type Live = Record<string, { tool?: ToolKey; typing?: boolean }>;
type AgentState = Record<string, { status: BoardStatus; task: string; updated: string }>;

const clock = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
const initials = (name: string) =>
  name
    .split(/[\s&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
const categoryLabel = (key: CategoryKey) => CATEGORIES.find((category) => category.key === key)!.label;
const statusLabel = (key: BoardStatus) => STATUSES.find((status) => status.key === key)!.label;

function Avatar({ agent, size = 28 }: { agent: BoardAgent; size?: number }) {
  return (
    <span className={`board-avatar cat-${agent.category}`} style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden>
      {initials(agent.name)}
    </span>
  );
}

function ToolStack({ tools, size = 18 }: { tools: ToolKey[]; size?: number }) {
  return (
    <span className="tool-stack">
      {tools.map((tool) => (
        <span key={tool} className="tool-stack-item" title={TOOL_NAMES[tool]}>
          <ToolLogo tool={tool} size={size} />
        </span>
      ))}
    </span>
  );
}

/** Highlights @mentions of board agents inside a message. */
function MessageText({ text }: { text: string }) {
  const names = [...BOARD_AGENTS.map((agent) => agent.name), "all"].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(@(?:${names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}))`, "gi");
  return (
    <>
      {text.split(pattern).map((part, index) =>
        index % 2 ? (
          <span key={index} className="chat-mention">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

function AgentCard({
  agent,
  state,
  live,
  groupBy,
  selected,
  overlay,
  onOpen,
}: {
  agent: BoardAgent;
  state: AgentState[string];
  live?: Live[string];
  groupBy: GroupBy;
  selected?: boolean;
  overlay?: boolean;
  onOpen?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: agent.id, disabled: groupBy !== "status" || overlay });
  const busy = live?.tool || live?.typing;
  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      role="button"
      tabIndex={0}
      aria-label={`${agent.name}, ${statusLabel(state.status)}. Open chat`}
      aria-pressed={selected}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen?.();
        listeners?.onKeyDown?.(event);
      }}
      className={`board-card ${selected ? "is-selected" : ""} ${isDragging ? "is-dragging" : ""} ${overlay ? "is-overlay" : ""}`}
    >
      <div className="board-card-top">
        {groupBy === "status" ? (
          <span className={`board-chip cat-${agent.category}`}>{categoryLabel(agent.category)}</span>
        ) : (
          <span className={`board-chip status-chip status-${state.status}`}>{statusLabel(state.status)}</span>
        )}
        <span className="board-card-autonomy mono" title={agent.autonomy === "A2" ? "Proposals need a human accept" : "Proposes; a PM reviews the result"}>
          {agent.autonomy}
        </span>
      </div>
      <div className="board-card-title">
        <Avatar agent={agent} />
        <strong>{agent.name}</strong>
      </div>
      <p className="board-card-task">{state.task}</p>
      <div className="board-card-foot">
        <ToolStack tools={agent.tools} />
        {busy ? (
          <span className="board-live">
            <span className="board-live-dot" />
            {live?.tool ? `Using ${TOOL_NAMES[live.tool]}` : "Writing…"}
          </span>
        ) : (
          <span className="board-updated">{state.updated}</span>
        )}
      </div>
    </div>
  );
}

function Column({
  id,
  title,
  description,
  count,
  tone,
  droppable,
  children,
}: {
  id: string;
  title: string;
  description: string;
  count: number;
  tone: string;
  droppable: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !droppable });
  return (
    <section ref={setNodeRef} className={`board-column tone-${tone} ${isOver ? "is-over" : ""}`} aria-label={`${title}, ${count} agents`}>
      <header>
        <span className="board-column-marker" aria-hidden />
        <h2>{title}</h2>
        <span className="board-column-count">{count}</span>
      </header>
      <p className="board-column-description">{description}</p>
      <div className="board-column-cards">
        {children}
        {count === 0 && <div className="board-column-empty">Drop an agent here</div>}
      </div>
    </section>
  );
}

function ChatEntry({ item }: { item: ChatItem }) {
  if (item.kind === "user")
    return (
      <div className="chat-row chat-user">
        <div className="chat-bubble">
          <MessageText text={item.text} />
        </div>
        <time>{item.at}</time>
      </div>
    );
  if (item.kind === "agent") {
    const agent = agentById.get(item.agent)!;
    return (
      <div className="chat-row chat-agent">
        <Avatar agent={agent} size={26} />
        <div>
          <div className="chat-author">
            {agent.name} <time>{item.at}</time>
          </div>
          <p className="chat-text">
            <MessageText text={item.text} />
          </p>
        </div>
      </div>
    );
  }
  if (item.kind === "tool") {
    const agent = agentById.get(item.agent)!;
    return (
      <div className={`chat-tool ${item.state === "running" ? "is-running" : ""}`}>
        <span className="chat-tool-logo">
          <ToolLogo tool={item.tool} size={18} />
        </span>
        <div className="chat-tool-body">
          <div className="chat-tool-title">
            <strong>{TOOL_NAMES[item.tool]}</strong>
            <span>{item.action}</span>
            <span className="chat-tool-by">· {agent.name}</span>
          </div>
          <code className="chat-tool-detail">{item.detail}</code>
          {item.state === "done" && <div className="chat-tool-result">{item.result}</div>}
        </div>
        <span className="chat-tool-state" aria-label={item.state === "running" ? "Running" : "Done"}>
          {item.state === "running" ? <LoaderCircle size={15} className="animate-spin" /> : <CircleCheck size={15} />}
        </span>
      </div>
    );
  }
  const from = agentById.get(item.from)!;
  const to = agentById.get(item.to)!;
  return (
    <div className="chat-handoff">
      <div className="chat-handoff-route">
        <Avatar agent={from} size={20} />
        <span>{from.name}</span>
        <ArrowRightLeft size={12} aria-label="to" />
        <Avatar agent={to} size={20} />
        <span>{to.name}</span>
        <time>{item.at}</time>
      </div>
      <p>{item.text}</p>
    </div>
  );
}

/** Textarea with an @mention menu for addressing other agents. */
function Composer({
  placeholder,
  disabled,
  suggestions,
  allowAll,
  onSend,
  inputRef,
}: {
  placeholder: string;
  disabled: boolean;
  suggestions: string[];
  allowAll: boolean;
  onSend: (text: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const [text, setText] = useState("");
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [active, setActive] = useState(0);
  const options = useMemo(() => {
    if (!mention) return [];
    const all = [...(allowAll ? [{ id: "all", name: "all", hint: "Every agent on the board" }] : []), ...BOARD_AGENTS.map((agent) => ({ id: agent.id, name: agent.name, hint: categoryLabel(agent.category) }))];
    return all.filter((option) => option.name.toLowerCase().includes(mention.query.toLowerCase())).slice(0, 8);
  }, [mention, allowAll]);

  const track = (value: string, caret: number) => {
    const match = /(^|\s)@([\w &]{0,24})$/.exec(value.slice(0, caret));
    setMention(match ? { query: match[2], start: caret - match[2].length - 1 } : null);
    setActive(0);
  };
  const pick = (name: string) => {
    if (!mention || !inputRef.current) return;
    const caret = inputRef.current.selectionStart ?? text.length;
    const next = `${text.slice(0, mention.start)}@${name} ${text.slice(caret)}`;
    setText(next);
    setMention(null);
    requestAnimationFrame(() => {
      const position = mention.start + name.length + 2;
      inputRef.current?.setSelectionRange(position, position);
      inputRef.current?.focus();
    });
  };
  const send = (value = text) => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setText("");
    setMention(null);
  };

  return (
    <div className="chat-composer">
      {suggestions.length > 0 && (
        <div className="chat-suggestions" aria-label="Suggested messages">
          {suggestions.map((suggestion) => (
            <button key={suggestion} type="button" disabled={disabled} onClick={() => send(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      )}
      <div className="chat-input">
        {mention && options.length > 0 && (
          <ul className="mention-menu" role="listbox" aria-label="Mention an agent">
            {options.map((option, index) => {
              const agent = agentById.get(option.id);
              return (
                <li
                  key={option.id}
                  role="option"
                  aria-selected={index === active}
                  className={index === active ? "is-active" : ""}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    pick(option.name);
                  }}
                >
                  {agent ? (
                    <Avatar agent={agent} size={20} />
                  ) : (
                    <span className="board-avatar cat-all" style={{ width: 20, height: 20 }}>
                      <UsersRound size={11} />
                    </span>
                  )}
                  <span>@{option.name}</span>
                  <small>{option.hint}</small>
                </li>
              );
            })}
          </ul>
        )}
        <textarea
          ref={inputRef}
          rows={2}
          value={text}
          placeholder={placeholder}
          aria-label="Message"
          onChange={(event) => {
            setText(event.target.value);
            track(event.target.value, event.target.selectionStart);
          }}
          onKeyDown={(event) => {
            if (mention && options.length) {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setActive((active + (event.key === "ArrowDown" ? 1 : options.length - 1)) % options.length);
                return;
              }
              if (event.key === "Enter" || event.key === "Tab") {
                event.preventDefault();
                pick(options[active].name);
                return;
              }
              if (event.key === "Escape") {
                event.stopPropagation();
                setMention(null);
                return;
              }
            }
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
        />
        <button type="button" className="chat-send" aria-label="Send message" disabled={disabled || !text.trim()} onClick={() => send()}>
          <SendHorizontal size={16} />
        </button>
      </div>
      <p className="chat-hint">
        Type <kbd>@</kbd> to bring in another agent{allowAll ? " or @all" : ""}. Enter sends, Shift + Enter adds a line.
      </p>
    </div>
  );
}

/** Notion-style side peek: the board stays usable on the left while one agent (or the channel) is open on the right. */
function SidePeek({
  target,
  state,
  items,
  live,
  running,
  expanded,
  onExpand,
  onClose,
  onStep,
  onStatus,
  onSend,
  onOpen,
}: {
  target: string;
  state: AgentState;
  items: ChatItem[];
  live: Live;
  running: boolean;
  expanded: boolean;
  onExpand: () => void;
  onClose: () => void;
  onStep: (direction: 1 | -1) => void;
  onStatus: (status: BoardStatus) => void;
  onSend: (text: string) => void;
  onOpen: (id: string) => void;
}) {
  const agent = agentById.get(target);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const typing = Object.entries(live).filter(([, value]) => value.typing).map(([id]) => agentById.get(id)!);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, [target]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [items.length, typing.length, target]);

  return (
    <aside className={`side-peek ${expanded ? "is-expanded" : ""}`} aria-label={agent ? `${agent.name} chat` : "Agent channel"}>
      <div className="side-peek-bar">
        <button type="button" onClick={onClose} aria-label="Close side peek" title="Close (Esc)">
          <X size={16} />
        </button>
        <button type="button" onClick={onExpand} aria-label={expanded ? "Narrow side peek" : "Widen side peek"} title={expanded ? "Narrow" : "Widen"}>
          {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        {agent && (
          <>
            <button type="button" onClick={() => onStep(-1)} aria-label="Previous agent" title="Previous agent">
              <ChevronUp size={16} />
            </button>
            <button type="button" onClick={() => onStep(1)} aria-label="Next agent" title="Next agent">
              <ChevronDown size={16} />
            </button>
          </>
        )}
        <span className="side-peek-crumb">
          Agent board / {agent ? categoryLabel(agent.category) : "Channel"}
        </span>
      </div>

      <div className="side-peek-body">
        <div className="side-peek-head">
          {agent ? (
            <>
              <Avatar agent={agent} size={44} />
              <div>
                <h2>{agent.name}</h2>
                <p>{agent.role}</p>
              </div>
            </>
          ) : (
            <>
              <span className="board-avatar cat-all" style={{ width: 44, height: 44 }}>
                <UsersRound size={20} />
              </span>
              <div>
                <h2>Agent channel</h2>
                <p>Every agent reads this channel. Handoffs between agents appear here, and @all asks the whole board.</p>
              </div>
            </>
          )}
        </div>

        {agent ? (
          <dl className="peek-properties">
            <dt>Status</dt>
            <dd>
              <div className="peek-status" role="group" aria-label="Status">
                {STATUSES.map((status) => (
                  <button
                    key={status.key}
                    type="button"
                    aria-pressed={state[agent.id].status === status.key}
                    className={`status-${status.key}`}
                    onClick={() => onStatus(status.key)}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
            </dd>
            <dt>Category</dt>
            <dd>
              <span className={`board-chip cat-${agent.category}`}>{categoryLabel(agent.category)}</span>
            </dd>
            <dt>Current task</dt>
            <dd>{state[agent.id].task}</dd>
            <dt>Autonomy</dt>
            <dd>
              <span className="mono">{agent.autonomy}</span> {agent.autonomy === "A2" ? "Its proposals need a human accept" : "Proposes; a PM reviews the result"}
            </dd>
            <dt>Connected tools</dt>
            <dd className="peek-tools">
              {agent.tools.map((tool) => (
                <span key={tool}>
                  <ToolLogo tool={tool} size={16} />
                  {TOOL_NAMES[tool]}
                </span>
              ))}
            </dd>
            <dt>Works with</dt>
            <dd className="peek-peers">
              {agent.peers.map((id) => {
                const peer = agentById.get(id)!;
                return (
                  <button key={id} type="button" onClick={() => onOpen(id)} title={`Open ${peer.name}`}>
                    <Avatar agent={peer} size={18} />
                    {peer.name}
                  </button>
                );
              })}
            </dd>
          </dl>
        ) : (
          <div className="peek-roster">
            {BOARD_AGENTS.map((member) => (
              <button key={member.id} type="button" onClick={() => onOpen(member.id)} title={`Open ${member.name}`}>
                <Avatar agent={member} size={22} />
                <span>{member.name}</span>
                <small>{statusLabel(state[member.id].status)}</small>
              </button>
            ))}
          </div>
        )}

        <div className="chat-log" aria-live="polite">
          <div className="chat-divider">
            <span>{agent ? "Conversation" : "Agent-to-agent messages"}</span>
          </div>
          {items.map((item) => (
            <ChatEntry key={item.id} item={item} />
          ))}
          {typing.map((member) => (
            <div key={member.id} className="chat-row chat-agent chat-typing">
              <Avatar agent={member} size={26} />
              <span>
                {member.name} is writing<span className="typing-dots" aria-hidden />
              </span>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <Composer
        key={target}
        inputRef={inputRef}
        placeholder={agent ? `Message ${agent.name}…` : "Message every agent…"}
        disabled={running}
        allowAll={!agent}
        suggestions={running ? [] : agent ? agent.suggestions : ["@all What should I look at before the Friday review?", "Where do we have conflicting evidence?"]}
        onSend={onSend}
      />
    </aside>
  );
}

/** Kanban board of agents: drag a card between status columns, open it to chat, and watch agents hand work to each other. */
export function AgentBoard() {
  const { scope } = useWorkspace();
  const dndId = useId();
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [state, setState] = useState<AgentState>(() =>
    Object.fromEntries(BOARD_AGENTS.map((agent) => [agent.id, { status: agent.status, task: agent.task, updated: agent.updated }])),
  );
  const [conversations, setConversations] = useState(seedConversations);
  const [open, setOpen] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [live, setLive] = useState<Record<string, Live>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [unread, setUnread] = useState(0);
  const [dragging, setDragging] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const counter = useRef(0);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) setOpen(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] } }),
  );

  const nextId = () => `msg-${++counter.current}`;
  const append = useCallback((conversation: string, item: ChatItem) => {
    setConversations((all) => ({ ...all, [conversation]: [...(all[conversation] ?? []), item] }));
    if (conversation === CHANNEL && openRef.current !== CHANNEL) setUnread((count) => count + 1);
  }, []);
  const patch = (conversation: string, id: string, changes: Partial<Extract<ChatItem, { kind: "tool" }>>) =>
    setConversations((all) => ({
      ...all,
      [conversation]: all[conversation].map((item) => (item.id === id && item.kind === "tool" ? { ...item, ...changes } : item)),
    }));
  const setAgentLive = (conversation: string, agent: string, value: Live[string] | null) =>
    setLive((all) => {
      const current = { ...(all[conversation] ?? {}) };
      if (value) current[agent] = value;
      else delete current[agent];
      return { ...all, [conversation]: current };
    });
  const updateAgent = (id: string, changes: Partial<AgentState[string]>) =>
    setState((all) => ({ ...all, [id]: { ...all[id], ...changes } }));

  /** Plays scripted steps with realistic pacing: tool calls spin, then resolve; handoffs reach the channel and the other agent. */
  const play = (conversation: string, steps: Step[], owner?: string) => {
    const schedule = (delay: number, fn: () => void) => timers.current.push(window.setTimeout(fn, delay));
    setRunning((all) => ({ ...all, [conversation]: true }));
    let delay = 450;
    for (const step of steps) {
      if (step.type === "tool") {
        const id = nextId();
        schedule(delay, () => {
          append(conversation, { id, kind: "tool", agent: step.agent, tool: step.tool, action: step.action, detail: step.detail, result: step.result, state: "running", at: clock() });
          setAgentLive(conversation, step.agent, { tool: step.tool });
        });
        delay += 1150;
        schedule(delay, () => {
          patch(conversation, id, { state: "done" });
          setAgentLive(conversation, step.agent, null);
        });
        delay += 250;
      } else if (step.type === "say") {
        schedule(delay, () => setAgentLive(conversation, step.agent, { typing: true }));
        delay += 850;
        schedule(delay, () => {
          setAgentLive(conversation, step.agent, null);
          append(conversation, { id: nextId(), kind: "agent", agent: step.agent, text: step.text, at: clock() });
        });
        delay += 350;
      } else {
        schedule(delay, () => {
          const at = clock();
          append(conversation, { id: nextId(), kind: "handoff", from: step.from, to: step.to, text: step.text, at });
          if (conversation !== CHANNEL) append(CHANNEL, { id: nextId(), kind: "handoff", from: step.from, to: step.to, text: step.text, at });
          const other = step.from === conversation ? step.to : step.from;
          if (other !== conversation) append(other, { id: nextId(), kind: "handoff", from: step.from, to: step.to, text: step.text, at });
        });
        delay += 950;
      }
    }
    schedule(delay, () => {
      setRunning((all) => ({ ...all, [conversation]: false }));
      if (owner) {
        const agent = agentById.get(owner)!;
        updateAgent(owner, { status: agent.autonomy === "A2" ? "review" : "done", updated: "just now" });
      }
    });
  };

  const send = (text: string) => {
    if (!open) return;
    append(open, { id: nextId(), kind: "user", text, at: clock() });
    if (open === CHANNEL) {
      play(CHANNEL, planChannel(text));
    } else {
      updateAgent(open, { status: "working", task: text.length > 70 ? `${text.slice(0, 68).trimEnd()}…` : text, updated: "just now" });
      play(open, planReply(open, text), open);
    }
  };

  const openTarget = (id: string) => {
    setOpen(id);
    if (id === CHANNEL) setUnread(0);
  };

  const columns =
    groupBy === "status"
      ? STATUSES.map((status) => ({ id: status.key, title: status.label, description: status.description, tone: status.key, agents: BOARD_AGENTS.filter((agent) => state[agent.id].status === status.key) }))
      : CATEGORIES.map((category) => ({ id: category.key, title: category.label, description: category.description, tone: `cat-${category.key}`, agents: BOARD_AGENTS.filter((agent) => agent.category === category.key) }));
  const order = columns.flatMap((column) => column.agents.map((agent) => agent.id));
  const step = (direction: 1 | -1) => {
    if (!open || open === CHANNEL) return;
    const index = order.indexOf(open);
    setOpen(order[(index + direction + order.length) % order.length]);
  };
  const busyAgents = (id: string) => Object.values(live).reduce<Live[string] | undefined>((found, entry) => found ?? entry[id], undefined);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (!over || groupBy !== "status") return;
    const status = over.id as BoardStatus;
    if (state[String(active.id)].status !== status) updateAgent(String(active.id), { status, updated: "just now" });
  };

  const counts = Object.fromEntries(STATUSES.map((status) => [status.key, BOARD_AGENTS.filter((agent) => state[agent.id].status === status.key).length]));
  const latest = [...(conversations[CHANNEL] ?? [])].reverse().find((item) => item.kind === "handoff");

  return (
    <div className={`agent-board-page ${open ? "has-peek" : ""}`}>
      <div className="board-heading">
        <div>
          <h1>Agent board</h1>
          <p className="agent-lede">
            Eight agents across four areas work on {scope.vehicle} / {scope.market}. Drag a card to change its status, open it to chat, and type @ to
            bring another agent into the conversation.
          </p>
        </div>
        <div className="board-actions">
          <button type="button" className={`board-channel-button ${open === CHANNEL ? "is-active" : ""}`} onClick={() => openTarget(CHANNEL)}>
            <MessagesSquare size={15} />
            Agent channel
            {unread > 0 && <span className="nav-count">{unread}</span>}
          </button>
        </div>
      </div>

      <div className="board-toolbar">
        <div className="segmented-control" role="group" aria-label="Group cards by">
          <button type="button" aria-pressed={groupBy === "status"} onClick={() => setGroupBy("status")}>
            By status
          </button>
          <button type="button" aria-pressed={groupBy === "category"} onClick={() => setGroupBy("category")}>
            By category
          </button>
        </div>
        <span className="board-summary">
          <strong>{BOARD_AGENTS.length}</strong> agents · <strong>{counts.working}</strong> working · <strong className="is-attention">{counts.review}</strong> need you
        </span>
        <span className="toolbar-spacer" />
        <button
          type="button"
          className="text-link board-reset"
          onClick={() => {
            timers.current.forEach((timer) => window.clearTimeout(timer));
            timers.current = [];
            setState(Object.fromEntries(BOARD_AGENTS.map((agent) => [agent.id, { status: agent.status, task: agent.task, updated: agent.updated }])));
            setConversations(seedConversations());
            setLive({});
            setRunning({});
            setUnread(0);
          }}
        >
          <RotateCcw size={13} /> Reset demo
        </button>
      </div>

      {latest && latest.kind === "handoff" && (
        <button type="button" className="board-ticker" onClick={() => openTarget(CHANNEL)}>
          <ArrowRightLeft size={13} />
          <strong>{agentById.get(latest.from)!.name}</strong>
          <span aria-hidden>→</span>
          <strong>{agentById.get(latest.to)!.name}</strong>
          <span className="board-ticker-text">{latest.text}</span>
          <time>{latest.at}</time>
        </button>
      )}

      <DndContext id={dndId} sensors={sensors} onDragStart={({ active }) => setDragging(String(active.id))} onDragCancel={() => setDragging(null)} onDragEnd={onDragEnd}>
        <div className="board-columns">
          {columns.map((column) => (
            <Column key={column.id} id={column.id} title={column.title} description={column.description} count={column.agents.length} tone={column.tone} droppable={groupBy === "status"}>
              {column.agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  state={state[agent.id]}
                  live={busyAgents(agent.id)}
                  groupBy={groupBy}
                  selected={open === agent.id}
                  onOpen={() => openTarget(agent.id)}
                />
              ))}
            </Column>
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {dragging ? <AgentCard agent={agentById.get(dragging)!} state={state[dragging]} groupBy={groupBy} overlay /> : null}
        </DragOverlay>
      </DndContext>

      {open && (
        <SidePeek
          target={open}
          state={state}
          items={conversations[open] ?? []}
          live={live[open] ?? {}}
          running={!!running[open]}
          expanded={expanded}
          onExpand={() => setExpanded(!expanded)}
          onClose={() => setOpen(null)}
          onStep={step}
          onStatus={(status) => open !== CHANNEL && updateAgent(open, { status, updated: "just now" })}
          onSend={send}
          onOpen={openTarget}
        />
      )}
    </div>
  );
}
