import { StageId } from "./types";
import { getAvailableTools } from "./chat-tools";
import { getStage, getNextStage } from "./stages";
import { ChatTool } from "./tool-types";

/**
 * Map integrationId → human-readable verb phrases the LLM can reference
 * when deciding which tool to call.
 */
const INTEGRATION_VERBS: Record<string, string> = {
  perplexity: "search the web, research ideas, find competitors, validate concepts",
  notion: "search Notion pages, create Notion pages",
  gdocs: "create Google Docs, search Google Docs",
  figma: "fetch Figma designs, list Figma components",
  slack: "search Slack messages, send Slack messages",
  discord: "search Discord messages, send Discord messages",
  vercel: "deploy to Vercel, list Vercel deployments",
  lovable: "generate a Lovable app, update a Lovable project",
  cursor: "open in Cursor, run Cursor commands",
  "claude-code": "run Claude Code tasks",
  codex: "run Codex tasks",
  devin: "create a Devin session, assign tasks to Devin",
  base44: "create a Base44 app",
};

/**
 * Stage-specific tool usage guidance.
 */
const STAGE_TOOL_HINTS: Record<StageId, string> = {
  ideation:
    "GUIDE THE USER TO: 1) Define their idea clearly (one sentence), 2) Research if similar products exist using Perplexity, 3) Identify their target user, 4) Save key decisions as memories. When the idea is clear and validated, suggest advancing to Context.",
  context:
    "GUIDE THE USER TO: 1) Research technical approaches and best practices with Perplexity, 2) Define constraints and preferences (save as memories), 3) Create a project brief with target user, features, and tech choices. When context is solid, suggest advancing to Landing Page.",
  "landing-page":
    "GUIDE THE USER TO: 1) Generate a copy-ready prompt for Lovable/Cursor that includes all project context and memories, 2) The user will paste this prompt into the tool and build externally, 3) When they return, ask what they built and save progress. Suggest advancing to GitHub when the page is ready.",
  github:
    "GUIDE THE USER TO: 1) Create a GitHub repo (offer to generate a README prompt for Cursor/Claude Code), 2) Push their landing page code, 3) Set up basic CI if needed. Suggest advancing to Hosting once code is pushed.",
  hosting:
    "GUIDE THE USER TO: 1) Deploy to Vercel from their GitHub repo (use Vercel integration if connected), 2) Verify the deployment works, 3) Share the live URL for feedback. Suggest advancing to Domain once deployed.",
  domain:
    "GUIDE THE USER TO: 1) Choose and register a domain, 2) Connect it to their hosting provider (Vercel domains if connected), 3) Verify DNS propagation. Suggest advancing to Build Prototype once domain is live.",
  "build-prototype":
    "GUIDE THE USER TO: 1) Define core features (from memories/brief), 2) Generate implementation prompts for Cursor/Claude Code/Devin with full project context, 3) Build iteratively — one feature at a time, 4) Search Figma for design references if connected. The user builds externally and returns to update progress.",
  "next-features":
    "GUIDE THE USER TO: 1) Gather user feedback from Slack/Discord, 2) Prioritize the backlog (use Notion if connected), 3) Generate implementation prompts for the next features, 4) Delegate to AI coding tools. Keep iterating.",
};

/**
 * Build a context string describing which tool actions are available for the
 * current stage and connected integrations.
 */
export function getFlowContext(
  stageId: StageId,
  connectedIntegrations: string[]
): string {
  const tools = getAvailableTools();

  if (tools.length === 0) {
    return "No tool actions are currently available. Respond with text-only guidance.";
  }

  const byIntegration = new Map<string, ChatTool[]>();
  for (const tool of tools) {
    const list = byIntegration.get(tool.integrationId) ?? [];
    list.push(tool);
    byIntegration.set(tool.integrationId, list);
  }

  const lines: string[] = ["AVAILABLE ACTIONS:"];
  // Always show system tools
  const systemTools = byIntegration.get("_system");
  if (systemTools) {
    lines.push(`- System: save memories, update memories, advance stage, generate project brief (tools: ${systemTools.map((t) => t.name).join(", ")})`);
  }
  for (const [integrationId, intTools] of byIntegration) {
    if (integrationId === "_system") continue;
    const connected = connectedIntegrations.includes(integrationId);
    if (!connected) continue;
    const names = intTools.map((t) => t.name).join(", ");
    const verbs = INTEGRATION_VERBS[integrationId] ?? names;
    lines.push(`- ${integrationId}: ${verbs} (tools: ${names})`);
  }

  const stageHint = STAGE_TOOL_HINTS[stageId] ?? "";
  if (stageHint) {
    lines.push("");
    lines.push(`STAGE GUIDANCE: ${stageHint}`);
  }

  lines.push("");
  lines.push(
    "TOOL USAGE RULES:\n" +
      "- When a user request can be fulfilled by a tool, use it instead of just describing what to do.\n" +
      "- Announce what you're about to do before calling a tool (e.g., \"Let me search Notion for that...\").\n" +
      "- If a tool call fails, explain the error and suggest the user check the integration settings.\n" +
      "- You may call up to 3 tools per turn. Do not loop."
  );

  return lines.join("\n");
}

/**
 * Suggest whether the user should consider moving to the next stage based
 * on what actions have been completed.
 */
export function getStageTransitionAdvice(
  currentStage: StageId,
  completedActions: string[]
): string {
  const stage = getStage(currentStage);
  const next = getNextStage(currentStage);

  if (!stage || !next) return "";

  if (completedActions.length === 0) {
    return `You're in the ${stage.label} stage. Focus on: ${stage.nextAction}`;
  }

  const thresholds: Record<StageId, number> = {
    ideation: 2,
    context: 3,
    "landing-page": 2,
    github: 1,
    hosting: 1,
    domain: 1,
    "build-prototype": 5,
    "next-features": 3,
  };

  const threshold = thresholds[currentStage] ?? 2;
  if (completedActions.length >= threshold) {
    return (
      `You've completed ${completedActions.length} action(s) in ${stage.label}. ` +
      `Consider moving to the next stage: ${next.label} — ${next.nextAction}`
    );
  }

  return `Progress in ${stage.label}: ${completedActions.length} action(s) completed. ${stage.nextAction}`;
}
