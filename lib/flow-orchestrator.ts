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
    "GUIDE THE USER TO: 1) Write the problem in one sentence — who has it, how painful it is, what they do about it today, 2) Research whether the problem is real and how people solve it now (use Perplexity if connected), 3) Save the problem definition, target user, and evidence as memories. If the user asks to build features or generate code prompts, REDIRECT: this stage validates the problem, not the product. Advance to Context when the problem is validated and the target user is named.",
  context:
    "GUIDE THE USER TO: 1) Research how others solve this problem and what works (Perplexity if connected), 2) Build and refine the project brief with generate_project_brief + update_project_doc — problem evidence, target user, constraints, success criteria, 3) Save every decision and constraint as memories. This context is what AI build tools will need later — the better the brief, the better the build. If the user asks to start coding, remind them context comes first. Advance to Landing Page when the brief is solid.",
  "landing-page":
    "GUIDE THE USER TO: 1) Define the demand test — one clear pitch plus one call to action (signup/waitlist), 2) Generate a copy-ready prompt for Lovable/v0/Framer that carries the project brief and memories, 3) The user builds the page externally — when they return, ask what they shipped and save progress. A landing page validates demand cheaply; it is NOT the product. Advance to GitHub when the page exists.",
  github:
    "GUIDE THE USER TO: 1) Put the validation page in version control (offer to generate a README prompt for Cursor/Claude Code that states the problem being validated), 2) Push the code. Suggest advancing to Hosting once pushed.",
  hosting:
    "GUIDE THE USER TO: 1) Deploy the validation page (Vercel if connected), 2) Share the link where the target users actually are, 3) Save every signup, reply, and objection as memories — that's the PMF signal forming. Suggest advancing to Domain once the page is live and being shared.",
  domain:
    "GUIDE THE USER TO: 1) Pick a domain that makes the pitch credible, 2) Connect it to hosting (Vercel domains if connected), 3) Keep collecting signal. Advance to Build Prototype ONLY when real validation evidence exists in memories — signups, replies, or clear demand. If there's none yet, keep the user validating instead of building.",
  "build-prototype":
    "GUIDE THE USER TO: 1) Before generating any build prompt, CHECK memories/doc for validation evidence — if it's thin, send the user back to validate demand first, 2) Pick the ONE feature the evidence points to, 3) Generate implementation prompts for Cursor/Claude Code/Devin packed with project context and memories, 4) Build iteratively — one feature at a time. The user builds externally and returns to update progress.",
  "next-features":
    "GUIDE THE USER TO: 1) Collect what users actually asked for (Slack/Discord if connected), 2) Prioritize only validated requests (use Notion if connected), 3) Generate implementation prompts for those features, 4) Keep iterating: request → build → feedback.",
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
    lines.push(`- System: manage memories and the project document, advance stage, generate project brief (tools: ${systemTools.map((t) => t.name).join(", ")})`);
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

  const threshold = getStageThreshold(currentStage);
  if (completedActions.length >= threshold) {
    return (
      `You've completed ${completedActions.length} action(s) in ${stage.label}. ` +
      `Consider moving to the next stage: ${next.label} — ${next.nextAction}`
    );
  }

  return `Progress in ${stage.label}: ${completedActions.length} action(s) completed. ${stage.nextAction}`;
}

export const STAGE_THRESHOLDS: Record<StageId, number> = {
  ideation: 2,
  context: 3,
  "landing-page": 2,
  github: 1,
  hosting: 1,
  domain: 1,
  "build-prototype": 5,
  "next-features": 3,
};

export function getStageThreshold(stageId: StageId): number {
  return STAGE_THRESHOLDS[stageId] ?? 2;
}
