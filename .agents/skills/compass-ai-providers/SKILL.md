---
name: compass-ai-providers
description: How Compass wires LLM providers and where model IDs/keys live. Use when chat or integrations fail with provider errors (404 model, 401 key, tool-call conflicts) or when changing provider behavior.
---

# Compass AI providers

Provider routing lives in `lib/chat-service.ts`. Hardcoded model IDs (per provider) are the single most fragile part of the app — providers retire models and pinned IDs then 404 every chat turn. This already happened twice (Groq `llama-3.3-70b-versatile` and a retired Gemini id broke all chat).

Current pins (check these first on any provider 404):
- Groq: `openai/gpt-oss-20b`
- OpenAI: `gpt-4o-mini`
- Anthropic: `claude-3-5-haiku-20241022`
- Google: `gemini-flash-latest` (the `*-latest` alias rolls forward — preferred over dated pins)

When a model 404s, query the provider's `/models` endpoint with the configured key and pick the current equivalent; prefer `*-latest` aliases where the provider offers them.

## Gemini tool-calling gotcha

`googleSearch` grounding + function calling is opt-in-compatible on current models but was forbidden on older ones — Gemini's `save_memory` tool calls silently never worked before PR #25. If Gemini answers but never calls tools, verify the tool config is a combination the model supports, not just that requests return 200.

## Inline-JSON tool calls (Groq and lookalikes)

Some providers emit tool calls as inline JSON text (`{"action":"save_memory","params":{...}}` or `action_input`) instead of real tool_calls — Groq's `openai/gpt-oss-*` models do this, which silently never saved memories before PR #41 added `parseInlineToolCalls` coverage. If a provider answers fine but tools never fire, look for raw JSON in the reply text before suspecting keys or model support.

## Custom providers

Users can add custom providers in BYOK settings (PR #37): name + base URL + model + optional key + optional JSON params; `/chat/completions` is auto-appended and they take the OpenAI-compatible path. Custom providers persist in app state and are toggleable/removable. The AI Guidance UI shows muted `recommended:` model hints (e.g. gpt-5.6-luna, claude-haiku-4-5, gemini-flash-latest) rather than naming one pinned model per row — keep that pattern when editing the UI, don't reintroduce hardcoded model names.

## Keys

Keys are BYOK, entered in the app's UI (clipboard paste via `xclip` on DISPLAY :0 in Devin sessions). `PERPLEXITY_API_KEY` was still unprovisioned as of Sep 2026 — Perplexity search (`app/api/integrations/perplexity/route.ts`) can't be tested end-to-end without it.

## Custom (OpenAI-compatible) providers

BYOK custom providers live in `vibe-compass-state` → `byokSettings.providers[]` with `custom:true`, `baseUrl`, `model`, optional `params` (merged into the request body). `openAICompatibleEndpoint` in chat-service trims trailing slashes and appends `/chat/completions` unless the URL already ends with it. Picker order: the four standard providers are checked first (enabled + project-scoped key), custom providers only after — so a chat turn proves the custom path only when no standard provider has a key for that project (use a fresh project).

Easy e2e recipe: add a custom provider with base URL `https://api.groq.com/openai/v1`, model `openai/gpt-oss-20b`, and `${GROQ_API_KEY}` — a real reply confirms URL append, key lookup, and the OpenAI-compatible call path.

## Testing

Guided-journey/chat tests: `testing-compass-guided-journey` skill. Encryption/BYOK: `testing-compass-encryption`. Mobile: `testing-compass-mobile`.
