# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

# Run single test file
npx vitest run test/fileLoader.test.ts

# Run tests matching pattern
npx vitest run -t "skipExclude"

# CLI
helm-env-delta --config config.yaml [--validate] [--suggest] [--dry-run] [--force] [--diff] [--diff-html] [--diff-json] [--skip-format] [--format-only] [--list-files] [--show-config] [--no-color] [--verbose] [--quiet]
```

**Key Flags:** `--config` (required), `--validate` (two-phase validation with unused pattern detection), `--suggest` (heuristic analysis), `--suggest-threshold` (min confidence 0-1), `--dry-run` (preview), `--force` (override stop rules), `--diff-html` (browser), `--diff-json` (pipe to jq), `--format-only` (format destination files without syncing, source not required), `--list-files` (preview files), `--show-config` (display resolved config)

## Architecture

**Entry:** `bin/index.js` → `src/index.ts` (parseCommandLine → loadConfigFile → loadFiles → computeFileDiff → validateStopRules → updateFiles → reports)

**Core Modules:**

- `commandLine.ts` - CLI parsing (commander), help examples, flag validation
- `configFile.ts` - Zod validation (BaseConfig/FinalConfig/FormatOnlyConfig), source==dest validation
- `configLoader.ts` / `configMerger.ts` - YAML loading, inheritance (max 5 levels)
- `configWarnings.ts` - Config validation warnings (inefficient globs, duplicates, conflicts)
- `patternUsageValidator.ts` - Unused pattern detection (validates exclude, skipPath, stopRules, fixedValues match files)
- `fileLoader.ts` - Glob-based parallel loading (tinyglobby → Map), supports `skipExclude` for validation
- `fileDiff.ts` - YAML diff pipeline (parse → transforms → fixedValues → skipPath → normalize → deepEqual)
- `yamlFormatter.ts` - AST formatting (key order, quoting, array sort, keySeparator with whitespace filtering)
- `stopRulesValidator.ts` - Validation (semver, versionFormat, numeric, regex)
- `fileUpdater.ts` - Deep merge sync (preserves skipped paths, skipPath-aware array merging)
- `arrayDiffer.ts` - Array diffing for reports (added/removed/unchanged items)
- `suggestionEngine.ts` - Heuristic config suggestions (analyzes diffs → suggests transforms/stop rules)
- Reporters: `htmlReporter.ts`, `consoleDiffReporter.ts`, `jsonReporter.ts`, `treeBuilder.ts`, `treeRenderer.ts`
- Utils: `filenameTransformer.ts`, `collisionDetector.ts`, `versionChecker.ts`

**Config Schema:**

- Core: `source`, `destination` (required for sync, source optional for `--format-only`), `include`/`exclude`, `prune`, `confirmationDelay`
- Validation: source and destination cannot resolve to the same path
- Inheritance: Single parent via `extends`, max 5 levels, circular detection
- `skipPath`: JSONPath patterns per-file (glob patterns), supports CSS-style filter expressions `[prop=value]`, `[prop^=prefix]`, `[prop$=suffix]`, `[prop*=substring]`
- `transforms`: Object with `content`/`filename` arrays (regex find/replace), `contentFile`/`filenameFile` for external files
- `stopRules`: semverMajorUpgrade, semverDowngrade, versionFormat, numeric, regex, regexFile, regexFileKey
- `fixedValues`: Set JSONPath locations to constant values (glob pattern → array of {path, value}), applied after merge
- `outputFormat`: indent, keySeparator, quoteValues, keyOrders, arraySort

**Config Inheritance Merging (`configMerger.ts`):**

1. Primitives (`source`, `destination`, `prune`, `confirmationDelay`): Child overrides parent
2. Arrays (`include`, `exclude`): Concatenate `[...parent, ...child]`
3. Per-file Records (`skipPath`, `transforms`, `stopRules`, `fixedValues`): Merge keys, concatenate arrays per key
4. `outputFormat`: Shallow merge (child fields override parent fields)
5. `extends` field removed from merged result

**Dependencies:** commander, yaml, zod (v4+), picomatch, tinyglobby, diff, diff2html, chalk

## Code Style

- **Functions:** Const arrow only: `const fn = (params): Type => { ... };`
  - Single-line returns use implicit return: `const fn = (): Type => expression;`
  - Multi-statement functions use explicit braces
- **TypeScript:** ES2023, CommonJS, strict, rootDir: "./src"
- **ESLint:** unicorn/no-null, prevent-abbreviations, consistent-function-scoping, simple-import-sort
- **Prettier:** Single quotes, no trailing commas, 2 spaces, 120 chars
- **CI/CD:** Node 22.x/24.x, format → lint → build → test

## Utilities (`src/utils/`)

Barrel exports via `index.ts`:

- `errors.ts` - createErrorClass, createErrorTypeGuard
- `fileType.ts` - isYamlFile()
- `diffGenerator.ts` - generateUnifiedDiff()
- `serialization.ts` - serializeForDiff, normalizeForComparison (YAML.stringify cache)
- `deepEqual.ts` - deepEqual (fast path for small objects)
- `jsonPath.ts` - parseJsonPath, getValueAtPath, isFilterSegment, parseFilterSegment, matchesFilter (memoization, CSS-style operators)
- `transformer.ts` - applyTransforms (regex on values, sequential)
- `patternMatcher.ts` - PatternMatcher, globalMatcher (picomatch cache)
- `versionChecker.ts` - checkForUpdates (npm registry, CI detection)
- `transformFileLoader.ts` - loadTransformFile, loadTransformFiles, escapeRegex
- `regexPatternFileLoader.ts` - loadRegexPatternArray, loadRegexPatternsFromKeys
- `fixedValues.ts` - getFixedValuesForFile, applyFixedValues, setValueAtPath (constant value injection)
- `arrayMerger.ts` - getApplicableArrayFilters, mergeArraysWithFilters (skipPath-aware array merging)

**Error Pattern:** All modules use `errors.ts` factory for custom error classes with type guards, error codes, hints.

## YAML Processing Pipeline

1. **File Loading** - tinyglobby + parallel → filename transforms → filtering (cached patterns) → Map
2. **Diff** - parse → content transforms → **fixedValues** → skipPath (early return) → normalize (cached stringify) → deepEqual
3. **Stop Rules** - Validate JSONPath values (memoized, semver, versionFormat, numeric, regex), fail unless --force
4. **Update** - Deep merge → fixedValues (safety net) → yamlFormatter (batched patterns) → write/dry-run
5. **Format** - Parse AST → apply rules → serialize

## SkipPath Filter Expressions

Skip specific array items by property value using CSS-style filter operators:

| Operator | Name       | Example          | Matches                   |
| -------- | ---------- | ---------------- | ------------------------- |
| `=`      | equals     | `[name=DEBUG]`   | Exact match               |
| `^=`     | startsWith | `[name^=DB_]`    | `DB_HOST`, `DB_PORT`      |
| `$=`     | endsWith   | `[name$=_KEY]`   | `API_KEY`, `SECRET_KEY`   |
| `*=`     | contains   | `[name*=SECRET]` | `MY_SECRET_KEY`, `SECRET` |

```yaml
skipPath:
  '**/*.yaml':
    # Equals (=) - exact match
    - 'env[name=SECRET_KEY]' # Skip array item where name=SECRET_KEY
    - 'containers[name=sidecar].resources' # Skip nested field in matching item

    # StartsWith (^=) - prefix match
    - 'env[name^=DB_]' # Skip DB_HOST, DB_PORT, DB_USER
    - 'containers[name^=init-].resources' # Skip init-db, init-cache resources

    # EndsWith ($=) - suffix match
    - 'env[name$=_SECRET]' # Skip API_SECRET, DB_SECRET
    - 'volumes[name$=-data]' # Skip app-data, cache-data

    # Contains (*=) - substring match
    - 'env[name*=PASSWORD]' # Skip DB_PASSWORD, PASSWORD_HASH
    - 'containers[image*=nginx]' # Skip any nginx image

    # Nested paths with operators
    - 'spec.containers[name^=sidecar-].env[name$=_KEY]'
```

**Syntax:** `array[prop<op>value]` where `<op>` is `=`, `^=`, `$=`, or `*=`. Supports quoted values for spaces.

## Fixed Values

Set specific JSONPath locations to constant values, regardless of source/destination values. Applied after merge, before formatting.

```yaml
fixedValues:
  '**/*.yaml':
    - path: 'env[name=LOG_LEVEL].value'
      value: 'info'
    - path: 'spec.replicas'
      value: 3
  'values-prod.yaml':
    - path: 'debug'
      value: false
```

**Supports all filter operators:** `=`, `^=`, `$=`, `*=` (updates ALL matching items)

**Value types:** string, number, boolean, null, object, array

**Behavior:**

- Filter operators update ALL matching items (not just the first)
- Non-existent paths silently skipped
- Multiple rules for same path: last one wins
- Changes visible in all diff reports (HTML, console, JSON)
- Works with skipPath (fixedValues wins, applied after skipPath restored)

## Stop Rules

1. **semverMajorUpgrade** - Block major bumps (v1→v2)
2. **semverDowngrade** - Block any downgrade
3. **versionFormat** - Enforce `major.minor.patch`, vPrefix: required/allowed/forbidden
4. **numeric** - min/max constraints
5. **regex** - Block forbidden patterns (path optional: targeted or global)
6. **regexFile** - Load patterns from YAML array file
7. **regexFileKey** - Use transform file keys as patterns

**Path Modes:** With `path` checks specific JSONPath field. Without `path` recursively scans ALL values.

## Pattern Usage Validation

Validates that config patterns actually match files and JSONPaths exist. Triggered by `--validate` flag.

**Two-Phase Validation:**

1. **Phase 1 (Static)** - `configWarnings.ts` validates syntax, inefficient patterns, duplicates
2. **Phase 2 (File-Based)** - `patternUsageValidator.ts` validates pattern usage against actual files

**What Gets Validated:** exclude patterns, skipPath patterns (glob + JSONPath), stopRules patterns (glob + path field), fixedValues patterns (glob + path field)

## Testing

**Structure:** Vitest, describe/it, Arrange-Act-Assert

**35 test files, 1150+ tests:** Core modules, reporters, utils, integration tests

**Performance:** 8 benchmark files in `test/perf/`. Uses Vitest `bench()` API. Run: `npm run test:perf`

## Key Design Patterns

**Type Safety:** Zod schemas, BaseConfig (partial) → FinalConfig (strict), type inference

**Errors:** Factory pattern with codes, type guards, custom messages

**Data:** `Map<string, string>` for O(1) lookup, sorted keys

**Deep Merge:** Preserves destination structure, skipPath-aware array merging (preserves items matching filters), preserves skipped paths

## Key Notes

- Glob: tinyglobby (picomatch-based)
- JSONPath: Omit `$.` prefix in stop rules (use `'version'` not `'$.version'`)
- Async: Promise.all for parallel processing
- Version check: Auto-notify on every run (skips CI, 3s timeout)
