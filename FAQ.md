# Frequently Asked Questions (FAQ)

Common questions and answers about HelmEnvDelta.

## Table of Contents

- [General Questions](#general-questions)
- [Installation & Setup](#installation--setup)
- [Configuration](#configuration)
- [Usage & Workflow](#usage--workflow)
- [Transforms & Path Filtering](#transforms--path-filtering)
- [Stop Rules & Safety](#stop-rules--safety)
- [Troubleshooting](#troubleshooting)
- [Advanced Topics](#advanced-topics)

---

## General Questions

### What is HelmEnvDelta and what problem does it solve?

HelmEnvDelta is a CLI tool that automates the synchronization of YAML configuration files between different environments (like UAT → Production) in GitOps workflows. It solves the problem of manual, error-prone file copying by:

- Intelligently syncing files while preserving environment-specific values
- Validating changes against safety rules before applying them
- Enforcing consistent YAML formatting across environments
- Providing clear audit trails through diff reports

**Use it when:** You manage multiple Kubernetes/Helm environments and need to safely promote configurations between them.

---

### How is HelmEnvDelta different from git diff or other diff tools?

HelmEnvDelta performs **structural YAML comparison** rather than line-by-line text comparison:

- **Git diff**: Shows changes when arrays are reordered, formatting differs, or whitespace changes
- **HelmEnvDelta**: Parses YAML structure, ignores formatting/order differences, shows only meaningful content changes

Additionally, HelmEnvDelta:

- Applies transformations (environment-specific value replacement)
- Filters out paths that should never sync (skipPath)
- Validates changes against safety rules (stopRules)
- Can automatically sync files after validation

---

### Is HelmEnvDelta specific to Helm, or can I use it for other YAML files?

Despite the name, HelmEnvDelta works with **any YAML files**, not just Helm:

- Kubernetes manifests
- ArgoCD applications
- CI/CD pipeline configurations
- Docker Compose files
- Any YAML-based configuration

The tool focuses on YAML structure and environment synchronization, regardless of the specific use case.

---

### Can I use HelmEnvDelta with ArgoCD, Flux, or other GitOps tools?

**Yes!** HelmEnvDelta is designed to complement GitOps workflows:

1. **You** use HelmEnvDelta to sync files locally
2. **You** commit the changes to git
3. **Your GitOps tool** (ArgoCD/Flux) detects the commit and deploys

HelmEnvDelta handles the file synchronization, while your GitOps tool handles the deployment. They work together seamlessly.

---

## Installation & Setup

### Does HelmEnvDelta automatically check for updates?

**Yes!** HelmEnvDelta automatically checks for newer versions on npm every time it runs.

**Behavior:**

- Checks https://registry.npmjs.org on every run
- Displays a notification if a newer version is available
- Automatically skipped in CI/CD environments (detects CI env vars)
- Silent failure if npm is unreachable (doesn't interrupt your work)
- 3-second timeout to avoid delays

**Disable check:** Set the `CI` environment variable to skip the check:

```bash
CI=true helm-env-delta --config config.yaml
```

**Example notification:**

```
⚠ Update available! v1.2.3 → v2.0.0
Run: npm install -g helm-env-delta@latest
```

The check runs in the background and never blocks your main operation. If you see the notification, simply run `npm install -g helm-env-delta@latest` to upgrade.

---

### What are the system requirements?

**Minimum requirements:**

- Node.js >= 22
- npm >= 9
- Any operating system (Linux, macOS, Windows)

**Installation:**

```bash
npm install -g helm-env-delta
```

---

### How do I get started with a minimal configuration?

Create a `config.yaml` file with the bare minimum:

```yaml
source: './uat'
destination: './prod'

transforms:
  '**/*.yaml':
    content:
      - find: "-uat\\b"
        replace: '-prod'
```

Test it safely:

```bash
helm-env-delta --config config.yaml --dry-run --diff
```

This shows what would change without modifying any files.

---

### Can I test HelmEnvDelta without modifying my files?

**Yes!** Always use `--dry-run` to preview changes:

```bash
# Console output
helm-env-delta --config config.yaml --dry-run --diff

# Visual HTML report
helm-env-delta --config config.yaml --dry-run --diff-html

# JSON output for programmatic analysis
helm-env-delta --config config.yaml --dry-run --diff-json
```

Dry-run shows exactly what would change without writing any files.

---

## Configuration

### What's the difference between skipPath and transforms?

**skipPath**: Fields to **completely ignore** during sync

- Use when values should **never** be copied (namespaces, replica counts)
- Destination values are preserved for these paths

**transforms**: Pattern-based **find and replace** for values that should sync but need modification

- Use when values should sync but need environment-specific changes (database URLs, service names)
- Applies to all matching values in the file

**Example:**

```yaml
skipPath:
  '**/*.yaml':
    - 'metadata.namespace' # Never sync namespace

transforms:
  '**/*.yaml':
    content:
      - find: 'uat-db'
        replace: 'prod-db' # Sync but transform database URL
```

---

### How do I handle environment-specific values like namespaces or replica counts?

Use `skipPath` to preserve these values:

```yaml
skipPath:
  '**/*.yaml':
    - 'metadata.namespace'
    - 'spec.replicas'
    - 'spec.destination.namespace'
    - 'resources.limits.memory'
    - 'resources.limits.cpu'
```

These fields will never be overwritten during sync, keeping production-specific settings intact.

---

### Can I use a base configuration and override it per environment?

**Yes!** Use config inheritance with `extends`:

**Base config (`config.base.yaml`):**

```yaml
include:
  - '**/*.yaml'
skipPath:
  'apps/*.yaml':
    - 'spec.destination.namespace'
outputFormat:
  indent: 2
```

**Production config (`config.prod.yaml`):**

```yaml
extends: './config.base.yaml'

source: './uat'
destination: './prod'

transforms:
  '**/*.yaml':
    content:
      - find: "-uat\\b"
        replace: '-prod'
```

Run with: `helm-env-delta --config config.prod.yaml`

---

### How deep can config inheritance go?

Maximum **5 levels** of inheritance to prevent excessive nesting.

```
base.yaml
  └── env.yaml (level 1)
      └── region.yaml (level 2)
          └── cluster.yaml (level 3)
              └── service.yaml (level 4)
                  └── override.yaml (level 5) ✓ OK
                      └── too-deep.yaml (level 6) ✗ ERROR
```

Circular dependencies are detected and rejected automatically.

---

## Usage & Workflow

### How do I get started if I don't know what transforms or stop rules to use?

**Use the `--suggest` flag for heuristic analysis!**

```bash
helm-env-delta --config config.yaml --suggest

# Control suggestion sensitivity (0-1, default: 0.3)
helm-env-delta --config config.yaml --suggest --suggest-threshold 0.7
```

**What heuristic analysis does:**

- Intelligently analyzes differences between source and destination using pattern recognition
- Detects repeated value changes using semantic matching (e.g., `uat-db` → `prod-db`)
- Suggests transform patterns automatically based on smart algorithms
- Recommends stop rules for version changes, numeric values using heuristics
- Provides confidence scores (0-100%) and occurrence counts for each suggestion
- **NEW:** Configurable threshold allows you to control suggestion sensitivity (0-1)
- **Enhanced noise filtering:**
  - Filters out UUIDs, timestamps, single-character edits
  - Filters antonym pairs (enable/disable, true/false, on/off, yes/no, active/inactive)
  - Filters regex special characters (unless semantic keywords like uat/prod present)
  - Filters version-number-only changes (service-v1 → service-v2, node1 → node2)
  - Allows semantic patterns even with special chars (db.uat.com → db.prod.com)
- Outputs copy-paste ready YAML configuration

**Note:** Suggestions are heuristic-based (intelligent pattern detection) and should always be reviewed before applying.

**Example workflow:**

```bash
# 1. Create minimal config with just source/destination
cat > config.yaml <<EOF
source: './uat'
destination: './prod'
EOF

# 2. Get suggestions
helm-env-delta --config config.yaml --suggest > suggestions.yaml

# 3. Review suggestions and copy relevant sections to config.yaml

# 4. Test with dry-run
helm-env-delta --config config.yaml --dry-run --diff

# 5. Execute sync
helm-env-delta --config config.yaml
```

**When to use:**

- First-time setup (bootstrap configuration automatically)
- Config refinement (discover missing patterns)
- Learning tool (understand what's changing)
- Quick start (avoid manual pattern analysis)

---

### How do the suggestion confidence scores work?

The `--suggest` feature uses heuristic algorithms to calculate confidence scores (0-100%) that help you evaluate recommendations:

**Transform suggestions (heuristic scoring):**

- **High confidence (80-100%)**: Heuristics detected pattern frequently across many files
  - Example: `uat-cluster` → `prod-cluster` (42 occurrences in 12 files)
  - Action: Likely safe to add to config
  - Heuristic boost: Semantic keywords (uat/prod/staging) increase confidence
- **Medium confidence (50-79%)**: Pattern appears moderately
  - Example: `staging` → `production` (8 occurrences in 3 files)
  - Action: Review carefully, might be environment-specific
- **Low confidence (30-49%)**: Pattern appears infrequently
  - Example: `test-value` → `prod-value` (2 occurrences in 1 file)
  - Action: Verify this is truly a pattern, not a one-off change
  - Note: Below 30% are filtered out by default

**Stop rule suggestions:**

- **High confidence (90-95%)**: Multiple files OR consistent version format
  - Example: Version format rules with unanimous v-prefix usage
- **Medium confidence (60-70%)**: Single file OR mixed patterns
  - Example: Semver rules for single-file version changes
- **Low confidence (50%)**: Single file numeric constraints
  - Example: Replica count ranges detected in one file
- Confidence threshold applies to both transforms AND stop rules

**Controlling which suggestions appear:**

```bash
# Show all suggestions (including low confidence)
helm-env-delta --config config.yaml --suggest --suggest-threshold 0.3

# Show only medium-high confidence
helm-env-delta --config config.yaml --suggest --suggest-threshold 0.6

# Show only high confidence
helm-env-delta --config config.yaml --suggest --suggest-threshold 0.8
```

**Best practices:**

- Start with default threshold (0.3) to see all reasonable suggestions
- Use higher threshold (0.7-0.8) when you only want very confident patterns
- Use lower threshold (0.2) when exploring all possible patterns
- Always test with `--dry-run` after applying suggestions

---

### What's the recommended workflow for syncing environments?

**Standard workflow:**

```bash
# 1. Review changes with dry-run
helm-env-delta --config config.yaml --dry-run --diff

# 2. Generate detailed HTML report
helm-env-delta --config config.yaml --dry-run --diff-html

# 3. Execute sync if changes look good
helm-env-delta --config config.yaml

# 4. Review the actual changes made
git diff

# 5. Commit and push
git add .
git commit -m "Sync UAT changes to Production"
git push
```

**Always run dry-run first!**

---

### Can I sync multiple environment pairs with one config?

Not directly, but you can create multiple configs:

```bash
# UAT → Prod
helm-env-delta --config config.uat-to-prod.yaml

# Dev → Staging
helm-env-delta --config config.dev-to-staging.yaml

# Staging → UAT
helm-env-delta --config config.staging-to-uat.yaml
```

Or use a script:

```bash
#!/bin/bash
for config in configs/*.yaml; do
  helm-env-delta --config "$config" --dry-run --diff
done
```

---

### How do I integrate HelmEnvDelta into my CI/CD pipeline?

**Example GitHub Actions workflow:**

```yaml
- name: Install HelmEnvDelta
  run: npm install -g helm-env-delta

- name: Validate sync
  run: |
    helm-env-delta --config config.yaml --dry-run --diff-json > report.json

    # Check for stop rule violations
    VIOLATIONS=$(cat report.json | jq '.stopRuleViolations | length')
    if [ "$VIOLATIONS" -gt 0 ]; then
      echo "Stop rule violations detected!"
      cat report.json | jq '.stopRuleViolations'
      exit 1
    fi

- name: Execute sync
  run: helm-env-delta --config config.yaml

- name: Commit changes
  run: |
    git add .
    git commit -m "Automated sync [skip ci]"
    git push
```

Use `--diff-json` for programmatic analysis with jq.

---

### What does the prune option do and when should I use it?

`prune: true` **deletes files in destination that don't exist in source**:

```yaml
prune: true # Remove orphaned files
```

**Use when:**

- You want destination to exactly mirror source
- You've deleted files in source and want them removed in destination

**Don't use when:**

- Destination has files that shouldn't be managed by sync
- You're unsure what will be deleted

**Always dry-run first:**

```bash
helm-env-delta --config config.yaml --dry-run --diff-json | jq '.files.deleted'
```

---

## Transforms & Path Filtering

### How do transforms work and in what order are they applied?

**Transforms apply sequentially:**

```yaml
transforms:
  '**/*.yaml':
    content:
      - find: 'uat-db.example.com'
        replace: 'temp-db.example.com' # Step 1
      - find: 'temp-db.example.com'
        replace: 'prod-db.example.com' # Step 2
    # Result: uat-db.example.com → prod-db.example.com
```

**Key points:**

- Content transforms apply to **YAML values only** (not keys)
- Filename transforms apply to **full relative paths** (folders + filename)
- Rules process in order (output of rule N becomes input of rule N+1)
- Supports regex with capture groups (`$1`, `$2`)

---

### Can I transform file paths, not just content?

**Yes!** Use `filename` transforms:

```yaml
transforms:
  '**/*.yaml':
    filename:
      - find: 'envs/uat/'
        replace: 'envs/prod/'
      - find: '-uat\.'
        replace: '-prod.'
```

**Example transformation:**

```
envs/uat/app-uat.yaml → envs/prod/app-prod.yaml
```

Filename transforms apply **before** include/exclude filtering.

---

### How do I use regex capture groups in transforms?

Use `$1`, `$2`, etc. to reference captured groups:

```yaml
transforms:
  '**/*.yaml':
    content:
      # Capture subdomain and use in replacement
      - find: "uat-db\\.(.+)\\.internal"
        replace: 'prod-db.$1.internal'

      # uat-db.mysql.internal → prod-db.mysql.internal
      # uat-db.postgres.internal → prod-db.postgres.internal
```

**Common patterns:**

```yaml
# Word boundaries
- find: "\\buat\\b"
  replace: 'prod'

# Escaped dots (literal .)
- find: "uat\\.example\\.com"
  replace: 'prod.example.com'

# Capture groups with parentheses
- find: '([a-z]+)-uat'
  replace: '$1-prod'
```

---

### Can I load transforms from external files instead of defining them inline?

**Yes!** Use `contentFile` and `filenameFile` to load transforms from external YAML files:

```yaml
transforms:
  '**/*.yaml':
    # Load from single file
    contentFile: './transforms/common.yaml'

    # Or load from multiple files (processed in order)
    contentFile:
      - './transforms/common.yaml'
      - './transforms/services.yaml'

    # Filename transforms from file
    filenameFile: './transforms/paths.yaml'

    # Can still combine with inline transforms (file-based run first)
    content:
      - find: 'v(\d+)-uat'
        replace: 'v$1-prod'
```

**Transform file format (simple key:value pairs):**

```yaml
# transforms/common.yaml
staging: production
stg: prod
staging-db.internal: production-db.internal
```

**Benefits:**

- Cleaner config files
- Reusable transform files across projects
- Easier maintenance (update in one place)
- Literal string matching (case-sensitive)

**Execution order:**

1. File-based transforms (literal)
2. Inline regex transforms (patterns)

---

### What JSONPath syntax should I use for skipPath and stopRules?

**JSONPath syntax (without `$.` prefix):**

```yaml
skipPath:
  '**/*.yaml':
    - 'metadata.namespace' # Top-level field
    - 'spec.destination.namespace' # Nested field
    - 'spec.env[*].value' # Array wildcard
    - 'annotations[kubernetes.io/name]' # Object key
```

**Common patterns:**

- Nested fields: `spec.template.spec.containers[*].image`
- All array items: `env[*].name`
- Specific array index: `env[0].value`
- Nested arrays: `spec.items[*].subitems[*].value`

**Important:** Omit the `$.` prefix (use `'version'` not `'$.version'`)

---

## Stop Rules & Safety

### What are stop rules and when should I use them?

**Stop rules prevent dangerous changes** from being applied:

| Rule Type            | Purpose                       | Example                      |
| -------------------- | ----------------------------- | ---------------------------- |
| `semverMajorUpgrade` | Block major version increases | Prevent v1.x → v2.0          |
| `semverDowngrade`    | Block any version downgrades  | Prevent v1.3.2 → v1.2.4      |
| `numeric`            | Validate number ranges        | Ensure replicas 2-10         |
| `regex`              | Block pattern matches         | Reject pre-release tags      |
| `regexFile`          | Block patterns from file      | Load forbidden patterns      |
| `regexFileKey`       | Block transform file keys     | Use transform keys as blocks |

**Example:**

```yaml
stopRules:
  'services/**/values.yaml':
    - type: 'semverMajorUpgrade'
      path: 'image.tag'
    - type: 'numeric'
      path: 'replicaCount'
      min: 2
      max: 10
```

**Use when:**

- You want to prevent accidental breaking changes
- You need to enforce resource limits
- You want to block specific patterns (like alpha/beta versions in production)

**Override with:** `--force` flag (use cautiously)

---

### Can I load stop rule patterns from external files?

**Yes!** Use `regexFile` and `regexFileKey` to load validation patterns from external files:

```yaml
stopRules:
  '**/*.yaml':
    # Load patterns from array file (with path - targeted)
    - type: 'regexFile'
      path: 'image.tag'
      file: './patterns/forbidden-versions.yaml'

    # Load patterns from array file (without path - global scan)
    - type: 'regexFile'
      file: './patterns/forbidden-global.yaml'

    # Use transform file keys as patterns
    - type: 'regexFileKey'
      path: 'service.name'
      file: './transforms/common.yaml'
```

**Pattern file format (array):**

```yaml
# patterns/forbidden-versions.yaml
- ^0\..* # Block 0.x.x versions
- .*-alpha.* # Block alpha releases
- .*-beta.* # Block beta releases
```

**Benefits:**

- Share validation rules across projects
- Easier maintenance
- Cleaner config files
- Reuse transform files for validation

---

### What's the difference between targeted and global regex stop rules?

**Path modes determine where regex rules check:**

**Targeted mode (with `path`):**

- Checks specific field only
- Efficient for known fields
- Example: Check only `image.tag`

```yaml
stopRules:
  '**/*.yaml':
    - type: 'regex'
      path: 'image.tag'
      regex: '^0\.' # Only checks image.tag field
```

**Global mode (without `path`):**

- Recursively scans ALL values in file
- Finds forbidden values anywhere
- Example: Block localhost references anywhere

```yaml
stopRules:
  '**/*.yaml':
    - type: 'regex'
      regex: '^127\.' # Scans entire file for this pattern
```

**Use global mode to block:**

- Localhost references (`localhost`, `127.0.0.1`)
- Test prefixes (`test-*`)
- Debug suffixes (`*-debug`)
- Exposed secrets patterns

---

### How do I override stop rules when I actually want to make a blocked change?

Use the `--force` flag:

```bash
helm-env-delta --config config.yaml --force
```

**When to use:**

- Intentional major version upgrades
- Planned scaling changes beyond normal limits
- Emergency fixes that violate rules

**Safety tip:** Always review with `--dry-run` first, even when using `--force`:

```bash
helm-env-delta --config config.yaml --force --dry-run --diff
```

---

### Can I validate changes without actually syncing files?

**Yes!** Use dry-run with JSON output:

```bash
# Check for violations
helm-env-delta --config config.yaml --dry-run --diff-json > report.json

# Count violations
cat report.json | jq '.stopRuleViolations | length'

# Show violation details
cat report.json | jq '.stopRuleViolations'

# Check specific fields
cat report.json | jq '.files.changed[].changes[] | select(.path == "$.image.tag")'
```

**Exit code:** Non-zero if stop rule violations are detected (useful for CI/CD).

---

## Troubleshooting

### Why are my glob patterns not matching files?

**Common issues:**

1. **Recursive matching:** Use `**` for recursive, `*` for single level

   ```yaml
   include:
     - '*.yaml' # Only root directory
     - '**/*.yaml' # All subdirectories recursively
   ```

2. **Pattern specificity:**

   ```yaml
   include:
     - 'apps/*.yaml' # apps/app.yaml ✓, apps/foo/app.yaml ✗
     - 'apps/**/*.yaml' # apps/foo/app.yaml ✓, apps/foo/bar/app.yaml ✓
   ```

3. **Exclude overrides include:**
   ```yaml
   include:
     - '**/*.yaml'
   exclude:
     - '**/test*.yaml' # Excludes test files even if included
   ```

**Debugging:** Use `--dry-run --diff-json` to see which files were loaded:

```bash
helm-env-delta --config config.yaml --dry-run --diff-json | jq '.files | keys'
```

---

### Why are some fields still being synced when I have them in skipPath?

**Common causes:**

1. **Wrong JSONPath syntax:**

   ```yaml
   # ❌ Wrong
   skipPath:
     "*.yaml":
       - "$.metadata.namespace"  # Don't use $. prefix

   # ✓ Correct
   skipPath:
     "*.yaml":
       - "metadata.namespace"
   ```

2. **Glob pattern doesn't match file:**

   ```yaml
   # Pattern: 'apps/*.yaml'
   # File: 'apps/frontend/values.yaml'
   # Doesn't match! Use 'apps/**/*.yaml'
   ```

3. **Transforms applying before skipPath:**
   - Transforms apply first, then skipPath
   - If transform creates the path, skipPath won't catch it

**Debug:** Use `--diff-json` to see which paths changed:

```bash
helm-env-delta --config config.yaml --dry-run --diff-json | jq '.files.changed[].changes[].path'
```

---

### What should I do if I get file collision errors?

**Error:** Multiple source files transform to the same destination filename.

**Example:**

```
Source files:
  - envs/uat/app.yaml
  - envs/uat-backup/app.yaml

Both transform to: envs/prod/app.yaml
```

**Solutions:**

1. **More specific transforms:**

   ```yaml
   transforms:
     '**/uat/*.yaml':
       filename:
         - find: '/uat/'
           replace: '/prod/'
     '**/uat-backup/*.yaml':
       filename:
         - find: '/uat-backup/'
           replace: '/prod-backup/'
   ```

2. **Exclude conflicting files:**

   ```yaml
   exclude:
     - '**/uat-backup/**'
   ```

3. **Use capture groups for uniqueness:**
   ```yaml
   transforms:
     '**/*.yaml':
       filename:
         - find: '/(uat[^/]*)/(.+)'
           replace: '/prod-$1/$2'
   ```

---

### How do I control output verbosity with --verbose and --quiet?

**Three verbosity levels:**

| Flag        | Output Level                         | Use When                              |
| ----------- | ------------------------------------ | ------------------------------------- |
| (default)   | Progress, summaries, file operations | Normal interactive usage              |
| `--verbose` | All default + debug details          | Troubleshooting, understanding config |
| `--quiet`   | Only errors and stop rule violations | CI/CD, scripting, minimal output      |

**Verbose mode shows additional debug information:**

```bash
helm-env-delta --config config.yaml --verbose
```

**Debug output includes:**

- Config inheritance chain resolution
- Glob pattern matching results
- Filename transformation examples
- Diff computation pipeline details
- Stop rule validation statistics

**Quiet mode suppresses all non-critical output:**

```bash
helm-env-delta --config config.yaml --quiet
```

**Still shown in quiet mode:**

- Critical errors (file not found, permission denied, etc.)
- Stop rule violations
- JSON output (when using `--diff-json`)

**Important notes:**

- `--verbose` and `--quiet` are **mutually exclusive** (error if both provided)
- Machine-readable output (`--diff-json`) **always outputs** regardless of verbosity
- Automatic update check is skipped in quiet mode

**Example use cases:**

```bash
# Debugging config issues
helm-env-delta --config config.yaml --verbose --dry-run

# CI/CD with minimal noise
helm-env-delta --config config.yaml --quiet --diff-json > report.json

# Troubleshoot glob patterns
helm-env-delta --config config.yaml --verbose --dry-run | grep "Matched:"

# Silent execution (only errors shown)
helm-env-delta --config config.yaml --quiet
```

---

### How can I preview which files will be synced without processing them?

**Use `--list-files`** to quickly see which files match your glob patterns:

```bash
helm-env-delta --config config.yaml --list-files
```

**Output:**

```
📋 Files to be synced:

Source files: 12
  deployments/api.yaml
  deployments/web.yaml
  services/api-service.yaml
  ...

Destination files: 10
  deployments/api.yaml
  deployments/web.yaml
  ...
```

**When to use:**

- Verify glob patterns are matching the right files
- Check filename transforms before processing
- Quick sanity check without running full diff

**Compare to:**

- `--dry-run --diff` - Processes diffs (slower, but shows changes)
- `--list-files` - Just lists files (faster, no diff processing)

---

### How can I see the final resolved configuration after inheritance?

**Use `--show-config`** to display the merged configuration after all `extends` chains are resolved:

```bash
helm-env-delta --config config.yaml --show-config
```

**When to use:**

- Debug config inheritance issues
- Verify parent configs are being merged correctly
- Understand what the final effective config looks like
- Document the actual configuration being used

**Example:**

```yaml
# base.yaml
source: ./base-source
exclude: ['**/test*.yaml']

# config.yaml
extends: ./base.yaml
destination: ./prod
skipPath:
  '**/*.yaml': ['metadata.namespace']
```

Running `--show-config` shows the **merged result** (both configs combined).

---

### Does --validate show warnings for potential config issues?

**Yes!** As of recent versions, `--validate` now shows **non-fatal warnings** in addition to errors:

```bash
helm-env-delta --config config.yaml --validate
```

**Warnings detect:**

- ✅ Inefficient glob patterns (e.g., `**/**` should be `**/*`)
- ✅ Duplicate patterns in include/exclude arrays
- ✅ Conflicting patterns (same pattern in both include and exclude)
- ✅ Empty skipPath arrays (no effect)
- ✅ Empty transform arrays (no content or filename transforms)

**Example output:**

```
✓ Configuration is valid

⚠️  Validation Warnings (non-fatal):

  • Inefficient glob pattern '**/**/*.yaml' detected (use '**/*' instead)
  • Duplicate patterns found in include array
  • skipPath pattern 'empty.yaml' has empty array (will have no effect)
```

**Warnings vs Errors:**

- **Errors** = Config is invalid, tool won't run
- **Warnings** = Config works but could be improved

---

## Advanced Topics

### When should I use --suggest vs manually writing my config?

**Use `--suggest` (heuristic analysis) when:**

- 🚀 **Starting from scratch**: Let heuristics discover patterns automatically from your files
- 🔍 **Discovering patterns**: You're not sure what's changing; let pattern recognition help
- ⏰ **Saving time**: Manually analyzing 50+ files would take hours; heuristics work in seconds
- 📚 **Learning**: Understand typical patterns detected by intelligent algorithms
- 🔄 **Config audit**: Verify you haven't missed patterns through automated analysis
- 🧠 **Pattern discovery**: Leverage semantic matching and smart filtering
- 🎯 **Confidence tuning**: Adjust threshold to find the right balance for your use case

**Manually write config when:**

- 🎯 **Specific requirements**: You know exactly what needs to change
- 🏗️ **Complex patterns**: Multi-step transforms or advanced regex beyond heuristic detection
- 📐 **Custom rules**: Business-specific validation logic not covered by heuristics
- 🔒 **Security-sensitive**: Careful manual control over what gets synced
- 🧪 **One-off sync**: Simple, temporary synchronization
- 🎨 **Edge cases**: Patterns too specific or nuanced for automated detection

**Hybrid approach (recommended):**

```bash
# 1. Start with heuristic suggestions (tune threshold as needed)
helm-env-delta --config minimal-config.yaml --suggest --suggest-threshold 0.5 > suggestions.yaml

# 2. Review suggestions and pick high-confidence patterns from heuristic analysis

# 3. Add to your config with refinements
cat suggestions.yaml >> config.yaml

# 4. Manually add complex/business-specific rules that heuristics can't detect

# 5. Test thoroughly
helm-env-delta --config config.yaml --dry-run --diff
```

**Example - When heuristic suggestions help:**

```yaml
# Heuristics detected this pattern automatically (semantic matching):
transforms:
  '**/*.yaml':
    content:
      - find: 'uat-db\.internal'
        replace: 'prod-db.internal'
        # 95% confidence, 42 occurrences (boosted by 'uat/prod' semantic pattern)

# You refine it with word boundaries:
transforms:
  '**/*.yaml':
    content:
      - find: '\buat-db\.internal\b'
        replace: 'prod-db.internal'
```

**Pro tip:** Use `--suggest` first to leverage heuristic analysis for a baseline, then refine manually. The intelligent pattern detection finds patterns you might miss, and you add the domain knowledge.

---

### How does the deep merge work and what gets preserved?

**Deep merge process:**

1. Source is processed (transforms + skipPath applied)
2. Destination is read completely (including skipped paths)
3. Processed source is merged into destination structure
4. Arrays are **replaced entirely** (not merged element-by-element)

**Example:**

```yaml
# Source (after transforms)
spec:
  replicas: 3
  image: my-app:v2

# Destination
spec:
  replicas: 5
  image: my-app:v1
  customField: value

# skipPath: ['spec.replicas']

# Result after merge
spec:
  replicas: 5           # ← Preserved (skipped)
  image: my-app:v2      # ← Updated from source
  customField: value    # ← Preserved (not in source)
```

---

### Can I sort arrays or enforce key ordering in output YAML?

**Yes!** Use `outputFormat`:

```yaml
outputFormat:
  # Custom key ordering
  keyOrders:
    'apps/*.yaml':
      - 'apiVersion'
      - 'kind'
      - 'metadata'
      - 'spec'

  # Array sorting
  arraySort:
    'services/**/values.yaml':
      - path: 'env'
        sortBy: 'name'
        order: 'asc' # or 'desc'

  # Other formatting
  indent: 2
  keySeparator: true # Blank line between top-level keys
```

**Skip formatting:** Use `--skip-format` to bypass outputFormat section entirely.

---

### What's the difference between --diff, --diff-html, and --diff-json?

**Different output formats for different needs:**

| Flag          | Output               | Use Case                     |
| ------------- | -------------------- | ---------------------------- |
| `--diff`      | Console unified diff | Quick review in terminal     |
| `--diff-html` | HTML side-by-side    | Visual review, opens browser |
| `--diff-json` | JSON to stdout       | CI/CD, programmatic analysis |

**You can combine them:**

```bash
helm-env-delta --config config.yaml --diff --diff-html --diff-json > report.json
```

**JSON output is best for:**

- CI/CD validation
- Piping to jq for filtering
- Automated reporting
- Integration with other tools

---

### How can I see field-level changes instead of file-level changes?

Use `--diff-json` with jq:

```bash
# All field-level changes
helm-env-delta --config config.yaml --diff-json | jq '.files.changed[].changes'

# Changes to specific field
helm-env-delta --config config.yaml --diff-json | jq '
  .files.changed[].changes[] |
  select(.path | contains("image.tag"))
'

# Summary of what fields changed
helm-env-delta --config config.yaml --diff-json | jq '
  .files.changed[] |
  {file: .path, fields: [.changes[].path]}
'
```

The JSON output includes JSONPath notation for each changed field (e.g., `$.spec.replicas`).

---

### Can HelmEnvDelta handle binary files or non-YAML files?

**Yes, with limitations:**

- **Binary files**: Copied as-is (no transformations or diff)
- **Non-YAML text files**: Copied as-is (no YAML-specific processing)
- **YAML files**: Full processing (transforms, skipPath, formatting, etc.)

**Configuration:**

```yaml
include:
  - '**/*.yaml' # YAML processing
  - '**/*.md' # Copy as-is
  - '**/*.json' # Copy as-is
```

**Note:** Transforms only apply to YAML files. Other files are copied directly from source to destination.

---

## Still Have Questions?

- **Documentation**: See [README.md](README.md) for comprehensive guides
- **Issues**: [GitHub Issues](https://github.com/BCsabaEngine/helm-env-delta/issues)
- **Contributing**: See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines

---

**Last Updated:** 2026-01-01 (chore/opt: Code style optimizations - simplified arrow functions for better readability)
