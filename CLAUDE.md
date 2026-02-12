# CLAUDE.md

## Project Overview

HelmEnvDelta (`helm-env-delta`/`hed`) - CLI for environment-aware YAML delta and sync for GitOps. Syncs Helm values between environments (UAT → Prod) respecting env-specific differences and validation rules.

## Development Commands

```bash
npm run build         # Clean build
npm run dev           # Run with tsx and example config
npm test              # Run all tests (84%+ coverage)
npm run test:perf     # Performance benchmarks
npm run fix           # Format + lint + format
npm run all           # Fix + build + test
npx vitest run test/pipeline/fileLoader.test.ts  # Single test file
npx vitest run -t "skipExclude"                  # Tests matching pattern
```

**CLI:** `helm-env-delta -c config.yaml [--validate] [--suggest] [--suggest-threshold 0-1] [-D|--dry-run] [--force] [-d|--diff] [-H|--diff-html] [-J|--diff-json] [-S|--skip-format] [--format-only] [-l|--list-files] [--show-config] [--no-color] [-f|--filter <string>] [-m|--mode <type>] [--verbose] [--quiet]`

## Architecture

**Entry:** `bin/index.js` → `src/index.ts` (parseCommandLine → loadConfigFile → loadFiles → computeFileDiff → validateStopRules → updateFiles → reports)

**Structure:** `src/` contains `index.ts` (orchestrator), `commandLine.ts`, `constants.ts`, `logger.ts`, `consoleFormatter.ts`, `suggestionEngine.ts`, plus four subdirectories:

- `config/` - configFile.ts (Zod schemas: BaseConfig/FinalConfig/FormatOnlyConfig), configLoader.ts, configMerger.ts (inheritance max 5 levels), configWarnings.ts, ZodError.ts
- `pipeline/` - fileLoader.ts (glob→Map), fileDiff.ts (parse→transforms→fixedValues→skipPath→normalize→deepEqual), fileUpdater.ts (deep merge), yamlFormatter.ts (AST formatting), stopRulesValidator.ts, patternUsageValidator.ts
- `reporters/` - htmlReporter.ts, consoleDiffReporter.ts, jsonReporter.ts, arrayDiffer.ts, htmlTemplate.ts, htmlStyles.ts, treeBuilder.ts, treeRenderer.ts, browserLauncher.ts
- `utils/` - errors.ts, fileType.ts, diffGenerator.ts, serialization.ts, deepEqual.ts, jsonPath.ts, transformer.ts, patternMatcher.ts, versionChecker.ts, transformFileLoader.ts, regexPatternFileLoader.ts, fixedValues.ts, arrayMerger.ts, fileFilter.ts

**Dependencies:** commander, yaml, zod (v4+), picomatch, tinyglobby, diff, diff2html, chalk

## Code Style

- **Functions:** Const arrow only: `const fn = (params): Type => { ... };` (single-line implicit return, multi-statement explicit braces)
- **TypeScript:** ES2023, CommonJS, strict, rootDir: "./src"
- **ESLint:** unicorn/no-null, prevent-abbreviations, consistent-function-scoping, simple-import-sort
- **Prettier:** Single quotes, no trailing commas, 2 spaces, 120 chars
- **CI/CD:** Node 22.x/24.x, format → lint → build → test

## YAML Processing Pipeline

1. **File Loading** - tinyglobby + parallel → filename transforms → filtering (cached patterns) → Map
2. **Diff** - parse → content transforms → fixedValues → skipPath (early return) → normalize (cached stringify) → deepEqual
3. **Stop Rules** - Validate JSONPath values (memoized, semver, versionFormat, numeric, regex), fail unless --force
4. **Update** - Deep merge → fixedValues (safety net) → yamlFormatter (batched patterns) → write/dry-run
5. **Format** - Parse AST → apply rules (keyOrders → keySort → arraySort → quoteValues → multiline → keySeparator) → serialize

## Config Schema

- **Core:** `source`, `destination` (required for sync; source optional for `--format-only`), `include`/`exclude`, `prune`, `confirmationDelay`, `requiredVersion`
- **Validation:** source and destination cannot resolve to same path
- **Inheritance:** Single parent via `extends`, max 5 levels, circular detection
- **skipPath:** JSONPath patterns per-file glob. CSS-style filters: `[prop=val]`, `[prop^=prefix]`, `[prop$=suffix]`, `[prop*=substr]`. Example: `env[name^=DB_]`, `containers[name=sidecar].resources`
- **transforms:** `content`/`filename` arrays (regex find/replace), `contentFile`/`filenameFile` for external files
- **stopRules:** semverMajorUpgrade, semverDowngrade, versionFormat, numeric, regex, regexFile, regexFileKey. With `path`: checks specific JSONPath. Without: scans ALL values
- **fixedValues:** glob → array of `{path, value}`. All filter operators supported. Updates ALL matching items. Applied after merge, before formatting. Last rule wins for same path
- **outputFormat:** indent, keySeparator, quoteValues, keyOrders, keySort, arraySort

**Inheritance Merging:** Primitives: child overrides. Arrays (include/exclude): concatenate. Per-file records (skipPath/transforms/stopRules/fixedValues): merge keys, concat arrays. outputFormat: shallow merge. `extends` removed from result.

## CLI Filter (`-f/--filter`)

Simple: `-f prod`. OR (`,`): `-f prod,staging`. AND (`+`): `-f values+prod`. Cannot mix `+` and `,`. Case-insensitive. Escape literal `,`/`+` with backslash.

## Pattern Usage Validation (`--validate`)

Two-phase: (1) Static - syntax, inefficient patterns, duplicates (configWarnings.ts). (2) File-based - validates patterns match actual files and JSONPaths exist (patternUsageValidator.ts). Validates: exclude, skipPath, stopRules, fixedValues patterns.

## Testing

Vitest, describe/it, Arrange-Act-Assert. 35 test files, 1150+ tests. Performance: 8 benchmark files using `bench()` API.

## Key Design Patterns

- **Type Safety:** Zod schemas, BaseConfig (partial) → FinalConfig (strict)
- **Errors:** Factory pattern (`errors.ts`) with codes, type guards, hints
- **Data:** `Map<string, string>` for O(1) lookup, sorted keys
- **Deep Merge:** Preserves destination structure, skipPath-aware array merging, preserves skipped paths
- **Glob:** tinyglobby (picomatch-based). **JSONPath:** Omit `$.` prefix. **Async:** Promise.all for parallel. **Version check:** Auto-notify (skips CI, 3s timeout)
