import { StageId } from "./types";
import { getAvailableTools } from "./chat-tools";
import { getStage, getNextStage } from "./stages";
import { ChatTool } from "./tool-types";

/**
 * Map integrationId → human-readable verb phrases the LLM can reference
 * when deciding which tool to call.
 */
const INTEGRATION_VERBS: Record<string, string> = {
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
    "Help the user brainstorm. If they mention notes or docs, offer to search Notion or Google Docs. If they want to capture ideas, offer to create a doc.",
  context:
    "Help the user gather context. Proactively offer to search Notion, Google Docs, Slack, or Discord for relevant specs, decisions, and prior work.",
  "landing-page":
    "Help build a landing page. Suggest creating a doc outline first, then deploying with Lovable or Vercel. Offer to search Figma for design references.",
  github:
    "Help with version control setup. Offer to use Devin or Claude Code for repo scaffolding and README generation.",
  hosting:
    "Help deploy the project. Proactively suggest deploying to Vercel. Offer to check deployment status or notify the team via Slack.",
  domain:
    "Help configure a custom domain. Suggest checking Vercel domain settings if Vercel is connected.",
  "build-prototype":
    "Help build features. Offer to search Notion for specs, reference Figma designs, delegate tasks to Devin or Claude Code, and deploy with Vercel.",
  "next-features":
    "Help prioritize features. Offer to search Notion for the backlog, pull Slack/Discord feedback, and delegate implementation to AI coding tools.",
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
  for (const [integrationId, intTools] of byIntegration) {
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
