import { existsSync, readFileSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import type { Check } from '../index.js';
import {
  POINTS_HOOKS,
  POINTS_AGENTS_MD,
  POINTS_OPEN_SKILLS_FORMAT,
} from '../constants.js';

function readFileOrNull(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}

function hasPreCommitHook(dir: string): boolean {
  try {
    const gitDir = execSync('git rev-parse --git-dir', { cwd: dir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    const hookPath = join(gitDir, 'hooks', 'pre-commit');
    const content = readFileOrNull(hookPath);
    return content ? content.includes('caliber') : false;
  } catch {
    return false;
  }
}

export function checkBonus(dir: string): Check[] {
  const checks: Check[] = [];

  // 1. Hooks configured (Claude Code hooks OR git pre-commit hook)
  let hasClaudeHooks = false;
  let hasPrecommit = false;
  const hookSources: string[] = [];

  const settingsContent = readFileOrNull(join(dir, '.claude', 'settings.json'));
  if (settingsContent) {
    try {
      const settings = JSON.parse(settingsContent) as Record<string, unknown>;
      const hooks = settings.hooks as Record<string, unknown> | undefined;
      if (hooks && Object.keys(hooks).length > 0) {
        hasClaudeHooks = true;
        hookSources.push(`Claude Code: ${Object.keys(hooks).join(', ')}`);
      }
    } catch { /* invalid JSON */ }
  }

  hasPrecommit = hasPreCommitHook(dir);
  if (hasPrecommit) {
    hookSources.push('git pre-commit');
  }

  const hasHooks = hasClaudeHooks || hasPrecommit;
  const hookDetail = hasHooks
    ? hookSources.join(', ')
    : settingsContent
      ? 'No hooks in settings.json'
      : 'No hooks configured';

  checks.push({
    id: 'hooks_configured',
    name: 'Hooks configured',
    category: 'bonus',
    maxPoints: POINTS_HOOKS,
    earnedPoints: hasHooks ? POINTS_HOOKS : 0,
    passed: hasHooks,
    detail: hookDetail,
    suggestion: hasHooks
      ? undefined
      : 'Run `caliber hooks install` or `caliber hooks install-precommit` for auto-refresh',
  });

  // 2. AGENTS.md exists
  const agentsMdExists = existsSync(join(dir, 'AGENTS.md'));
  checks.push({
    id: 'agents_md_exists',
    name: 'AGENTS.md exists',
    category: 'bonus',
    maxPoints: POINTS_AGENTS_MD,
    earnedPoints: agentsMdExists ? POINTS_AGENTS_MD : 0,
    passed: agentsMdExists,
    detail: agentsMdExists ? 'Found at project root' : 'Not found',
    suggestion: agentsMdExists
      ? undefined
      : 'Add AGENTS.md — the emerging cross-agent standard (60k+ repos)',
  });

  // 3. Skills use OpenSkills format (SKILL.md with YAML frontmatter)
  const skillsDir = join(dir, '.claude', 'skills');
  let openSkillsCount = 0;
  let totalSkillFiles = 0;

  try {
    const entries = readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        // OpenSkills format: .claude/skills/{name}/SKILL.md
        const skillMd = readFileOrNull(join(skillsDir, entry.name, 'SKILL.md'));
        if (skillMd) {
          totalSkillFiles++;
          // Check for YAML frontmatter (starts with ---)
          if (skillMd.trimStart().startsWith('---')) {
            openSkillsCount++;
          }
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        // Legacy format: .claude/skills/{name}.md (flat file)
        totalSkillFiles++;
      }
    }
  } catch {
    // skills dir doesn't exist
  }

  const allOpenSkills = totalSkillFiles > 0 && openSkillsCount === totalSkillFiles;
  checks.push({
    id: 'open_skills_format',
    name: 'Skills use OpenSkills format',
    category: 'bonus',
    maxPoints: POINTS_OPEN_SKILLS_FORMAT,
    earnedPoints: allOpenSkills ? POINTS_OPEN_SKILLS_FORMAT : 0,
    passed: allOpenSkills,
    detail:
      totalSkillFiles === 0
        ? 'No skills to check'
        : allOpenSkills
          ? `All ${totalSkillFiles} skill${totalSkillFiles === 1 ? '' : 's'} use SKILL.md with frontmatter`
          : `${openSkillsCount}/${totalSkillFiles} use OpenSkills format`,
    suggestion:
      totalSkillFiles > 0 && !allOpenSkills
        ? 'Migrate skills to .claude/skills/{name}/SKILL.md with YAML frontmatter (SkillsBench: +16.2pp improvement)'
        : undefined,
  });

  return checks;
}
