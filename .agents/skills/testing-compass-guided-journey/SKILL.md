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

### Hardcoded provider models can go stale (blocks all LLM chat testing)

`lib/chat-service.ts` hardcodes a model per provider (`PROVIDERS` array near the top, plus a
separate hardcoded Google URL in the Gemini tool-calling function). Providers retire models, so
the committed value may 404 even with a perfectly valid key. Symptoms in the chat panel:

- `Groq API error (404): The model "llama-3.3-70b-versatile" does not exist...`
- `Google API error (404): This model models/gemini-2.0-flash is no longer available...`

**Diagnose before blaming the key:**
```bash
curl -s -H "Authorization: Bearer $GROQ_API_KEY" https://api.groq.com/openai/v1/models | jq -r '.data[].id'
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$GOOGLE_API_KEY" | jq -r '.models[].name'
```
**Workaround for testing only:** temporarily point the model at a currently-listed one (e.g.
`openai/gpt-oss-20b` for Groq) and **`git checkout -- lib/chat-service.ts` before finishing** so the
edit never leaks into the diff. If the PR under test is not about chat, report this as a
pre-existing app bug rather than a regression.

### Groq rate limits / model choice

Free-tier Groq keys have a low TPM cap (~8k). The Compass system prompt is large, so big models
(`openai/gpt-oss-120b`) can return HTTP 429 on the first message. A smaller model
(`openai/gpt-oss-20b`) fits the budget and returns a real reply plus a `Compass: save_memory`
tool-call card.

### Google/Gemini path: Search grounding + function calling in one request

On older code Gemini returned `400 Built-in tools ({google_search}) and Function Calling cannot be
combined in the same request.` The combination is opt-in on current models via
`toolConfig: { includeServerSideToolInvocations: true }` in the request body — if you see that 400,
the request body is missing that flag rather than the combination being impossible.

To verify the Gemini path end-to-end, open DevTools → Network, filter `generativelanguage`, and
check a `...:generateContent` call:
- Status 200 (a 404 means the hardcoded model is stale, a 401 usually means a mangled stored key)
- Payload contains `toolConfig.includeServerSideToolInvocations`, `tools[0].functionDeclarations`
  and `tools[1].googleSearch`
- Response contains `toolType: "GOOGLE_SEARCH_WEB"` and `groundingChunks` for a research-style
  question — that is the proof grounding actually ran alongside function calling

### Forcing which provider is used

`PROVIDERS` order in `lib/chat-service.ts` is groq → openai → anthropic → google, and
`app/page.tsx` only passes providers that are `enabled && keySet`. The first match wins, so to test
Google you must **toggle Groq off** in the API keys modal (or use a separate project that has no
Groq key). Use one fresh project per provider so memories stay separated.

### Typing long API keys via computer-use drops characters

A 56-char `gsk_...` key typed through the UI came out 55 chars and produced a 401. A 53-char
Google key came out 51 chars and produced a Google `401 UNAUTHENTICATED /
ACCESS_TOKEN_TYPE_UNSUPPORTED`.

**The masked suffix in the modal is NOT sufficient proof** — characters are usually dropped in the
middle, so `••••••••TVOA` can still match while the key is truncated. Always check the length:

```js
// before clicking "save key" (input is still open)
[...document.querySelectorAll('input')].map(i => [i.placeholder, i.value.length])
// after saving
localStorage.getItem('vibe-compass-project-enc-<projectId>-byok-<provider>').length
```

If the length is short, click `edit`, `ctrl+a`, `Delete`, retype, and re-verify. A quick way to
tell a mangled key from a real provider problem: `curl` the same endpoint from the shell with the
env key (e.g. `-H "x-goog-api-key: $GOOGLE_API_KEY"`); a 200 there plus a 401 in the browser means
the stored key is mangled, not the code.

### Sending a chat message right after closing a modal can no-op

After closing the API keys modal, the first click+type into the chat input sometimes leaves the
text in the box without sending. Screenshot to confirm the text is present, then click the send
button explicitly instead of pressing Enter.

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
