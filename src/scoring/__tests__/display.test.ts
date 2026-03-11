import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ScoreResult, Check } from '../index.js';

// Disable chalk colors for predictable assertions
vi.mock('chalk', () => {
  const identity = (s: string) => s;
  const chainable: Record<string, unknown> = {};
  const handler: ProxyHandler<typeof identity> = {
    get: (_target, prop) => {
      if (prop === 'bold' || prop === 'dim' || prop === 'green' || prop === 'red' ||
          prop === 'yellow' || prop === 'gray' || prop === 'white' || prop === 'greenBright' ||
          prop === 'cyan') {
        return new Proxy(identity, handler);
      }
      if (prop === 'hex') return () => new Proxy(identity, handler);
      return identity;
    },
    apply: (_target, _thisArg, args) => args[0],
  };
  const chalk = new Proxy(identity, handler);
  return { default: chalk };
});

import { displayScoreDelta, displayScore } from '../display.js';

function makeCheck(overrides: Partial<Check> & { id: string; name: string; category: Check['category'] }): Check {
  return {
    maxPoints: 10,
    earnedPoints: 0,
    passed: false,
    detail: '',
    ...overrides,
  };
}

function makeScoreResult(overrides: Partial<ScoreResult>): ScoreResult {
  return {
    score: 0,
    maxScore: 100,
    grade: 'F',
    checks: [],
    categories: {
      existence: { earned: 0, max: 25 },
      quality: { earned: 0, max: 25 },
      coverage: { earned: 0, max: 20 },
      accuracy: { earned: 0, max: 15 },
      freshness: { earned: 0, max: 10 },
      bonus: { earned: 0, max: 5 },
    },
    targetAgent: 'claude',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('displayScoreDelta', () => {
  let logs: string[];

  beforeEach(() => {
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
  });

  it('shows positive delta for score improvement', () => {
    const before = makeScoreResult({ score: 30, grade: 'F' });
    const after = makeScoreResult({ score: 75, grade: 'B' });

    displayScoreDelta(before, after);

    const output = logs.join('\n');
    expect(output).toContain('+45');
    expect(output).toContain('30');
    expect(output).toContain('75');
  });

  it('shows negative delta for score regression', () => {
    const before = makeScoreResult({ score: 80, grade: 'B' });
    const after = makeScoreResult({ score: 60, grade: 'C' });

    displayScoreDelta(before, after);

    const output = logs.join('\n');
    expect(output).toContain('-20');
  });

  it('shows zero delta when scores are equal', () => {
    const before = makeScoreResult({ score: 50, grade: 'C' });
    const after = makeScoreResult({ score: 50, grade: 'C' });

    displayScoreDelta(before, after);

    const output = logs.join('\n');
    expect(output).toContain('+0');
  });

  it('lists improved checks with point gains', () => {
    const sharedCheck = { id: 'claude_md_exists', name: 'CLAUDE.md exists', category: 'existence' as const };
    const before = makeScoreResult({
      score: 20,
      grade: 'F',
      checks: [makeCheck({ ...sharedCheck, earnedPoints: 0, passed: false })],
    });
    const after = makeScoreResult({
      score: 30,
      grade: 'F',
      checks: [makeCheck({ ...sharedCheck, earnedPoints: 6, passed: true })],
    });

    displayScoreDelta(before, after);

    const output = logs.join('\n');
    expect(output).toContain('What improved');
    expect(output).toContain('CLAUDE.md exists');
    expect(output).toContain('+6');
  });

  it('does not show improved section when nothing improved', () => {
    const check = { id: 'test', name: 'Test', category: 'existence' as const };
    const before = makeScoreResult({
      score: 50,
      grade: 'C',
      checks: [makeCheck({ ...check, earnedPoints: 5, passed: true })],
    });
    const after = makeScoreResult({
      score: 50,
      grade: 'C',
      checks: [makeCheck({ ...check, earnedPoints: 5, passed: true })],
    });

    displayScoreDelta(before, after);

    const output = logs.join('\n');
    expect(output).not.toContain('What improved');
  });
});

describe('displayScore', () => {
  let logs: string[];

  beforeEach(() => {
    logs = [];
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(' '));
    });
  });

  it('renders score header with grade', () => {
    const result = makeScoreResult({ score: 85, grade: 'A', targetAgent: 'claude' });

    displayScore(result);

    const output = logs.join('\n');
    expect(output).toContain('85');
    expect(output).toContain('A');
    expect(output).toContain('Claude Code');
  });

  it('shows both agents label when targetAgent is both', () => {
    const result = makeScoreResult({ score: 50, grade: 'C', targetAgent: 'both' });

    displayScore(result);

    const output = logs.join('\n');
    expect(output).toContain('Claude Code + Cursor');
  });

  it('shows Cursor label when targetAgent is cursor', () => {
    const result = makeScoreResult({ score: 50, grade: 'C', targetAgent: 'cursor' });

    displayScore(result);

    const output = logs.join('\n');
    expect(output).toContain('Cursor');
  });

  it('renders category sections', () => {
    const result = makeScoreResult({ score: 50, grade: 'C' });

    displayScore(result);

    const output = logs.join('\n');
    expect(output).toContain('FILES & SETUP');
    expect(output).toContain('QUALITY');
    expect(output).toContain('COVERAGE');
    expect(output).toContain('ACCURACY');
    expect(output).toContain('FRESHNESS & SAFETY');
    expect(output).toContain('BONUS');
  });
});
