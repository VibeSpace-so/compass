---
name: testing-compass-encryption
description: Test per-project encryption flow in Compass app. Use when verifying encryption, unlock, BYOK key storage, or project isolation changes.
---

# Testing Compass Per-Project Encryption

## Overview
Compass uses per-project AES-GCM encryption (PBKDF2 key derivation, 100k iterations) to protect BYOK keys, integration tokens, and chat history. Each project has its own password set at creation time.

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

### 2. Project Creation with Password
- Click "Create your first project" or "+ New"
- Modal includes "Encryption password" section with password + confirm fields
- Validation: password must be at least 4 characters, must match confirm
- After submit, project opens directly (no re-unlock needed)

### 3. Encrypted Storage Verification
- After saving a BYOK key, check browser console:
  ```js
  Object.keys(localStorage).filter(k => k.includes('project-enc-'))
  ```
- Values should be JSON with `iv` (array) and `data` (array) — NOT plaintext
- Also verify no plaintext key appears anywhere:
  ```js
  Object.keys(localStorage).filter(k => localStorage.getItem(k).includes('YOUR_TEST_KEY'))
  ```

### 4. Unlock Flow After Refresh
- Hard refresh (Ctrl+Shift+R) clears in-memory passwords
- Clicking an encrypted project shows unlock modal with:
  - Lock icon, project name, password input
  - "Back to projects" link
  - "Forgot password? Wipe project data" link
- Wrong password shows "Incorrect password." error
- Correct password decrypts and restores all keys/chat

### 5. Multi-Project Isolation
- Create 2 projects with different passwords
- Add different API keys to each
- Verify keys don't leak between projects
- After refresh, each project requires its own password

### 6. Wipe Flow
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
- If keys appear as plaintext in localStorage, check that `saveEncryptedKey` is being called instead of direct localStorage writes
- If unlock always fails, verify the salt stored in `vibe-compass-project-salt-{id}` matches what was used during encryption setup

## Devin Secrets Needed
None required for basic encryption testing. For LLM chat testing, a valid Groq/OpenAI API key is needed (stored per-project via BYOK settings).
