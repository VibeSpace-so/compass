---
name: testing-compass-encryption
description: Test the optional per-project encryption flow in Compass app. Use when verifying encryption, unlock, BYOK key storage, or project isolation changes.
---

# Testing Compass Per-Project Encryption

## Overview
Compass encryption is **optional**. Projects start **unencrypted** — keys, integration tokens, chat, and memories are stored as plaintext in localStorage. The user can later encrypt a project with a password from the API keys settings. When encrypted, Compass uses per-project AES-GCM encryption (PBKDF2 key derivation, 100k iterations) and requires the password to unlock after a refresh.

## Local Dev Setup
```bash
cd /home/ubuntu/repos/compass
npm install
npx next dev --port 3000
```

## Key Flows to Test

### 1. No Global Password Gate
- Navigate to `http://localhost:3000`
- App should load immediately with hero, journey map, and project list
- There should be NO password prompt or lock screen on page load

### 2. Project Creation (No Password)
- Click "Create your first project" or "+ New"
- Modal asks only for name + description (NO password fields)
- A note explains the project starts unencrypted and can be encrypted later
- After submit, project opens directly

### 3. Unencrypted Storage (Default)
- After saving a BYOK key in a fresh project, check browser console:
  ```js
  Object.keys(localStorage).filter(k => k.includes('project-enc-'))
  ```
- Value should be the **plaintext** key (not `{iv, data}` JSON)
- The project list / detail does not prompt for a password on open

### 4. Encrypt Reminder + Enabling Encryption
- After adding an API key, a yellow "Reminder: encrypt your project" banner
  appears in the project detail view and inside the API keys settings modal
- Open API keys settings → "Encrypt project" → set password + confirm
  (min 4 chars, must match) → "Enable encryption"
- After enabling, re-check localStorage: `project-enc-*`, `project-chat-*`,
  and `project-mem-*` values should now be `{iv, data}` JSON ciphertext
- Verify no plaintext key remains:
  ```js
  Object.keys(localStorage).filter(k => localStorage.getItem(k).includes('YOUR_TEST_KEY'))
  ```
- The settings modal now shows "Encryption is on" with a "Disable encryption" link

### 5. Unlock Flow After Refresh
- Hard refresh (Ctrl+Shift+R) clears in-memory passwords
- Clicking an encrypted project shows unlock modal with:
  - Lock icon, project name, password input
  - "Back to projects" link
  - "Forgot password? Wipe project data" link
- Wrong password shows "Incorrect password." error
- Correct password decrypts and restores all keys/chat

### 6. Multi-Project Isolation
- Create 2 projects, encrypt them with different passwords
- Add different API keys to each
- Verify keys don't leak between projects
- After refresh, each encrypted project requires its own password

### 7. Disable Encryption
- In an unlocked encrypted project, open API keys → "Disable encryption"
- localStorage values revert to plaintext; after refresh the project opens
  without an unlock prompt

### 8. Wipe Flow
- On unlock screen, click "Forgot password? Wipe project data"
- Confirmation dialog explains what will be deleted
- After wipe: project remains in list but opens without lock (encryption data cleared)
- Other projects' encrypted data is unaffected

## localStorage Key Patterns
- `vibe-compass-project-salt-{projectId}` — per-project PBKDF2 salt
- `vibe-compass-project-verify-{projectId}` — password verification token
- `vibe-compass-project-enc-{projectId}-{key}` — encrypted BYOK/integration keys
- `vibe-compass-project-chat-{projectId}` — encrypted chat history

## Common Issues
- If the app shows a global password gate instead of loading directly, the old `PasswordGate` wrapper might not have been removed from `app/page.tsx`
- If a new project demands a password at creation, the optional-encryption flow regressed
- If an unencrypted project stores `{iv, data}` ciphertext, the `isProjectEncrypted` branch in `saveEncryptedKey`/`saveEncryptedChat`/`saveEncryptedMemories` is not being hit
- After enabling encryption, if plaintext values remain, `rewriteProjectKeysAndChat` / `rewriteProjectMemories` may not have run
- If unlock always fails, verify the salt stored in `vibe-compass-project-salt-{id}` matches what was used during encryption setup

## Devin Secrets Needed
None required for basic encryption testing. For LLM chat testing, a valid Groq/OpenAI API key is needed (stored per-project via BYOK settings).
