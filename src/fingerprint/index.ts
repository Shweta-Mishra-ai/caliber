import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getGitRemoteUrl } from './git.js';
import { getFileTree } from './file-tree.js';
import { readExistingConfigs } from './existing-config.js';
import { analyzeCode, CodeAnalysis } from './code-analysis.js';
import { detectProjectStack } from '../ai/detect.js';
import { loadConfig } from '../llm/config.js';

export type { CodeAnalysis };

export interface Fingerprint {
  gitRemoteUrl?: string;
  packageName?: string;
  languages: string[];
  frameworks: string[];
  tools: string[];
  fileTree: string[];
  existingConfigs: ReturnType<typeof readExistingConfigs>;
  codeAnalysis?: CodeAnalysis;
  description?: string;
}

export async function collectFingerprint(dir: string): Promise<Fingerprint> {
  const gitRemoteUrl = getGitRemoteUrl();
  const fileTree = getFileTree(dir);
  const existingConfigs = readExistingConfigs(dir);
  const codeAnalysis = analyzeCode(dir);
  const packageName = readPackageName(dir);

  const fingerprint: Fingerprint = {
    gitRemoteUrl,
    packageName,
    languages: [],
    frameworks: [],
    tools: [],
    fileTree,
    existingConfigs,
    codeAnalysis,
  };

  await enrichWithLLM(fingerprint, dir);

  return fingerprint;
}

function readPackageName(dir: string): string | undefined {
  try {
    const pkgPath = path.join(dir, 'package.json');
    if (!fs.existsSync(pkgPath)) return undefined;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.name;
  } catch {
    return undefined;
  }
}

export function computeFingerprintHash(fingerprint: Fingerprint): string {
  const key = [
    fingerprint.gitRemoteUrl || '',
    fingerprint.packageName || '',
  ].join('::');

  return crypto.createHash('sha256').update(key).digest('hex');
}

const DEP_FILE_PATTERNS = [
  'package.json',
  'pyproject.toml',
  'requirements.txt',
  'setup.py',
  'Pipfile',
  'Cargo.toml',
  'go.mod',
  'Gemfile',
  'build.gradle',
  'pom.xml',
  'composer.json',
];

const MAX_CONTENT_SIZE = 50 * 1024;

async function enrichWithLLM(fingerprint: Fingerprint, dir: string): Promise<void> {
  try {
    const config = loadConfig();
    if (!config) return;

    const fileContents: Record<string, string> = {};
    let totalSize = 0;

    for (const treePath of fingerprint.fileTree) {
      const basename = path.basename(treePath);
      if (!DEP_FILE_PATTERNS.includes(basename)) continue;

      const fullPath = path.join(dir, treePath);
      if (!fs.existsSync(fullPath)) continue;

      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        if (totalSize + content.length > MAX_CONTENT_SIZE) break;
        fileContents[treePath] = content;
        totalSize += content.length;
      } catch {
        continue;
      }
    }

    if (Object.keys(fileContents).length === 0 && fingerprint.fileTree.length === 0) return;

    const result = await detectProjectStack(fingerprint.fileTree, fileContents);

    if (result.languages?.length) fingerprint.languages = result.languages;
    if (result.frameworks?.length) fingerprint.frameworks = result.frameworks;
    if (result.tools?.length) fingerprint.tools = result.tools;
  } catch {
    // Silently continue — LLM enrichment is best-effort
  }
}
