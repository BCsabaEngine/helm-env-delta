# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

HelmEnvDelta (`helm-env-delta` or `hed`) is a CLI tool for environment-aware YAML delta and sync for GitOps workflows. Processes Helm values and YAML configs, allowing controlled sync between environments (UAT → Production) while respecting environment-specific differences and validation rules.

## Development Commands

```bash
npm run build         # Clean build
npm run dev           # Run with tsx and example config
npm test              # Run all tests (84%+ coverage)
npm run test:perf     # Performance benchmarks
npm run fix           # Format + lint + format
npm run all           # Fix + build + test

# CLI
helm-env-delta --config config.yaml [--validate] [--suggest] [--dry-run] [--force] [--diff] [--diff-html] [--diff-json] [--skip-format] [--list-files] [--show-config] [--no-color] [--verbose] [--quiet]
```

**Key Flags:** `--config` (required), `--suggest` (heuristic analysis and config suggestions), `--dry-run` (preview), `--force` (override stop rules), `--diff-html` (browser), `--diff-json` (pipe to jq), `--list-files` (preview files), `--show-config` (display resolved config), `--no-color` (disable colors), `--verbose`/`--quiet` (output control)

## Architecture

**Entry:** `bin/index.js` → `src/index.ts` (parseCommandLine → loadConfigFile → loadFiles → computeFileDiff → validateStopRules → updateFiles → reports)

**Core Modules:**

- `commandLine.ts` - CLI parsing (commander), help examples, flag validation
- `configFile.ts` - Zod validation (BaseConfig/FinalConfig)
- `configLoader.ts` / `configMerger.ts` - YAML loading, inheritance (max 5 levels)
- `configWarnings.ts` - Config validation warnings (inefficient globs, duplicates, conflicts, empty arrays)
- `fileLoader.ts` - Glob-based parallel loading (tinyglobby → Map)
- `fileDiff.ts` - YAML diff pipeline (parse → transforms → skipPath → normalize → deepEqual)
- `yamlFormatter.ts` - AST formatting (key order, quoting, array sort)
- `stopRulesValidator.ts` - Validation (semver, versionFormat, numeric, regex)
- `fileUpdater.ts` - Deep merge sync (preserves skipped paths)
- `suggestionEngine.ts` - **NEW v1.5+** - Heuristic config suggestions (analyzes diffs → suggests transforms/stop rules using pattern recognition)
- Reporters: `htmlReporter.ts`, `consoleDiffReporter.ts`, `jsonReporter.ts`
- Utils: `filenameTransformer.ts`, `collisionDetector.ts`, `versionChecker.ts`

**Config Schema:**

- Core: `source`, `destination` (required), `include`/`exclude`, `prune`
- Inheritance: Single parent via `extends`, max 5 levels, circular detection
- `skipPath`: JSONPath patterns per-file (glob patterns)
- `transforms`: **BREAKING v1.1+** - Object with `content`/`filename` arrays (regex find/replace, sequential)
  - **NEW v1.4+**: `contentFile`/`filenameFile` - Load transforms from external YAML files (single string or array)
  - File-based transforms: Literal string replacement (keys escaped for regex safety)
  - Execution order: File-based (literal) → Inline (regex)
- `stopRules`: semverMajorUpgrade, semverDowngrade, versionFormat (vPrefix modes), numeric (min/max), regex
  - **NEW v1.4+**: `regexFile` - Load patterns from YAML array file
  - **NEW v1.4+**: `regexFileKey` - Use transform file keys as patterns
  - **NEW v1.4+**: Optional `path` for regex rules - Omit for global value scanning
- `outputFormat`: indent, keySeparator, quoteValues, keyOrders, arraySort

**Dependencies:** commander, yaml, zod (v4+), picomatch, tinyglobby, diff, diff2html, chalk

## Code Style

- **Functions:** Const arrow only: `const fn = (params): Type => { ... };`
- **TypeScript:** ES2023, CommonJS, strict, rootDir: "./src"
- **ESLint:** unicorn/no-null, prevent-abbreviations, consistent-function-scoping, simple-import-sort
- **Prettier:** Single quotes, no trailing commas, 2 spaces, 120 chars
- **CI/CD:** Node 22.x/24.x, format → lint → build → test
- **Status:** 29 test files, 787 tests, 84%+ coverage, 45-60% faster (v1.3.3)

## Utilities (`src/utils/`)

Barrel exports via `index.ts`:

- `errors.ts` - createErrorClass, createErrorTypeGuard
- `fileType.ts` - isYamlFile()
- `diffGenerator.ts` - generateUnifiedDiff()
- `serialization.ts` - serializeForDiff, normalizeForComparison (YAML.stringify cache)
- `deepEqual.ts` - deepEqual (fast path for small objects)
- `jsonPath.ts` - parseJsonPath, getValueAtPath (memoization cache)
- `transformer.ts` - applyTransforms (regex on values, sequential)
- `patternMatcher.ts` - PatternMatcher, globalMatcher (picomatch cache)
- `versionChecker.ts` - checkForUpdates (npm registry, CI detection)
- **NEW v1.4+**:
  - `transformFileLoader.ts` - loadTransformFile, loadTransformFiles, escapeRegex (literal string replacements from YAML)
  - `regexPatternFileLoader.ts` - loadRegexPatternArray, loadRegexPatternsFromKeys (pattern loading for stop rules)

**Error Pattern:** All modules use `errors.ts` factory for custom error classes with type guards, error codes, hints.

## YAML Processing Pipeline

1. **File Loading** - tinyglobby + parallel → filename transforms → filtering (cached patterns) → Map
2. **Diff** - parse → content transforms → skipPath (early return) → normalize (cached stringify) → deepEqual (fast path)
3. **Stop Rules** - Validate JSONPath values (memoized, semver, versionFormat, numeric, regex), fail unless --force
4. **Update** - Deep merge → yamlFormatter (batched patterns) → write/dry-run
5. **Format** - Parse AST → apply rules → serialize

## Performance Optimizations (v1.3.3)

**45-60% improvement via:**

1. YAML.stringify caching - O(N²) → O(N) for array sorting
2. Picomatch pattern caching - globalMatcher shared across 6 modules
3. JSONPath memoization - cached parsing for repeated lookups
4. Batched pattern matching - yamlFormatter single pass vs 3 passes
5. Early returns - skip structuredClone, binary detection when unneeded
6. Fast paths - deepEqual optimized for small objects, empty arrays

## Filename Transforms

Transform source paths during sync. Full relative path (folders + filename).

```yaml
transforms:
  '**/*.yaml':
    content: [{ find: 'uat-cluster', replace: 'prod-cluster' }]
    filename: [{ find: 'envs/uat/', replace: 'envs/prod/' }]
# envs/uat/app-uat.yaml → envs/prod/app-prod.yaml
```

- Applies BEFORE include/exclude, uses regex with capture groups, sequential
- Content transforms ONLY YAML values (keys preserved)
- Errors: empty path, traversal, invalid chars, collisions

## Stop Rules

1. **semverMajorUpgrade** - Block major bumps (v1→v2)
2. **semverDowngrade** - Block any downgrade
3. **versionFormat** - Enforce `major.minor.patch`, vPrefix: required/allowed/forbidden
   - Rejects: incomplete, pre-release, build metadata, leading zeros
4. **numeric** - min/max constraints
5. **regex** - Block forbidden patterns (path optional: targeted or global)
6. **NEW v1.4+: regexFile** - Load patterns from YAML array file (path optional)
7. **NEW v1.4+: regexFileKey** - Use transform file keys as patterns (path optional)

**Path Modes (regex, regexFile, regexFileKey):**

- **With `path`**: Check specific JSONPath field (targeted mode)
- **Without `path`**: Recursively scan ALL values in file (global mode)

Example: Helm charts use `vPrefix: 'forbidden'` (1.2.3), Docker tags use `vPrefix: 'required'` (v1.2.3)

## External Files (v1.4+)

### Transform Files

Load literal string replacements from external YAML files:

```yaml
transforms:
  '**/*.yaml':
    contentFile: './transforms/common.yaml' # Single file
    # Or array: ['./common.yaml', './services.yaml']
    filenameFile: './transforms/paths.yaml'
```

**File Format:** Simple key:value pairs (Record<string, string>)

```yaml
staging: production
stg-db.internal: prod-db.internal
```

**Features:**

- Keys escaped for regex safety (literal matching, case-sensitive)
- Multiple files processed in order (last wins for duplicates)
- Applied BEFORE inline regex transforms
- Errors: file not found, parse error, invalid format (nested objects/arrays)

### Pattern Files for Stop Rules

**regexFile** - Array of regex patterns:

```yaml
# patterns/forbidden.yaml
- ^0\..* # Block 0.x versions
- .*-alpha.* # Block alphas
```

**regexFileKey** - Uses transform file keys as patterns:

```yaml
stopRules:
  '**/*.yaml':
    - type: regexFileKey
      path: service.name
      file: './transforms/common.yaml' # Keys become patterns
```

**File Format Validation:**

- regexFile MUST be YAML array (error if not)
- regexFileKey MUST be YAML object with keys (error if not)
- Invalid regex patterns cause immediate error

**Usage:**

- Files loaded on-demand during validation (not during config merge)
- Paths resolved relative to config file directory
- Empty files return empty array (no error)

## Testing

**Structure:** Vitest, describe/it, Arrange-Act-Assert

**29 test files, 787 tests:**

- Core: commandLine, configFile, configLoader, configMerger, configWarnings, fileLoader, fileDiff, fileUpdater, arrayDiffer, yamlFormatter, stopRulesValidator
- Reporters: consoleDiffReporter, jsonReporter, htmlReporter, consoleFormatter, logger
- Utils: errors, fileType, diffGenerator, serialization, deepEqual, jsonPath, transformer, filenameTransformer, collisionDetector, versionChecker, index
- Integration: index, ZodError

**Performance:** 8 benchmark files in `test/perf/` (fileDiff, deepEqual, fileLoader, yamlFormatter, transformer, serialization, stopRulesValidator, fileUpdater). Uses Vitest `bench()` API, 10x safety margin thresholds. Run: `npm run test:perf`

## Key Design Patterns

**Type Safety:** Zod schemas, BaseConfig (partial) → FinalConfig (strict), type inference

**Errors:** Factory pattern with codes, type guards, custom messages

**Data:** `Map<string, string>` for O(1) lookup, sorted keys

**Deep Merge:** Preserves destination structure, replaces arrays entirely, preserves skipped paths

## User Experience Features

**Discovery & Debugging:**

- `--list-files` - Preview source/destination files without processing diffs
- `--show-config` - Display resolved configuration after inheritance merging
- `--validate` - Enhanced with non-fatal warnings (inefficient globs, duplicates, conflicts, empty arrays)

**Safety:**

- Pre-execution summary (2s pause before sync, shows added/changed/deleted counts)
- First-run tips (shown once, saved to ~/.helm-env-delta/first-run)
- Improved error messages with examples and hints for common issues

**Output Control:**

- `--no-color` - Disable colored output for CI/accessibility
- Help text includes usage examples (4 common workflows)
- Commander suggestion for typos (e.g., --dryrun → --dry-run)

**Smart Suggestions (v1.5+) - Heuristic Operation:**

- `--suggest` - Uses heuristic analysis to examine diffs and recommend config updates
- Intelligently detects transform patterns using semantic matching (uat→prod, staging→production)
- Suggests stop rules based on pattern recognition (version bumps, numeric ranges)
- Provides confidence scores (0-100%) and occurrence counts for each suggestion
- Outputs copy-paste ready YAML configuration
- Smart noise filtering (ignores UUIDs, timestamps, single-char changes, version numbers)
- Use case: Bootstrap config from existing files, discover missing patterns through intelligent analysis
- **Note:** Suggestions are heuristic-based and should be reviewed before applying

## Key Notes

- Glob: tinyglobby (picomatch-based)
- JSONPath: Omit `$.` prefix in stop rules (use `'version'` not `'$.version'`)
- Async: Promise.all for parallel processing
- Version check: Auto-notify on every run (skips CI, 3s timeout)
