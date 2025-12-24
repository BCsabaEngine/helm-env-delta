# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HelmEnvDelta (`helm-env-delta` or `hed`) is a CLI tool for environment-aware YAML delta and sync for GitOps workflows. It processes Helm values files and other YAML configurations, allowing controlled synchronization between environments (e.g., UAT → Production) while respecting environment-specific differences and validation rules.

## Development Commands

```bash
# Building
npm run build         # Clean build
npm run dev           # Run with tsx and example config
npm run clean         # Clean build artifacts

# Testing (60% minimum coverage enforced, currently at 84%+)
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report

# Code Quality
npm run fix           # Format + lint + format
npm run all           # Fix + build + test

# Running CLI
helm-env-delta --config config.yaml [--validate] [--dry-run] [--force] [--diff] [--diff-html] [--diff-json] [--skip-format] [--verbose] [--quiet]
hed --config config.yaml  # Short alias
```

**CLI Flags:**

- `--config <path>` (required) - YAML config file path
- `--validate` - Validate configuration file and exit (skips file operations)
- `--dry-run` - Preview without writing
- `--force` - Override stop rules
- `--diff` - Console diff output
- `--diff-html` - HTML diff report (opens in browser)
- `--diff-json` - JSON diff to stdout (pipe to jq)
- `--skip-format` - Skip YAML formatting (outputFormat section)
- `--verbose` - Show detailed debug information (config loading, glob matching, transforms, etc.)
- `--quiet` - Suppress all output except critical errors and stop rule violations

**Note**: `--verbose` and `--quiet` are mutually exclusive. Machine-readable output (`--diff-json`) always outputs regardless of verbosity settings.

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
- `stopRulesValidator.ts` - Validation (semver, numeric, regex, versionFormat)
- `fileUpdater.ts` - File sync (deep merge preserves skipped paths, dry-run support)
- `htmlReporter.ts` / `consoleDiffReporter.ts` / `jsonReporter.ts` - Diff output
- `consoleFormatter.ts` - Colorized terminal output
- `arrayDiffer.ts` - Array comparison utilities
- `utils/filenameTransformer.ts` - Filename/path transformation (full path regex transforms)
- `utils/collisionDetector.ts` - Detects when multiple source files transform to same name
- `utils/versionChecker.ts` - Automatic update notifications from npm registry

**Configuration Schema:**

Core: `source`, `destination` (required), `include` (default: `['**/*']`), `exclude` (default: `[]`), `prune` (default: false)

Config Inheritance (`extends`):

- Single parent, max 5 levels, circular detection
- Base configs can be partial, child overrides parent
- Arrays concatenated, per-file rules merged

Processing:

- `skipPath` - JSONPath patterns to skip (per-file glob patterns)
- `transforms` - **NEW FORMAT (BREAKING)**: Object with `content` and/or `filename` arrays
  - `content`: Regex find/replace on YAML values (supports capture groups, sequential)
  - `filename`: Regex find/replace on file paths (full relative path including folders)
  - At least one of `content` or `filename` must be specified
  - Example: `'**/*.yaml': { content: [{find: 'uat-', replace: 'prod-'}], filename: [{find: '/uat/', replace: '/prod/'}] }`

Stop Rules: `semverMajorUpgrade`, `semverDowngrade`, `versionFormat` (vPrefix: required/allowed/forbidden), `numeric` (min/max), `regex`

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

**Status:** Core features complete (CLI, config loading/merging/validation, file sync, content+filename transforms, stop rules, diff reports, dry-run, force, prune, automatic update notifications). 28 test files with 761 tests, 84%+ coverage.

**BREAKING CHANGES:**

- Transform format changed from array to object: `transforms: {'*.yaml': [{find, replace}]}` → `transforms: {'*.yaml': {content: [...], filename: [...]}}`
- Old format no longer supported - users must migrate configs

## Utilities (`src/utils/`)

Barrel exports via `index.ts`:

- `errors.ts` - Error factory (createErrorClass, createErrorTypeGuard)
- `fileType.ts` - isYamlFile()
- `diffGenerator.ts` - generateUnifiedDiff()
- `serialization.ts` - serializeForDiff(), normalizeForComparison()
- `deepEqual.ts` - deepEqual() (normalize then compare)
- `jsonPath.ts` - parseJsonPath(), getValueAtPath() (wildcards, array indices)
- `transformer.ts` - applyTransforms() (regex on values only, preserves keys, sequential)
- `versionChecker.ts` - checkForUpdates() (npm registry check, CI detection, silent fail)

**Error Pattern:** All modules use factory from `errors.ts` (createErrorClass + createErrorTypeGuard). Custom error classes with type guards, consistent formatting, error codes (ENOENT, EACCES, etc.). Override constructor for hints.

## YAML Processing Pipeline

1. **File Loading** - tinyglobby + parallel load → filename transforms → include/exclude filtering → Map<string, string>
2. **Diff Computation** - YAML.parse → content transforms → skipPath → normalize → deep equal
3. **Stop Rules** - Validate JSONPath values (semver, versionFormat, numeric, regex), fails unless --force
4. **File Update** - Deep merge (preserves skipped paths) → yamlFormatter → write/dry-run
5. **YAML Formatting** - Parse to AST → apply (key ordering, quoting, array sort, keySeparator) → serialize

## Filename Transforms

**Purpose**: Transform source file paths to match destination file paths during sync.

**Scope**: Full relative path (folders + filename). Example: `envs/uat/app.yaml` → `envs/prod/app.yaml`

**Config Format**:

```yaml
transforms:
  '**/*.yaml':
    content: # Transforms YAML values (not keys)
      - find: 'uat-cluster'
        replace: 'prod-cluster'
    filename: # Transforms file paths
      - find: 'envs/uat/'
        replace: 'envs/prod/'
      - find: '-uat\.'
        replace: '-prod.'
# Result: envs/uat/app-uat.yaml → envs/prod/app-prod.yaml
```

**Behavior**:

- Filename transforms apply BEFORE include/exclude filtering
- Uses regex find/replace (supports capture groups like `$1`, `$2`)
- Sequential processing (rule N output → rule N+1 input)
- Content transforms apply ONLY to YAML values (keys preserved)
- Name collisions detected and reported as errors
- Transforms apply to source files only (destination files unchanged)

**Error Handling**:

- Empty transformed path → error
- Path traversal (`../`, leading `/`) → error
- Invalid characters (`<>:"|?*\x00-\x1F`) → error
- Name collisions (multiple sources → same name) → error with details

## Stop Rules Details

**Rule Types:**

1. **semverMajorUpgrade** - Blocks major version increases (e.g., `v1.2.3` → `v2.0.0`)
2. **semverDowngrade** - Blocks any version downgrade (major/minor/patch)
3. **versionFormat** - Enforces strict `major.minor.patch` format with configurable v-prefix
   - **vPrefix modes**:
     - `'required'` - Version MUST start with 'v' (accepts `v1.2.3`, rejects `1.2.3`)
     - `'allowed'` (default) - Version MAY start with 'v' (accepts both `v1.2.3` and `1.2.3`)
     - `'forbidden'` - Version MUST NOT start with 'v' (accepts `1.2.3`, rejects `v1.2.3`)
   - **Rejects**: Incomplete (`1.2`), pre-release (`1.2.3-rc`), build metadata (`1.2.3+build`), leading zeros (`01.2.3`)
   - **Validation target**: Only updated value (new value being introduced)
4. **numeric** - Validates numeric ranges with `min`/`max` constraints
5. **regex** - Blocks values matching forbidden patterns

**Config Example:**

```yaml
stopRules:
  'chart.yaml':
    - type: 'versionFormat'
      path: 'version'
      vPrefix: 'forbidden' # Helm chart versions: 1.2.3 (no v-prefix)

  'values.yaml':
    - type: 'versionFormat'
      path: 'image.tag'
      vPrefix: 'required' # Docker tags: v1.2.3 (with v-prefix)
```

## Testing

**Structure:** Vitest, describe/it pattern, Arrange-Act-Assert

**Mocking:** vi.mock at top, vi.clearAllMocks in beforeEach, vi.restoreAllMocks in afterEach

**Guidelines:** Use undefined not null, descriptive names (error1 not e1), test happy + error paths, use type guards for error testing

**Test Files (28 total, 761 tests):**

Core modules: `commandLine.test.ts`, `configFile.test.ts`, `configLoader.test.ts`, `configMerger.test.ts`, `fileLoader.test.ts`, `fileDiff.test.ts`, `fileUpdater.test.ts`, `arrayDiffer.test.ts`, `yamlFormatter.test.ts`, `stopRulesValidator.test.ts`

Reporters: `consoleDiffReporter.test.ts`, `jsonReporter.test.ts`, `htmlReporter.test.ts`, `consoleFormatter.test.ts`, `logger.test.ts`

Utils: `utils/errors.test.ts`, `utils/fileType.test.ts`, `utils/diffGenerator.test.ts`, `utils/serialization.test.ts`, `utils/deepEqual.test.ts`, `utils/jsonPath.test.ts`, `utils/transformer.test.ts`, `utils/filenameTransformer.test.ts`, `utils/collisionDetector.test.ts`, `utils/versionChecker.test.ts`, `utils/index.test.ts`

Integration: `index.test.ts`, `ZodError.test.ts`

**Recent Additions (chore/tests branch):** Added 6 new test files (`ZodError.test.ts`, `configFile.test.ts`, `consoleDiffReporter.test.ts`, `fileLoader.test.ts`, `index.test.ts`, `utils/index.test.ts`) bringing total coverage from 60%+ to 84%+

## Key Design Patterns

**Type Safety & Validation:**

- Zod schema-based validation for all configuration
- Two-stage validation: `BaseConfig` (partial, allows inheritance) → `FinalConfig` (strict)
- Custom error messages with hints
- Type inference: `type FinalConfig = z.infer<typeof finalConfigSchema>`

**Error Handling Strategy:**

```typescript
// Each module creates:
const ErrorClass = createErrorClass('Module Error', {
  CODE1: 'explanation',
  CODE2: 'explanation'
}, customFormatter?);

export class ModuleError extends ErrorClass {}
export const isModuleError = createErrorTypeGuard(ModuleError);
```

**File Maps as Core Data Structure:**

- `Map<string, string>` instead of arrays for O(1) lookup
- Sorted keys for deterministic ordering
- Easy source/destination correlation

**Deep Merge Strategy:**

- Deep merge preserves destination structure
- Arrays replaced entirely (not merged element-by-element)
- Preserves skipped paths that weren't in source

## Key Notes

- Glob patterns: tinyglobby (picomatch-based)
- JSONPath: `$.path[*].field` syntax, **omit `$.` prefix in stop rules** (use `'version'` not `'$.version'`)
- File operations: async/await with Promise.all for parallel processing
- Deep merge: preserves destination values for paths not in source
- Utilities: barrel exports from `src/utils/index.ts`
- Version check: Automatic update notifications on every run (skips in CI environments, silent fail on errors, 3-second timeout)
