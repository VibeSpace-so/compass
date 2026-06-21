---
name: testing-compass-guided-journey
description: Test the guided journey features in Compass — core memories, directive chat, stage advancement, research integrations, and Brief tab. Use when verifying chat tool calling, memory persistence, or stage progression changes.
---

# Testing Compass Guided Journey

## Overview

Tests the AI-guided journey system: core memories (save/display/encrypt), stage advancement via chat, directive system prompts, Perplexity integration suggestions, and the Project Brief tab.

## Prerequisites

- Compass app running locally (`npm run dev`, typically port 3001 if 3000 is in use)
- A working LLM API key (Groq preferred for speed)

## Devin Secrets Needed

- `GROQ_API_KEY` — for LLM-powered chat testing

## Test Setup

1. Navigate to localhost:3001
2. Create a new project (e.g., "TestApp") with a password (e.g., "test1234")
3. Open API keys modal, enable Groq, paste the key from `$GROQ_API_KEY`
4. Close modal — chat should show directive greeting

## Key Test Flows

### 1. Memory Saving via Chat

**Send:** "My target user is indie hackers who want to validate ideas quickly. I'm building with Next.js and Supabase."

**Verify:**
- AI response acknowledges saving memories
- Brief tab counter increments (e.g., "Brief (4)")
- Click Brief tab → memories grouped under PREFERENCES / CONSTRAINTS / etc.

### 2. Encrypted Persistence

**Console check:**
```js
Object.keys(localStorage).filter(k => k.includes('project-mem-'))
// Should return at least one key like "vibe-compass-project-mem-{id}"

const val = JSON.parse(localStorage.getItem(key));
// val.iv should be array (12 bytes), val.data should be array (ciphertext)
// val should NOT contain plaintext like "indie hackers"
```

### 3. Stage Advancement

**Send:** "I've validated my idea, no direct competitors, target user is clear. Please advance me to the Context stage."

**Verify:**
- Stage badge in header changes from "Ideation" to "Context"
- Brief tab gets a new LEARNINGS memory about the advancement
- AI response provides Context-stage guidance (not Ideation)

### 4. Perplexity Integration Suggestions

**Check:** Click Guidance tab at Context or Ideation stage

**Verify:**
- Perplexity listed in "Suggested integrations" with research-related purpose text
- Has Connect button

### 5. Directive System Prompt

**Send:** "hi" (minimal message)

**Verify:**
- Response includes specific next steps (not just "How can I help?")
- References current stage
- Suggests concrete actions or asks specific questions

### 6. Project Brief Auto-Generation

After saving memories, the LLM may call `generate_project_brief` which creates an ARTIFACTS memory with a structured markdown brief. Check Brief tab for an entry under ARTIFACTS.

## Known Issues & Workarounds

### Groq Intermittent `tool_use_failed`

Groq (Llama models) sometimes output malformed tool calls in XML format (`<function=save_memory>`) instead of JSON. This causes a 400 error with `"code":"tool_use_failed"`. **Workaround:** Retry the message — it usually succeeds on the next attempt. This is a Groq model limitation, not a Compass bug.

### Duplicate Memories

The LLM may save the same information multiple times across messages (e.g., "Next.js" saved 3 times). There is no deduplication logic currently. This is cosmetic — doesn't break functionality.

### Port Conflicts

If port 3000 is in use, Next.js automatically starts on 3001. Check the dev server output for the actual port.

## Architecture Notes

- Memories stored at `vibe-compass-project-mem-{projectId}` in localStorage (encrypted)
- Chat history at `vibe-compass-chat-{projectId}` (encrypted)
- BYOK keys at `vibe-compass-key-{projectId}-{provider}` (encrypted)
- System tools defined in `lib/chat-tools.ts`: save_memory, update_memory, advance_stage, generate_project_brief
- Tool context set via `setToolContext()` before each LLM call
- Memories formatted into system prompt via `formatMemoriesForPrompt()`
