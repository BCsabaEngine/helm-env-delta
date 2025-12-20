# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.3] - 2024-12-20

### Added

- Automatic update notifications: The tool now checks for newer versions on npm every time it runs and displays a friendly notification when an update is available. The check is automatic, non-blocking, and skips in CI/CD environments to avoid noise in your pipelines.

## [1.1.2] - 2024-12-20

### Added

- Enhanced documentation with comprehensive CONTRIBUTING.md guide, FAQ section, and LLM-optimized documentation for AI assistants
- Clearer error messages with helpful hints when validation or file operations fail

### Changed

- Reduced package size by removing unused dependencies (nodemon, ts-node, handlebars)

## [1.1.0] - 2024-12-19

### Added

- Filename transformations: You can now transform file paths during sync, not just YAML content. Use the new `filename` section in transforms to rename files and change folder structures (e.g., `envs/uat/app.yaml` → `envs/prod/app.yaml`)
- Collision detection: Automatically prevents multiple source files from transforming to the same destination filename
- `--skip-format` flag: Skip YAML formatting when you want to sync content without changing file formatting

### Changed

- Transform configuration structure: The `transforms` section now requires explicit `content` and/or `filename` subsections for clearer separation of content vs. filename transformations
- All example configuration files updated to use the new transform format

### Fixed

- Transforms now correctly apply to array items in YAML files

## [1.0.0] - 2024-12-18

### Initial release
