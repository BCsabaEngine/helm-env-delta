# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.9.0] - 2026-01-25

### Added

- Fixed values: New `fixedValues` configuration option lets you set specific fields to constant values regardless of what's in source or destination files. Perfect for enforcing production settings like `debug: false`, `logLevel: warn`, or `replicas: 3` after every sync. Supports all filter operators (`=`, `^=`, `$=`, `*=`) to update multiple matching array items at once. Changes are visible in all diff reports (console, HTML, JSON).

### Changed

- Cleaner HTML diff report: Array sections now show a simplified unified diff view instead of separate added/removed/unchanged sections, making it easier to see what actually changed.

### Fixed

- HTML report layout: The side-by-side tree view now properly fills the available height, preventing unnecessary scrolling and improving readability for large reports.

## [1.8.1] - 2026-01-23

### Fixed

- Array items matching skipPath filters are now correctly preserved during sync. Previously, when using skipPath with array filter expressions (like `env[name=DEBUG]` or `containers[name^=sidecar-]`), the matched items were being deleted from the destination instead of being preserved. Now these items are kept as expected, allowing you to protect environment-specific array entries from being overwritten or removed during sync.

## [1.8.0] - 2026-01-23

### Added

- New filter operators for skipPath expressions: In addition to exact match (`=`), you can now use `^=` (startsWith), `$=` (endsWith), and `*=` (contains) operators to match array items by property patterns. For example, `env[name^=DB_]` skips all environment variables starting with "DB\_", `env[name$=_SECRET]` skips variables ending with "\_SECRET", and `env[name*=PASSWORD]` skips any variable containing "PASSWORD". Perfect for batch filtering items by naming conventions without listing each one individually.

## [1.7.2] - 2026-01-22

### Added

- Format-only mode: New `--format-only` flag applies your `outputFormat` settings to destination files without syncing from source. Perfect for standardizing YAML formatting across existing files, or reformatting after manual edits. Works with `--dry-run` to preview what would change.

### Fixed

- Pattern validation now correctly includes excluded files when checking if patterns match. Previously, the `--validate` flag would incorrectly report unused patterns for files that existed but were in the exclude list. Now validation sees all matching files regardless of exclude rules, giving you accurate feedback about your configuration.

## [1.7.1] - 2026-01-19

### Added

- Array filter expressions in skipPath: Skip specific array items by property value using filter syntax like `env[name=SECRET_KEY]` or `containers[name=sidecar].resources`. Perfect for skipping environment-specific array entries without excluding the entire array. Supports nested filters, quoted values for spaces, and numeric matching.

### Fixed

- HTML diff report now displays filename transformations: When using filename transforms to rename files during sync (e.g., `envs/uat/` → `envs/prod/`), the HTML report now shows both the original and transformed filenames, making it easier to track what happened to each file.
- HTML report array sections now display correctly with proper collapsible styling.

## [1.7.0] - 2026-01-08

### Added

- Pattern usage validation: The `--validate` flag now checks if your configuration patterns actually match files in your project. Catches typos and outdated patterns in `exclude`, `skipPath`, and `stopRules` before they cause issues. For example, if you misspell a field name like `microservice.replicaCountX` instead of `microservice.replicaCount`, validation will warn you that the path doesn't exist in your files.
- JSONPath validation for skipPath: In addition to checking if glob patterns match files, validation now verifies that JSONPath fields specified in `skipPath` actually exist in your YAML files. This helps you catch configuration mistakes early, like referencing fields that were renamed or removed.
- Comprehensive validation warnings: Get detailed context with each warning, including which pattern failed to match, how many files were checked, and what rule type triggered the warning. Makes it easy to understand exactly what needs fixing in your configuration.

### Changed

- Two-phase validation: The `--validate` flag now runs in two phases - first validating configuration syntax and structure (static checks), then loading your actual files to verify patterns match and paths exist (file-based checks). This catches more potential issues before you run a sync operation.

## [1.6.0] - 2026-01-01

### Added

- Smart configuration suggestions: New `--suggest` flag analyzes your file differences and intelligently recommends configuration updates. The tool examines patterns in your changes and suggests transforms (like environment name changes) and stop rules (like version bump validations) to add to your config. Each suggestion includes a confidence score and occurrence count to help you decide what to apply.
- Suggestion sensitivity control: New `--suggest-threshold` flag lets you control how sensitive the suggestion engine is (0-1 scale, default: 0.3). Lower values show more suggestions with less strict confidence requirements; higher values only show high-confidence patterns. Perfect for discovering hidden patterns or focusing on the most obvious improvements.
- Noise filtering: The suggestion engine automatically ignores common noise like UUIDs, timestamps, single-character changes, and antonym pairs (enable/disable, true/false, on/off). It also filters out version-number-only changes and regex special characters unless they appear in meaningful patterns. This keeps suggestions focused on real configuration patterns worth capturing.

### Changed

- Dependency updates: Updated development and runtime dependencies to latest versions.

## [1.5.0] - 2025-12-30

### Added

- External transform files: Load text replacements from separate YAML files using `contentFile` and `filenameFile` in your transforms. Perfect for managing common replacements across multiple configs (e.g., environment names, service URLs, cluster names) in a single shared file. Use a single file or an array of files to organize your replacements by category.
- External pattern files for stop rules: Load validation patterns from external YAML files using `regexFile` (for pattern arrays) or `regexFileKey` (to use transform file keys as patterns). Keep your forbidden patterns organized in separate files and share them across multiple configurations.
- Global value scanning for regex stop rules: Regex stop rules can now scan all values in a file when you omit the `path` field. Great for catching forbidden patterns anywhere in your YAML files, not just in specific fields.

### Changed

- Dependency updates: Updated development and runtime dependencies to latest versions.

## [1.4.0] - 2024-12-28

### Added

- File discovery preview: New `--list-files` flag shows which files will be processed before running sync operations. Perfect for verifying your glob patterns match the right files without processing diffs.
- Configuration display: New `--show-config` flag displays your complete configuration after all inheritance and merging is applied. Useful for understanding how config files combine and troubleshooting complex setups.
- Color control: New `--no-color` flag disables colored output for CI/CD environments, accessibility tools, or when piping output to files.

### Changed

- Enhanced validation: The `--validate` flag now shows helpful warnings for common configuration issues like inefficient glob patterns, duplicate entries, conflicting rules, and empty arrays.
- Improved help text: Command help now includes practical usage examples for common workflows.
- Better error messages: More helpful suggestions when commands are mistyped (e.g., suggests `--dry-run` when you type `--dryrun`).

## [1.3.3] - 2024-12-27

### Changed

- Performance improvements: Significantly faster processing across all operations (45-60% faster for typical workloads). Large file sets with many transforms or arrays now process much more quickly with reduced memory usage.

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
