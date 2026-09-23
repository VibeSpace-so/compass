import { BYOKProvider, ChatMessage, Integration, MemoryType, Project, StageId } from "./types";
import { getStage } from "./stages";
import { getSuggestionsForStage } from "./integrations";
import { getBYOKKey } from "./storage";
import {
  getAvailableTools,
  executeTool,
  toolsToOpenAIFormat,
  toolsToAnthropicFormat,
  toolsToGeminiFormat,
  setToolContext,
} from "./chat-tools";
import {
  getFlowContext,
  getStageTransitionAdvice,
} from "./flow-orchestrator";
import { addMemory, formatMemoriesForPrompt, getCachedMemories } from "./memories";
import { ChatTool } from "./tool-types";
import { IntegrationAuth } from "./integration-service";

const MAX_TOOL_CALLS_PER_TURN = 3;
const GOOGLE_MODEL = "gemini-flash-latest";
const GOOGLE_GENERATE_CONTENT_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_MODEL}:generateContent`;
const GOOGLE_STREAM_CONTENT_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_MODEL}:streamGenerateContent?alt=sse`;

export type StageAdvanceOutcome = "applied" | "pending" | "noop";

/** Consume an SSE response body, invoking onPayload for each `data:` JSON line. */
async function streamSSE(
  response: Response,
  onPayload: (parsed: unknown) => void
): Promise<void> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const flush = () => {
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
      for (const line of block.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          onPayload(JSON.parse(payload));
        } catch {
          // Ignore keep-alive / non-JSON data lines.
        }
      }
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    flush();
  }
  buffer += decoder.decode();
  flush();
}

function isSSEResponse(response: Response): boolean {
  return (response.headers.get("content-type") ?? "").includes("text/event-stream");
}

export interface LLMProvider {
  id: string;
  endpoint: string;
  model: string;
  custom?: boolean;
  extraParams?: Record<string, unknown>;
}

const PROVIDERS: LLMProvider[] = [
  {
    id: "groq",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    model: "openai/gpt-oss-20b",
  },
  {
    id: "openai",
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
  },
  {
    id: "anthropic",
    endpoint: "https://api.anthropic.com/v1/messages",
    model: "claude-3-5-haiku-20241022",
  },
  {
    id: "google",
    endpoint: GOOGLE_GENERATE_CONTENT_ENDPOINT,
    model: GOOGLE_MODEL,
  },
];

// Providers that support function calling; custom OpenAI-compatible
// endpoints are assumed capable (inline-call parsing covers the rest).
const TOOL_CAPABLE_PROVIDERS = new Set(["groq", "openai", "anthropic", "google"]);

function openAICompatibleEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/chat/completions")
    ? trimmed
    : `${trimmed}/chat/completions`;
}

export function getActiveProvider(
  projectId: string,
  providers?: BYOKProvider[]
): { provider: LLMProvider; apiKey: string } | null {
  for (const provider of PROVIDERS) {
    if (providers && !providers.some((p) => p.id === provider.id && p.enabled)) {
      continue;
    }
    const key = getBYOKKey(projectId, provider.id);
    if (key) {
      return { provider, apiKey: key };
    }
  }
  for (const p of providers ?? []) {
    if (!p.custom || !p.enabled || !p.baseUrl || !p.model) continue;
    const key = getBYOKKey(projectId, p.id);
    if (key) {
      return {
        provider: {
          id: p.id,
          endpoint: openAICompatibleEndpoint(p.baseUrl),
          model: p.model,
          custom: true,
          extraParams: p.params,
        },
        apiKey: key,
      };
    }
  }
  return null;
}

export function buildSystemPrompt(
  project: Project,
  integrations: Integration[]
): string {
  const stage = getStage(project.currentStage);
  if (!stage) return "You are Compass, a helpful assistant for vibe coders.";

  const connected = integrations.filter((i) =>
    IntegrationAuth.hasIntegrationToken(project.id, i.id)
  );
  const suggestions = getSuggestionsForStage(project.currentStage);
  const unconnected = suggestions.filter((s) => {
    return !connected.some((i) => i.id === s.integrationId);
  });

  const connectedList =
    connected.length > 0
      ? `Connected integrations: ${connected.map((i) => i.name).join(", ")}.`
      : "No integrations connected yet.";

  const suggestedList =
    unconnected.length > 0
      ? `\nSuggested integrations for this stage:\n${unconnected
          .map((s) => {
            const integ = integrations.find((i) => i.id === s.integrationId);
            return `- ${integ?.name}: ${s.purpose} → ${s.outcome}`;
          })
          .join("\n")}`
      : "";

  const connectedIds = connected.map((i) => i.id);
  const flowContext = getFlowContext(project.currentStage, connectedIds);
  const lateStageBlock =
    project.currentStage === "grow-scale"
      ? `\nLATE-STAGE DOCTRINE (post-launch — apply while guiding):\n` +
        `- Architecture: monolith-first; extract a service only when a measured hotspot demands it. Document key decisions so AI build tools inherit them.\n` +
        `- Security: secrets stay server-side, security headers on, dependencies audited, auth rules verified, rate limits on public endpoints, restores actually tested.\n` +
        `- Observability: error tracking, uptime checks, and product analytics before the user feels they need them — alerts over bug reports.\n` +
        `- Scaling: data over anxiety — indexes and page speed first, then caching/CDN, then queues; replicas and services only when load is measured.\n` +
        `- Incidents: detect → mitigate → communicate → postmortem. One owner, one runbook, one status page.\n` +
        `- Feedback: one intake channel, one triage cadence, always close the loop with users.\n` +
        `- Automations: CI gates, preview deploys, scheduled jobs — automate what repeats.\n` +
        `- Go deep on ONE domain per reply after asking what hurts most — don't lecture all seven at once.\n`
      : "";
  const memoriesContext = formatMemoriesForPrompt(project.id);
  const completedActions = getCachedMemories(project.id)
    .filter((memory) => memory.stage === project.currentStage)
    .map((memory) => memory.content);
  const stageProgress = getStageTransitionAdvice(
    project.currentStage,
    completedActions
  );

  return `You are Compass, an opinionated AI guide for vibe coders built by Vibe Space. You LEAD the user through the vibe coding journey — from ideation to launch. You don't just answer questions; you proactively guide, suggest next steps, and drive progress.

CURRENT PROJECT: "${project.name}"
${project.description ? `Description: ${project.description}` : ""}
CURRENT STAGE: ${stage.label} — ${stage.description}
NEXT MOVE: ${stage.nextAction}
RECOMMENDED TOOLS: ${stage.tools.join(", ")}
RISK: ${stage.risk} | COMPLEXITY: ${stage.complexity}
TECHNICAL DEBT: ${project.technicalDebt} | COGNITIVE DEBT: ${project.cognitiveDebt}

STAGE CONTEXT: ${stage.debtNote}
STAGE PROGRESS: ${stageProgress}

${memoriesContext}

INTEGRATIONS:
${connectedList}${suggestedList}

${flowContext}
${lateStageBlock}
RESOURCES FOR THIS STAGE:
${stage.links.map((l) => `- ${l.label}: ${l.url}`).join("\n")}

VALIDATION-FIRST RULES (non-negotiable):
- The journey arc is: validate the problem → build and refine context → validate demand with a landing page and real signal → only then build features.
- Before the Build Prototype stage, never generate code or feature prompts — if the user asks to build early, redirect them to the current validation step with one concrete action.
- Context before code: the project brief and memories are what make AI build tools produce something worth having. Push the user to enrich them.
- Keep the brief alive: whenever the user supplies facts that fit a brief section that's still empty (tech stack, features, decisions, constraints, open questions, milestones), update_project_doc in the same reply. The brief should track the journey, not freeze after Context.
- A landing page is a demand test, not a product. Real PMF signal means signups, replies, objections — not vibes. Save that evidence as memories.
- When the user reaches Build Prototype, check their validation evidence first and build only the feature it points to.
- Interview, don't interrogate: ask ONE focused question per reply. In Ideation the arc is who has the problem → how painful it is → evidence it exists; in Context it's what they're building → who it's for → constraints and direction. Save each answer as a memory before asking the next question.

YOUR ROLE — PROACTIVE GUIDE:
- You LEAD the experience. Don't wait for the user to know what to ask. Tell them: "Here's where you are. Here's your next move."
- Be direct, opinionated, and action-oriented. Sound like a knowledgeable friend who's shipped products before.
- Persist proactively: whenever the user shares an artifact, evidence, decision, preference, or constraint — a shipped page, signup counts, a repo URL, a scoping decision — call save_memory in the SAME reply, without waiting to be asked. Stage counters and the advance gate depend on these memories existing.
- When the user completes key milestones for the current stage, proactively suggest advancing to the next stage using advance_stage.
- When the user needs to use an external tool (Lovable, Cursor, etc.), generate a complete, copy-ready prompt they can paste directly into that tool. Include all relevant project context and memories.
- Guide the user through research before building. Suggest web searches (Perplexity) to validate ideas, find competitors, and gather best practices.
- Keep responses concise (2-4 paragraphs max) but always end with a clear next action or question.
- If the user seems stuck, proactively offer 2-3 concrete next steps they can take right now.
- Track progress by saving learnings and decisions as memories. Reference past decisions when giving new advice.
- When a user request can be fulfilled by an available tool action, USE the tool rather than just describing what to do.
- Announce what you're about to do before calling a tool.
- Never make up information about tools or links. Use only what's in the context above.`;
}

function formatMessages(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string
): { role: string; content: string }[] {
  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];

  const recentHistory = history.slice(-10);
  const startIdx = recentHistory.findIndex((m) => m.role === "user");
  const trimmedHistory = startIdx >= 0 ? recentHistory.slice(startIdx) : [];
  for (const msg of trimmedHistory) {
    if (msg.role === "user" || msg.role === "assistant") {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: "user", content: userMessage });
  return messages;
}

// ---------------------------------------------------------------------------
// Tool call types shared across providers
// ---------------------------------------------------------------------------

export interface ToolCallInfo {
  id: string;
  toolName: string;
  integrationId: string;
  args: Record<string, unknown>;
  status: "executing" | "success" | "error";
  result?: string;
}

export interface ChatResponseWithTools {
  content: string;
  toolCalls: ToolCallInfo[];
}

// Statuses that can mean "this endpoint doesn't do SSE/streaming" — the only
// ones worth re-firing the request without stream:true. Auth, rate-limit and
// server errors would just double-burn quota on a retry.
function shouldRetryNonStream(status: number): boolean {
  return [400, 404, 405, 406, 415, 422].includes(status);
}

export function formatChatError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const providerMatch = raw.match(
    /\b(Groq|OpenAI|Anthropic|Google)(?: API)? error\s*\((\d{3})\)/i
  );
  const provider = providerMatch?.[1] ?? "Provider";
  const status = providerMatch?.[2];
  const lower = raw.toLowerCase();
  const statusCode = status ?? raw.match(/API error \((\d{3})\)/)?.[1];
  const detail = statusCode
    ? `${provider} response ${statusCode}`
    : "Provider request failed";

  if (
    statusCode === "429" ||
    /\b(rate limit|rate_limit|quota|too many requests|tpm limit)\b/i.test(lower)
  ) {
    return `Provider rate limit reached — wait a moment, or add/switch providers in AI Guidance (a custom endpoint can work around per-minute caps). (${detail})`;
  }

  if (
    /\b(invalid|malformed|attempted to call|tool.?call|function.?call)\b/i.test(
      lower
    ) &&
    /\b(tool|function)\b/i.test(lower)
  ) {
    return `The model produced an invalid tool call, please retry. (Tool-call format was rejected)`;
  }

  return `The AI provider couldn't complete the request. (${detail})`;
}

// ---------------------------------------------------------------------------
// OpenAI-compatible provider (Groq, OpenAI) — with tool calling
// ---------------------------------------------------------------------------

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface OpenAIChoice {
  message: {
    content?: string | null;
    tool_calls?: OpenAIToolCall[];
    role: string;
  };
  finish_reason: string;
}

export function parseInlineToolCalls(
  content: string,
  tools?: ChatTool[]
): { name: string; arguments: Record<string, unknown> }[] {
  const available = tools ? new Set(tools.map((tool) => tool.name)) : null;
  const calls: { name: string; arguments: Record<string, unknown> }[] = [];
  const seen = new Set<string>();
  const add = (name: string, raw: string) => {
    if (available && !available.has(name)) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const args = (parsed.arguments ?? parsed.parameters ?? parsed) as Record<string, unknown>;
      if (args && typeof args === "object" && !Array.isArray(args)) {
        const key = `${name}:${JSON.stringify(args)}`;
        if (!seen.has(key)) {
          seen.add(key);
          calls.push({ name, arguments: args });
        }
      }
    } catch {
      // Ignore malformed inline calls and let the model response pass through as text.
    }
  };

  const extractJson = (text: string, start: number): string | null => {
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let i = start; i < text.length; i++) {
      const char = text[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') quoted = false;
        continue;
      }
      if (char === '"') quoted = true;
      else if (char === "{") depth++;
      else if (char === "}" && --depth === 0) return text.slice(start, i + 1);
    }
    return null;
  };

  const xmlPattern = /<function=([A-Za-z0-9_-]+)\s*/g;
  for (const match of content.matchAll(xmlPattern)) {
    const start = (match.index ?? 0) + match[0].length;
    const jsonStart = content.indexOf("{", start);
    const raw = jsonStart >= 0 ? extractJson(content, jsonStart) : null;
    if (raw) add(match[1], raw);
  }

  // Some models emit {"action": "tool_name", "params": {...}} (or
  // "action_input") instead of {"name": ..., "arguments"|"parameters": ...}.
  const toolName = (parsed: Record<string, unknown>): string | undefined =>
    typeof parsed.name === "string"
      ? parsed.name
      : typeof parsed.action === "string"
        ? parsed.action
        : undefined;
  const toolArgs = (parsed: Record<string, unknown>): Record<string, unknown> =>
    ((parsed.arguments ?? parsed.parameters ?? parsed.params ?? parsed.action_input ?? {}) as Record<string, unknown>);

  const jsonCandidates = [
    ...Array.from(content.matchAll(/```json\s*([\s\S]*?)```/gi), (match) => match[1]),
  ];
  for (const candidate of jsonCandidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const name = toolName(parsed);
      if (name) add(name, JSON.stringify(toolArgs(parsed)));
    } catch {
      // Ignore malformed candidates.
    }
  }
  for (let index = content.indexOf("{"); index >= 0; index = content.indexOf("{", index + 1)) {
    const raw = extractJson(content, index);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const name = toolName(parsed);
      if (name) add(name, JSON.stringify(toolArgs(parsed)));
    } catch {
      // Ignore non-tool JSON objects in ordinary prose.
    }
  }
  return calls;
}

async function callOpenAICompatibleWithTools(
  endpoint: string,
  model: string,
  apiKey: string,
  messages: { role: string; content: string }[],
  tools: ChatTool[],
  onToolCall?: (info: ToolCallInfo) => void,
  extraParams?: Record<string, unknown>,
  onTextDelta?: (text: string) => void
): Promise<ChatResponseWithTools> {
  const toolDefs = tools.length > 0 ? toolsToOpenAIFormat(tools) : undefined;
  const allToolCalls: ToolCallInfo[] = [];

  // Allow up to MAX_TOOL_CALLS_PER_TURN rounds of tool calling
  const conversationMessages: Record<string, unknown>[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  for (let round = 0; round < MAX_TOOL_CALLS_PER_TURN; round++) {
    const body: Record<string, unknown> = {
      max_tokens: 1024,
      temperature: 0.7,
      ...extraParams,
      model,
      messages: conversationMessages,
    };
    if (toolDefs && toolDefs.length > 0) {
      body.tools = toolDefs;
    }

    const sendRequest = (stream: boolean) =>
      fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(stream ? { ...body, stream: true } : body),
      });

    // Try SSE first; fall back to a plain request only when the status can
    // mean "can't stream" (some custom OpenAI-compatible providers can't).
    let response = await sendRequest(true);
    if (!response.ok && shouldRetryNonStream(response.status)) {
      response = await sendRequest(false);
    }
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error (${response.status}): ${error}`);
    }

    let msg: OpenAIChoice["message"] | null = null;
    if (isSSEResponse(response)) {
      let textAcc = "";
      let streamError: string | null = null;
      const tcParts = new Map<number, { id: string; name: string; args: string }>();
      await streamSSE(response, (chunk) => {
        // Providers can deliver failures inside a 200 + SSE stream
        // (e.g. Groq's tool-call validation errors) — surface them.
        const err = (chunk as { error?: { message?: string } }).error?.message;
        if (err && !streamError) streamError = err;
        const delta = (
          chunk as {
            choices?: {
              delta?: {
                content?: string | null;
                tool_calls?: {
                  index: number;
                  id?: string;
                  function?: { name?: string; arguments?: string };
                }[];
              };
            }[];
          }
        ).choices?.[0]?.delta;
        if (!delta) return;
        if (delta.content) {
          textAcc += delta.content;
          onTextDelta?.(textAcc);
        }
        for (const tc of delta.tool_calls ?? []) {
          const part = tcParts.get(tc.index) ?? { id: "", name: "", args: "" };
          if (tc.id) part.id = tc.id;
          if (tc.function?.name) part.name += tc.function.name;
          if (tc.function?.arguments) part.args += tc.function.arguments;
          tcParts.set(tc.index, part);
        }
      });
      if (streamError) throw new Error(streamError);
      msg = {
        role: "assistant",
        content: textAcc || null,
        tool_calls: [...tcParts.entries()]
          .sort(([a], [b]) => a - b)
          .map(([, part], i) => ({
            id: part.id || `call_${i}`,
            type: "function" as const,
            function: { name: part.name, arguments: part.args },
          })),
      };
    } else {
      const data = (await response.json()) as { choices: OpenAIChoice[] };
      msg = data.choices?.[0]?.message ?? null;
    }
    if (!msg) {
      return { content: "I couldn't generate a response. Please try again.", toolCalls: allToolCalls };
    }

    // Groq/Llama occasionally emits function calls as text rather than tool_calls.
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      const inlineCalls = msg.content ? parseInlineToolCalls(msg.content, tools) : [];
      if (inlineCalls.length > 0) {
        const synthesizedCalls = inlineCalls.map((call, index) => ({
          id: `inline_${Date.now()}_${index}`,
          type: "function" as const,
          function: { name: call.name, arguments: JSON.stringify(call.arguments) },
        }));
        conversationMessages.push({
          role: "assistant",
          content: msg.content ?? null,
          tool_calls: synthesizedCalls,
        });
        for (const tc of synthesizedCalls) {
          const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
          const tool = tools.find((t) => t.name === tc.function.name);
          const info: ToolCallInfo = {
            id: tc.id,
            toolName: tc.function.name,
            integrationId: tool?.integrationId ?? "unknown",
            args,
            status: "executing",
          };
          allToolCalls.push(info);
          onToolCall?.(info);
          const result = await executeTool(tc.function.name, args);
          info.status = result.success ? "success" : "error";
          info.result = result.success ? JSON.stringify(result.data) : (result.error ?? "Unknown error");
          onToolCall?.(info);
          conversationMessages.push({ role: "tool", tool_call_id: tc.id, content: info.result });
        }
        continue;
      }
      return {
        content: msg.content || "I couldn't generate a response. Please try again.",
        toolCalls: allToolCalls,
      };
    }

    // Execute tool calls
    conversationMessages.push({
      role: "assistant",
      content: msg.content ?? null,
      tool_calls: msg.tool_calls,
    });

    for (const tc of msg.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        // pass
      }

      const tool = tools.find((t) => t.name === tc.function.name);
      const info: ToolCallInfo = {
        id: tc.id,
        toolName: tc.function.name,
        integrationId: tool?.integrationId ?? "unknown",
        args,
        status: "executing",
      };

      allToolCalls.push(info);
      onToolCall?.(info);

      const result = await executeTool(tc.function.name, args);

      info.status = result.success ? "success" : "error";
      info.result = result.success
        ? JSON.stringify(result.data)
        : (result.error ?? "Unknown error");
      onToolCall?.(info);

      conversationMessages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: info.result,
      });
    }
  }

  // Exhausted tool rounds — get final text response
  const finalResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      max_tokens: 1024,
      temperature: 0.7,
      ...extraParams,
      model,
      messages: conversationMessages,
    }),
  });

  if (!finalResponse.ok) {
    const error = await finalResponse.text();
    throw new Error(`API error (${finalResponse.status}): ${error}`);
  }

  const finalData = (await finalResponse.json()) as { choices: OpenAIChoice[] };
  return {
    content:
      finalData.choices?.[0]?.message?.content ||
      "I couldn't generate a response. Please try again.",
    toolCalls: allToolCalls,
  };
}

// ---------------------------------------------------------------------------
// Anthropic — with tool calling
// ---------------------------------------------------------------------------

interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface AnthropicResponse {
  content: AnthropicContentBlock[];
  stop_reason: string;
}

async function callAnthropicWithTools(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  tools: ChatTool[],
  onToolCall?: (info: ToolCallInfo) => void,
  onTextDelta?: (text: string) => void
): Promise<ChatResponseWithTools> {
  const toolDefs = tools.length > 0 ? toolsToAnthropicFormat(tools) : undefined;
  const allToolCalls: ToolCallInfo[] = [];

  const anthropicMessages: { role: string; content: string | AnthropicContentBlock[] }[] = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  for (let round = 0; round < MAX_TOOL_CALLS_PER_TURN; round++) {
    const body: Record<string, unknown> = {
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: anthropicMessages,
    };
    if (toolDefs && toolDefs.length > 0) {
      body.tools = toolDefs;
    }

    const sendRequest = (stream: boolean) =>
      fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify(stream ? { ...body, stream: true } : body),
      });

    let response = await sendRequest(true);
    if (!response.ok && shouldRetryNonStream(response.status)) {
      response = await sendRequest(false);
    }
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${error}`);
    }

    let data: AnthropicResponse;
    if (isSSEResponse(response)) {
      const blocks: {
        type: string;
        text: string;
        id?: string;
        name?: string;
        inputJson: string;
      }[] = [];
      let stopReason = "";
      let streamError: string | null = null;
      await streamSSE(response, (evt) => {
        const errPayload = (evt as { error?: { message?: string } }).error;
        if (errPayload?.message && !streamError) streamError = errPayload.message;
        const e = evt as {
          type: string;
          index?: number;
          content_block?: {
            type: string;
            text?: string;
            id?: string;
            name?: string;
          };
          delta?: {
            type: string;
            text?: string;
            partial_json?: string;
            stop_reason?: string;
          };
        };
        if (e.type === "content_block_start" && e.index != null && e.content_block) {
          blocks[e.index] = {
            type: e.content_block.type,
            text: e.content_block.text ?? "",
            id: e.content_block.id,
            name: e.content_block.name,
            inputJson: "",
          };
        } else if (e.type === "content_block_delta" && e.index != null && e.delta) {
          const blk = blocks[e.index];
          if (!blk) return;
          if (e.delta.type === "text_delta" && e.delta.text) {
            blk.text += e.delta.text;
            onTextDelta?.(
              blocks
                .filter((b) => b?.type === "text")
                .map((b) => b.text)
                .join("\n")
            );
          } else if (e.delta.type === "input_json_delta" && e.delta.partial_json) {
            blk.inputJson += e.delta.partial_json;
          }
        } else if (e.type === "message_delta" && e.delta?.stop_reason) {
          stopReason = e.delta.stop_reason;
        }
      });
      if (streamError) throw new Error(streamError);
      data = {
        content: blocks
          .filter(Boolean)
          .map((b) =>
            b.type === "tool_use"
              ? {
                  type: "tool_use",
                  id: b.id,
                  name: b.name,
                  input: JSON.parse(b.inputJson || "{}") as Record<string, unknown>,
                }
              : { type: "text", text: b.text }
          ),
        stop_reason: stopReason,
      };
    } else {
      data = (await response.json()) as AnthropicResponse;
    }

    const textBlocks = data.content.filter((b) => b.type === "text");
    const toolUseBlocks = data.content.filter((b) => b.type === "tool_use");

    if (toolUseBlocks.length === 0 || data.stop_reason !== "tool_use") {
      const text = textBlocks.map((b) => b.text ?? "").join("\n") ||
        "I couldn't generate a response. Please try again.";
      return { content: text, toolCalls: allToolCalls };
    }

    // Process tool calls
    anthropicMessages.push({ role: "assistant", content: data.content });

    const toolResults: AnthropicContentBlock[] = [];

    for (const block of toolUseBlocks) {
      const tool = tools.find((t) => t.name === block.name);
      const info: ToolCallInfo = {
        id: block.id ?? `tc_${Date.now()}`,
        toolName: block.name ?? "unknown",
        integrationId: tool?.integrationId ?? "unknown",
        args: block.input ?? {},
        status: "executing",
      };

      allToolCalls.push(info);
      onToolCall?.(info);

      const result = await executeTool(block.name ?? "", block.input ?? {});

      info.status = result.success ? "success" : "error";
      info.result = result.success
        ? JSON.stringify(result.data)
        : (result.error ?? "Unknown error");
      onToolCall?.(info);

      toolResults.push({
        type: "tool_result",
        id: block.id,
        text: undefined,
        name: undefined,
        input: undefined,
        ...({ tool_use_id: block.id, content: info.result } as unknown as Record<string, unknown>),
      } as unknown as AnthropicContentBlock);
    }

    anthropicMessages.push({
      role: "user",
      content: toolResults as unknown as string,
    });
  }

  // Final text response after tool rounds
  const finalResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: anthropicMessages,
    }),
  });

  if (!finalResponse.ok) {
    const error = await finalResponse.text();
    throw new Error(`Anthropic API error (${finalResponse.status}): ${error}`);
  }

  const finalData = (await finalResponse.json()) as AnthropicResponse;
  const text = finalData.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n") || "I couldn't generate a response. Please try again.";

  return { content: text, toolCalls: allToolCalls };
}

// ---------------------------------------------------------------------------
// Google Gemini — with function calling
// ---------------------------------------------------------------------------

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  toolCall?: Record<string, unknown>;
  toolResponse?: Record<string, unknown>;
  thoughtSignature?: string;
}

interface GeminiCandidate {
  content: { parts: GeminiPart[]; role: string };
  finishReason?: string;
}

interface GeminiResponse {
  candidates: GeminiCandidate[];
}

async function callGoogleWithTools(
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  tools: ChatTool[],
  onToolCall?: (info: ToolCallInfo) => void,
  onTextDelta?: (text: string) => void
): Promise<ChatResponseWithTools> {
  const allToolCalls: ToolCallInfo[] = [];

  let contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }] as GeminiPart[],
    }));

  // Gemini requires the first content to have role "user"
  while (contents.length > 0 && contents[0].role === "model") {
    contents = contents.slice(1);
  }

  const geminiToolsArr: Record<string, unknown>[] = [];
  if (tools.length > 0) {
    geminiToolsArr.push(toolsToGeminiFormat(tools));
  }
  // Enable Google Search grounding for web research capabilities
  geminiToolsArr.push({ googleSearch: {} });

  for (let round = 0; round < MAX_TOOL_CALLS_PER_TURN; round++) {
    const body: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
      toolConfig: { includeServerSideToolInvocations: true },
    };
    if (geminiToolsArr.length > 0) {
      body.tools = geminiToolsArr;
    }

    const sendRequest = (stream: boolean) =>
      fetch(stream ? GOOGLE_STREAM_CONTENT_ENDPOINT : GOOGLE_GENERATE_CONTENT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
      });

    let response = await sendRequest(true);
    if (!response.ok && shouldRetryNonStream(response.status)) {
      response = await sendRequest(false);
    }
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google API error (${response.status}): ${error}`);
    }

    let candidate: GeminiCandidate | null = null;
    if (isSSEResponse(response)) {
      const parts: GeminiPart[] = [];
      let textAcc = "";
      let finishReason = "";
      let streamError: string | null = null;
      await streamSSE(response, (chunk) => {
        const err = (chunk as { error?: { message?: string } }).error?.message;
        if (err && !streamError) streamError = err;
        const cand = (chunk as GeminiResponse).candidates?.[0];
        if (!cand) return;
        for (const part of cand.content?.parts ?? []) {
          parts.push(part);
          if (part.text) {
            textAcc += part.text;
            onTextDelta?.(textAcc);
          }
        }
        if (cand.finishReason) finishReason = cand.finishReason;
      });
      if (streamError) throw new Error(streamError);
      candidate = { content: { parts, role: "model" }, finishReason };
    } else {
      const data = (await response.json()) as GeminiResponse;
      candidate = data.candidates?.[0] ?? null;
    }
    if (!candidate) {
      return {
        content: "I couldn't generate a response. Please try again.",
        toolCalls: allToolCalls,
      };
    }

    const parts = candidate.content.parts;
    const functionCalls = parts.filter((p) => p.functionCall);
    const textParts = parts.filter((p) => p.text);

    if (functionCalls.length === 0) {
      const text = textParts.map((p) => p.text ?? "").join("\n") ||
        "I couldn't generate a response. Please try again.";
      return { content: text, toolCalls: allToolCalls };
    }

    // Add the model response to contents
    contents.push({ role: "model", parts });

    // Execute function calls and build response parts
    const responseParts: GeminiPart[] = [];

    for (const part of functionCalls) {
      const fc = part.functionCall!;
      const tool = tools.find((t) => t.name === fc.name);
      const info: ToolCallInfo = {
        id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        toolName: fc.name,
        integrationId: tool?.integrationId ?? "unknown",
        args: fc.args,
        status: "executing",
      };

      allToolCalls.push(info);
      onToolCall?.(info);

      const result = await executeTool(fc.name, fc.args);

      info.status = result.success ? "success" : "error";
      info.result = result.success
        ? JSON.stringify(result.data)
        : (result.error ?? "Unknown error");
      onToolCall?.(info);

      responseParts.push({
        functionResponse: {
          name: fc.name,
          response: result.success
            ? { result: result.data }
            : { error: result.error ?? "Unknown error" },
        },
      });
    }

    contents.push({ role: "user", parts: responseParts });
  }

  // Final text response
  const finalResponse = await fetch(GOOGLE_GENERATE_CONTENT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
      toolConfig: { includeServerSideToolInvocations: true },
    }),
  });

  if (!finalResponse.ok) {
    const error = await finalResponse.text();
    throw new Error(`Google API error (${finalResponse.status}): ${error}`);
  }

  const finalData = (await finalResponse.json()) as GeminiResponse;
  const text = finalData.candidates?.[0]?.content?.parts
    ?.filter((p) => p.text)
    .map((p) => p.text ?? "")
    .join("\n") || "I couldn't generate a response. Please try again.";

  return { content: text, toolCalls: allToolCalls };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateChatResponse(
  userMessage: string,
  project: Project,
  integrations: Integration[],
  history: ChatMessage[],
  providers?: BYOKProvider[],
  onToolCall?: (info: ToolCallInfo) => void,
  onStageAdvance?: (newStage: StageId) => StageAdvanceOutcome,
  onTextDelta?: (text: string) => void
): Promise<ChatResponseWithTools> {
  const active = getActiveProvider(project.id, providers);
  if (!active) {
    return { content: "No API key configured. Please add an API key in Settings to enable AI-powered chat.", toolCalls: [] };
  }

  // Set tool context for system tools (memories, stage advancement)
  setToolContext(project.id, project.currentStage, onStageAdvance, project.name);

  const { provider, apiKey } = active;
  const systemPrompt = buildSystemPrompt(project, integrations);
  const messages = formatMessages(systemPrompt, history, userMessage);

  // Collect available tools from connectors
  const tools =
    provider.custom || TOOL_CAPABLE_PROVIDERS.has(provider.id)
      ? getAvailableTools()
      : [];

  try {
    let result: ChatResponseWithTools;

    if (provider.id === "anthropic") {
      result = await callAnthropicWithTools(
        apiKey,
        provider.model,
        systemPrompt,
        messages,
        tools,
        onToolCall,
        onTextDelta
      );
    } else if (provider.id === "google") {
      result = await callGoogleWithTools(
        apiKey,
        systemPrompt,
        messages,
        tools,
        onToolCall,
        onTextDelta
      );
    } else {
      // OpenAI-compatible (Groq, OpenAI, custom endpoints)
      result = await callOpenAICompatibleWithTools(
        provider.endpoint,
        provider.model,
        apiKey,
        messages,
        tools,
        onToolCall,
        provider.extraParams,
        onTextDelta
      );
    }

    return result;
  } catch (error) {
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Post-turn memory extraction — deterministic persistence regardless of model
// initiative. One small JSON-only call per completed turn, best-effort.
// ---------------------------------------------------------------------------

const EXTRACTABLE_MEMORY_TYPES = new Set<MemoryType>([
  "context",
  "decision",
  "preference",
  "constraint",
  "learning",
  "artifact",
]);

export async function callSimpleCompletion(
  provider: LLMProvider,
  apiKey: string,
  prompt: string,
  maxTokens: number
): Promise<string> {
  if (provider.id === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(`Anthropic API error (${response.status})`);
    const data = (await response.json()) as AnthropicResponse;
    return (
      data.content
        ?.filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("\n") ?? ""
    );
  }

  if (provider.id === "google") {
    const response = await fetch(GOOGLE_GENERATE_CONTENT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0 },
      }),
    });
    if (!response.ok) throw new Error(`Google API error (${response.status})`);
    const data = (await response.json()) as GeminiResponse;
    return (
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("") ?? ""
    );
  }

  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature: 0,
      ...provider.extraParams,
    }),
  });
  if (!response.ok) throw new Error(`API error (${response.status})`);
  const data = (await response.json()) as { choices: OpenAIChoice[] };
  return data.choices?.[0]?.message?.content ?? "";
}

async function extractTurnMemories(
  provider: LLMProvider,
  apiKey: string,
  projectId: string,
  stage: StageId,
  userMessage: string,
  assistantReply: string
): Promise<number> {
  const clip = (text: string, max: number) =>
    text.length > max ? `${text.slice(0, max)}\u2026` : text;

  const prompt = [
    "Extract facts worth remembering about this project from the exchange below.",
    "Persist only concrete artifacts, decisions, evidence, constraints, preferences,",
    "or learnings stated or confirmed in it — no plans, opinions, or chit-chat.",
    "",
    `Stage: ${stage}`,
    `USER: ${clip(userMessage, 1500)}`,
    `ASSISTANT: ${clip(assistantReply, 2000)}`,
    "",
    'Return ONLY a JSON array (max 3 items): [{"type":"context|decision|preference|constraint|learning|artifact","content":"one self-contained sentence"}]',
    "Return [] if nothing is worth persisting.",
  ].join("\n");

  try {
    const raw = await callSimpleCompletion(provider, apiKey, prompt, 300);
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return 0;
    const parsed: unknown = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return 0;
    let saved = 0;
    for (const item of parsed.slice(0, 3)) {
      const candidate = item as { type?: unknown; content?: unknown };
      if (
        typeof candidate?.type !== "string" ||
        typeof candidate?.content !== "string" ||
        !candidate.content.trim() ||
        !EXTRACTABLE_MEMORY_TYPES.has(candidate.type as MemoryType)
      ) {
        continue;
      }
      addMemory(
        projectId,
        candidate.type as MemoryType,
        candidate.content.trim(),
        stage,
        "ai"
      );
      saved++;
    }
    return saved;
  } catch {
    return 0;
  }
}
