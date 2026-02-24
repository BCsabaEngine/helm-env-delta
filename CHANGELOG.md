# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.14.0] - 2026-02-24

### Added

- Scalar array sorting: `arraySort` can now sort plain value arrays (strings, numbers) without a `sortBy` field. Simply omit `sortBy` and the array items themselves are used as the sort key. Great for sorting volume lists, tag arrays, or any sequence of plain values. Object arrays still require `sortBy` as before. Mismatched modes are silently skipped, so mixing scalar and object array rules in the same config is safe.

## [1.13.1] - 2026-02-19

### Changed

- Source restructure: `src/` files reorganized into `config/`, `pipeline/`, and `reporters/` subdirectories with barrel exports for cleaner imports and better separation of concerns.
- Dev dependencies updated: eslint upgraded to v10, `@types/node` to v25, `@typescript-eslint` to v8. Build now uses `tsc --build` (project references mode) for faster incremental builds.
- New `test:all` npm script runs both unit tests and performance benchmarks in sequence.

## [1.13.0] - 2026-02-12

### Added

- Required version enforcement: New `requiredVersion` config option lets you specify the minimum version of helm-env-delta needed to process a config file. If someone runs your config with an older version, they get a clear error message telling them to update. Supports inheritance via `extends`, so you can set it once in a base config. Perfect for teams where configs rely on features from a specific version.

## [1.12.0] - 2026-02-10

### Added

- Alphabetical key sorting: New `keySort` option in `outputFormat` lets you sort YAML keys alphabetically at specific paths. Use JSONPath targeting to sort only where it matters (e.g., sort environment variables or labels alphabetically) while keeping the rest of your file structure intact. Works alongside existing `keyOrders` for precise control over key arrangement.
- Stop rule violations in HTML report: When using `--dry-run` with `--diff-html`, stop rule violations now appear directly in the HTML report as a collapsible table with file, rule type, path, old/new values, and message. A violations count badge is also shown in the summary header for quick visibility.

## [1.11.1] - 2026-02-07

### Changed

- HTML report: Stats dashboard now hidden by default with a "Show Details" toggle button, reducing visual clutter. Top changed files list expanded from 5 to 10 items.
- HTML report: Sidebar file browser no longer shows +/- line count badges for a cleaner, less noisy navigation experience.
- HTML report: Empty categories (0 count) are now hidden from the summary badges and tab bar. Only categories with files are shown, and the first non-empty tab is selected by default.
- HTML report: Synchronized horizontal scrolling for side-by-side diff panels — scrolling one panel now scrolls the other.

## [1.11.0] - 2026-02-05

### Added

- Self-contained HTML reports: diff2html CSS is now inlined, so HTML reports work fully offline without CDN downloads. Open reports anywhere, anytime — no internet required.
- Diff statistics dashboard: The HTML report header now shows total added/removed line counts with a visual bar chart and a list of the top changed files, giving you an at-a-glance overview of the sync impact.
- Per-file line change badges: Each file section and sidebar entry now shows `+N` / `-N` badges indicating the number of added and removed lines, making it easy to spot the most impactful changes.
- Copy Diff button: Each changed file section includes a "Copy Diff" button to copy the unified diff to your clipboard for easy sharing or pasting into pull requests.
- Collapse All / Expand All buttons: Quickly collapse or expand all file sections in the changed and added tabs for faster navigation in large reports.
- Scroll-to-top button: A floating button appears when you scroll down, letting you quickly jump back to the top of the report.
- Sidebar file search: A filter input at the top of the sidebar lets you search files by path, instantly narrowing the file tree to matching entries.
- Sticky file headers: Open file section headers now stick to the top of the viewport as you scroll through diffs, so you always know which file you're looking at.

## [1.10.3] - 2026-02-02

### Changed

- Filter operators updated: The `-f, --filter` flag now uses `,` for OR and `+` for AND instead of `|` and `&`. This makes filtering easier in shell environments since no quoting is required. Use `-f prod,staging` for OR and `-f values+prod` for AND. Escape literal `,` or `+` with backslash when needed.

## [1.10.2] - 2026-02-02

### Added

- Filter logical operators: The `-f, --filter` flag supports logical operators for complex filtering. Use `-f prod,staging` to match files containing either term (OR), or `-f values+prod` to match files containing both terms (AND). Escape literal `,` or `+` with backslash when needed. Cannot mix operators in a single expression.

## [1.10.1] - 2026-01-31

### Changed

- Updated dependencies to latest versions for improved stability and security.

## [1.10.0] - 2026-01-30

### Added

- Downloadable new files in HTML report: When syncing creates new files, the HTML diff report now includes download buttons so you can save them directly from your browser. Great for reviewing and sharing proposed new files before committing.
- File filtering: New `-f, --filter <string>` flag lets you narrow down which files to process by matching against filenames or file contents (case-insensitive). Perfect for focusing on specific services or configurations in large projects.
- Change type filtering: New `-m, --mode <type>` flag filters files by their change status: `new` (only files that will be created), `modified` (only changed files), `deleted` (only files that will be removed), or `all` (default). Combine with `--diff` or `--dry-run` to review specific types of changes.
- Command shortcuts: Added single-letter aliases for commonly used flags: `-D` (dry-run), `-d` (diff), `-H` (diff-html), `-J` (diff-json), `-S` (skip-format), `-l` (list-files), `-f` (filter), `-m` (mode). Type less, sync faster.

## [1.9.3] - 2026-01-27

### Added

- Format-only example: New example configuration (`example/7-format-only/`) demonstrates how to use `--format-only` mode to standardize YAML formatting across files without syncing from a source.

### Fixed

- Comment-only YAML files are now preserved: Files containing only comments (like placeholder files or documentation stubs) are no longer corrupted during sync or formatting. Previously, these files would lose their comments or cause formatting errors.
- YAML formatting now correctly handles whitespace-only lines, preventing duplicate blank lines from appearing in formatted output.
- `--list-files` flag now works correctly with `--format-only` mode, showing which files would be formatted instead of requiring a source folder.

## [1.9.2] - 2026-01-27

### Added

- Path validation: Source and destination folders can no longer be the same path. The tool now detects when both resolve to identical locations (including relative paths like `./envs/../envs/prod` and `./envs/prod`) and shows a clear error message, preventing accidental self-overwrites.

### Changed

- Format-only mode simplified: When using `--format-only`, you no longer need to specify a `source` folder in your config. Just provide `destination` and `outputFormat` settings to format files in place. This makes format-only configs cleaner and more intuitive for standalone formatting tasks.

## [1.9.1] - 2026-01-26

### Added

- Configurable confirmation delay: New `confirmationDelay` config option lets you control the pre-sync countdown timer (in milliseconds). Set to `0` to disable the delay entirely for automated workflows, or increase it for extra review time. Default remains 3 seconds.

### Fixed

- Fixed values now properly inherited via `extends`: When using config inheritance, `fixedValues` from parent configs are now correctly merged into child configs. Previously, `fixedValues` defined in a base config would be lost when extending it.

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
