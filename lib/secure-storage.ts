/**
 * Per-project storage. Encryption is optional: a project starts unencrypted
 * (values stored in plaintext) and can later be encrypted with a password.
 * When encrypted, each project has its own AES-GCM vault; passwords and
 * decrypted values are held in memory only for the duration of the session.
 */

import { encrypt, decrypt, isProjectEncrypted } from "./crypto";
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
  // Populate cache immediately for synchronous reads
  if (!projectKeyCache.has(projectId)) {
    projectKeyCache.set(projectId, new Map());
  }
  projectKeyCache.get(projectId)!.set(key, value);

  const storageKey = ENC_PREFIX + projectId + "-" + key;
  if (isProjectEncrypted(projectId)) {
    const password = projectPasswords.get(projectId);
    if (!password) throw new Error("Project not unlocked");
    const encrypted = await encrypt(value, password, projectId);
    localStorage.setItem(storageKey, encrypted);
  } else {
    localStorage.setItem(storageKey, value);
  }
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
  const encrypted = isProjectEncrypted(projectId);
  const password = projectPasswords.get(projectId);
  if (encrypted && !password) return;

  if (!projectKeyCache.has(projectId)) {
    projectKeyCache.set(projectId, new Map());
  }

  const prefix = ENC_PREFIX + projectId + "-";
  for (let i = 0; i < localStorage.length; i++) {
    const storageKey = localStorage.key(i);
    if (!storageKey || !storageKey.startsWith(prefix)) continue;

    const key = storageKey.slice(prefix.length);
    const raw = localStorage.getItem(storageKey)!;
    try {
      const value = encrypted ? await decrypt(raw, password!, projectId) : raw;
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
  projectChatCache.set(projectId, messages);

  const storageKey = CHAT_PREFIX + projectId;
  if (isProjectEncrypted(projectId)) {
    const password = projectPasswords.get(projectId);
    if (!password) throw new Error("Project not unlocked");
    const encrypted = await encrypt(JSON.stringify(messages), password, projectId);
    localStorage.setItem(storageKey, encrypted);
  } else {
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }
}

export async function loadEncryptedChat(projectId: string): Promise<ChatMessage[]> {
  const encrypted = isProjectEncrypted(projectId);
  const password = projectPasswords.get(projectId);
  if (encrypted && !password) return [];

  const stored = localStorage.getItem(CHAT_PREFIX + projectId);
  if (!stored) return [];

  try {
    const json = encrypted ? await decrypt(stored, password!, projectId) : stored;
    const messages = JSON.parse(json) as ChatMessage[];
    projectChatCache.set(projectId, messages);
    return messages;
  } catch {
    return [];
  }
}

/**
 * Re-write all cached keys and chat for a project using the project's
 * current storage mode (encrypted if a password is set up, plaintext
 * otherwise). Used when toggling encryption on or off.
 */
export async function rewriteProjectKeysAndChat(projectId: string): Promise<void> {
  const keys = projectKeyCache.get(projectId);
  if (keys) {
    for (const [key, value] of keys) {
      await saveEncryptedKey(projectId, key, value);
    }
  }
  const chat = projectChatCache.get(projectId);
  if (chat && chat.length > 0) {
    await saveEncryptedChat(projectId, chat);
  }
}
