# TEST_INFRA.md — E2E Testing Infrastructure Specification

## 1. Executive Summary & Architecture

The E2E Testing Infrastructure for **Clash of Clans Studio Workstation (`coc-img`)** provides an automated, requirement-driven, opaque-box testing framework. It validates repository security safeguards, Git hooks, batch CLI scripts, client-side canvas/watermark/WebP pipelines, Vite Connect API middleware, centralized metadata storage, and the in-app Git publishing workflow.

### Core Testing Principles:
1. **Opaque-Box & Requirement-Driven**: Tests derive directly from `ORIGINAL_REQUEST.md` and `PROJECT.md`, verifying observable system behavior, inputs, outputs, and exit codes without coupling to private implementation details.
2. **Progressive Testability**: Tests can execute progressively across Milestones M1 through M6. Early milestones (e.g. security ignore rules, batch scripts, branding assets) pass immediately without waiting for later milestones (such as full UI or API servers).
3. **Dual-Channel Execution**: API endpoints can be tested headlessly via in-process Connect middleware on ephemeral ports or against a live Vite development server.
4. **Isolated Git & Filesystem Sandboxes**: All git operations, hook triggers, and secret staging tests run inside isolated temporary repositories (`tests/harness/git-sandbox.mjs`), ensuring zero risk to the host repository.
5. **Zero External Test Runner Dependencies**: The core runner (`tests/runner.mjs`) is implemented in pure modern Node.js standard library built-ins (v18+ / v24+), requiring no complex compilation or root `node_modules` to run.

---

## 2. Directory Structure & File Map

```
B:\_Git\DEV\Babar-Meet\coc-img\
├── TEST_INFRA.md                       # This architecture specification
├── TEST_READY.md                       # Publication readiness certificate (E4)
└── tests/
    ├── runner.mjs                      # Core test runner, CLI flags, lifecycle & reporter
    ├── harness/
    │   ├── index.mjs                   # Public harness export aggregating all test tools
    │   ├── runner-core.mjs             # BDD test registry, suite/test engine, timeout handler
    │   ├── assertions.mjs              # Custom opaque-box assertion library & matchers
    │   ├── capabilities.mjs            # Milestone capability detection & progressive guards
    │   ├── fixtures.mjs                # Test fixture generators (PNG, WebP, secrets, temp dirs)
    │   ├── git-sandbox.mjs             # Isolated temporary git repository sandbox
    │   ├── reporter.mjs                # Obsidian dark-theme ANSI terminal reporter
    │   └── self-test.test.mjs          # Harness verification self-test suite
    ├── tier1_features/                 # Tier 1: Single-Feature Coverage (Features 1-19)
    │   ├── security-git.test.mjs       # Features 1, 2, 3 (.gitignore, hooks, verify-secrets)
    │   ├── scripts-batch.test.mjs      # Feature 4 (push.bat, convert-img.bat, get-raw-link.bat)
    │   ├── branding-assets.test.mjs    # Features 6, 7 (Logos, dimensions, dark palette)
    │   ├── webp-naming.test.mjs        # Features 8, 9, 10 (Canvas math, 9-anchor, 6-digit naming)
    │   ├── cdn-links.test.mjs          # Features 13, 14 (CDN URL generation & encoding)
    │   ├── metadata-categories.test.mjs# Features 12, 15, 16 (Metadata schema, category CRUD, notes)
    │   └── api-endpoints.test.mjs      # Features 11, 17, 18, 19 (Git status, staging, commit, push)
    ├── tier2_boundaries/               # Tier 2: Boundary, Stress & Adversarial Inputs
    │   ├── security-traversal.test.mjs # Path traversal attacks (../../.env, null-bytes, URL encodings)
    │   ├── secret-patterns.test.mjs    # Secret token edge cases, obfuscation, commit injections
    │   ├── invalid-inputs.test.mjs     # Corrupted base64, zero-byte uploads, disguised executables
    │   └── edge-cases.test.mjs         # Watermark math extremes (0%, 500%), empty staging lists
    ├── tier3_combinations/             # Tier 3: Cross-Feature Interactions & Pipelines
    │   ├── watermark-webp-category.test.mjs # Watermark -> WebP export -> Category save pipeline
    │   ├── category-asset-cdn.test.mjs      # Category creation -> Asset upload -> CDN URL verify
    │   ├── secret-staging-publish.test.mjs  # Secret leak attempt + Staging whitelist block
    │   └── metadata-search-sync.test.mjs    # Comments/tags update -> Search index sync -> Persistence
    └── tier4_scenarios/                # Tier 4: Real-World End-to-End Workflows
        ├── full-workflow-th18-base.test.mjs # Town Hall 18 screenshot -> Watermark -> WebP -> Publish
        ├── category-curation-publish.test.mjs# New category curation -> Asset management -> Publish
        └── cli-studio-coexistence.test.mjs  # Legacy batch script & studio coexistence workflow
```

---

## 3. Progressive Testability Framework

### 3.1 Milestone Capability Detection Matrix
The test harness inspects the workspace for readiness markers before running suites:

| Milestone | Capability Flag | Capability Marker Files | Covered Features |
|---|---|---|---|
| **M1** | `CAPABILITY_M1_SECURITY` | `.gitignore`, `.githooks/pre-commit`, `scripts/verify-secrets.mjs` | F1, F2, F3, F4 |
| **M2** | `CAPABILITY_M2_STUDIO_SHELL` | `studio/package.json`, `studio/src/assets/branding/app icon.png` | F5, F6, F7 |
| **M3** | `CAPABILITY_M3_CANVAS_ENGINE` | `studio/src/utils/canvas.ts` or `studio/src/components/editor/` | F8, F9, F10 |
| **M4** | `CAPABILITY_M4_STUDIO_API` | `studio/vite-plugin-studio-api.ts`, `assets-metadata.json` | F11, F12, F13, F14, F15, F16 |
| **M5** | `CAPABILITY_M5_GIT_PUBLISHER` | `studio/src/components/publisher/` or `/api/git/*` handlers | F17, F18, F19 |
| **M6** | `CAPABILITY_M6_FULL_E2E` | All capabilities present | Tiers 1-4 Complete + Tier 5 Hardening |

### 3.2 Progressive Runner Execution Modes
1. **Default Mode (`node tests/runner.mjs`)**:
   - Detects present capabilities dynamically via `detectCapabilities()`.
   - Executes tests for available milestones.
   - Gracefully reports unlanded milestones as `[SKIPPED (Pending Milestone Mx)]`.
   - Returns exit code `0` if all available tests pass.
2. **Targeted Milestone Mode (`node tests/runner.mjs --milestone=M1`)**:
   - Executes only tests tagged with the specified milestone (or prior milestones).
   - Skips tests beyond the targeted milestone.
   - Fails immediately if any required capability for that milestone is missing.
3. **Strict / CI Mode (`node tests/runner.mjs --strict`)**:
   - Enforces 100% feature readiness.
   - Any skipped test or missing capability is treated as a hard failure (exit code `1`).
   - Mandatory for Milestone E4 sign-off and M6 acceptance gates.

---

## 4. Test Tiering Specification

### Tier 1: Single-Feature Coverage (Isolated Verification)
- **Objective**: Guarantee that every feature in `PROJECT.md § Feature Inventory` (Features 1–19) operates as specified in isolation.
- **Rules**:
  - Tests must have minimal coupling to other features.
  - Test suites must use sandboxes or mocked environments.
  - Failures in Tier 1 directly point to a single defective component.

### Tier 2: Boundary, Invariants & Malicious Inputs
- **Objective**: Harden the system against malformed data, unexpected user actions, and deliberate security attacks.
- **Rules**:
  - Path traversal attempts must be completely neutralized. No file outside permitted asset directories may be written or deleted.
  - Secret token patterns (`github_pat_*`, `ghp_*`, RSA keys) must be caught across all inputs (file contents, file names, commit messages).
  - Corrupted, truncated, or zero-byte payloads must return clear client errors (`400 Bad Request`) without server crashes or unhandled exceptions.

### Tier 3: Cross-Feature Interactions & Pipelines
- **Objective**: Validate the interoperability contracts between multiple subsystems.
- **Rules**:
  - Tests verify sequential multi-step dataflows (e.g. Canvas render -> WebP encode -> Category save -> Metadata register -> Git status update).
  - Must assert data integrity across module transitions (e.g. verifying that binary WebP signatures survive client-to-server transmission).

### Tier 4: Real-World Scenarios (End-to-End User Journeys)
- **Objective**: Simulate full end-to-end user workflows from initial asset ingestion to remote publish readiness.
- **Rules**:
  - Mimic real Clash of Clans player/creator tasks (e.g. Town Hall 18 base screenshot watermarking, CWL note annotation).
  - Verify that the resulting repository state contains ONLY intended assets, updated metadata, valid CDN URLs, and clean Git commits.

### Tier 5: Adversarial Hardening (Milestone M6 Challenger Testing)
- **Objective**: White-box penetration testing, race-condition probing, and edge-case fuzzing conducted during Milestone M6 to discover latent bugs and harden boundaries before final release.

---

## 5. Test Harness Primitives & Contracts

### 5.1 Test Runner Core (`tests/harness/runner-core.mjs`)
- `describe(title, [options], fn)`: Declares a test suite with optional `{ milestone: 'M1', tier: 1 }`.
- `it(title, [options], fn)` / `test(title, [options], fn)`: Declares an async or sync test case.
- `it.skip(title, fn)` / `it.only(title, fn)`: Direct execution modifiers.
- Lifecycle hooks: `before(fn)`, `after(fn)`, `beforeEach(fn)`, `afterEach(fn)`.
- Direct execution support: When a test file is run directly via `node path/to/test.mjs`, runner-core auto-schedules execution and prints a standalone report.

### 5.2 Assertion Primitives (`tests/harness/assertions.mjs`)
- Re-exports standard Node `node:assert/strict` functions (`strictEqual`, `deepStrictEqual`, `ok`, `throws`, `rejects`, `match`).
- Fluent BDD matchers via `expect(actual)`:
  - `.toBe(expected)`, `.toEqual(expected)`, `.toBeTruthy()`, `.toBeFalsy()`, `.toBeNull()`, `.toBeUndefined()`, `.toBeDefined()`
  - `.toContain(item)`, `.toMatch(regex)`, `.toHaveLength(len)`
  - `.toBeGreaterThan(n)`, `.toBeLessThan(n)`, `.toBeGreaterThanOrEqual(n)`, `.toBeLessThanOrEqual(n)`
  - `.toThrow(expectedErrorOrRegex?)`
  - `.resolves` / `.rejects` for Promise assertions
  - `.toBeValidPng()`, `.toBeValidWebP()`
  - `.not` modifier for all matchers
- Domain-specific helpers:
  - `assertFileExists(path)`, `assertFileNotExists(path)`
  - `assertFileContains(path, pattern)`, `assertFileNotContains(path, pattern)`
  - `assertDirectoryExists(dir)`
  - `assertPngHeader(bufferOrPath)`: Verifies 8-byte PNG signature `89 50 4E 47 0D 0A 1A 0A`.
  - `assertWebpHeader(bufferOrPath)`: Verifies `RIFF` ... `WEBP` ... `VP8/VP8L/VP8X` chunks.
  - `assertWebpNaming(filename, expectedStem?)`: Verifies `<stem>_<6digits>.webp` naming formula.
  - `assertCdnUrl(url, { owner, repo, branch, path })`: Verifies GitHub raw CDN formula with normalized POSIX paths.
  - `assertGitBlocked(exitCode, output, expectedReason?)`: Verifies non-zero exit code and security block notice.
  - `assertNoSecrets(contentOrPath, customPatterns?)`: Scans text or file for active secret tokens (GitHub PAT, private keys, AWS tokens).

### 5.3 Git Sandbox Helper (`tests/harness/git-sandbox.mjs`)
- `GitSandbox.create(options)`: Creates isolated Git repository in `os.tmpdir()` (`coc-git-sandbox-<id>`).
- Client working tree in `client/` and bare remote in `origin.git/` acting as offline `origin/main`.
- Dual hook installation in `.githooks/` and `.git/hooks/` with LF line ending normalization and `0o755` permissions.
- Environment sanitization: Strips parent `GIT_*` environment variables before child process execution.
- Windows file lock resilience: Teardown retry loop handles momentary `EBUSY`/`EPERM` locks.
- `sandbox.runBatch(batName, args, options)`: Pipes newline stdin (`\n\n`) to prevent Windows `pause` prompts from hanging the test runner.
- Process exit hook: Automatically purges active sandboxes on process termination.

### 5.4 Fixture Generator (`tests/harness/fixtures.mjs`)
- `MINIMAL_PNG_BASE64` & `MINIMAL_PNG_BUFFER`: Valid 70-byte 1x1 sRGB PNG image.
- `MINIMAL_WEBP_BASE64` & `MINIMAL_WEBP_BUFFER`: Valid 34-byte 1x1 Lossless WebP image.
- `SECRETS`: Synthetic catalog of tokens (GitHub fine-grained PAT, classic PAT, RSA private keys, AWS keys, Slack tokens).
- `FORBIDDEN_FILES`: Standard sensitive filenames (`.env`, `.env.local`, `id_rsa`, `cert.pem`, etc.).
- `COC_CATEGORIES`: Standard 14 category directories matching repository layout.
- `createTempDir(prefix)` & `cleanupTempDir(dirPath)`: Managed temporary directory life cycle.
- `createDummyPng(optionsOrPath)` & `createDummyWebP(optionsOrPath)`: Generates valid, corrupt, or empty image files.
- `createMasqueradeFile(targetPath, text)`: Creates disguised executable/script payloads.
- `createSecretFile(targetDir, secretKey, filename)`: Writes secret tokens to simulated configuration files.
- `createSampleMetadata(overrides)`: Generates valid `assets-metadata.json` structure.

---

## 6. Execution Commands & Workflows

### Local Development:
```bash
# Run all available tests progressively (skips unbuilt milestones gracefully)
node tests/runner.mjs

# Run tests with standalone runner for specific file
node tests/harness/self-test.test.mjs

# Run a specific test tier
node tests/runner.mjs --tier 1
node tests/runner.mjs --tier 2
node tests/runner.mjs --tier 3
node tests/runner.mjs --tier 4

# Run tests for a specific implementation milestone
node tests/runner.mjs --milestone M1
node tests/runner.mjs --milestone M2
node tests/runner.mjs --milestone M3
node tests/runner.mjs --milestone M4
node tests/runner.mjs --milestone M5

# Run a specific test file
node tests/runner.mjs tests/harness/self-test.test.mjs

# Filter tests by title regex/substring
node tests/runner.mjs --grep "secret"

# Stop immediately on first test failure
node tests/runner.mjs --bail

# List discovered test suites without executing them
node tests/runner.mjs --list

# Disable terminal ANSI colors
node tests/runner.mjs --no-color
```

### Strict CI / Quality Gate Verification:
```bash
# Enforce that 100% of tests pass with 0 skips permitted
node tests/runner.mjs --strict
```

---

## 7. Quality Gates & Acceptance Matrix

| Gate | Scope | Required Pass Rate | Invalidation Conditions |
|---|---|---|---|
| **E1 Gate** | Test runner, assertions, fixtures, sandboxes, self-tests, `TEST_INFRA.md` | 100% harness self-tests pass | Any sandbox leak, Windows path failure, hanging batch script |
| **E2 Gate** | Tier 1 Feature Coverage (Features 1–19) | 100% of implemented features | Any feature regression, false pass on missing feature |
| **E3 Gate** | Tier 2 Boundaries & Corners | 100% boundary suites | Path traversal vulnerability, unhandled server crash |
| **E4 Gate** | Tier 3 Combinations, Tier 4 Workflows, `TEST_READY.md` | 100% strict full pass | Any broken user workflow, secret leakage during publish |
