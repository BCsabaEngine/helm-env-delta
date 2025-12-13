# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HelmEnvDelta (`helm-env-delta` or `hed`) is a CLI tool for environment-aware YAML delta and sync for GitOps workflows. It processes Helm values files and other YAML configurations, allowing controlled synchronization between environments (e.g., UAT → Production) while respecting environment-specific differences and validation rules.

## Development Commands

### Building and Development

```bash
npm run build          # Clean build (tsc --build --clean && tsc --build --force)
npm run dev            # Watch mode development with nodemon
npm run clean          # Clean TypeScript build artifacts
```

### Testing

```bash
npm test               # Run all tests once (vitest run)
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Generate coverage report (60% minimum threshold)
```

Tests are configured in `vitest.config.ts` and should be placed in `test/**/*.test.ts` directory (which doesn't exist yet).

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

The project provides two bin aliases after building:

```bash
helm-env-delta         # Main CLI command
hed                    # Short alias
```

During development, run with: `node bin/index.js` (which loads from `dist/index.js`)

## Architecture

### Entry Point

- `bin/index.js` - Shebang entry point that requires `dist/index.js`
- `src/index.ts` - Main application entry (currently empty, needs implementation)

### Core Modules (Planned)

- `src/commandLine.ts` - CLI argument parsing using `commander` library
- `src/configFile.ts` - Configuration file parsing with Zod schema validation

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
- **YAML Processing**: No YAML library yet (needs selection)
- **Validation**: `zod` for config schema validation
- **Templating**: `handlebars` for potential templating features
- **Glob**: `picomatch` and `tinyglobby` for file pattern matching

## Code Style and Conventions

### TypeScript Configuration

- Target: ES2020, CommonJS modules
- Strict mode enabled with comprehensive safety checks
- No unused locals/parameters allowed
- Output: `dist/` directory with declaration files

### ESLint Rules

- Uses `@typescript-eslint` recommended rules
- `eslint-plugin-unicorn` for additional conventions (with some rules disabled)
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

## Notes for Development

- The source files are currently empty - this is a greenfield project
- Tests directory doesn't exist yet but should be created as `test/`
- No YAML parsing library is selected yet - consider options based on requirements:
  - Preserve comments/formatting: `yaml` package with custom serialization
  - Performance-focused: `js-yaml`
  - Type-safe: Consider pairing with Zod schemas
- The CLI will need to handle both interactive and non-interactive modes
- Configuration file supports glob patterns with `picomatch` syntax
- JSON path expressions use JSONPath-style syntax (e.g., `$.secrets[*].password`)
