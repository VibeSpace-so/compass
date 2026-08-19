/**
 * Core Memories — persistent per-project knowledge store.
 * The AI reads memories for context and writes memories to capture
 * decisions, preferences, constraints, and learnings.
 */

import { ProjectMemory, MemoryType, StageId } from "./types";
import { encrypt, decrypt, isProjectEncrypted } from "./crypto";
import { getProjectPassword } from "./secure-storage";
import { generateId } from "./storage";

const MEMORY_PREFIX = "vibe-compass-project-mem-";
export const NEAR_DUP_THRESHOLD = 0.7;

// In-memory cache per project
const memoryCache: Map<string, ProjectMemory[]> = new Map();

export function getCachedMemories(projectId: string): ProjectMemory[] {
  return memoryCache.get(projectId) || [];
}

function normalizeContent(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function wordSimilarity(a: string, b: string): number {
  const aWords = new Set(normalizeContent(a).split(" ").filter(Boolean));
  const bWords = new Set(normalizeContent(b).split(" ").filter(Boolean));
  if (aWords.size === 0 && bWords.size === 0) return 1;
  if (aWords.size === 0 || bWords.size === 0) return 0;
  let intersection = 0;
  for (const word of aWords) {
    if (bWords.has(word)) intersection++;
  }
  return intersection / (aWords.size + bWords.size - intersection);
}

export function addMemory(
  projectId: string,
  type: MemoryType,
  content: string,
  stage: StageId,
  source: "user" | "ai" = "ai",
  fields?: Pick<ProjectMemory, "pinned" | "tags">
): ProjectMemory {
  const existing = memoryCache.get(projectId) || [];
  const normalize = normalizeContent;
  const duplicate = existing.find(
    (memory) => memory.type === type && normalize(memory.content) === normalize(content)
  );
  if (duplicate) return duplicate;

  const nearDuplicate = existing.find(
    (memory) =>
      memory.type === type &&
      (wordSimilarity(memory.content, content) >= NEAR_DUP_THRESHOLD ||
        normalize(memory.content).includes(normalize(content)) ||
        normalize(content).includes(normalize(memory.content)))
  );
  if (nearDuplicate) {
    const updatedMemory = {
      ...nearDuplicate,
      content,
      updatedAt: new Date().toISOString(),
      ...(fields?.pinned !== undefined ? { pinned: fields.pinned } : {}),
      ...(fields?.tags !== undefined ? { tags: fields.tags } : {}),
    };
    memoryCache.set(
      projectId,
      existing.map((memory) => memory.id === nearDuplicate.id ? updatedMemory : memory)
    );
    saveEncryptedMemories(projectId, memoryCache.get(projectId)!).catch(() => {});
    return updatedMemory;
  }

  const createdAt = new Date().toISOString();
  const memory: ProjectMemory = {
    id: generateId(),
    type,
    content,
    stage,
    createdAt,
    source,
    updatedAt: createdAt,
    ...fields,
  };

  const updated = [...existing, memory];
  memoryCache.set(projectId, updated);

  // Persist encrypted (fire-and-forget)
  saveEncryptedMemories(projectId, updated).catch(() => {});
  return memory;
}

export function updateMemory(
  projectId: string,
  memoryId: string,
  content: string
): ProjectMemory | null {
  return setMemoryFields(projectId, memoryId, { content });
}

export function setMemoryFields(
  projectId: string,
  memoryId: string,
  patch: Partial<Pick<ProjectMemory, "content" | "pinned" | "tags">>
): ProjectMemory | null {
  const existing = memoryCache.get(projectId) || [];
  const idx = existing.findIndex((m) => m.id === memoryId);
  if (idx === -1) return null;
  const updated = [...existing];
  updated[idx] = { ...updated[idx], ...patch, updatedAt: new Date().toISOString() };
  memoryCache.set(projectId, updated);
  saveEncryptedMemories(projectId, updated).catch(() => {});
  return updated[idx];
}

export function searchMemories(projectId: string, query: string): ProjectMemory[] {
  const normalizedQuery = normalizeContent(query);
  if (!normalizedQuery) return getCachedMemories(projectId);
  return getCachedMemories(projectId).filter((memory) =>
    normalizeContent(memory.content).includes(normalizedQuery)
  );
}

export function removeMemory(projectId: string, memoryId: string): boolean {
  const existing = memoryCache.get(projectId) || [];
  const filtered = existing.filter((m) => m.id !== memoryId);
  if (filtered.length === existing.length) return false;

  memoryCache.set(projectId, filtered);
  saveEncryptedMemories(projectId, filtered).catch(() => {});
  return true;
}

export function getMemoriesByType(
  projectId: string,
  type: MemoryType
): ProjectMemory[] {
  return getCachedMemories(projectId).filter((m) => m.type === type);
}

export function clearProjectMemories(projectId: string): void {
  memoryCache.delete(projectId);
  if (typeof window !== "undefined") {
    localStorage.removeItem(MEMORY_PREFIX + projectId);
  }
}

/**
 * Format memories for injection into the system prompt.
 */
export function formatMemoriesForPrompt(projectId: string): string {
  const memories = getCachedMemories(projectId);
  if (memories.length === 0) return "";

  const prioritized = [
    ...memories.filter((memory) => memory.pinned),
    ...memories
      .filter((memory) => !memory.pinned)
      .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt)),
  ];
  const selected = prioritized.slice(0, MAX_PROMPT_MEMORIES);
  const grouped: Record<string, ProjectMemory[]> = {};
  for (const m of selected) {
    if (!grouped[m.type]) grouped[m.type] = [];
    grouped[m.type].push(m);
  }

  const TYPE_LABELS: Record<MemoryType, string> = {
    preference: "User Preferences",
    decision: "Decisions Made",
    constraint: "Constraints",
    context: "Project Context",
    learning: "Learnings",
    artifact: "Artifacts & Docs",
  };

  const lines: string[] = ["CORE MEMORIES (persistent project knowledge):"];
  for (const [type, mems] of Object.entries(grouped)) {
    lines.push(`\n[${TYPE_LABELS[type as MemoryType] || type}]`);
    for (const m of mems) {
      lines.push(`- ${m.pinned ? "📌 " : ""}(#${m.id}) ${m.content}`);
    }
  }
  const omitted = memories.length - selected.length;
  if (omitted > 0) {
    lines.push(`\n… (${omitted} older memories not shown; use list_memories to search)`);
  }

  return lines.join("\n");
}

export const MAX_PROMPT_MEMORIES = 40;

// --- Persistence (encrypted or plaintext depending on project mode) ---

async function saveEncryptedMemories(
  projectId: string,
  memories: ProjectMemory[]
): Promise<void> {
  const storageKey = MEMORY_PREFIX + projectId;
  if (isProjectEncrypted(projectId)) {
    const password = getProjectPassword(projectId);
    if (!password) throw new Error("Project not unlocked");
    const encrypted = await encrypt(JSON.stringify(memories), password, projectId);
    localStorage.setItem(storageKey, encrypted);
  } else {
    localStorage.setItem(storageKey, JSON.stringify(memories));
  }
}

/**
 * Re-write cached memories using the project's current storage mode.
 * Used when toggling encryption on or off.
 */
export async function rewriteProjectMemories(projectId: string): Promise<void> {
  const memories = memoryCache.get(projectId);
  if (memories && memories.length > 0) {
    await saveEncryptedMemories(projectId, memories);
  }
}

export async function replaceProjectMemories(
  projectId: string,
  memories: ProjectMemory[]
): Promise<void> {
  memoryCache.set(projectId, memories);
  await saveEncryptedMemories(projectId, memories);
}

export async function loadEncryptedMemories(
  projectId: string
): Promise<ProjectMemory[]> {
  const encrypted = isProjectEncrypted(projectId);
  const password = getProjectPassword(projectId);
  if (encrypted && !password) return [];

  const stored = localStorage.getItem(MEMORY_PREFIX + projectId);
  if (!stored) return [];

  try {
    const json = encrypted ? await decrypt(stored, password!, projectId) : stored;
    const memories = JSON.parse(json) as ProjectMemory[];
    for (const memory of memories) {
      memory.updatedAt ??= memory.createdAt;
    }
    memoryCache.set(projectId, memories);
    return memories;
  } catch {
    return [];
  }
}
