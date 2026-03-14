import fs from 'fs';
import { execSync } from 'child_process';

let _resolved: string | null = null;

/**
 * Resolve the absolute path to the `caliber` binary.
 * Caches the result so the lookup happens at most once per process.
 */
export function resolveCaliber(): string {
  if (_resolved) return _resolved;

  // 1. Try `which caliber`
  try {
    const found = execSync('which caliber', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (found) {
      _resolved = found;
      return _resolved;
    }
  } catch {
    // not on PATH — fall through
  }

  // 2. Derive from our own process.argv[1] (the script being executed)
  const binPath = process.argv[1];
  if (binPath && fs.existsSync(binPath)) {
    _resolved = binPath;
    return _resolved;
  }

  // 3. Last resort: bare command (may still fail in /bin/sh)
  _resolved = 'caliber';
  return _resolved;
}

/**
 * Check whether a hook command refers to caliber, regardless of whether
 * it uses a bare `caliber` or an absolute path ending in `caliber`.
 * Matches by looking for the caliber binary name + the subcommand tail.
 *
 * Example: matches both `caliber refresh --quiet` and `/usr/local/bin/caliber refresh --quiet`
 */
export function isCaliberCommand(command: string, subcommandTail: string): boolean {
  // Exact legacy match
  if (command === `caliber ${subcommandTail}`) return true;
  // Absolute-path match: ends with /caliber <tail>
  if (command.endsWith(`/caliber ${subcommandTail}`)) return true;
  return false;
}
