/**
 * Core Memories — persistent per-project knowledge store.
 * The AI reads memories for context and writes memories to capture
 * decisions, preferences, constraints, and learnings.
 */

import { ProjectMemory, MemoryType, StageId } from "./types";
import { encrypt, decrypt } from "./crypto";
import { getProjectPassword } from "./secure-storage";
import { generateId } from "./storage";

const MEMORY_PREFIX = "vibe-compass-project-mem-";

// In-memory cache per project
const memoryCache: Map<string, ProjectMemory[]> = new Map();

export function getCachedMemories(projectId: string): ProjectMemory[] {
  return memoryCache.get(projectId) || [];
}

export function addMemory(
  projectId: string,
  type: MemoryType,
  content: string,
  stage: StageId,
  source: "user" | "ai" = "ai"
): ProjectMemory {
  const memory: ProjectMemory = {
    id: generateId(),
    type,
    content,
    stage,
    createdAt: new Date().toISOString(),
    source,
  };

  const existing = memoryCache.get(projectId) || [];
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
  const existing = memoryCache.get(projectId) || [];
  const idx = existing.findIndex((m) => m.id === memoryId);
  if (idx === -1) return null;

  const updated = [...existing];
  updated[idx] = { ...updated[idx], content };
  memoryCache.set(projectId, updated);

  saveEncryptedMemories(projectId, updated).catch(() => {});
  return updated[idx];
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

  const grouped: Record<string, ProjectMemory[]> = {};
  for (const m of memories) {
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
      lines.push(`- ${m.content}`);
    }
  }

  return lines.join("\n");
}

// --- Encrypted persistence ---

async function saveEncryptedMemories(
  projectId: string,
  memories: ProjectMemory[]
): Promise<void> {
  const password = getProjectPassword(projectId);
  if (!password) throw new Error("Project not unlocked");

  const encrypted = await encrypt(
    JSON.stringify(memories),
    password,
    projectId
  );
  localStorage.setItem(MEMORY_PREFIX + projectId, encrypted);
}

export async function loadEncryptedMemories(
  projectId: string
): Promise<ProjectMemory[]> {
  const password = getProjectPassword(projectId);
  if (!password) return [];

  const stored = localStorage.getItem(MEMORY_PREFIX + projectId);
  if (!stored) return [];

  try {
    const decrypted = await decrypt(stored, password, projectId);
    const memories = JSON.parse(decrypted) as ProjectMemory[];
    memoryCache.set(projectId, memories);
    return memories;
  } catch {
    return [];
  }
}
