# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.2] - 2024-12-24

### Fixed

- Deep merge: Fixed critical bug where fields present in destination but not in source were not being deleted during sync. The `deepMerge` function now correctly removes fields from the destination when they don't exist in the source (unless they are in `skipPath`). This ensures that changes like removing `extraVolumeMounts` from source files properly propagate to destination files.
- YAML formatting: Multi-line strings with embedded newlines are now properly preserved using YAML literal block scalar style (`|-`). Previously, strings like cronjob args with newlines were being reformatted incorrectly, causing repeated changes on every run.
- YAML formatting: All YAML files now end with a trailing newline to match VSCode and other editor formatting conventions, preventing unnecessary format-only changes in git diffs.

## [1.3.1] - 2024-12-24

### Fixed

- YAML formatting: Fixed `keySeparator` edge case where a blank line was incorrectly inserted before the first second-level key when a YAML file has only one top-level key. Now blank lines only appear between second-level keys, not before the first one, resulting in cleaner formatted output.

## [1.3.0] - 2024-12-23

### Added

- Version format validation: New `versionFormat` stop rule enforces strict version numbering standards. Prevent incomplete versions (like `1.2` instead of `1.2.3`), pre-release identifiers (`1.2.3-rc`), build metadata (`1.2.3+build`), and leading zeros (`01.2.3`) from being deployed. Configure v-prefix requirements per environment - require `v1.2.3` for Docker tags, forbid it for Helm chart versions, or allow both formats. Perfect for maintaining consistent versioning across your GitOps deployments.

## [1.2.0] - 2024-12-21

### Added

- Output verbosity control: New `--verbose` and `--quiet` flags let you control how much information the tool displays. Use `--verbose` to see detailed debug information (config loading, glob matching, transforms, diff pipeline), or `--quiet` to suppress all output except errors and stop rule violations. Perfect for troubleshooting or running in CI/CD pipelines.
- Configuration validation: New `--validate` flag to check your configuration file without performing any sync operations

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
