import { ChatMessage, Integration, Project, StageId } from "./types";
import { getStage } from "./stages";
import { getSuggestionsForStage } from "./integrations";
import { getBYOKKey } from "./storage";

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
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    model: "gemini-2.0-flash",
  },
];

function getActiveProvider(): { provider: LLMProvider; apiKey: string } | null {
  for (const provider of PROVIDERS) {
    const key = getBYOKKey(provider.id);
    if (key) {
      return { provider, apiKey: key };
    }
  }
  return null;
}

function buildSystemPrompt(project: Project, integrations: Integration[]): string {
  const stage = getStage(project.currentStage);
  if (!stage) return "You are Compass, a helpful assistant for vibe coders.";

  const connected = integrations.filter((i) => i.connected);
  const suggestions = getSuggestionsForStage(project.currentStage);
  const unconnected = suggestions.filter((s) => {
    const integ = integrations.find((i) => i.id === s.integrationId);
    return integ && !integ.connected;
  });

  const connectedList = connected.length > 0
    ? `Connected integrations: ${connected.map((i) => i.name).join(", ")}.`
    : "No integrations connected yet.";

  const suggestedList = unconnected.length > 0
    ? `\nSuggested integrations for this stage:\n${unconnected.map((s) => {
        const integ = integrations.find((i) => i.id === s.integrationId);
        return `- ${integ?.name}: ${s.purpose} → ${s.outcome}`;
      }).join("\n")}`
    : "";

  return `You are Compass, a guided assistant for vibe coders built by Vibe Space. You help users navigate the vibe coding journey — from ideation to launch — with clarity and opinionated guidance.

CURRENT PROJECT: "${project.name}"
${project.description ? `Description: ${project.description}` : ""}
CURRENT STAGE: ${stage.label} — ${stage.description}
NEXT MOVE: ${stage.nextAction}
RECOMMENDED TOOLS: ${stage.tools.join(", ")}
RISK: ${stage.risk} | COMPLEXITY: ${stage.complexity}
TECHNICAL DEBT: ${project.technicalDebt} | COGNITIVE DEBT: ${project.cognitiveDebt}

STAGE CONTEXT: ${stage.debtNote}

INTEGRATIONS:
${connectedList}${suggestedList}

RESOURCES FOR THIS STAGE:
${stage.links.map((l) => `- ${l.label}: ${l.url}`).join("\n")}

YOUR ROLE:
- Be direct, friendly, and helpful. Sound like: "You are here." / "Here's your next move." / "This choice adds complexity." / "Keep it simple for now."
- Guide the user through their current stage with opinionated, actionable advice.
- When they ask about tools, suggest the recommended ones for their stage and explain tradeoffs.
- When they ask about integrations, reference the connected/suggested ones above.
- When they ask about debt or risk, explain clearly what adds or reduces complexity.
- Keep responses concise (2-4 paragraphs max). Avoid generic filler.
- If suggesting an integration, mention its purpose and expected outcome.
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

  // Include recent history (last 10 messages for context window)
  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    if (msg.role === "user" || msg.role === "assistant") {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: "user", content: userMessage });
  return messages;
}

async function callOpenAICompatible(
  endpoint: string,
  model: string,
  apiKey: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "I couldn't generate a response. Please try again.";
}

async function callAnthropic(
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const anthropicMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
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

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || "I couldn't generate a response. Please try again.";
}

async function callGoogle(
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response. Please try again.";
}

export async function generateChatResponse(
  userMessage: string,
  project: Project,
  integrations: Integration[],
  history: ChatMessage[]
): Promise<string> {
  const active = getActiveProvider();
  if (!active) {
    return "No API key configured. Please add an API key in Settings to enable AI-powered chat.";
  }

  const { provider, apiKey } = active;
  const systemPrompt = buildSystemPrompt(project, integrations);
  const messages = formatMessages(systemPrompt, history, userMessage);

  try {
    if (provider.id === "anthropic") {
      return await callAnthropic(apiKey, systemPrompt, messages);
    }

    if (provider.id === "google") {
      return await callGoogle(apiKey, systemPrompt, messages);
    }

    // OpenAI-compatible (Groq, OpenAI)
    return await callOpenAICompatible(provider.endpoint, provider.model, apiKey, messages);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return `Error calling ${provider.id}: ${msg}\n\nPlease check your API key and try again.`;
  }
}
