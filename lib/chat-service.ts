import { ChatMessage, Integration, Project, StageId } from "./types";
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
import { getFlowContext } from "./flow-orchestrator";
import { formatMemoriesForPrompt } from "./memories";
import { ChatTool } from "./tool-types";

const MAX_TOOL_CALLS_PER_TURN = 3;

interface LLMProvider {
  id: string;
  endpoint: string;
  model: string;
}

const PROVIDERS: LLMProvider[] = [
  {
    id: "groq",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
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
    endpoint:
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    model: "gemini-2.0-flash",
  },
];

// Providers that support function calling
const TOOL_CAPABLE_PROVIDERS = new Set(["groq", "openai", "anthropic", "google"]);

function getActiveProvider(
  projectId: string,
  enabledProviderIds?: string[]
): { provider: LLMProvider; apiKey: string } | null {
  for (const provider of PROVIDERS) {
    if (enabledProviderIds && !enabledProviderIds.includes(provider.id)) {
      continue;
    }
    const key = getBYOKKey(projectId, provider.id);
    if (key) {
      return { provider, apiKey: key };
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

  const connected = integrations.filter((i) => i.connected);
  const suggestions = getSuggestionsForStage(project.currentStage);
  const unconnected = suggestions.filter((s) => {
    const integ = integrations.find((i) => i.id === s.integrationId);
    return integ && !integ.connected;
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
  const memoriesContext = formatMemoriesForPrompt(project.id);

  return `You are Compass, an opinionated AI guide for vibe coders built by Vibe Space. You LEAD the user through the vibe coding journey — from ideation to launch. You don't just answer questions; you proactively guide, suggest next steps, and drive progress.

CURRENT PROJECT: "${project.name}"
${project.description ? `Description: ${project.description}` : ""}
CURRENT STAGE: ${stage.label} — ${stage.description}
NEXT MOVE: ${stage.nextAction}
RECOMMENDED TOOLS: ${stage.tools.join(", ")}
RISK: ${stage.risk} | COMPLEXITY: ${stage.complexity}
TECHNICAL DEBT: ${project.technicalDebt} | COGNITIVE DEBT: ${project.cognitiveDebt}

STAGE CONTEXT: ${stage.debtNote}

${memoriesContext}

INTEGRATIONS:
${connectedList}${suggestedList}

${flowContext}

RESOURCES FOR THIS STAGE:
${stage.links.map((l) => `- ${l.label}: ${l.url}`).join("\n")}

YOUR ROLE — PROACTIVE GUIDE:
- You LEAD the experience. Don't wait for the user to know what to ask. Tell them: "Here's where you are. Here's your next move."
- Be direct, opinionated, and action-oriented. Sound like a knowledgeable friend who's shipped products before.
- When the user shares information about their project (target user, tech choices, constraints, preferences), use save_memory to persist it. This builds a knowledge base that helps you give better advice over time.
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

async function callOpenAICompatibleWithTools(
  endpoint: string,
  model: string,
  apiKey: string,
  messages: { role: string; content: string }[],
  tools: ChatTool[],
  onToolCall?: (info: ToolCallInfo) => void
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
      model,
      messages: conversationMessages,
      max_tokens: 1024,
      temperature: 0.7,
    };
    if (toolDefs && toolDefs.length > 0) {
      body.tools = toolDefs;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error (${response.status}): ${error}`);
    }

    const data = (await response.json()) as { choices: OpenAIChoice[] };
    const choice = data.choices?.[0];
    if (!choice) {
      return { content: "I couldn't generate a response. Please try again.", toolCalls: allToolCalls };
    }

    const msg = choice.message;

    // No tool calls → return text
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
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
      model,
      messages: conversationMessages,
      max_tokens: 1024,
      temperature: 0.7,
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
  systemPrompt: string,
  messages: { role: string; content: string }[],
  tools: ChatTool[],
  onToolCall?: (info: ToolCallInfo) => void
): Promise<ChatResponseWithTools> {
  const toolDefs = tools.length > 0 ? toolsToAnthropicFormat(tools) : undefined;
  const allToolCalls: ToolCallInfo[] = [];

  const anthropicMessages: { role: string; content: string | AnthropicContentBlock[] }[] = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  for (let round = 0; round < MAX_TOOL_CALLS_PER_TURN; round++) {
    const body: Record<string, unknown> = {
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1024,
      system: systemPrompt,
      messages: anthropicMessages,
    };
    if (toolDefs && toolDefs.length > 0) {
      body.tools = toolDefs;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${error}`);
    }

    const data = (await response.json()) as AnthropicResponse;

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
      model: "claude-3-5-haiku-20241022",
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
  onToolCall?: (info: ToolCallInfo) => void
): Promise<ChatResponseWithTools> {
  const allToolCalls: ToolCallInfo[] = [];
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

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
    };
    if (geminiToolsArr.length > 0) {
      body.tools = geminiToolsArr;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google API error (${response.status}): ${error}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const candidate = data.candidates?.[0];
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
  const finalResponse = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
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
  enabledProviderIds?: string[],
  onToolCall?: (info: ToolCallInfo) => void,
  onStageAdvance?: (newStage: StageId) => void
): Promise<string> {
  const active = getActiveProvider(project.id, enabledProviderIds);
  if (!active) {
    return "No API key configured. Please add an API key in Settings to enable AI-powered chat.";
  }

  // Set tool context for system tools (memories, stage advancement)
  setToolContext(project.id, project.currentStage, onStageAdvance);

  const { provider, apiKey } = active;
  const systemPrompt = buildSystemPrompt(project, integrations);
  const messages = formatMessages(systemPrompt, history, userMessage);

  // Collect available tools from connectors
  const tools = TOOL_CAPABLE_PROVIDERS.has(provider.id) ? getAvailableTools() : [];

  try {
    let result: ChatResponseWithTools;

    if (provider.id === "anthropic") {
      result = await callAnthropicWithTools(
        apiKey,
        systemPrompt,
        messages,
        tools,
        onToolCall
      );
    } else if (provider.id === "google") {
      result = await callGoogleWithTools(
        apiKey,
        systemPrompt,
        messages,
        tools,
        onToolCall
      );
    } else {
      // OpenAI-compatible (Groq, OpenAI)
      result = await callOpenAICompatibleWithTools(
        provider.endpoint,
        provider.model,
        apiKey,
        messages,
        tools,
        onToolCall
      );
    }

    return result.content;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return `Error calling ${provider.id}: ${msg}\n\nPlease check your API key and try again.`;
  }
}
