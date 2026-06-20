/**
 * Per-project secure storage. Each project has its own password and
 * encrypted vault. Passwords and decrypted keys are held in memory
 * only for the duration of the session.
 */

import { encrypt, decrypt } from "./crypto";
import { ChatMessage } from "./types";

const ENC_PREFIX = "vibe-compass-project-enc-";
const CHAT_PREFIX = "vibe-compass-project-chat-";

// In-memory state per project
const projectPasswords: Map<string, string> = new Map();
const projectKeyCache: Map<string, Map<string, string>> = new Map();
const projectChatCache: Map<string, ChatMessage[]> = new Map();

// --- Password management ---

export function setProjectPassword(projectId: string, password: string): void {
  projectPasswords.set(projectId, password);
  if (!projectKeyCache.has(projectId)) {
    projectKeyCache.set(projectId, new Map());
  }
}

export function getProjectPassword(projectId: string): string | null {
  return projectPasswords.get(projectId) || null;
}

export function isProjectUnlocked(projectId: string): boolean {
  return projectPasswords.has(projectId);
}

export function lockProject(projectId: string): void {
  projectPasswords.delete(projectId);
  projectKeyCache.delete(projectId);
  projectChatCache.delete(projectId);
}

// --- Key cache (BYOK + integration tokens) ---

export function getCachedKey(projectId: string, key: string): string {
  return projectKeyCache.get(projectId)?.get(key) || "";
}

export function hasCachedKey(projectId: string, key: string): boolean {
  return projectKeyCache.get(projectId)?.has(key) || false;
}

export async function saveEncryptedKey(projectId: string, key: string, value: string): Promise<void> {
  const password = projectPasswords.get(projectId);
  if (!password) throw new Error("Project not unlocked");

  // Populate cache immediately for synchronous reads
  if (!projectKeyCache.has(projectId)) {
    projectKeyCache.set(projectId, new Map());
  }
  projectKeyCache.get(projectId)!.set(key, value);

  const encrypted = await encrypt(value, password, projectId);
  localStorage.setItem(ENC_PREFIX + projectId + "-" + key, encrypted);
}

export function removeEncryptedKey(projectId: string, key: string): void {
  localStorage.removeItem(ENC_PREFIX + projectId + "-" + key);
  projectKeyCache.get(projectId)?.delete(key);
}

export function hasEncryptedKey(projectId: string, key: string): boolean {
  return localStorage.getItem(ENC_PREFIX + projectId + "-" + key) !== null;
}

/**
 * Load all encrypted keys for a project into cache on unlock.
 */
export async function loadAllProjectKeys(projectId: string): Promise<void> {
  const password = projectPasswords.get(projectId);
  if (!password) return;

  if (!projectKeyCache.has(projectId)) {
    projectKeyCache.set(projectId, new Map());
  }

  const prefix = ENC_PREFIX + projectId + "-";
  for (let i = 0; i < localStorage.length; i++) {
    const storageKey = localStorage.key(i);
    if (!storageKey || !storageKey.startsWith(prefix)) continue;

    const key = storageKey.slice(prefix.length);
    try {
      const value = await decrypt(localStorage.getItem(storageKey)!, password, projectId);
      projectKeyCache.get(projectId)!.set(key, value);
    } catch {
      // Skip corrupted entries
    }
  }
}

// --- Chat history (encrypted per-project) ---

export function getCachedChat(projectId: string): ChatMessage[] {
  return projectChatCache.get(projectId) || [];
}

export async function saveEncryptedChat(projectId: string, messages: ChatMessage[]): Promise<void> {
  const password = projectPasswords.get(projectId);
  if (!password) throw new Error("Project not unlocked");

  projectChatCache.set(projectId, messages);

  const encrypted = await encrypt(JSON.stringify(messages), password, projectId);
  localStorage.setItem(CHAT_PREFIX + projectId, encrypted);
}

export async function loadEncryptedChat(projectId: string): Promise<ChatMessage[]> {
  const password = projectPasswords.get(projectId);
  if (!password) return [];

  const stored = localStorage.getItem(CHAT_PREFIX + projectId);
  if (!stored) return [];

  try {
    const decrypted = await decrypt(stored, password, projectId);
    const messages = JSON.parse(decrypted) as ChatMessage[];
    projectChatCache.set(projectId, messages);
    return messages;
  } catch {
    return [];
  }
}
