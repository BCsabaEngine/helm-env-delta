# CLAUDE.md

## Project Overview

HelmEnvDelta (`helm-env-delta` or `hed`) is a CLI tool for environment-aware YAML delta and sync for GitOps workflows. It processes Helm values files and other YAML configurations, allowing controlled synchronization between environments (e.g., UAT → Production) while respecting environment-specific differences and validation rules.

## Development Commands

```bash
# Building
npm run build         # Clean build
npm run dev           # Run with tsx and example config
npm run clean         # Clean build artifacts

# Testing (60% minimum coverage enforced)
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report

# Code Quality
npm run fix           # Format + lint + format
npm run all           # Fix + build + test

# Running CLI
helm-env-delta --config config.yaml [--dry-run] [--force] [--diff] [--diff-html] [--diff-json]
hed --config config.yaml  # Short alias
```

**CLI Flags:**

- `--config <path>` (required) - YAML config file path
- `--dry-run` - Preview without writing
- `--force` - Override stop rules
- `--diff` - Console diff output
- `--diff-html` - HTML diff report (opens in browser)
- `--diff-json` - JSON diff to stdout (pipe to jq)

## Architecture

**Entry Flow:** `bin/index.js` → `src/index.ts` (parseCommandLine → loadConfigFile → loadFiles → computeFileDiff → validateStopRules → updateFiles → generate reports)

**Core Modules:**

- `commandLine.ts` - CLI parsing (commander)
- `configFile.ts` - Zod validation (BaseConfig/FinalConfig schemas)
- `configMerger.ts` - Config inheritance (max 5 levels, circular detection)
- `configLoader.ts` - YAML loading with extends chain resolution
- `fileLoader.ts` - Glob-based file loading (tinyglobby, parallel, returns Map)
- `fileDiff.ts` - YAML diff (Pipeline: parse → transforms → skipPath → normalize → deep equal)
- `yamlFormatter.ts` - YAML AST formatting (key ordering, quoting, array sort, keySeparator)
- `stopRulesValidator.ts` - Validation (semver, numeric, regex)
- `fileUpdater.ts` - File sync (deep merge preserves skipped paths, dry-run support)
- `htmlReporter.ts` / `consoleDiffReporter.ts` / `jsonReporter.ts` - Diff output
- `consoleFormatter.ts` - Colorized terminal output
- `arrayDiffer.ts` - Array comparison utilities

**Configuration Schema:**

Core: `source`, `destination` (required), `include` (default: `['**/*']`), `exclude` (default: `[]`), `prune` (default: false)

Config Inheritance (`extends`):

- Single parent, max 5 levels, circular detection
- Base configs can be partial, child overrides parent
- Arrays concatenated, per-file rules merged

Processing:

- `skipPath` - JSONPath patterns to skip (per-file glob patterns)
- `transforms` - Regex find/replace on ALL string values (supports capture groups, sequential, per-file patterns)

Stop Rules: `semverMajorUpgrade`, `semverDowngrade`, `numeric` (min/max), `regex`

Output Format: `indent` (2), `keySeparator` (false), `quoteValues` (wildcards), `keyOrders`, `arraySort` (field + asc/desc)

**JSON Diff Output (`--diff-json`):**

Structure: `metadata` (timestamp, paths, dryRun, version), `summary` (counts), `files` (added/deleted/changed/formatted/unchanged), `stopRuleViolations`

Field-level detection with JSONPath (e.g., `$.image.tag`). Pipe to jq or save to file.

**Dependencies:** commander, yaml, zod (v4+), picomatch, tinyglobby, diff, diff2html, chalk, open

## Code Style

**Functions:** Const arrow functions only: `const fn = (params): Type => { ... };`

**Comments:** Shorter than code, no detailed examples, block separators only

**TypeScript:** ES2023, CommonJS, strict mode, rootDir: "./src"

**ESLint:**

- `unicorn/no-null` - use `undefined` not `null`
- `unicorn/no-useless-undefined` - avoid explicit undefined when default
- `unicorn/prevent-abbreviations` - descriptive names (error1, not e1)
- `unicorn/consistent-function-scoping` - move reusable functions to outer scope
- `simple-import-sort`, `curly: multi`

**Prettier:** Single quotes, no trailing commas, 2 spaces, 120 chars

**CI/CD:** Node 22.x/24.x, format → lint → build → test

**Status:** Core features complete (CLI, config loading/merging/validation, file sync, transforms, stop rules, diff reports, dry-run, force, prune). 16 test files, 60%+ coverage. TODO: coverage for fileLoader, htmlReporter, consoleDiffReporter.

## Utilities (`src/utils/`)

Barrel exports via `index.ts`:

- `errors.ts` - Error factory (createErrorClass, createErrorTypeGuard)
- `fileType.ts` - isYamlFile()
- `diffGenerator.ts` - generateUnifiedDiff()
- `serialization.ts` - serializeForDiff(), normalizeForComparison()
- `deepEqual.ts` - deepEqual() (normalize then compare)
- `jsonPath.ts` - parseJsonPath(), getValueAtPath() (wildcards, array indices)
- `transformer.ts` - applyTransforms() (regex on values only, preserves keys, sequential)

**Error Pattern:** All modules use factory from `errors.ts` (createErrorClass + createErrorTypeGuard). Custom error classes with type guards, consistent formatting, error codes (ENOENT, EACCES, etc.). Override constructor for hints.

## YAML Processing Pipeline

1. **File Loading** - tinyglobby + parallel load → Map<string, string>
2. **Diff Computation** - YAML.parse → transforms → skipPath → normalize → deep equal
3. **Stop Rules** - Validate JSONPath values (semver, numeric, regex), fails unless --force
4. **File Update** - Deep merge (preserves skipped paths) → yamlFormatter → write/dry-run
5. **YAML Formatting** - Parse to AST → apply (key ordering, quoting, array sort, keySeparator) → serialize

## Testing

**Structure:** Vitest, describe/it pattern, Arrange-Act-Assert

**Mocking:** vi.mock at top, vi.clearAllMocks in beforeEach, vi.restoreAllMocks in afterEach

**Guidelines:** Use undefined not null, descriptive names (error1 not e1), test happy + error paths, use type guards for error testing

## Key Notes

- Glob patterns: tinyglobby (picomatch-based)
- JSONPath: `$.path[*].field` syntax, **omit `$.` prefix in stop rules** (use `'version'` not `'$.version'`)
- File operations: async/await with Promise.all for parallel processing
- Deep merge: preserves destination values for paths not in source
- Utilities: barrel exports from `src/utils/index.ts`
