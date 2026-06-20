/**
 * Client-side encryption utilities using Web Crypto API.
 * AES-GCM with PBKDF2 key derivation from a user password.
 */

const SALT_KEY = "vibe-compass-salt";
const VERIFY_KEY = "vibe-compass-verify";
const PBKDF2_ITERATIONS = 100_000;

function getStoredSalt(): Uint8Array | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(SALT_KEY);
  if (!stored) return null;
  return new Uint8Array(JSON.parse(stored));
}

function createAndStoreSalt(): Uint8Array {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(SALT_KEY, JSON.stringify(Array.from(salt)));
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

export async function encrypt(plaintext: string, password: string): Promise<string> {
  let salt = getStoredSalt();
  if (!salt) {
    salt = createAndStoreSalt();
  }

  const key = await deriveKey(password, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );

  const result = {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(ciphertext)),
  };

  return JSON.stringify(result);
}

export async function decrypt(encrypted: string, password: string): Promise<string> {
  const salt = getStoredSalt();
  if (!salt) throw new Error("No encryption salt found");

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
 * Store a verification token so we can check if the password is correct
 * without decrypting all data.
 */
export async function setVerificationToken(password: string): Promise<void> {
  const token = await encrypt("compass-verified", password);
  localStorage.setItem(VERIFY_KEY, token);
}

/**
 * Check if the provided password matches the stored verification token.
 */
export async function verifyPassword(password: string): Promise<boolean> {
  const stored = localStorage.getItem(VERIFY_KEY);
  if (!stored) return false;

  try {
    const decrypted = await decrypt(stored, password);
    return decrypted === "compass-verified";
  } catch {
    return false;
  }
}

/**
 * Check if encryption has been set up (password exists).
 */
export function isEncryptionSetup(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(VERIFY_KEY) !== null;
}

/**
 * Wipe all encrypted data and encryption setup.
 */
export function wipeAllData(): void {
  if (typeof window === "undefined") return;
  localStorage.clear();
}
