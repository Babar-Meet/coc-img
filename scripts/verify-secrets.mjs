#!/usr/bin/env node
/**
 * scripts/verify-secrets.mjs
 * Cross-platform secret verification scanner for coc-img
 * Zero external dependencies (Pure Node.js ES Module)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// Terminal ANSI color escape codes (auto-detect TTY)
const isTTY = Boolean(process.stdout && process.stdout.isTTY);
const RED = isTTY ? '\x1b[1;31m' : '';
const GREEN = isTTY ? '\x1b[1;32m' : '';
const YELLOW = isTTY ? '\x1b[1;33m' : '';
const CYAN = isTTY ? '\x1b[1;36m' : '';
const BOLD = isTTY ? '\x1b[1m' : '';
const NC = isTTY ? '\x1b[0m' : '';

// Extensions to skip from content regex scanning (binary media & archives)
export const BINARY_EXTENSIONS = new Set([
  '.webp', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.bmp', '.tiff', '.tif',
  '.avif', '.heic', '.exe', '.dll', '.so', '.dylib', '.bin', '.zip', '.tar',
  '.gz', '.7z', '.rar', '.pdf', '.ttf', '.woff', '.woff2', '.eot', '.gitkeep'
]);

// Directories to skip during recursive filesystem traversal
export const IGNORED_DIRECTORIES = new Set([
  '.git', 'node_modules', 'dist', 'build', '.vite', '.agents'
]);

// Self-exclusion: Do not scan the verification script itself or hooks for token patterns
export const EXCLUDED_FILES = new Set([
  'scripts/verify-secrets.mjs',
  'scripts\\verify-secrets.mjs',
  '.githooks/pre-commit',
  '.githooks/pre-push',
  '.git/hooks/pre-commit',
  '.git/hooks/pre-push'
]);

// -----------------------------------------------------------------------------
// Forbidden File Path Patterns
// -----------------------------------------------------------------------------
export const FORBIDDEN_FILE_PATTERNS = [
  {
    id: 'FILE_DOTENV',
    name: 'Environment Configuration File',
    regex: /(^|[/\\])\.env(\..+)?$/i
  },
  {
    id: 'FILE_ENV_EXT',
    name: 'DotEnv Extension File',
    regex: /\.env$/i
  },
  {
    id: 'FILE_KEY',
    name: 'Private Key or Certificate',
    regex: /\.(pem|key|pkcs12|p12|pfx)$/i
  },
  {
    id: 'FILE_SSH_KEY',
    name: 'SSH Key Pair',
    regex: /(^|[/\\])id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i
  },
  {
    id: 'FILE_CREDENTIALS',
    name: 'Service Credential JSON',
    regex: /(^|[/\\])(credentials|client[-_]secret.*|service[-_]account.*)\.json$/i
  },
  {
    id: 'FILE_KEYSTORE',
    name: 'Signing Keystore',
    regex: /\.(keystore|jks)$/i
  },
  {
    id: 'FILE_SHELL_HISTORY',
    name: 'Shell History File',
    regex: /(^|[/\\])\.(bash_history|zsh_history|history)$/i
  },
  {
    id: 'FILE_NETRC',
    name: 'Netrc Credential Store',
    regex: /(^|[/\\])\.netrc$/i
  }
];

// -----------------------------------------------------------------------------
// Secret Token Content Patterns
// -----------------------------------------------------------------------------
export const SECRET_PATTERNS = [
  {
    id: 'SEC_GITHUB_PAT',
    name: 'GitHub Fine-Grained Personal Access Token',
    regex: /\bgithub_pat_[a-zA-Z0-9_]{50,120}\b/
  },
  {
    id: 'SEC_GITHUB_CLASSIC',
    name: 'GitHub Classic Personal Access Token',
    regex: /\bghp_[a-zA-Z0-9]{36}\b/
  },
  {
    id: 'SEC_GITHUB_OAUTH',
    name: 'GitHub OAuth Access Token',
    regex: /\bgho_[a-zA-Z0-9]{36}\b/
  },
  {
    id: 'SEC_GITHUB_APP',
    name: 'GitHub App / User Token',
    regex: /\b(ghu|ghs|ghr)_[a-zA-Z0-9]{36}\b/
  },
  {
    id: 'SEC_AWS_KEY',
    name: 'AWS Access Key ID',
    regex: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/
  },
  {
    id: 'SEC_AWS_SECRET',
    name: 'AWS Secret Access Key Assignment',
    regex: /\baws_?(?:secret)?_?(?:access)?_?(?:key)?\s*[:=]\s*['"][0-9a-zA-Z/+]{40}['"]/i
  },
  {
    id: 'SEC_PRIVATE_KEY',
    name: 'Cryptographic Private Key Header',
    regex: /-----BEGIN ((?:EC|RSA|DSA|OPENSSH|PGP) )?PRIVATE KEY-----/
  },
  {
    id: 'SEC_ANTHROPIC_KEY',
    name: 'Anthropic Claude API Key',
    regex: /\bsk-ant-[a-zA-Z0-9_-]{80,}\b/
  },
  {
    id: 'SEC_OPENAI_KEY',
    name: 'OpenAI API Key',
    regex: /\bsk-(?!ant-)(?:proj-)?[a-zA-Z0-9_-]{20,}\b/
  },
  {
    id: 'SEC_SLACK_TOKEN',
    name: 'Slack Token',
    regex: /\bxox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*\b/
  },
  {
    id: 'SEC_SLACK_WEBHOOK',
    name: 'Slack Incoming Webhook URL',
    regex: /https:\/\/hooks\.slack\.com\/services\/T[a-zA-Z0-9_]+\/B[a-zA-Z0-9_]+\/[a-zA-Z0-9_]+/
  },
  {
    id: 'SEC_DISCORD_TOKEN',
    name: 'Discord Bot Token',
    regex: /\b[MNO][a-zA-Z0-9_-]{23,25}\.[a-zA-Z0-9_-]{6,8}\.[a-zA-Z0-9_-]{27,38}\b/
  },
  {
    id: 'SEC_DISCORD_WEBHOOK',
    name: 'Discord Webhook URL',
    regex: /https:\/\/discord(?:app)?\.com\/api\/webhooks\/[0-9]+\/[a-zA-Z0-9_-]+/
  },
  {
    id: 'SEC_GOOGLE_KEY',
    name: 'Google API Key',
    regex: /\bAIza[0-9A-Za-z_-]{35}\b/
  },
  {
    id: 'SEC_STRIPE_KEY',
    name: 'Stripe API Key',
    regex: /\b(?:sk|rk)_(?:live|test)_[0-9a-zA-Z]{24,}\b/
  },
  {
    id: 'SEC_GENERIC_KEY',
    name: 'Generic API / Secret Key Assignment',
    regex: /\b(?:api_key|apikey|secret_key|app_secret|auth_token)\s*[:=]\s*['"][a-zA-Z0-9_!@#$%^&*()\-+=]{12,64}['"]/i
  }
];

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

/**
 * SOC2-safe redaction utility: masks the sensitive middle payload.
 */
export function redactSecret(secret) {
  if (typeof secret !== 'string') return '[REDACTED]';
  if (secret.length <= 8) return '********';
  const prefixLen = Math.min(8, Math.max(3, Math.floor(secret.length / 4)));
  const suffixLen = Math.min(4, Math.max(2, Math.floor(secret.length / 4)));
  const prefix = secret.slice(0, prefixLen);
  const suffix = secret.slice(-suffixLen);
  const redactedCount = secret.length - prefixLen - suffixLen;
  return `${prefix}...[REDACTED: ${redactedCount} chars]...${suffix}`;
}

/**
 * Normalizes relative paths to forward slashes.
 */
export function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

/**
 * Safely runs a Git command. Returns stdout or null if failed.
 */
export function runGit(args, cwd = REPO_ROOT) {
  try {
    return execSync(`git ${args}`, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 20 * 1024 * 1024
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Checks whether a relative path matches forbidden filename rules.
 */
export function checkFileName(relPath) {
  const normalized = normalizePath(relPath);
  if (EXCLUDED_FILES.has(normalized) || normalized.startsWith('.githooks/')) {
    return null;
  }
  for (const rule of FORBIDDEN_FILE_PATTERNS) {
    if (rule.regex.test(normalized)) {
      return rule;
    }
  }
  return null;
}

/**
 * Checks content line-by-line for secret token patterns.
 * Returns an array of violations: { lineNum, rule, matchedToken, redacted }
 */
export function checkContent(content, relPath) {
  const normalized = normalizePath(relPath);
  if (EXCLUDED_FILES.has(normalized) || normalized.startsWith('tests/harness/')) {
    return [];
  }
  const ext = path.extname(normalized).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) {
    return [];
  }

  const violations = [];
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Allow explicit inline exclusion comment
    if (line.includes('verify-secrets-ignore')) {
      continue;
    }

    for (const rule of SECRET_PATTERNS) {
      const match = rule.regex.exec(line);
      if (match) {
        const matchedToken = match[0];
        violations.push({
          lineNum: i + 1,
          rule,
          matchedToken,
          redacted: redactSecret(matchedToken)
        });
        break; // Record one violation per line
      }
    }
  }
  return violations;
}

// -----------------------------------------------------------------------------
// Scanning Modes
// -----------------------------------------------------------------------------

/**
 * Mode 1: Scan Git Staged Index (--staged)
 */
export function scanStaged() {
  const stagedOutput = runGit('diff --cached --name-only --diff-filter=ACM');
  if (stagedOutput === null) {
    throw new Error('Failed to run git diff --cached. Ensure git is installed and repository initialized.');
  }

  const stagedFiles = stagedOutput.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (stagedFiles.length === 0) {
    return { filesChecked: 0, violations: [] };
  }

  const allViolations = [];

  for (const file of stagedFiles) {
    const fileRule = checkFileName(file);
    if (fileRule) {
      allViolations.push({
        file,
        type: 'FORBIDDEN_FILE',
        rule: fileRule,
        message: `Forbidden file staged: ${fileRule.name} (${fileRule.id})`
      });
    }

    // Inspect staged blob content
    const ext = path.extname(file).toLowerCase();
    if (!BINARY_EXTENSIONS.has(ext)) {
      const stagedBlob = runGit(`show ":${file}"`);
      if (stagedBlob) {
        const contentViolations = checkContent(stagedBlob, file);
        for (const v of contentViolations) {
          allViolations.push({
            file,
            type: 'SECRET_TOKEN',
            rule: v.rule,
            lineNum: v.lineNum,
            redacted: v.redacted,
            message: `Secret token staged on line ${v.lineNum}: ${v.rule.name} [${v.redacted}]`
          });
        }
      }
    }
  }

  return { filesChecked: stagedFiles.length, violations: allViolations };
}

/**
 * Mode 2: Scan Git Commit Range (--commits [range])
 */
export function scanCommits(range) {
  let commitRange = range;
  if (!commitRange) {
    // Attempt upstream comparison, fallback to last 50 commits
    const upstream = runGit('rev-parse --abbrev-ref --symbolic-full-name @{u}');
    if (upstream) {
      commitRange = `${upstream}..HEAD`;
    }
  }

  const commitsList = commitRange
    ? runGit(`rev-list ${commitRange}`)
    : runGit('rev-list --max-count=50 HEAD');
  const commits = commitsList ? commitsList.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [];

  if (commits.length === 0 && commitRange) {
    // Try single commit or direct range check
    const singleCommit = runGit(`rev-parse ${commitRange}`);
    if (singleCommit) commits.push(singleCommit);
  }

  if (commits.length === 0) {
    return { commitsChecked: 0, violations: [] };
  }

  const allViolations = [];

  for (const commit of commits) {
    const shortCommit = commit.slice(0, 8);
    const changedFilesOutput = runGit(`diff-tree --no-commit-id --name-only --diff-filter=ACM -r ${commit}`);
    const changedFiles = changedFilesOutput ? changedFilesOutput.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [];

    for (const file of changedFiles) {
      const fileRule = checkFileName(file);
      if (fileRule) {
        allViolations.push({
          commit: shortCommit,
          file,
          type: 'FORBIDDEN_FILE',
          rule: fileRule,
          message: `Commit ${shortCommit} introduces forbidden file: ${file} (${fileRule.id})`
        });
      }
    }

    // Inspect added diff lines
    const diffOutput = runGit(`diff-tree -p -U0 ${commit}`);
    if (diffOutput) {
      const lines = diffOutput.split(/\r?\n/);
      let currentFile = '';
      for (const line of lines) {
        if (line.startsWith('+++ b/')) {
          currentFile = line.slice(6);
          continue;
        }
        if (line.startsWith('+') && !line.startsWith('+++')) {
          const addedText = line.slice(1);
          if (addedText.includes('verify-secrets-ignore')) continue;
          if (EXCLUDED_FILES.has(normalizePath(currentFile))) continue;
          const ext = path.extname(currentFile).toLowerCase();
          if (BINARY_EXTENSIONS.has(ext)) continue;

          for (const rule of SECRET_PATTERNS) {
            const match = rule.regex.exec(addedText);
            if (match) {
              const redacted = redactSecret(match[0]);
              allViolations.push({
                commit: shortCommit,
                file: currentFile,
                type: 'SECRET_TOKEN',
                rule,
                redacted,
                message: `Commit ${shortCommit} introduces secret in ${currentFile}: ${rule.name} [${redacted}]`
              });
              break;
            }
          }
        }
      }
    }
  }

  return { commitsChecked: commits.length, violations: allViolations };
}

/**
 * Mode 3: Scan Working Tree or specific path
 */
export function scanWorkingTree(targetPath = REPO_ROOT, options = {}) {
  const { strictDisk = false, isDirectTarget = false } = options;
  const targetAbs = path.resolve(REPO_ROOT, targetPath);
  const allViolations = [];
  let filesChecked = 0;

  if (!fs.existsSync(targetAbs)) {
    throw new Error(`Target path does not exist: ${targetPath}`);
  }

  const stat = fs.statSync(targetAbs);

  if (stat.isFile()) {
    filesChecked++;
    const rel = path.relative(REPO_ROOT, targetAbs);
    const fileRule = checkFileName(rel);
    if (fileRule) {
      allViolations.push({
        file: rel,
        type: 'FORBIDDEN_FILE',
        rule: fileRule,
        message: `Forbidden file detected: ${rel} (${fileRule.id})`
      });
    }

    const ext = path.extname(rel).toLowerCase();
    if (!BINARY_EXTENSIONS.has(ext)) {
      const content = fs.readFileSync(targetAbs, 'utf8');
      const contentViolations = checkContent(content, rel);
      for (const v of contentViolations) {
        allViolations.push({
          file: rel,
          type: 'SECRET_TOKEN',
          rule: v.rule,
          lineNum: v.lineNum,
          redacted: v.redacted,
          message: `Secret token detected on line ${v.lineNum}: ${v.rule.name} [${v.redacted}]`
        });
      }
    }
    return { filesChecked, violations: allViolations };
  }

  // Recursive directory scan
  function traverse(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const rel = path.relative(REPO_ROOT, fullPath);

      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) {
          continue;
        }
        traverse(fullPath);
      } else if (entry.isFile()) {
        filesChecked++;

        // Forbidden file check
        const fileRule = checkFileName(rel);
        if (fileRule) {
          // If not strictDisk and file is excluded by gitignore and untracked, treat as safe local file
          let isIgnored = false;
          let isTracked = false;
          if (!strictDisk && !isDirectTarget) {
            const checkIgnore = runGit(`check-ignore -q "${rel}"`);
            isIgnored = (checkIgnore !== null);
            const checkTracked = runGit(`ls-files --error-unmatch "${rel}"`);
            isTracked = (checkTracked !== null);
          }

          if (isTracked || strictDisk || !isIgnored) {
            allViolations.push({
              file: rel,
              type: 'FORBIDDEN_FILE',
              rule: fileRule,
              message: `Forbidden file on disk: ${rel} (${fileRule.id})`
            });
          }
        }

        const ext = path.extname(entry.name).toLowerCase();
        if (!BINARY_EXTENSIONS.has(ext)) {
          // If file matched a forbidden rule and is ignored on disk (e.g. .env), skip content scan unless strictDisk
          if (fileRule && !strictDisk && !isDirectTarget) {
            // Ignored local file, content skipped
          } else {
            try {
              const content = fs.readFileSync(fullPath, 'utf8');
              const contentViolations = checkContent(content, rel);
              for (const v of contentViolations) {
                allViolations.push({
                  file: rel,
                  type: 'SECRET_TOKEN',
                  rule: v.rule,
                  lineNum: v.lineNum,
                  redacted: v.redacted,
                  message: `Secret token detected in ${rel}:${v.lineNum}: ${v.rule.name} [${v.redacted}]`
                });
              }
            } catch {
              // Ignore unreadable files
            }
          }
        }
      }
    }
  }

  traverse(targetAbs);
  return { filesChecked, violations: allViolations };
}

// -----------------------------------------------------------------------------
// CLI Runner & Formatter
// -----------------------------------------------------------------------------

function printUsage() {
  console.log(`
${BOLD}Clash of Clans Secret Verification Scanner${NC}
Usage:
  node scripts/verify-secrets.mjs [options] [targetPath]

Options:
  ${CYAN}--staged${NC}             Scan files staged in the Git index (used by pre-commit hook)
  ${CYAN}--commits [range]${NC}    Scan outgoing commits in given range (used by pre-push hook)
  ${CYAN}--all, --strict-disk${NC} Scan all working tree files including local ignored files
  ${CYAN}-h, --help${NC}           Show this help message

Exit Status:
  0   Clean: zero forbidden files or secret tokens detected.
  1   Violations detected: commit or push blocked.
`);
}

export function main(argv = process.argv.slice(2)) {
  const args = argv;

  if (args.includes('-h') || args.includes('--help')) {
    printUsage();
    return 0;
  }

  let result = null;
  let modeDesc = '';

  try {
    if (args.includes('--staged')) {
      modeDesc = 'Git Staging Area (--staged)';
      result = scanStaged();
    } else if (args.includes('--commits')) {
      const idx = args.indexOf('--commits');
      const range = (args[idx + 1] && !args[idx + 1].startsWith('-')) ? args[idx + 1] : undefined;
      modeDesc = `Outgoing Commits Range [${range || 'default'}]`;
      result = scanCommits(range);
    } else {
      const strictDisk = args.includes('--all') || args.includes('--strict-disk');
      const pathArg = args.find(a => !a.startsWith('-'));
      const isDirectTarget = Boolean(pathArg);
      modeDesc = isDirectTarget ? `Target Path [${pathArg}]` : `Working Tree [${strictDisk ? 'strict' : 'standard'}]`;
      result = scanWorkingTree(pathArg || REPO_ROOT, { strictDisk, isDirectTarget });
    }
  } catch (err) {
    console.error(`${RED}[ERROR] Secret verification failed to execute: ${err.message}${NC}`);
    return 1;
  }

  const { violations } = result;

  if (violations.length === 0) {
    console.log(`${GREEN}✔ [CLEAN] ${modeDesc}: zero secret leaks or forbidden files detected.${NC}`);
    return 0;
  }

  console.error(`\n${RED}================================================================================${NC}`);
  console.error(`${RED}${BOLD}[SECURITY VIOLATION DETECTED] ${modeDesc}${NC}`);
  console.error(`${RED}================================================================================${NC}`);
  console.error(`${YELLOW}Found ${violations.length} prohibited item(s):${NC}\n`);

  for (const v of violations) {
    console.error(`  ${RED}✖ [${v.type}]${NC} ${v.file || ''} ${v.commit ? `(Commit ${v.commit})` : ''}`);
    console.error(`    ${CYAN}Rule:${NC}    ${v.rule.name} (${v.rule.id})`);
    if (v.redacted) {
      console.error(`    ${YELLOW}Secret:${NC}  ${v.redacted}`);
    }
    console.error('');
  }

  console.error(`${CYAN}Remediation Steps:${NC}`);
  console.error('  1. Unstage or remove the forbidden files from version control.');
  console.error('  2. Move credentials to uncommitted local .env files matching .gitignore.');
  console.error('  3. If tokens were exposed or committed, rotate/revoke them immediately.\n');
  console.error(`${RED}================================================================================${NC}\n`);

  return 1;
}

// Direct CLI invocation
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const code = main();
  process.exit(code);
}
