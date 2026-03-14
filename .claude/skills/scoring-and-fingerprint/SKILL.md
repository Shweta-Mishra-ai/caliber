---
name: scoring-and-fingerprint
description: Scoring checks and fingerprint collection for @rely-ai/caliber. Use when working on caliber score output, adding a new scoring check, modifying project fingerprinting, or understanding how project context is collected and scored.
---
# Scoring and Fingerprinting

## Scoring (`src/scoring/`)

The `caliber score` command runs a fully deterministic quality audit — no LLM, no network calls.

### Check categories and point values

See `src/scoring/constants.ts`. Categories:
- **Existence** (25 pts) — CLAUDE.md, cursor rules, skills, MCP servers, cross-platform parity
- **Quality** (25 pts) — build/test commands documented, CLAUDE.md under 100 lines, no vague instructions, no directory tree listings, no contradictions
- **Coverage** (20 pts) — actual dependencies named, services/MCP referenced
- **Accuracy** (15 pts) — documented commands exist in package.json, documented paths exist on disk, config freshness
- **Freshness & Safety** (10 pts) — no secrets, permissions configured
- **Bonus** (5 pts) — hooks configured, AGENTS.md, OpenSkills format

### Adding a new check

1. Edit the relevant category file: `src/scoring/checks/{existence,quality,coverage,accuracy,freshness,bonus}.ts`
2. Each check function returns `Check[]`:

```typescript
import type { Check } from '../index.js';

const checks: Check[] = [];

checks.push({
  id: 'my-check-id',
  label: 'Human-readable description',
  points: 3,
  earned: conditionPasses ? 3 : 0,
  note: conditionPasses ? undefined : 'Why it failed',
});

return checks;
```

3. Add the point constant to `src/scoring/constants.ts`
4. `computeLocalScore()` in `src/scoring/index.ts` aggregates all checks automatically

### Target filtering

Checks are filtered by target agent (`claude`, `cursor`, `codex`) via `CURSOR_ONLY_CHECKS`, `CLAUDE_ONLY_CHECKS`, `BOTH_ONLY_CHECKS`, and `CODEX_ONLY_CHECKS` sets in `src/scoring/constants.ts`. Add new check IDs to the appropriate set if platform-specific.

### Displaying scores

`src/scoring/display.ts` exports `displayScore()`, `displayScoreDelta()`, `displayScoreOneLiner()` — all use `chalk` for formatting.

## Fingerprinting (`src/fingerprint/`)

Collects structured project context before sending to the LLM for config generation.

### What gets collected

| File | What it does |
|------|----------|
| `git.ts` | `getGitRemoteUrl()`, `isGitRepo()` via `child_process.execSync` |
| `languages.ts` | `detectLanguages()` from file extensions |
| `package-json.ts` | `analyzePackageJson()` — Node + Python framework detection via `globSync` (`glob`) |
| `file-tree.ts` | `getFileTree()` — directory snapshot |
| `existing-config.ts` | `readExistingConfigs()` — reads CLAUDE.md, .cursorrules, .cursor/rules/, skills |
| `code-analysis.ts` | `analyzeCode()` — file summaries, API routes, config files |
| `index.ts` | Orchestrates all above, LLM enrichment is automatic |

### `Fingerprint` type (key fields)

```typescript
interface Fingerprint {
  gitRemoteUrl?: string;
  packageName?: string;
  languages: string[];
  frameworks: string[];
  tools: string[];
  fileTree: string[];
  existingConfigs: ExistingConfigs;
  codeAnalysis?: CodeAnalysis;
  description?: string;
}
```

### Drift detection

`computeFingerprintHash()` in `src/fingerprint/index.ts` produces a SHA hash stored in `.caliber/state.json`. The `accuracy` scoring check compares this against the current fingerprint to detect stale configs.