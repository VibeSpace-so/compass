import {
  ProjectDoc,
  ProjectDocSection,
  ProjectDocSectionId,
  ProjectMemory,
} from "./types";
import { encrypt, decrypt, isProjectEncrypted } from "./crypto";
import { getProjectPassword } from "./secure-storage";
import { getCachedMemories, removeMemory } from "./memories";

const DOC_PREFIX = "vibe-compass-project-doc-";
const projectDocCache = new Map<string, ProjectDoc>();
const migratedProjects = new Set<string>();

const SECTION_DEFINITIONS: { id: ProjectDocSectionId; title: string }[] = [
  { id: "summary", title: "Summary" },
  { id: "problem", title: "Problem" },
  { id: "targetUser", title: "Target User" },
  { id: "techStack", title: "Tech Stack" },
  { id: "features", title: "Features" },
  { id: "decisions", title: "Decisions" },
  { id: "constraints", title: "Constraints" },
  { id: "openQuestions", title: "Open Questions" },
  { id: "milestones", title: "Milestones" },
];

export function getCachedProjectDoc(projectId: string): ProjectDoc | undefined {
  return projectDocCache.get(projectId);
}

function createProjectDoc(projectId: string): ProjectDoc {
  const now = new Date().toISOString();
  return {
    projectId,
    sections: SECTION_DEFINITIONS.map(({ id, title }): ProjectDocSection => ({
      id,
      title,
      content: "",
      updatedAt: now,
      source: "ai",
    })),
    updatedAt: now,
  };
}

export function ensureProjectDoc(projectId: string): ProjectDoc {
  const existing = projectDocCache.get(projectId);
  if (existing) return existing;
  const doc = createProjectDoc(projectId);
  projectDocCache.set(projectId, doc);
  saveEncryptedProjectDoc(projectId, doc).catch(() => {});
  return doc;
}

export function updateDocSection(
  projectId: string,
  sectionId: ProjectDocSectionId,
  content: string,
  source: "user" | "ai"
): ProjectDoc {
  const doc = ensureProjectDoc(projectId);
  const updatedAt = new Date().toISOString();
  const next: ProjectDoc = {
    ...doc,
    sections: doc.sections.map((section) =>
      section.id === sectionId ? { ...section, content, source, updatedAt } : section
    ),
    updatedAt,
  };
  projectDocCache.set(projectId, next);
  saveEncryptedProjectDoc(projectId, next).catch(() => {});
  return next;
}

export function appendMilestone(projectId: string, text: string): ProjectDoc {
  const doc = ensureProjectDoc(projectId);
  const milestones = doc.sections.find((section) => section.id === "milestones");
  const content = milestones?.content ? `${milestones.content}\n- ${text}` : `- ${text}`;
  return updateDocSection(projectId, "milestones", content, "ai");
}

function collectSectionMatches(
  memories: ProjectMemory[],
  includeArtifacts = true
): Map<ProjectDocSectionId, string[]> {
  const sectionIds = SECTION_DEFINITIONS.map(({ id }) => id);
  const sectionMatches = new Map<ProjectDocSectionId, string[]>();

  for (const memory of memories) {
    const content = memory.content.trim();
    if (!content) continue;

    // A structured brief is the most reliable source for the document. Keep
    // its headings intact instead of trying to infer sections from keywords.
    if (memory.type === "artifact" && includeArtifacts) {
      const headingPattern = /^#{2,3}\s+(.+?)\s*$/gm;
      const headings = [...content.matchAll(headingPattern)];
      for (let index = 0; index < headings.length; index++) {
        const heading = headings[index][1].toLowerCase().replace(/[^a-z]/g, "");
        const sectionId = ({
          summary: "summary",
          problem: "problem",
          targetuser: "targetUser",
          techstack: "techStack",
          features: "features",
          decisions: "decisions",
          constraints: "constraints",
          openquestions: "openQuestions",
          milestones: "milestones",
        } as Record<string, ProjectDocSectionId | undefined>)[heading];
        if (!sectionId) continue;
        const start = (headings[index].index ?? 0) + headings[index][0].length;
        const end = headings[index + 1]?.index ?? content.length;
        const sectionText = content.slice(start, end).trim();
        if (sectionText) {
          sectionMatches.set(sectionId, [
            ...(sectionMatches.get(sectionId) ?? []),
            sectionText,
          ]);
        }
      }
      continue;
    }

    const lower = content.toLowerCase();
    const matches: ProjectDocSectionId[] = [];
    if (
      memory.type === "decision" &&
      /\b(next\.?js|react|typescript|javascript|supabase|postgres|database|api|framework|library|stack|tool|host|vercel)\b/i.test(
        content
      )
    ) {
      matches.push("techStack");
    } else if (memory.type === "decision") {
      matches.push("decisions");
    }
    if (memory.type === "constraint") matches.push("constraints");
    if (
      /\b(target user|users?|audience|customer|customers|indie hackers?|developers?|founders?)\b/i.test(
        content
      )
    ) {
      matches.push("targetUser");
    }
    if (
      /\b(feature|features|functionality|capability|capabilities|should support|must support)\b/i.test(
        content
      )
    ) {
      matches.push("features");
    }
    const describesProblem = /\b(problem|pain point|need|challenge|solve|solves|solution)\b/i.test(
      content
    );
    if (describesProblem) {
      matches.push("problem");
    }
    if (
      memory.type === "context" ||
      /\b(project|idea|product|app|platform|building|build|description)\b/i.test(
        content
      )
    ) {
      matches.push("summary");
    }
    if (
      memory.type === "learning" &&
      /\?|open question|unknown|research|investigate|decide\b/i.test(lower)
    ) {
      matches.push("openQuestions");
    }

    for (const sectionId of matches) {
      if (!sectionIds.includes(sectionId)) continue;
      sectionMatches.set(sectionId, [
        ...(sectionMatches.get(sectionId) ?? []),
        `- ${content}`,
      ]);
    }
  }

  if (!sectionMatches.has("summary")) {
    const nonArtifactMemories = memories.filter(
      (memory) => memory.type !== "artifact" && memory.content.trim()
    );
    const fallback =
      nonArtifactMemories.find((memory) =>
        /\b(project|idea|product|app|platform|building|build|description)\b/i.test(
          memory.content
        )
      ) ??
      nonArtifactMemories.find((memory) => memory.type === "context") ??
      nonArtifactMemories[0];
    if (fallback) {
      sectionMatches.set("summary", [`- ${fallback.content.trim()}`]);
    }
  }

  return sectionMatches;
}

function applySectionMatches(
  doc: ProjectDoc,
  sectionMatches: Map<ProjectDocSectionId, string[]>
): ProjectDoc {
  const updatedAt = new Date().toISOString();
  return {
    ...doc,
    sections: doc.sections.map((section) => {
      const matches = sectionMatches.get(section.id);
      const isSeededContent =
        section.source === "ai" &&
        section.content.trim().split("\n").every((line) => line.trim().startsWith("- "));
      if (
        !matches?.length ||
        (section.content.trim() && !isSeededContent)
      ) {
        return section;
      }
      return {
        ...section,
        content: [...new Set(matches)].join("\n\n"),
        updatedAt,
      };
    }),
    updatedAt,
  };
}

export function getSeededProjectDoc(projectId: string): ProjectDoc {
  const doc = ensureProjectDoc(projectId);
  return applySectionMatches(
    doc,
    collectSectionMatches(
      getCachedMemories(projectId).filter((memory) => memory.type !== "artifact"),
      false
    )
  );
}

export function seedDocFromMemories(projectId: string): ProjectDoc {
  const doc = ensureProjectDoc(projectId);
  const next = applySectionMatches(
    doc,
    collectSectionMatches(getCachedMemories(projectId))
  );
  projectDocCache.set(projectId, next);
  saveEncryptedProjectDoc(projectId, next).catch(() => {});
  return next;
}

export function docToMarkdown(doc: ProjectDoc, projectName: string): string {
  const sections = doc.sections
    .filter((section) => section.content.trim())
    .map((section) => `## ${section.title}\n\n${section.content.trim()}`)
    .join("\n\n");
  return `# ${projectName} — Project Brief\n\nGenerated ${new Date().toLocaleDateString()}\n\n${sections}\n`;
}

export async function saveEncryptedProjectDoc(projectId: string, doc: ProjectDoc): Promise<void> {
  const storageKey = DOC_PREFIX + projectId;
  if (isProjectEncrypted(projectId)) {
    const password = getProjectPassword(projectId);
    if (!password) throw new Error("Project not unlocked");
    localStorage.setItem(storageKey, await encrypt(JSON.stringify(doc), password, projectId));
  } else {
    localStorage.setItem(storageKey, JSON.stringify(doc));
  }
}

export async function loadEncryptedProjectDoc(projectId: string): Promise<ProjectDoc | null> {
  const encrypted = isProjectEncrypted(projectId);
  const password = getProjectPassword(projectId);
  if (encrypted && !password) return null;
  const stored = localStorage.getItem(DOC_PREFIX + projectId);
  if (!stored) return null;
  try {
    const json = encrypted ? await decrypt(stored, password!, projectId) : stored;
    const doc = JSON.parse(json) as ProjectDoc;
    projectDocCache.set(projectId, doc);
    return doc;
  } catch {
    return null;
  }
}

export async function rewriteProjectDoc(projectId: string): Promise<void> {
  const doc = projectDocCache.get(projectId);
  if (doc) await saveEncryptedProjectDoc(projectId, doc);
}

export function clearProjectDoc(projectId: string): void {
  projectDocCache.delete(projectId);
  migratedProjects.delete(projectId);
  if (typeof window !== "undefined") localStorage.removeItem(DOC_PREFIX + projectId);
}

export async function migrateLegacyBrief(projectId: string): Promise<void> {
  if (migratedProjects.has(projectId)) return;
  migratedProjects.add(projectId);
  const legacy = getCachedMemories(projectId).find(
    (memory) => memory.type === "artifact" && memory.content.startsWith("## Project Brief")
  );
  if (!legacy) {
    ensureProjectDoc(projectId);
    return;
  }
  seedDocFromMemories(projectId);
  removeMemory(projectId, legacy.id);
}
