# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HelmEnvDelta (`helm-env-delta`/`hed`) — CLI for environment-aware YAML delta and sync for GitOps. Syncs Helm values between environments (UAT → Prod) respecting env-specific differences and validation rules.

## Development Commands

```bash
npm run build         # Clean build (tsc --build --clean + tsc --build)
npm run clean         # Clean tsc build artifacts only
npm run dev           # Run with tsx and example config
npm test              # Run all tests
npm run test:perf     # Performance benchmarks
npm run test:all      # Run all tests + perf benchmarks
npm run fix           # Format + lint + format
npm run all           # Fix + build + test (pre-commit gate)
npm run lint:check    # ESLint only
npm run format:check  # Prettier only
npx vitest run test/pipeline/fileLoader.test.ts  # Single test file
npx vitest run -t "skipExclude"                  # Tests matching pattern
```

**CLI:** `helm-env-delta -c config.yaml [--validate] [--suggest] [--suggest-threshold 0-1] [-D|--dry-run] [--force] [-d|--diff] [-H|--diff-html] [-J|--diff-json] [-S|--skip-format] [--format-only] [-l|--list-files] [--show-config] [--no-color] [-f|--filter <string>] [-m|--mode <type>] [--verbose] [--quiet]`

## Architecture

**Entry:** `bin/index.js` → `src/index.ts` (orchestrator). Sequential pipeline:

```
parseCommandLine → loadConfigFile (with inheritance) → [early exits: --show-config, --validate, --format-only]
→ loadFiles (source + destination in parallel) → filterByCliOptions → computeFileDiff
→ validateStopRules (fail unless --force) → updateFiles (merge + format) → generateReports
```

**Source structure** (`src/`): `index.ts` (orchestrator), `commandLine.ts`, `constants.ts`, `logger.ts`, `consoleFormatter.ts`, `suggestionEngine.ts` (largest file — heuristic analyzer for `--suggest`), plus:

- `config/` — Zod schemas (BaseConfig → FinalConfig), config loading with inheritance (max 5 levels), merging, warnings
- `pipeline/` — fileLoader (glob→Map), fileDiff (structural YAML comparison), fileUpdater (deep merge), yamlFormatter (AST-based), stopRulesValidator, patternUsageValidator
- `reporters/` — HTML (self-contained standalone files with diff2html), console diff, JSON output, tree builder/renderer
- `utils/` — errors (factory pattern), jsonPath (CSS-style filters), transformer, patternMatcher (cached), arrayMerger (skipPath-aware), fixedValues, fileFilter, collisionDetector, versionChecker

**Dependencies:** commander, yaml, zod (v4+), picomatch, tinyglobby, diff, diff2html, chalk

## Code Style

- **Functions:** Const arrow only: `const fn = (params): Type => { ... };`
- **TypeScript:** ES2023, CommonJS, strict mode with `noUncheckedIndexedAccess`, rootDir: `./src`
- **ESLint:** Native flat config (v9), unicorn (all), simple-import-sort, `curly: ['error', 'multi']`
- **Prettier:** Single quotes, no trailing commas, 2 spaces, 120 chars
- **CI/CD:** Node 22.x/24.x matrix, format → lint → build → test

## Key Design Patterns

**Error factory** (`utils/errors.ts`): `createErrorClass('Module', { CODE: 'message' })` → typed error classes with string codes + `createErrorTypeGuard()` for discrimination. All error modules follow this pattern.

**Data flow:** `Map<string, string>` throughout (filename → YAML content). Sorted keys for deterministic output. JSONPath uses no `$.` prefix; CSS-style filters: `[prop=val]`, `[prop^=prefix]`, `[prop$=suffix]`, `[prop*=substr]`.

**Caching:** patternMatcher (global glob cache), serialization (normalized YAML strings), stop rule memoization (version comparisons).

**Config inheritance:** Single parent via `extends`, max 5 levels, circular detection. Merging: primitives override, arrays concatenate, per-file records merge keys + concat arrays, outputFormat shallow merges.

## YAML Processing Pipeline

1. **Load** — tinyglobby + Promise.all → filename transforms → collision detection → filtering → Map
2. **Diff** — parse → content transforms → fixedValues → skipPath (early return) → normalize → deepEqual
3. **Stop Rules** — Validate JSONPath values (semver, versionFormat, numeric, regex), fail unless --force
4. **Update** — Deep merge → fixedValues (safety net) → yamlFormatter (AST, batched patterns) → write/dry-run
5. **Format** — Parse AST → keyOrders → keySort → arraySort → quoteValues → multiline → keySeparator → serialize

## Testing

Vitest, describe/it, Arrange-Act-Assert. 42 test files, 1400+ tests (use `test:all` to run both). 8 perf benchmark files using `bench()` API. Coverage thresholds: lines 80%, functions 95%, branches 75%. Barrel exports and `src/index.ts` excluded from coverage.

## Config Schema

- **Core:** `source`, `destination` (required for sync; source optional for `--format-only`), `include`/`exclude`, `prune`, `confirmationDelay`, `requiredVersion`
- **skipPath:** JSONPath patterns per-file glob with CSS-style filters. Example: `env[name^=DB_]`, `containers[name=sidecar].resources`
- **transforms:** `content`/`filename` arrays (regex find/replace), `contentFile`/`filenameFile` for external files
- **stopRules:** semverMajorUpgrade, semverDowngrade, versionFormat, numeric, regex, regexFile, regexFileKey. With `path`: checks specific JSONPath. Without: scans ALL values
- **fixedValues:** glob → array of `{path, value}`. All filter operators supported. Last rule wins for same path
- **outputFormat:** indent, keySeparator, quoteValues, keyOrders, keySort, arraySort. `arraySort` rules: `path` (required), `sortBy` (optional — omit for scalar/keyless arrays, required for object arrays), `order` (asc/desc)

## CLI Filter (`-f/--filter`)

Simple: `-f prod`. OR (`,`): `-f prod,staging`. AND (`+`): `-f values+prod`. Cannot mix `+` and `,`. Case-insensitive.

## Pattern Usage Validation (`--validate`)

Two-phase: (1) Static — syntax, inefficient patterns, duplicates (configWarnings.ts). (2) File-based — validates patterns match actual files and JSONPaths exist (patternUsageValidator.ts). Validates: exclude, skipPath, stopRules, fixedValues patterns.
