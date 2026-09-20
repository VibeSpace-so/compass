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

## Keys

Keys are BYOK, entered in the app's UI (clipboard paste via `xclip` on DISPLAY :0 in Devin sessions). `PERPLEXITY_API_KEY` was still unprovisioned as of Sep 2026 — Perplexity search (`app/api/integrations/perplexity/route.ts`) can't be tested end-to-end without it.

## Testing

Guided-journey/chat tests: `testing-compass-guided-journey` skill. Encryption/BYOK: `testing-compass-encryption`. Mobile: `testing-compass-mobile`.
