import { getCachedMemories } from "./memories";
import { getSeededProjectDoc } from "./project-doc";

// Which project a chat turn is working on — set by chat-tools.setToolContext
// before each turn so stateless connectors can enrich what they generate.
let _projectId: string | null = null;
let _projectName = "Project";

export function setActiveToolProject(
  projectId: string | null,
  projectName?: string
): void {
  _projectId = projectId;
  _projectName = projectName || "Project";
}

export function getActiveToolProject(): {
  projectId: string | null;
  projectName: string;
} {
  return { projectId: _projectId, projectName: _projectName };
}

const SECTION_LABELS: { id: string; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "problem", label: "Problem" },
  { id: "targetUser", label: "Target user" },
  { id: "techStack", label: "Tech stack" },
  { id: "features", label: "Features" },
  { id: "decisions", label: "Decisions" },
  { id: "constraints", label: "Constraints" },
  { id: "openQuestions", label: "Open questions" },
  { id: "milestones", label: "Milestones" },
];

/**
 * Deterministic "PROJECT BRIEF" block for tool-generated prompts — pulls the
 * project's accumulated brief sections and most recent memories so generated
 * scaffolds carry real context instead of generic placeholders. Returns an
 * empty string when no project is active or nothing has been captured yet.
 */
export function projectBriefBlock(projectIdOverride?: string): string {
  const projectId = projectIdOverride ?? _projectId;
  if (!projectId) return "";

  const lines: string[] = [];
  try {
    const doc = getSeededProjectDoc(projectId);
    for (const { id, label } of SECTION_LABELS) {
      const section = doc.sections.find((s) => s.id === id);
      const content = section?.content?.trim();
      if (content) lines.push(`${label}: ${content}`);
    }
  } catch {
    // Doc unavailable — continue with memories only.
  }

  const memories = getCachedMemories(projectId)
    .slice(-8)
    .map((m) => `- ${m.content}`);
  if (memories.length > 0) {
    lines.push(`Recent context:\n${memories.join("\n")}`);
  }

  if (lines.length === 0) return "";
  return [
    ``,
    `PROJECT BRIEF (carry this context — do not invent different details):`,
    `Project name: ${_projectName}`,
    ...lines,
    ``,
  ].join("\n");
}
