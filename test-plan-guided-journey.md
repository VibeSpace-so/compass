# Test Plan: Guided Journey with Core Memories & Research Tools

## What Changed
- AI chat now proactively guides users with directive prompts
- System tools: save_memory, update_memory, advance_stage, generate_project_brief
- Perplexity Search connector + API proxy route
- Google Search Grounding in Gemini provider
- Project Brief tab showing grouped memories
- Memories persist encrypted in localStorage per-project

## Environment
- Local dev: http://localhost:3001
- Secret: GROQ_API_KEY (for LLM chat)
- No Perplexity key available (test error handling path)

## Test 1: Memory Saving via Chat (Critical Path)

**Goal:** Prove the LLM calls `save_memory` tool when user shares project info, and the memory appears in the Brief tab.

**Steps:**
1. Create a new project "TestApp" with password "test1234"
2. Open Settings, add Groq API key
3. Go to Chat tab, send: "My target user is indie hackers who want to validate ideas quickly. I'm building with Next.js and Supabase."
4. Wait for assistant response

**Pass criteria:**
- ToolCallCard appears showing "Saving to memory..." with green checkmark (success state)
- The assistant response references saving the information
- Click "Brief" tab → at least one memory entry appears under "Preferences" or "Decisions" or "Context" section
- Memory content matches what was shared (e.g., contains "indie hackers" or "Next.js" or "Supabase")

**Fail indicators:**
- No ToolCallCard appears (LLM didn't call save_memory)
- Brief tab remains empty after chat
- Memory content is generic/unrelated to what was shared

## Test 2: Memories Persist Encrypted in localStorage

**Goal:** Prove memories are stored encrypted, not plaintext.

**Steps:**
1. After Test 1 completes (memories exist in Brief tab)
2. Open browser console
3. Run: `Object.keys(localStorage).filter(k => k.includes('project-mem-'))`
4. For each matching key, inspect value: `localStorage.getItem(key)`

**Pass criteria:**
- At least one key matching `vibe-compass-project-mem-*` exists
- Value is JSON with `iv` (array of numbers) and `data` (array of numbers) — encrypted format
- Value does NOT contain plaintext strings like "indie hackers" or "Next.js"

**Fail indicators:**
- No `project-mem-` keys in localStorage (memories not persisted)
- Value is plaintext JSON array of memory objects
- Value contains readable project information

## Test 3: Brief Tab Displays Grouped Memories

**Goal:** Prove the Brief tab renders memories categorized by type with correct UI.

**Steps:**
1. After Test 1 (memories exist)
2. Click "Brief" tab in project detail
3. Observe the displayed memories

**Pass criteria:**
- Brief tab header shows "Core Memories" with a count > 0
- Memories are grouped under colored category labels (e.g., "CONTEXT" in green, "PREFERENCES" in blue, "DECISIONS" in yellow)
- Each memory shows its content text
- Delete button (trash icon) appears on hover

**Fail indicators:**
- Brief tab shows "No memories yet" empty state
- Memories not grouped (flat list without category headers)
- Wrong category colors or missing icons

## Test 4: Stage Advancement via Chat

**Goal:** Prove the LLM calls `advance_stage` when asked to advance.

**Steps:**
1. In the same project (currently at "Ideation" stage)
2. In Chat tab, send: "I've validated my idea, found no direct competitors, and my target user is clear. Let's move to the Context stage."
3. Wait for response

**Pass criteria:**
- ToolCallCard appears showing "Advancing stage..." with green checkmark
- After response, the stage badge in the header changes from "Ideation" to "Context"
- Brief tab gets a new "learning" memory about advancing stages
- Assistant response acknowledges the stage change and provides next steps for Context stage

**Fail indicators:**
- No ToolCallCard for advance_stage (LLM didn't use the tool)
- Stage badge still shows "Ideation" after response
- No learning memory about advancement

## Test 5: Perplexity Integration Appears in Suggestions

**Goal:** Prove Perplexity is listed as a suggested integration for ideation/context stages.

**Steps:**
1. Click "Guidance" tab
2. Look at the contextual integrations section

**Pass criteria:**
- Perplexity appears in the integration suggestions with purpose text containing "Research" or "research"
- Has a "Connect" button

**Fail indicators:**
- Perplexity not listed in suggestions
- Listed but without research-related purpose text

## Test 6: Directive System Prompt (Proactive Guidance)

**Goal:** Prove the AI leads the conversation proactively instead of just answering.

**Steps:**
1. Create a fresh project or use existing
2. In Chat tab, send just: "hi"
3. Read the response

**Pass criteria:**
- Response includes specific next steps or guidance (not just "How can I help?")
- Response references the current stage and what to do next
- Response ends with a clear question or suggested action

**Fail indicators:**
- Response is generic/passive like "How can I help you today?"
- No mention of stage or next steps
- Response doesn't suggest any concrete actions
