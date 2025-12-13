# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HelmEnvDelta (`helm-env-delta` or `hed`) is a CLI tool for environment-aware YAML delta and sync for GitOps workflows. It processes Helm values files and other YAML configurations, allowing controlled synchronization between environments (e.g., UAT → Production) while respecting environment-specific differences and validation rules.

## Development Commands

### Building and Development

```bash
npm run build          # Clean build (tsc --build --clean && tsc --build --force)
npm run dev            # Run with tsx and example config (tsx src/index.ts -c ./config.example.yaml)
npm run dev:watch      # Watch mode with nodemon
npm run clean          # Clean TypeScript build artifacts
```

### Testing

```bash
npm test               # Run all tests once (vitest run)
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Generate coverage report (60% minimum threshold)
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
helm-env-delta --config config.yaml   # Main CLI command
hed --config config.yaml              # Short alias
```

During development: `node bin/index.js --config config.example.yaml`

**Important:** The `--config` option is required. The CLI will show an error and help output if not provided.

## Architecture

### Entry Point Flow

1. `bin/index.js` - Shebang entry point that requires `dist/index.js`
2. `src/index.ts` - Main application entry:
   - Displays app header with version from package.json
   - Parses CLI arguments
   - Loads and validates YAML config
   - Orchestrates sync logic (in progress)

### Core Modules

- `src/commandLine.ts` - CLI argument parsing with `commander`
  - Validates required `--config` option
  - Supports `--dry-run`, `--force`, `--html-report` flags

- `src/configFile.ts` - Config validation with Zod schemas
  - Discriminated union for stop rules (semverMajor, numeric, regex)
  - User-friendly error messages via `ConfigValidationError`
  - Type-safe config with full TypeScript inference

### Configuration Schema

The tool uses a YAML configuration file (see `config.example.yaml`) with the following features:

**Core Settings:**

- `source` / `dest` - Source and destination folder paths (mandatory)
- `include` - Glob patterns for files to process (defaults to all YAML files)
- `prune` - Remove files in dest not present in source

**Processing Control:**

- `skipPath` - JSON/YAML paths to skip during processing (per-file patterns)
- `transforms` - Find/replace transformations for specific paths
- `orders` - Custom key ordering for output YAML files

**Validation Rules:**

- `stopRules` - Block operations based on:
  - `semverMajor` - Prevent major version bumps
  - `numeric` - Validate numeric ranges (min/max)
  - `regex` - Pattern matching validation

**Output Formatting:**

- `indent` - YAML indentation (default: 2)
- `quoteValues` - Quote values on right side of `:` (default: true)

### Dependencies

- **CLI**: `commander` for argument parsing
- **YAML Processing**: `yaml` library (currently used for parsing)
- **Validation**: `zod` (v4+) for config schema validation
- **Templating**: `handlebars` for potential future templating features
- **Glob**: `picomatch` and `tinyglobby` for file pattern matching

## Code Style and Conventions

### Function Style

- **Use const arrow functions** for all function declarations
- Pattern: `const functionName = (params): ReturnType => { ... };`
- This applies to exported functions, class methods, and local functions

### TypeScript Configuration

- Target: ES2020, CommonJS modules
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

- CLI argument parsing with required `--config` validation
- Configuration schema with Zod validation
- Application header displaying name/version from package.json
- YAML config file loading and parsing
- User-friendly error messages for config validation

### TODO

- Core sync logic (file reading, transformation, writing)
- Stop rules validation enforcement
- HTML report generation
- Dry-run mode implementation
- Force mode to skip stop rules
- Unit tests in `test/` directory

## Notes for Development

- Configuration file supports glob patterns with `picomatch` syntax
- JSON path expressions use JSONPath-style syntax (e.g., `$.secrets[*].password`)
- The `yaml` package is used for parsing; preserves structure but may need custom serialization for formatting control
- Static methods in classes should also use arrow function syntax: `private static methodName = (...): Type => { ... };`
