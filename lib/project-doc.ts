import { ProjectDoc, ProjectDocSection, ProjectDocSectionId } from "./types";
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

export function seedDocFromMemories(projectId: string): ProjectDoc {
  const doc = ensureProjectDoc(projectId);
  const memories = getCachedMemories(projectId);
  const sectionContent = (type: "decision" | "constraint") =>
    memories.filter((memory) => memory.type === type).map((memory) => `- ${memory.content}`).join("\n");
  const updatedAt = new Date().toISOString();
  const next: ProjectDoc = {
    ...doc,
    sections: doc.sections.map((section) =>
      section.id === "decisions" || section.id === "constraints"
        ? { ...section, content: sectionContent(section.id === "decisions" ? "decision" : "constraint"), updatedAt }
        : section
    ),
    updatedAt,
  };
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
