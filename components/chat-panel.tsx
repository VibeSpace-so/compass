"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  SendHorizontal,
  KeyRound,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Zap,
  Copy,
  Check,
  RotateCcw,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatMessage, Integration, PersistedToolCall, Project, StageId } from "@/lib/types";
import { getStage } from "@/lib/stages";
import { generateId } from "@/lib/storage";

import { formatChatError, generateChatResponse, ToolCallInfo } from "@/lib/chat-service";

interface ChatPanelProps {
  project: Project;
  messages: ChatMessage[];
  onSendMessage: (message: ChatMessage) => void;
  isEnabled: boolean;
  onSetupKeys: () => void;
  integrations: Integration[];
  enabledProviderIds?: string[];
  onStageAdvance?: (newStage: StageId) => void;
  onMemoriesChange?: () => void;
  isEncrypted: boolean;
}

interface ToolCallDisplay {
  toolName: string;
  integrationId: string;
  status: "executing" | "success" | "error";
  result?: string;
}

interface RetryTurn {
  id: string;
  content: string;
}

const INTEGRATION_LABELS: Record<string, string> = {
  notion: "Notion",
  gdocs: "Google Docs",
  figma: "Figma",
  slack: "Slack",
  discord: "Discord",
  vercel: "Vercel",
  lovable: "Lovable",
  cursor: "Cursor",
  "claude-code": "Claude Code",
  codex: "Codex",
  devin: "Devin",
  base44: "Base44",
  _system: "Compass",
  github: "GitHub",
};

function getToolActionLabel(toolName: string, integrationId: string): string {
  const label = INTEGRATION_LABELS[integrationId] ?? integrationId;
  if (toolName.includes("search")) return `Searching ${label}...`;
  if (toolName.includes("create")) return `Creating in ${label}...`;
  if (toolName.includes("send")) return `Sending via ${label}...`;
  if (toolName.includes("deploy")) return `Deploying to ${label}...`;
  if (toolName.includes("save_memory")) return "Saving memory...";
  if (toolName.includes("advance_stage")) return "Advancing stage...";
  if (toolName.includes("fetch") || toolName.includes("list"))
    return `Fetching from ${label}...`;
  return `Using ${label}...`;
}

function ToolCallCard({ call }: { call: ToolCallDisplay }) {
  const [expanded, setExpanded] = useState(false);
  const label = INTEGRATION_LABELS[call.integrationId] ?? call.integrationId;

  return (
    <div className="my-1.5 border border-[var(--accent-26)] rounded bg-[var(--accent-05,rgba(0,255,0,0.03))]">
      <button
        onClick={() => call.result && setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left"
      >
        {call.status === "executing" && (
          <Loader2 className="w-3.5 h-3.5 text-[var(--accent)] animate-spin flex-shrink-0" />
        )}
        {call.status === "success" && (
          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent)] flex-shrink-0" />
        )}
        {call.status === "error" && (
          <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
        )}

        <Wrench className="w-3 h-3 text-[var(--text-muted)] flex-shrink-0" />

        <span className="text-xs text-[var(--text-secondary)] flex-1 min-w-0 truncate">
          {call.status === "executing"
            ? getToolActionLabel(call.toolName, call.integrationId)
            : `${label}: ${call.toolName}`}
        </span>

        {call.result && (
          <span className="flex-shrink-0">
            {expanded ? (
              <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
            ) : (
              <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
            )}
          </span>
        )}
      </button>

      {expanded && call.result && (
        <div className="px-3 pb-2 border-t border-[var(--accent-26)]">
          <pre className="text-[10px] text-[var(--text-muted)] mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap break-all">
            {call.result.length > 500
              ? call.result.slice(0, 500) + "..."
              : call.result}
          </pre>
        </div>
      )}
    </div>
  );
}

function getSuggestedReplies(project: Project, messages: ChatMessage[]): string[] {
  const stage = getStage(project.currentStage);
  if (!stage) return [];

  if (messages.length === 0) {
    // First interaction suggestions based on stage
    const stageReplies: Record<string, string[]> = {
      ideation: [
        "Help me define my project idea",
        "What questions should I answer before building?",
        "I have a rough idea, help me refine it",
      ],
      context: [
        "Help me write a project brief",
        "What context should I gather before coding?",
        "Research similar products for me",
      ],
      "landing-page": [
        "Generate a landing page prompt for Lovable",
        "What should my landing page include?",
        "Help me write compelling copy",
      ],
      github: [
        "Help me set up my GitHub repo",
        "What should my README include?",
      ],
      hosting: [
        "Help me deploy to Vercel",
        "What hosting option is best for my project?",
      ],
      domain: [
        "Help me choose a domain name",
        "How do I connect my domain?",
      ],
      "build-prototype": [
        "Help me plan my core features",
        "Generate a Cursor prompt for my prototype",
        "What should I build first?",
      ],
      "next-features": [
        "Help me prioritize features",
        "What should I build next?",
      ],
    };
    return stageReplies[project.currentStage] || [];
  }

  // After conversation started — suggest contextual follow-ups
  const lastMsg = messages[messages.length - 1];
  if (lastMsg?.role === "assistant") {
    return [
      "Tell me more",
      "What's the next step?",
      `/advance`,
    ];
  }
  return [];
}

// Markdown components for chat rendering
const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-sm">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-[var(--accent)]">{children}</strong>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <div className="relative my-2">
          <pre className="bg-black/60 border border-[var(--accent-26)] rounded p-3 overflow-x-auto">
            <code className="text-xs text-[var(--text-secondary)]">{children}</code>
          </pre>
        </div>
      );
    }
    return (
      <code className="bg-[var(--accent-10)] border border-[var(--accent-26)] rounded px-1.5 py-0.5 text-xs text-[var(--accent)]">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--accent)] underline underline-offset-2 hover:opacity-80 inline-flex items-center gap-0.5"
    >
      {children}
      <ExternalLink className="w-2.5 h-2.5" />
    </a>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-base font-semibold text-[var(--accent)] mb-2">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-sm font-semibold text-[var(--accent)] mb-1.5">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-sm font-medium text-[var(--accent)] mb-1">{children}</h3>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-[var(--accent-44)] pl-3 my-2 text-[var(--text-secondary)] italic">
      {children}
    </blockquote>
  ),
};

function getDirectiveGreeting(project: Project): string {
  const stage = getStage(project.currentStage);
  if (!stage) return "Let's get started with your project.";

  const greetings: Record<string, string> = {
    ideation: `Let's define **${project.name || "your project"}**. Tell me:\n\n1. **Who is this for?** (your target user)\n2. **What problem does it solve?**\n3. **Why now?**\n\nI'll save your answers as core memories so we never lose context.`,
    context: `Time to build context for **${project.name}**. Here's what we need:\n\n1. A **project brief** (target user, key features, constraints)\n2. **Research** on similar products\n3. **Technical decisions** (stack, tools, approach)\n\nWhat would you like to start with?`,
    "landing-page": `Let's build a landing page for **${project.name}**. I can:\n\n- Generate a **Lovable/Bolt prompt** with your full project context\n- Help write **compelling copy** for your page\n- Define the **structure** (hero, features, CTA)\n\nReady to start?`,
    github: `Let's get **${project.name}** into version control.\n\nI'll help you:\n1. Set up a GitHub repository\n2. Write a solid README\n3. Configure your project structure\n\nHave you created a repo yet, or should we start from scratch?`,
    hosting: `Time to deploy **${project.name}** live.\n\nBest options for your project:\n- **Vercel** — zero-config for Next.js/React\n- **Netlify** — great for static sites\n- **Railway** — if you need a backend\n\nWhich hosting provider would you like to use?`,
    domain: `Let's get a custom domain for **${project.name}**.\n\nI'll help you:\n1. **Choose** a memorable domain name\n2. **Register** it (Namecheap, Cloudflare, etc.)\n3. **Connect** it to your hosting\n\nDo you have a domain in mind, or want suggestions?`,
    "build-prototype": `Time to build the real product. For **${project.name}**, let's:\n\n1. **Identify** your core feature (the one thing users need)\n2. **Generate** a detailed prompt for Cursor/Claude Code\n3. **Build** iteratively\n\nWhat's the most important feature to build first?`,
    "next-features": `**${project.name}** is live! Now let's be strategic about what comes next.\n\n1. What **feedback** have you received?\n2. What features are users **actually asking for**?\n3. What's the **smallest thing** you can ship this week?\n\nLet's prioritize ruthlessly.`,
  };

  return greetings[project.currentStage] || `You're in the **${stage.label}** stage. ${stage.nextAction}`;
}

export default function ChatPanel({
  project,
  messages,
  onSendMessage,
  isEnabled,
  onSetupKeys,
  integrations,
  enabledProviderIds,
  onStageAdvance,
  onMemoriesChange,
  isEncrypted,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCallDisplay[]>([]);
  const [typingLabel, setTypingLabel] = useState("Thinking...");
  const [error, setError] = useState<string | null>(null);
  const [retryTurn, setRetryTurn] = useState<RetryTurn | null>(null);
  const [retryAssistantId, setRetryAssistantId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const toolCallsRef = useRef<ToolCallDisplay[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeToolCalls]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleToolCall = useCallback((info: ToolCallInfo) => {
    const display: ToolCallDisplay = {
      toolName: info.toolName,
      integrationId: info.integrationId,
      status: info.status,
      result: info.result,
    };
    const previous = toolCallsRef.current;
    const idx = previous.findIndex(
      (tc) => tc.toolName === info.toolName && tc.status === "executing"
    );
    const next = [...previous];

    if (idx >= 0) next[idx] = display;
    else next.push(display);
    toolCallsRef.current = next;
    setActiveToolCalls(next);

    if (info.status === "executing") {
      setTypingLabel(getToolActionLabel(info.toolName, info.integrationId));
    } else {
      setTypingLabel("Thinking...");
    }
  }, []);

  async function handleSend(
    overrideInput?: string,
    retry?: RetryTurn
  ) {
    const text = overrideInput ?? input.trim();
    if (!text || !isEnabled || isTyping) return;
    setError(null);
    setRetryTurn(null);
    if (!retry) {
      setRetryAssistantId(null);
    }

    // Handle slash commands
    if (text.startsWith("/")) {
      const cmd = text.slice(1).toLowerCase().trim();
      if (cmd === "advance" || cmd.startsWith("advance")) {
        const stage = getStage(project.currentStage);
        const nextStageId = stage ? getNextStageId(project.currentStage) : null;
        if (nextStageId && onStageAdvance) {
          onStageAdvance(nextStageId);
          const systemMsg: ChatMessage = {
            id: generateId(),
            role: "assistant",
            content: `Stage advanced to **${getStage(nextStageId)?.label}**! Let's keep moving forward.`,
            timestamp: new Date().toISOString(),
          };
          onSendMessage(systemMsg);
          setInput("");
          return;
        }
      }
    }

    const userMessage: ChatMessage = retry
      ? {
          id: retry.id,
          role: "user",
          content: retry.content,
          timestamp: new Date().toISOString(),
        }
      : {
          id: generateId(),
          role: "user",
          content: text,
          timestamp: new Date().toISOString(),
        };

    if (!retry) {
      onSendMessage(userMessage);
    }
    setInput("");
    setIsTyping(true);
    setActiveToolCalls([]);
    toolCallsRef.current = [];
    setTypingLabel("Thinking...");

    const history = retry
      ? (() => {
          const failedTurnIndex = messages.findIndex(
            (message) => message.id === retry.id
          );
          return failedTurnIndex >= 0
            ? messages.slice(0, failedTurnIndex)
            : messages.filter((message) => message.id !== retry.id);
        })()
      : messages;

    try {
      const response = await generateChatResponse(
        userMessage.content,
        project,
        integrations,
        history,
        enabledProviderIds,
        handleToolCall,
        onStageAdvance
      );
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: response.content,
        timestamp: new Date().toISOString(),
        toolCalls: response.toolCalls
          .filter((call): call is ToolCallInfo & { status: "success" | "error" } => call.status !== "executing")
          .map(({ toolName, integrationId, status, result }): PersistedToolCall => ({
            toolName,
            integrationId,
            status,
            result,
          })),
      };
      onSendMessage(assistantMessage);
      onMemoriesChange?.();
      setRetryAssistantId(null);
    } catch (caught) {
      const friendlyError = formatChatError(caught);
      setRetryTurn({ id: userMessage.id, content: userMessage.content });
      const completedToolCalls = toolCallsRef.current.filter(
        (call) => call.status !== "executing"
      );
      if (completedToolCalls.some((call) => call.status === "success")) {
        const failedAssistantId = generateId();
        onSendMessage({
          id: failedAssistantId,
          role: "assistant",
          content: `I couldn't complete the whole turn. ${friendlyError}`,
          timestamp: new Date().toISOString(),
          toolCalls: completedToolCalls.map(
            ({ toolName, integrationId, status, result }): PersistedToolCall => ({
              toolName,
              integrationId,
              status: status as "success" | "error",
              result,
            })
          ),
        });
        setRetryAssistantId(failedAssistantId);
        onMemoriesChange?.();
      } else {
        setRetryAssistantId(null);
        setError(friendlyError);
      }
    } finally {
      setIsTyping(false);
      setActiveToolCalls([]);
    }
  }

  function handleRetry() {
    if (!retryTurn || isTyping) return;
    void handleSend(retryTurn.content, retryTurn);
  }

  async function handleCopy(messageId: string, content: string) {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      return;
    }
    setCopiedMessageId(messageId);
    if (copyTimeoutRef.current !== null) {
      window.clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopiedMessageId(null);
    }, 1500);
  }

  // Inline setup for when no keys configured
  if (!isEnabled) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          <div className="w-full max-w-sm space-y-4">
            <div className="text-center space-y-2">
              <Zap className="w-8 h-8 mx-auto text-[var(--accent)]" />
              <h3 className="text-sm font-medium text-[var(--accent)]">
                Activate AI Guidance
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Paste any one API key to unlock your AI guide.{" "}
                {isEncrypted
                  ? "It stays encrypted in your browser."
                  : "It is stored locally in your browser. Enable encryption in Settings to protect it with a password."}
              </p>
            </div>

            <div className="space-y-2">
              {[
                { id: "groq", name: "Groq", hint: "Free tier available", url: "https://console.groq.com/keys" },
                { id: "openai", name: "OpenAI", hint: "GPT-4o mini", url: "https://platform.openai.com/api-keys" },
                { id: "anthropic", name: "Anthropic", hint: "Claude 3.5", url: "https://console.anthropic.com/settings/keys" },
                { id: "google", name: "Google Gemini", hint: "With web search", url: "https://aistudio.google.com/apikey" },
              ].map((provider) => (
                <button
                  key={provider.id}
                  onClick={onSetupKeys}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded border border-[var(--accent-26)] hover:border-[var(--accent-44)] transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--accent)]" />
                    <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--accent)]">
                      {provider.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--text-muted)]">{provider.hint}</span>
                    <a
                      href={provider.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[var(--text-muted)] hover:text-[var(--accent)]"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </button>
              ))}
            </div>

            <p className="text-[10px] text-[var(--text-muted)] text-center">
              {isEncrypted
                ? "Keys are encrypted with your project password and never sent to our servers."
                : "Keys are stored locally in your browser and never sent to our servers. Enable encryption in Settings to protect them with a password."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const greeting = getDirectiveGreeting(project);
  const suggestedReplies = getSuggestedReplies(project, messages);

  return (
    <div className="flex flex-col h-full min-h-[500px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4 pr-1 mobile-scroll">
        {/* System greeting */}
        <div className="flex gap-3">
          <div className="flex-shrink-0 w-7 h-7 rounded bg-[var(--accent-10)] border border-[var(--accent-26)] flex items-center justify-center">
            <span className="text-xs text-[var(--accent)]">C</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-[var(--text-muted)] mb-1">
              Compass
            </div>
            <div className="text-sm text-[var(--text-secondary)] leading-relaxed prose-chat">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {greeting}
              </ReactMarkdown>
            </div>
          </div>
        </div>

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center ${
                msg.role === "user"
                  ? "bg-[var(--accent)] text-black"
                  : "bg-[var(--accent-10)] border border-[var(--accent-26)]"
              }`}
            >
              <span className="text-xs">
                {msg.role === "user" ? "Y" : "C"}
              </span>
            </div>
            <div
              className={`flex-1 min-w-0 ${msg.role === "user" ? "text-right" : ""}`}
            >
              <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mb-1">
                <span>{msg.role === "user" ? "You" : "Compass"}</span>
                {msg.role === "assistant" && (
                  <button
                    onClick={() => handleCopy(msg.id, msg.content)}
                    className="inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                    title="Copy response"
                    aria-label="Copy response"
                  >
                    {copiedMessageId === msg.id ? (
                      <>
                        <Check className="w-3 h-3" />
                        Copied
                      </>
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>
              {msg.role === "user" ? (
                <div className="text-sm leading-relaxed text-[var(--accent)] inline-block text-left bg-[var(--accent-10)] rounded px-3 py-2 border border-[var(--accent-26)]">
                  {msg.content}
                </div>
              ) : (
                <div className="text-sm leading-relaxed text-[var(--text-secondary)] prose-chat">
                  {msg.toolCalls?.length ? (
                    <div className="mb-2">
                      {msg.toolCalls.map((call, index) => (
                        <ToolCallCard key={`${call.toolName}-${index}`} call={call} />
                      ))}
                    </div>
                  ) : null}
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {msg.content}
                  </ReactMarkdown>
                  {retryAssistantId === msg.id && (
                    <button
                      onClick={handleRetry}
                      disabled={isTyping}
                      className="mt-2 inline-flex items-center gap-1.5 rounded border border-red-400/40 px-2 py-1 text-[10px] text-red-300 hover:border-red-300 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Retry
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded bg-[var(--accent-10)] border border-[var(--accent-26)] flex items-center justify-center">
              <span className="text-xs text-[var(--accent)]">C</span>
            </div>
            <div className="flex-1">
              <div className="text-[10px] text-[var(--text-muted)] mb-1">
                Compass
              </div>

              {/* Tool call indicators */}
              {activeToolCalls.map((tc, i) => (
                <ToolCallCard key={`${tc.toolName}-${i}`} call={tc} />
              ))}

              <div className="text-sm text-[var(--text-muted)] animate-pulse flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                {typingLabel}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested replies */}
      {suggestedReplies.length > 0 && !isTyping && (
        <div className="flex flex-wrap gap-1.5 pb-3">
          {suggestedReplies.map((reply) => (
            <button
              key={reply}
              onClick={() => handleSend(reply)}
              className="px-2.5 py-1.5 rounded border border-[var(--accent-26)] text-[10px] text-[var(--text-secondary)] hover:border-[var(--accent-44)] hover:text-[var(--accent)] transition-colors"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-[var(--accent-26)] pt-3">
        {error && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded border border-red-500/40 px-3 py-2 text-xs text-red-400">
            <span>{error}</span>
            <div className="flex items-center gap-2">
              {retryTurn && (
                <button
                  onClick={handleRetry}
                  disabled={isTyping}
                  className="inline-flex items-center gap-1 rounded border border-red-400/40 px-2 py-1 text-[10px] text-red-300 hover:border-red-300 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" />
                  Retry
                </button>
              )}
              <button onClick={() => setError(null)} aria-label="Dismiss error" className="text-red-400/70 hover:text-red-400">
                ×
              </button>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask anything or type /advance..."
            className="flex-1 bg-black border border-[var(--accent-26)] rounded px-3 py-2.5 text-sm text-[var(--accent)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] outline-none"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim()}
            className="px-3 py-2.5 rounded bg-[var(--accent)] text-black hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <SendHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function getNextStageId(currentStage: StageId): StageId | null {
  const stages: StageId[] = [
    "ideation", "context", "landing-page", "github",
    "hosting", "domain", "build-prototype", "next-features",
  ];
  const idx = stages.indexOf(currentStage);
  return idx >= 0 && idx < stages.length - 1 ? stages[idx + 1] : null;
}
