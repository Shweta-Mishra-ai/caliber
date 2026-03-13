---
name: llm-provider
description: Multi-provider LLM layer patterns for @rely-ai/caliber. Use when calling llmCall/llmJsonCall, adding a new LLM provider, handling streaming responses, parsing JSON from LLM output, or configuring provider credentials.
---
# LLM Provider Layer

All LLM calls go through `src/llm/`. Never import provider SDKs (`@anthropic-ai/sdk`, `openai`, `@anthropic-ai/vertex-sdk`) directly in commands or AI logic — use the helpers.

## Core Helpers

```typescript
import { llmCall, llmJsonCall } from '../llm/index.js';

// Plain text response
const text = await llmCall({
  system: 'You are a code analyst.',
  prompt: 'Summarize this file: ...',
});

// Structured JSON response — parsed and typed
const result = await llmJsonCall<{ frameworks: string[] }>({
  system: 'Extract frameworks as JSON.',
  prompt: 'Here is the package.json: ...',
});
```

`llmCall()` and `llmJsonCall()` automatically:
- Resolve the active provider via `getProvider()`
- Retry on transient errors with exponential backoff (`TRANSIENT_ERRORS`)
- Parse JSON using `extractJson()` (bracket-balancing) or `parseJsonResponse()`

## Streaming

For streaming generation (like `caliber onboard`), use the provider directly:

```typescript
import { getProvider } from '../llm/index.js';

const provider = getProvider();
await provider.stream(
  { system, prompt },
  {
    onText: (chunk) => process.stdout.write(chunk),
    onComplete: (fullText) => { /* finalize */ },
    onError: (err) => { /* handle */ },
  }
);
```

## Adding a New Provider

1. Create `src/llm/<provider>.ts` implementing `LLMProvider` from `types.ts`:

```typescript
import type { LLMProvider, LLMCallOptions, LLMStreamOptions, LLMStreamCallbacks, LLMConfig } from './types.js';

export class MyProvider implements LLMProvider {
  constructor(private config: LLMConfig) {}
  async call(options: LLMCallOptions): Promise<string> { /* ... */ }
  async stream(options: LLMStreamOptions, callbacks: LLMStreamCallbacks): Promise<void> { /* ... */ }
}
```

2. Add a detection branch in `createProvider()` in `src/llm/index.ts`
3. Add env var detection in `resolveFromEnv()` in `src/llm/config.ts`
4. Add a default model entry to `DEFAULT_MODELS` in `src/llm/config.ts`

## Existing Providers

| Provider | Class | Trigger |
|----------|-------|--------|
| `anthropic` | `AnthropicProvider` | `ANTHROPIC_API_KEY` |
| `vertex` | `VertexProvider` | `VERTEX_PROJECT_ID` / `GCP_PROJECT_ID` |
| `openai` | `OpenAICompatProvider` | `OPENAI_API_KEY` (+ optional `OPENAI_BASE_URL`) |
| `cursor` | `CursorAcpProvider` | `CALIBER_USE_CURSOR_SEAT=1` or `caliber config` → Cursor |
| `claude-cli` | `ClaudeCliProvider` | `CALIBER_USE_CLAUDE_CLI=1` or `caliber config` → Claude Code |

The `cursor` and `claude-cli` providers require no API key — they use the user's existing subscription via the Cursor Agent CLI (`agent`) or Claude Code CLI (`claude -p`) respectively.

## JSON Parsing Utilities

```typescript
import { extractJson, stripMarkdownFences, parseJsonResponse, estimateTokens } from '../llm/utils.js';

// Strips ```json fences and parses
const obj = parseJsonResponse<MyType>(rawLlmOutput);

// Bracket-balancing extractor (handles leading/trailing prose)
const json = extractJson(rawLlmOutput);

// Token estimation before sending
const tokens = estimateTokens(prompt);
```

## Config Resolution Order

1. `ANTHROPIC_API_KEY` → `AnthropicProvider` (`@anthropic-ai/sdk`, default: `claude-sonnet-4-6`)
2. `VERTEX_PROJECT_ID` / `GCP_PROJECT_ID` → `VertexProvider` (`@anthropic-ai/vertex-sdk`, `google-auth-library`, default region: `us-east5`)
3. `OPENAI_API_KEY` → `OpenAICompatProvider` (`openai`, default: `gpt-4.1`; `OPENAI_BASE_URL` for custom endpoints)
4. `CALIBER_USE_CURSOR_SEAT=1` → `CursorAcpProvider` (Cursor Agent CLI, no API key)
5. `CALIBER_USE_CLAUDE_CLI=1` → `ClaudeCliProvider` (Claude Code CLI, no API key)
6. `~/.caliber/config.json` — written by `caliber config`
7. `CALIBER_MODEL` — overrides model name for any provider