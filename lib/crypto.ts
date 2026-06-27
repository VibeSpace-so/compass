/**
 * Client-side encryption utilities using Web Crypto API.
 * AES-GCM with PBKDF2 key derivation from a user password.
 * All operations are scoped per-project.
 */

const SALT_PREFIX = "vibe-compass-project-salt-";
const VERIFY_PREFIX = "vibe-compass-project-verify-";
const PBKDF2_ITERATIONS = 100_000;

function getStoredSalt(projectId: string): Uint8Array | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(SALT_PREFIX + projectId);
  if (!stored) return null;
  return new Uint8Array(JSON.parse(stored));
}

function createAndStoreSalt(projectId: string): Uint8Array {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(SALT_PREFIX + projectId, JSON.stringify(Array.from(salt)));
  return salt;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(plaintext: string, password: string, projectId: string): Promise<string> {
  let salt = getStoredSalt(projectId);
  if (!salt) {
    salt = createAndStoreSalt(projectId);
  }

  const key = await deriveKey(password, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );

  return JSON.stringify({
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(ciphertext)),
  });
}

export async function decrypt(encrypted: string, password: string, projectId: string): Promise<string> {
  const salt = getStoredSalt(projectId);
  if (!salt) throw new Error("No encryption salt found for project");

  const key = await deriveKey(password, salt);
  const { iv, data } = JSON.parse(encrypted);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    key,
    new Uint8Array(data)
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Set up encryption for a project (store verification token).
 */
export async function setupProjectEncryption(projectId: string, password: string): Promise<void> {
  const token = await encrypt("compass-verified", password, projectId);
  localStorage.setItem(VERIFY_PREFIX + projectId, token);
}

/**
 * Verify a password for a specific project.
 */
export async function verifyProjectPassword(projectId: string, password: string): Promise<boolean> {
  const stored = localStorage.getItem(VERIFY_PREFIX + projectId);
  if (!stored) return false;

  try {
    const decrypted = await decrypt(stored, password, projectId);
    return decrypted === "compass-verified";
  } catch {
    return false;
  }
}

/**
 * Check if a project has encryption set up.
 */
export function isProjectEncrypted(projectId: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(VERIFY_PREFIX + projectId) !== null;
}

/**
 * Remove encryption for a project (delete salt + verification token).
 * Existing data is left untouched in localStorage and must be re-written
 * in plaintext by the caller.
 */
export function removeProjectEncryption(projectId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(VERIFY_PREFIX + projectId);
  localStorage.removeItem(SALT_PREFIX + projectId);
}

/**
 * Wipe all encrypted data for a specific project.
 */
export function wipeProjectData(projectId: string): void {
  if (typeof window === "undefined") return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes(projectId)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

/**
 * Migrate from old global encryption to per-project.
 * Removes old global keys.
 */
export function cleanupOldGlobalEncryption(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("vibe-compass-salt");
  localStorage.removeItem("vibe-compass-verify");
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("vibe-compass-enc-")) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}
