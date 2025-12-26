# Contributing to HelmEnvDelta

Thank you for your interest in contributing to HelmEnvDelta! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing Requirements](#testing-requirements)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Project Architecture](#project-architecture)
- [Reporting Issues](#reporting-issues)

---

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors. We expect:

- Respectful and constructive communication
- Focus on what is best for the project and community
- Acceptance of constructive criticism
- Collaboration with other contributors

---

## Getting Started

### Prerequisites

- Node.js >= 22
- npm >= 9
- Git
- A code editor (VS Code recommended)

### First Time Setup

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/helm-env-delta.git
   cd helm-env-delta
   ```
3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/BCsabaEngine/helm-env-delta.git
   ```
4. Install dependencies:
   ```bash
   npm install
   ```
5. Verify setup:
   ```bash
   npm run all  # Runs format, lint, build, and test
   ```

---

## Development Setup

### Project Structure

```
helm-env-delta/
├── src/              # Source code
│   ├── utils/        # Utility functions
│   ├── index.ts      # Main entry point
│   └── ...           # Core modules
├── bin/              # CLI entry point
├── tests/            # Test files (mirrors src/ structure)
├── examples/         # Example configurations
└── package.json      # Project metadata
```

### Available Commands

```bash
# Development
npm run dev           # Run with tsx and example config
npm run build         # Clean build
npm run clean         # Clean build artifacts

# Testing
npm test              # Run all tests
npm run test:coverage # Coverage report (60% minimum required)

# Code Quality
npm run format        # Format code with Prettier
npm run lint          # Lint code with ESLint
npm run fix           # Format + lint
npm run all           # Fix + build + test (run before committing)

# CLI
npm link              # Link for global use during development
helm-env-delta --config examples/config.yaml --dry-run
```

---

## Development Workflow

### Creating a New Feature or Fix

1. **Sync with upstream:**

   ```bash
   git checkout main
   git fetch upstream
   git merge upstream/main
   ```

2. **Create a feature branch:**

   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-123-description
   ```

3. **Make your changes:**
   - Write code following style guidelines
   - Add tests for new functionality
   - Update documentation if needed

4. **Run quality checks:**

   ```bash
   npm run all  # Must pass before committing
   ```

5. **Commit your changes:**

   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

6. **Push to your fork:**

   ```bash
   git push origin feature/your-feature-name
   ```

7. **Open a Pull Request** on GitHub

---

## Code Style Guidelines

### TypeScript

- **Functions**: Use const arrow functions only:

  ```typescript
  const myFunction = (param: string): ReturnType => {
    // implementation
  };
  ```

- **Types**: Prefer interfaces for objects, type aliases for unions
- **Exports**: Named exports only, no default exports
- **Target**: ES2023, CommonJS modules

### ESLint Rules

Key rules enforced:

- `unicorn/no-null` - Use `undefined` instead of `null`
- `unicorn/no-useless-undefined` - Avoid explicit `undefined` when default
- `unicorn/prevent-abbreviations` - Use descriptive names (error1, not e1)
- `unicorn/consistent-function-scoping` - Move reusable functions to outer scope
- `simple-import-sort` - Automatic import sorting
- `curly: multi` - Braces for multi-line blocks

### Prettier

Configuration:

- Single quotes
- No trailing commas
- 2 spaces indentation
- 120 character line length
- No semicolons

### Comments

- Keep comments shorter than the code they describe
- No detailed examples in comments (add to tests instead)
- Use block separators only for major sections
- Document "why" not "what" when code is not self-evident

### Error Handling

Use the error factory pattern from `src/utils/errors.ts`:

```typescript
const ErrorClass = createErrorClass('Module Error', {
  CODE1: 'explanation',
  CODE2: 'explanation'
});

export class MyModuleError extends ErrorClass {}
export const isMyModuleError = createErrorTypeGuard(MyModuleError);
```

---

## Testing Requirements

### Test Coverage

- **Minimum coverage: 60%** (enforced in CI)
- All new features must include tests
- Bug fixes should include regression tests

### Test Structure

Use Vitest with describe/it pattern:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('MyModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle valid input correctly', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe('expected');
  });

  it('should throw error for invalid input', () => {
    // Arrange
    const input = '';

    // Act & Assert
    expect(() => myFunction(input)).toThrow();
  });
});
```

### Testing Guidelines

- Use Arrange-Act-Assert pattern
- Use `undefined` not `null` in tests
- Use descriptive variable names (error1 not e1)
- Test both happy path and error cases
- Use type guards for error testing
- Mock external dependencies with `vi.mock`

### Running Tests

```bash
# Run all tests
npm test

# Coverage report
npm run test:coverage
```

---

## Commit Message Guidelines

Follow conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring (no feature change)
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, tooling

### Examples

```bash
feat: add filename transformation support

Add ability to transform file paths using regex patterns.
This enables source files to be renamed during sync.

Closes #123

---

fix: handle empty YAML files correctly

Previously crashed when encountering empty files.
Now returns early with appropriate warning.

Fixes #456

---

docs: update README with adoption guide

Add section explaining how to adopt HelmEnvDelta
in existing GitOps workflows.
```

### Rules

- Use imperative mood ("add feature" not "added feature")
- First line max 72 characters
- Body wraps at 72 characters
- Reference issues and PRs in footer

---

## Pull Request Process

### Before Submitting

1. **Run all checks:**

   ```bash
   npm run all  # Must pass
   ```

2. **Update documentation:**
   - README.md if adding features
   - CLAUDE.md if changing architecture
   - JSDoc comments for public APIs

3. **Update tests:**
   - Add tests for new features
   - Ensure coverage meets 60% minimum
   - Verify all tests pass

4. **Update CHANGELOG:**
   - Add entry under "Unreleased" section
   - Follow existing format

### PR Description Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Checklist

- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] All tests pass
- [ ] Coverage >= 60%
- [ ] Commit messages follow guidelines

## Related Issues

Closes #123
```

### Review Process

1. **Automated checks must pass:**
   - Format check (Prettier)
   - Lint check (ESLint)
   - Build check (TypeScript compilation)
   - Test check (Vitest with coverage)

2. **Code review:**
   - At least one approval required
   - Address all review comments
   - Keep discussion focused and respectful

3. **Merge:**
   - Squash and merge (preferred)
   - Maintainer will merge when approved

---

## Project Architecture

### Core Flow

```
parseCommandLine → loadConfigFile → loadFiles → computeFileDiff → validateStopRules → updateFiles → reports
```

### Key Modules

- **commandLine.ts**: CLI argument parsing (commander)
- **configFile.ts**: Zod schema validation
- **configLoader.ts**: YAML config loading with inheritance
- **fileLoader.ts**: Glob-based file loading
- **fileDiff.ts**: YAML structural comparison
- **yamlFormatter.ts**: YAML output formatting
- **stopRulesValidator.ts**: Safety validation
- **fileUpdater.ts**: Deep merge and file sync

### Design Patterns

- **Type Safety**: Zod schemas with TypeScript inference
- **Error Handling**: Custom error classes with type guards
- **Functional Style**: Pure functions, const arrow functions
- **Async/Await**: Promise-based with parallel operations
- **Barrel Exports**: `src/utils/index.ts` exports utilities

### Adding New Features

1. **New configuration option:**
   - Update schemas in `src/configFile.ts`
   - Update `BaseConfig` and `FinalConfig` types
   - Add validation logic
   - Update README.md

2. **New stop rule type:**
   - Add type to `StopRule` schema
   - Implement validation in `src/stopRulesValidator.ts`
   - Add tests
   - Update documentation

3. **New output format:**
   - Add formatter in `src/yamlFormatter.ts`
   - Update schema
   - Add tests
   - Update README.md

---

## Reporting Issues

### Before Creating an Issue

1. **Search existing issues** to avoid duplicates
2. **Test with minimal config** - isolate the problem

### Bug Report Template

````markdown
## Description

Clear description of the bug

## To Reproduce

Steps to reproduce:

1. Create config with...
2. Run command...
3. See error...

## Expected Behavior

What you expected to happen

## Actual Behavior

What actually happened

## Configuration

```yaml
# Your config.yaml (sanitize sensitive data)
source: './uat'
destination: './prod'
```
````

## Environment

- HelmEnvDelta version:
- Node.js version:
- OS:

## Additional Context

Any other relevant information

````

### Feature Request Template

```markdown
## Feature Description
Clear description of the feature

## Use Case
Why is this feature needed?

## Proposed Solution
How should it work?

## Alternatives Considered
Other approaches you've considered

## Additional Context
Any other relevant information
````

---

## Questions?

- **Issues**: [GitHub Issues](https://github.com/BCsabaEngine/helm-env-delta/issues)
- **Discussions**: Use GitHub Discussions for questions
- **Security**: Report security vulnerabilities privately via GitHub Security Advisories

Thank you for contributing to HelmEnvDelta!
