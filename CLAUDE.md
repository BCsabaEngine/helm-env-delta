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
npx vitest run test/pipeline/fileLoader.test.ts

# Run tests matching pattern
npx vitest run -t "skipExclude"

# CLI
helm-env-delta -c config.yaml [--validate] [--suggest] [-D|--dry-run] [--force] [-d|--diff] [-H|--diff-html] [-J|--diff-json] [-S|--skip-format] [--format-only] [-l|--list-files] [--show-config] [--no-color] [-f|--filter <string>] [-m|--mode <type>] [--verbose] [--quiet]
```

**Key Flags:** `-c, --config` (required), `--validate` (two-phase validation with unused pattern detection), `--suggest` (heuristic analysis), `--suggest-threshold` (min confidence 0-1), `-D, --dry-run` (preview), `--force` (override stop rules), `-H, --diff-html` (browser), `-J, --diff-json` (pipe to jq), `--format-only` (format destination files without syncing, source not required), `-l, --list-files` (preview files, takes precedence over --format-only), `--show-config` (display resolved config), `-f, --filter` (filter files by filename/content, supports `,` for OR, `+` for AND), `-m, --mode` (filter by change type: new/modified/deleted/all)

## Architecture

**Entry:** `bin/index.js` → `src/index.ts` (parseCommandLine → loadConfigFile → loadFiles → computeFileDiff → validateStopRules → updateFiles → reports)

**Folder Structure:**

```
src/
├── index.ts                  (orchestrator entry point)
├── commandLine.ts            (CLI parsing, standalone)
├── constants.ts              (cross-cutting)
├── logger.ts                 (cross-cutting)
├── consoleFormatter.ts       (cross-cutting)
├── suggestionEngine.ts       (large standalone module)
├── config/                   (config schema, loading, merging, warnings)
│   ├── index.ts              (barrel)
│   ├── configFile.ts
│   ├── configLoader.ts
│   ├── configMerger.ts
│   ├── configWarnings.ts
│   └── ZodError.ts
├── pipeline/                 (core data processing steps)
│   ├── index.ts              (barrel)
│   ├── fileLoader.ts
│   ├── fileDiff.ts
│   ├── fileUpdater.ts
│   ├── yamlFormatter.ts
│   ├── stopRulesValidator.ts
│   └── patternUsageValidator.ts
├── reporters/                (all output generation)
│   ├── index.ts              (barrel)
│   ├── htmlReporter.ts
│   ├── consoleDiffReporter.ts
│   ├── jsonReporter.ts
│   ├── arrayDiffer.ts
│   ├── htmlTemplate.ts
│   ├── htmlStyles.ts
│   ├── treeBuilder.ts
│   ├── treeRenderer.ts
│   └── browserLauncher.ts
└── utils/                    (shared utilities, barrel exports)
```

**Core Modules:**

- `config/configFile.ts` - Zod validation (BaseConfig/FinalConfig/FormatOnlyConfig), source==dest validation
- `config/configLoader.ts` / `config/configMerger.ts` - YAML loading, inheritance (max 5 levels)
- `config/configWarnings.ts` - Config validation warnings (inefficient globs, duplicates, conflicts)
- `pipeline/patternUsageValidator.ts` - Unused pattern detection (validates exclude, skipPath, stopRules, fixedValues match files)
- `pipeline/fileLoader.ts` - Glob-based parallel loading (tinyglobby → Map), supports `skipExclude` for validation
- `pipeline/fileDiff.ts` - YAML diff pipeline (parse → transforms → fixedValues → skipPath → normalize → deepEqual)
- `pipeline/yamlFormatter.ts` - AST formatting (key order, key sort, quoting, array sort, keySeparator with whitespace filtering)
- `pipeline/stopRulesValidator.ts` - Validation (semver, versionFormat, numeric, regex)
- `pipeline/fileUpdater.ts` - Deep merge sync (preserves skipped paths, skipPath-aware array merging)
- `reporters/arrayDiffer.ts` - Array diffing for reports (added/removed/unchanged items)
- `suggestionEngine.ts` - Heuristic config suggestions (analyzes diffs → suggests transforms/stop rules)
- Reporters: `reporters/htmlReporter.ts` (diff stats, copy diff, stop rule violations in dry-run), `reporters/consoleDiffReporter.ts`, `reporters/jsonReporter.ts`, `reporters/treeBuilder.ts`, `reporters/treeRenderer.ts` (sidebar tree), `reporters/htmlStyles.ts` (inlined diff2html CSS, styles, scripts, scroll sync), `reporters/htmlTemplate.ts` (DiffStats, HtmlStopRuleViolation, collapsible stats dashboard, collapsible violations table, sidebar search, collapse/expand, zero-count category hiding)
- Utils: `filenameTransformer.ts`, `collisionDetector.ts`, `versionChecker.ts`

**Config Schema:**

- Core: `source`, `destination` (required for sync, source optional for `--format-only`), `include`/`exclude`, `prune`, `confirmationDelay`, `requiredVersion`
- Validation: source and destination cannot resolve to the same path
- Inheritance: Single parent via `extends`, max 5 levels, circular detection
- `skipPath`: JSONPath patterns per-file (glob patterns), supports CSS-style filter expressions `[prop=value]`, `[prop^=prefix]`, `[prop$=suffix]`, `[prop*=substring]`
- `transforms`: Object with `content`/`filename` arrays (regex find/replace), `contentFile`/`filenameFile` for external files
- `stopRules`: semverMajorUpgrade, semverDowngrade, versionFormat, numeric, regex, regexFile, regexFileKey
- `fixedValues`: Set JSONPath locations to constant values (glob pattern → array of {path, value}), applied after merge
- `outputFormat`: indent, keySeparator, quoteValues, keyOrders, keySort, arraySort

**Config Inheritance Merging (`config/configMerger.ts`):**

1. Primitives (`source`, `destination`, `prune`, `confirmationDelay`, `requiredVersion`): Child overrides parent
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
- `fileFilter.ts` - parseFilterExpression, fileMatchesFilter, filterFileMap, filterFileMaps (logical operators for CLI filter)

**Error Pattern:** All modules use `errors.ts` factory for custom error classes with type guards, error codes, hints.

## YAML Processing Pipeline

1. **File Loading** - tinyglobby + parallel → filename transforms → filtering (cached patterns) → Map
2. **Diff** - parse → content transforms → **fixedValues** → skipPath (early return) → normalize (cached stringify) → deepEqual
3. **Stop Rules** - Validate JSONPath values (memoized, semver, versionFormat, numeric, regex), fail unless --force
4. **Update** - Deep merge → fixedValues (safety net) → yamlFormatter (batched patterns) → write/dry-run
5. **Format** - Parse AST → apply rules (keyOrders → keySort → arraySort → quoteValues → multiline → keySeparator) → serialize

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

**Report Visibility:** Violations appear in console, JSON, and HTML reports (HTML only in `--dry-run` mode, shown as collapsible table in header).

## Pattern Usage Validation

Validates that config patterns actually match files and JSONPaths exist. Triggered by `--validate` flag.

**Two-Phase Validation:**

1. **Phase 1 (Static)** - `config/configWarnings.ts` validates syntax, inefficient patterns, duplicates
2. **Phase 2 (File-Based)** - `pipeline/patternUsageValidator.ts` validates pattern usage against actual files

**What Gets Validated:** exclude patterns, skipPath patterns (glob + JSONPath), stopRules patterns (glob + path field), fixedValues patterns (glob + path field)

## CLI Filter Operators

The `-f/--filter` flag supports logical operators for complex filtering:

| Operator | Name   | Example           | Matches                                         |
| -------- | ------ | ----------------- | ----------------------------------------------- |
| (none)   | Simple | `-f prod`         | Files where filename or content contains "prod" |
| `,`      | OR     | `-f prod,staging` | Files matching "prod" OR "staging"              |
| `+`      | AND    | `-f values+prod`  | Files matching "values" AND "prod"              |

**Syntax:**

```bash
# OR: match ANY term (filename or content)
helm-env-delta -c config.yaml -f prod,staging --list-files

# AND: match ALL terms (can be split between filename and content)
helm-env-delta -c config.yaml -f values+prod --list-files

# Escape literal , or + with backslash
helm-env-delta -c config.yaml -f "foo\,bar" --list-files
```

**Constraints:**

- Cannot mix `+` and `,` in a single filter (throws `FilterParseError`)
- Case-insensitive matching
- Empty terms are ignored (`a,,b` becomes `a,b`)

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
