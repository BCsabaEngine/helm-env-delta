# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HelmEnvDelta (`helm-env-delta` or `hed`) is a CLI tool for environment-aware YAML delta and sync for GitOps workflows. It processes Helm values files and other YAML configurations, allowing controlled synchronization between environments (e.g., UAT → Production) while respecting environment-specific differences and validation rules.

## Development Commands

### Building and Development

```bash
npm run build          # Clean build (tsc --build --clean && tsc --build --force)
npm run dev            # Run sync with tsx and example config
npm run dev:init       # Run init command with tsx
npm run dev:clear      # Clear example/prod directory
npm run dev:watch      # Watch mode with nodemon
npm run clean          # Clean TypeScript build artifacts
```

### Testing

```bash
npm test                              # Run all tests once (vitest run)
npm run test:watch                    # Run tests in watch mode
npm run test:coverage                 # Generate coverage report (60% minimum threshold)
npx vitest run test/initCommand.test.ts  # Run a single test file
```

Tests should be placed in `test/**/*.test.ts` directory.

### Code Quality

```bash
npm run format:check   # Check formatting with Prettier
npm run format:fix     # Auto-fix formatting issues
npm run lint:check     # Run ESLint checks
npm run lint:fix       # Auto-fix linting issues
npm run fix            # Run format + lint + format in sequence
npm run all            # Run fix + build + test
```

### Running the CLI

After building, two bin aliases are available:

```bash
helm-env-delta sync --config config.yaml   # Main CLI command
hed sync --config config.yaml              # Short alias
```

During development: `node bin/index.js sync --config ./example/config.example.yaml`

**CLI Commands:**

- `init [path]` - Generate a config.yaml template with all features (default path: ./config.yaml)
- `sync` - Sync files from source to destination with YAML processing

**Sync Command Flags:**

- `--config <path>` (required) - Path to YAML configuration file
- `--dry-run` - Preview changes without writing files
- `--force` - Override stop rules and proceed with changes
- `--show-diff` - Display console diff for changed files
- `--show-diff-html` - Generate and open HTML diff report in browser

**Important:** You must specify either `init` or `sync` command. The `--config` option is required for sync command.

**Examples:**

```bash
# Generate a new config file
helm-env-delta init
helm-env-delta init my-config.yaml

# Sync files
helm-env-delta sync --config config.yaml

# Dry run with diff
helm-env-delta sync --config config.yaml --dry-run --show-diff
```

## Architecture

### Entry Point Flow

1. `bin/index.js` - Shebang entry point that requires `dist/index.js`
2. `src/index.ts` - Main application entry:
   - Displays app header with version from package.json
   - Parses CLI arguments using parseCommandLine()
   - Routes to init command (executeInit) or sync command:
     - **Init command**: Generates config.yaml template and exits
     - **Sync command**: Continues with sync workflow
   - Loads and validates YAML config using loadConfigFile()
   - Loads source and destination files using loadFiles()
   - Computes file differences using computeFileDiff()
   - Validates stop rules using validateStopRules()
   - Updates files using updateFiles()
   - Generates HTML report if requested using generateHtmlReport()
   - Error handling for all custom error types

### Core Modules

- `src/commandLine.ts` - CLI argument parsing with `commander`
  - Supports two subcommands: `init` and `sync` (both required)
  - Discriminated union types for type-safe command routing
  - Validates required `--config` option for sync command
  - Supports `--dry-run`, `--force`, `--show-diff`, `--show-diff-html` flags

- `src/initCommand.ts` - Init command for generating config templates
  - CONFIG_TEMPLATE with full-featured example config
  - executeInit() function to create config files
  - InitError custom error class with helpful messages
  - File exists validation to prevent overwrites

- `src/configFile.ts` - Config validation with Zod schemas
  - Discriminated union for stop rules (semverMajor, numeric, regex)
  - User-friendly error messages via `ConfigValidationError`
  - Type-safe config with full TypeScript inference

- `src/configLoader.ts` - Config file loading and parsing
  - Reads YAML config file from disk
  - Parses YAML content
  - Validates config using parseConfig from configFile.ts
  - Custom `ConfigLoaderError` with detailed error messages

- `src/fileLoader.ts` - File loading with glob pattern matching
  - Uses `tinyglobby` for fast file discovery
  - Loads files in parallel for performance
  - Returns `Map<string, string>` with sorted relative paths as keys
  - Binary file detection (throws error on null bytes)
  - Custom `FileLoaderError` with detailed error messages

- `src/ZodError.ts` - Custom error formatting for Zod validation failures
  - Formats validation errors into readable messages
  - Adds contextual help for common error types
  - Exported as `ZodValidationError` with type guard `isZodValidationError`

- `src/fileDiff.ts` - YAML diff computation and comparison
  - Detects added, deleted, changed, and unchanged files
  - Parses YAML files and applies skipPath filters
  - Normalizes data structures for deep equality comparison
  - Returns `FileDiffResult` with categorized file changes

- `src/yamlFormatter.ts` - YAML output formatting
  - Applies custom key ordering (per-file patterns with JSONPath)
  - Handles value quoting for specific paths
  - Supports array sorting by field with asc/desc order
  - Applies keySeparator to add blank lines between top-level keys
  - Custom `YamlFormatterError` for formatting failures

- `src/stopRulesValidator.ts` - Validation rules enforcement
  - Validates changed files against configured stop rules
  - Supports semverMajorUpgrade, semverDowngrade, numeric (min/max), regex patterns
  - Returns `ValidationResult` with violations list
  - Custom `StopRulesValidatorError` for validation failures

- `src/fileUpdater.ts` - File writing and synchronization
  - Writes new files, updates changed files, deletes pruned files
  - Deep merges YAML content (preserves unfiltered destination values)
  - Formats unchanged YAML files if output formatting differs
  - Supports dry-run mode (no actual file operations)
  - Custom `FileUpdaterError` for file operation failures

- `src/htmlReporter.ts` - HTML diff report generation
  - Generates visual diff reports using diff2html
  - Opens report in browser automatically
  - Includes formatted file changes in report
  - Uses shared utilities: `isYamlFile`, `generateUnifiedDiff`, `deepEqual`, `serializeForDiff`

- `src/consoleDiffReporter.ts` - Console diff output
  - Displays file diffs in terminal with colors
  - Shows added/deleted/changed file summaries
  - Uses shared utilities: `isYamlFile`, `generateUnifiedDiff`, `deepEqual`, `serializeForDiff`

- `src/consoleFormatter.ts` - Console output formatting
  - Colorizes messages (chalk) for different operation types
  - Formats stop rule violations, progress messages, file operations

- `src/arrayDiffer.ts` - Array diffing utilities
  - `diffArrays(source, dest)` - Compares arrays and returns removed/added/unchanged items
  - `hasArrays(obj)` - Recursively checks if object contains arrays
  - `findArrayPaths(obj)` - Finds all JSON paths containing arrays

### Configuration Schema

The tool uses a YAML configuration file (see `example/config.example.yaml`) with the following features:

**Core Settings:**

- `source` / `destination` - Source and destination folder paths (mandatory)
- `include` - Glob patterns for files to process (defaults to `['**/*']` - all files)
- `exclude` - Glob patterns for files to exclude from processing (defaults to `[]`)
- `prune` - Remove files in destination not present in source (default: false)

**Processing Control:**

- `skipPath` - JSON/YAML paths to skip during processing (per-file patterns)
- `transforms` - Find/replace transformations for specific paths (future feature)

**Validation Rules:**

- `stopRules` - Block operations based on:
  - `semverMajorUpgrade` - Prevent major version upgrades
  - `semverDowngrade` - Prevent major version downgrades
  - `numeric` - Validate numeric ranges (min/max)
  - `regex` - Pattern matching validation (blocks if value matches regex)

**Output Formatting:**

- `outputFormat.indent` - YAML indentation (default: 2)
- `outputFormat.keySeparator` - Add blank line between top-level keys (default: false)
- `outputFormat.quoteValues` - Quote values for specific keys on right side of `:` (per-file patterns, supports wildcards)
- `outputFormat.keyOrders` - Custom key ordering for output YAML files (per-file patterns)
- `outputFormat.arraySort` - Sort arrays by field name with asc/desc order (per-file patterns)

### Dependencies

- **CLI**: `commander` for argument parsing
- **YAML Processing**: `yaml` library for parsing and serialization
- **Validation**: `zod` (v4+) for config schema validation
- **Glob**: `picomatch` and `tinyglobby` for file pattern matching
- **Diffing**: `diff` for file comparison, `diff2html` for HTML report generation
- **Terminal UI**: `chalk` for colorized console output, `open` for browser launching

## Code Style and Conventions

### Function Style

- **Use const arrow functions** for all function declarations
- Pattern: `const functionName = (params): ReturnType => { ... };`
- This applies to exported functions, class methods, and local functions
- Static methods in classes should also use arrow function syntax: `private static methodName = (...): Type => { ... };`

### Comment Style

- Comments must be shorter than the code they belong to
- Do not use detailed examples in comments
- Use just block separators (e.g., `// ============================================================================`)

### TypeScript Configuration

- Target: ES2023, CommonJS modules
- `rootDir: "./src"` ensures clean output to `dist/`
- `resolveJsonModule: true` allows importing package.json directly
- Strict mode enabled with comprehensive safety checks
- No unused locals/parameters allowed

### ESLint Rules

- Uses `@typescript-eslint` recommended rules
- `eslint-plugin-unicorn` for additional conventions (some disabled: filename-case, no-process-exit, switch-case-braces, no-array-reduce, prefer-global-this, no-nested-ternary)
- `simple-import-sort` for automatic import ordering
- Multi-line curly braces style: `curly: ['error', 'multi']`
- No debugger or alert statements

### Prettier Formatting

- Single quotes
- No trailing commas
- 2 spaces indentation (no tabs)
- 120 character line width

## CI/CD

GitHub Actions workflow (`.github/workflows/ci-dev.yaml`) runs on all non-main branches:

- Tests on Node.js 22.x and 24.x
- Format check → Lint check → Build → Test
- Requires `npm ci` for reproducible builds

## Implementation Status

### Completed

- CLI subcommand architecture with init and sync commands
- Init command for generating config.yaml templates
- CLI argument parsing with required `--config` validation for sync command
- Discriminated union types for type-safe command routing
- Configuration schema with Zod validation (including arraySort rules)
- Application header displaying name/version from package.json
- YAML config file loading and parsing
- User-friendly error messages for config validation
- File loader module with glob pattern matching
- Parallel file reading from source and destination folders
- Binary file detection and error handling
- Core sync logic (diffing, skipPath filtering, deep merge)
- YAML formatter with key ordering, value quoting, array sorting, keySeparator
- Stop rules validation (semverMajorUpgrade, semverDowngrade, numeric, regex)
- File updater with add/update/delete/format operations
- HTML diff report generation (diff2html)
- Console diff reporter with colored output
- Dry-run mode implementation
- Force mode to skip stop rules
- Prune logic for removing files not in source
- Comprehensive unit tests (yamlFormatter.test.ts, initCommand.test.ts)

### TODO

- Transforms feature (find/replace transformations for specific paths)

## Utility Modules (`src/utils/`)

Shared utilities are centralized in `src/utils/` with barrel exports via `src/utils/index.ts`:

- **`errors.ts`** - Error factory pattern for consistent error handling
  - `createErrorClass(name, codeExplanations, customFormatter?)` - Creates custom error classes
  - `createErrorTypeGuard(ErrorClass)` - Generates type guard functions
  - All modules use this factory for consistency

- **`fileType.ts`** - File type detection utilities
  - `isYamlFile(filePath)` - Detects YAML files with regex `/\.ya?ml$/i`

- **`diffGenerator.ts`** - Unified diff generation
  - `generateUnifiedDiff(filePath, destinationContent, sourceContent)` - Creates unified diffs using `diff` library

- **`serialization.ts`** - YAML serialization and normalization
  - `serializeForDiff(content, sortKeys)` - Consistent YAML serialization for diffing
  - `normalizeForComparison(value)` - Recursively normalizes values (sorts arrays/keys)

- **`deepEqual.ts`** - Structural deep equality comparison
  - `deepEqual(a, b)` - Fast structural comparison (normalizes then compares)

- **`jsonPath.ts`** - JSON path utilities
  - `parseJsonPath(path)` - Converts JSON path strings to array of parts
  - `getValueAtPath(obj, path)` - Navigates objects using parsed paths
  - Supports wildcards (`*`) and numeric array indices

## Error Handling Pattern

All modules follow a consistent error handling pattern using the factory in `src/utils/errors.ts`:

1. **Custom Error Classes** - Each module creates its own error class via `createErrorClass()`
2. **Consistent Formatting** - Factory provides user-friendly error messages with context (path, code, cause)
3. **Type Guards** - Each error exports an `isXxxError()` type guard via `createErrorTypeGuard()`
4. **Error Codes** - Support for NodeJS.ErrnoException codes (ENOENT, EACCES, etc.) and custom codes

Example pattern:

```typescript
import { createErrorClass, createErrorTypeGuard } from './utils/errors';

const FileLoaderErrorClass = createErrorClass('File Loader Error', {
  ENOENT: 'File not found',
  EACCES: 'Permission denied'
});

export class FileLoaderError extends FileLoaderErrorClass {}
export const isFileLoaderError = createErrorTypeGuard(FileLoaderError);
```

To add a hint to error messages, override the constructor:

```typescript
export class InitError extends InitErrorClass {
  constructor(message: string, options: ErrorOptions = {}) {
    super(message, options);
    this.message += '\n  Hint: Choose a different path or remove the existing file';
  }
}
```

## YAML Processing Architecture

The tool uses a sophisticated multi-stage pipeline for YAML processing:

### 1. File Loading (`src/fileLoader.ts`)

- Loads raw file contents from source and destination folders
- Uses glob patterns with `tinyglobby` for file discovery
- Returns `Map<string, string>` with relative paths as keys

### 2. Diff Computation (`src/fileDiff.ts`)

- Parses YAML files into JavaScript objects
- Applies `skipPath` filters to remove ignored paths (per-file patterns)
- Normalizes data structures for comparison (sorts arrays, keys)
- Uses deep equality to detect actual changes (ignoring formatting)
- Returns `FileDiffResult` with added/deleted/changed/unchanged files

### 3. Stop Rules Validation (`src/stopRulesValidator.ts`)

- Validates changed files against configured stop rules
- Extracts values at JSONPath locations from old and new content
- Checks semver changes, numeric ranges, regex patterns
- Fails entire operation unless `--force` is used

### 4. File Update (`src/fileUpdater.ts`)

- **Deep merge strategy**: Merges source changes into full destination (preserving skipped paths)
- For YAML files: `deepMerge(destinationParsed, processedSourceContent)`
- This ensures skipPath values in destination are preserved
- Formats output using `yamlFormatter.ts`
- Writes to destination folder (or dry-run preview)

### 5. YAML Formatting (`src/yamlFormatter.ts`)

- Parses YAML into `yaml` AST (Document, YAMLMap, YAMLSeq, Scalar)
- Applies transformations to AST:
  - Key ordering (hierarchical JSONPath-based)
  - Value quoting (JSONPath with wildcard support)
  - Array sorting (by field, asc/desc)
  - keySeparator (blank lines between top-level keys)
- Serializes back to YAML string with specified indent

## Notes for Development

- Configuration file supports glob patterns with `tinyglobby` (picomatch-based) syntax
- JSON path expressions use JSONPath-style syntax (e.g., `$.secrets[*].password`, `spec.env[*].value`)
- JSONPath patterns support wildcards (`*`) for array indices
- The `yaml` package is used for both parsing and AST manipulation
- File loader returns `Map<string, string>` with relative paths sorted alphabetically
- All file operations use async/await with parallel processing via `Promise.all`
- Deep merge preserves destination values for paths not present in source
- Shared utilities in `src/utils/` provide file type detection, diff generation, serialization, and comparison functions
- Use barrel exports from `src/utils/index.ts` for cleaner imports
