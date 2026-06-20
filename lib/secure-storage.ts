/**
 * Secure storage wrapper that encrypts sensitive values (API keys, tokens)
 * using the user's password. The password is held in memory only for the
 * duration of the session. Keys are decrypted into an in-memory cache on
 * unlock for synchronous access.
 */

import { encrypt, decrypt } from "./crypto";

const ENCRYPTED_PREFIX = "vibe-compass-enc-";

let sessionPassword: string | null = null;
const keyCache: Map<string, string> = new Map();

export function setSessionPassword(password: string): void {
  sessionPassword = password;
}

export function getSessionPassword(): string | null {
  return sessionPassword;
}

export function clearSessionPassword(): void {
  sessionPassword = null;
  keyCache.clear();
}

/**
 * Get a decrypted value from the in-memory cache (synchronous).
 */
export function getCachedKey(key: string): string {
  return keyCache.get(key) || "";
}

/**
 * Check if a key exists in the cache.
 */
export function hasCachedKey(key: string): boolean {
  return keyCache.has(key);
}

/**
 * Save an encrypted value to localStorage and update cache.
 */
export async function saveEncrypted(key: string, value: string): Promise<void> {
  if (!sessionPassword) throw new Error("No session password set");
  const encrypted = await encrypt(value, sessionPassword);
  localStorage.setItem(ENCRYPTED_PREFIX + key, encrypted);
  keyCache.set(key, value);
}

/**
 * Load and decrypt a value from localStorage.
 */
export async function loadEncrypted(key: string): Promise<string> {
  if (!sessionPassword) return "";
  const stored = localStorage.getItem(ENCRYPTED_PREFIX + key);
  if (!stored) return "";
  try {
    return await decrypt(stored, sessionPassword);
  } catch {
    return "";
  }
}

/**
 * Remove an encrypted value from localStorage and cache.
 */
export function removeEncrypted(key: string): void {
  localStorage.removeItem(ENCRYPTED_PREFIX + key);
  keyCache.delete(key);
}

/**
 * Check if an encrypted value exists.
 */
export function hasEncrypted(key: string): boolean {
  return localStorage.getItem(ENCRYPTED_PREFIX + key) !== null;
}

/**
 * Load all encrypted keys into the in-memory cache on unlock.
 */
export async function loadAllEncryptedKeys(): Promise<void> {
  if (!sessionPassword) return;

  for (let i = 0; i < localStorage.length; i++) {
    const storageKey = localStorage.key(i);
    if (!storageKey || !storageKey.startsWith(ENCRYPTED_PREFIX)) continue;

    const key = storageKey.slice(ENCRYPTED_PREFIX.length);
    try {
      const value = await decrypt(
        localStorage.getItem(storageKey)!,
        sessionPassword
      );
      keyCache.set(key, value);
    } catch {
      // Skip corrupted entries
    }
  }
}

/**
 * Migrate plaintext keys to encrypted storage on first unlock after upgrade.
 * This handles users who already have keys stored in plaintext.
 */
export async function migrateToEncrypted(): Promise<void> {
  if (!sessionPassword) return;

  const BYOK_PREFIX = "vibe-compass-key-";
  const INTEGRATION_PREFIX = "vibe-compass-integration-";

  const keysToMigrate: { storageKey: string; encKey: string }[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const storageKey = localStorage.key(i);
    if (!storageKey) continue;

    if (storageKey.startsWith(BYOK_PREFIX)) {
      const id = storageKey.slice(BYOK_PREFIX.length);
      keysToMigrate.push({ storageKey, encKey: "byok-" + id });
    } else if (storageKey.startsWith(INTEGRATION_PREFIX)) {
      const id = storageKey.slice(INTEGRATION_PREFIX.length);
      keysToMigrate.push({ storageKey, encKey: "integration-" + id });
    }
  }

  for (const { storageKey, encKey } of keysToMigrate) {
    const plainValue = localStorage.getItem(storageKey);
    if (plainValue && !localStorage.getItem(ENCRYPTED_PREFIX + encKey)) {
      await saveEncrypted(encKey, plainValue);
      localStorage.removeItem(storageKey);
    }
  }
}
