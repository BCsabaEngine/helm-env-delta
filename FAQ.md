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

### 1. What is HelmEnvDelta and what problem does it solve?

HelmEnvDelta is a CLI tool that automates the synchronization of YAML configuration files between different environments (like UAT → Production) in GitOps workflows. It solves the problem of manual, error-prone file copying by:

- Intelligently syncing files while preserving environment-specific values
- Validating changes against safety rules before applying them
- Enforcing consistent YAML formatting across environments
- Providing clear audit trails through diff reports

**Use it when:** You manage multiple Kubernetes/Helm environments and need to safely promote configurations between them.

---

### 2. How is HelmEnvDelta different from git diff or other diff tools?

HelmEnvDelta performs **structural YAML comparison** rather than line-by-line text comparison:

- **Git diff**: Shows changes when arrays are reordered, formatting differs, or whitespace changes
- **HelmEnvDelta**: Parses YAML structure, ignores formatting/order differences, shows only meaningful content changes

Additionally, HelmEnvDelta:

- Applies transformations (environment-specific value replacement)
- Filters out paths that should never sync (skipPath)
- Validates changes against safety rules (stopRules)
- Can automatically sync files after validation

---

### 3. Is HelmEnvDelta specific to Helm, or can I use it for other YAML files?

Despite the name, HelmEnvDelta works with **any YAML files**, not just Helm:

- Kubernetes manifests
- ArgoCD applications
- CI/CD pipeline configurations
- Docker Compose files
- Any YAML-based configuration

The tool focuses on YAML structure and environment synchronization, regardless of the specific use case.

---

### 4. Can I use HelmEnvDelta with ArgoCD, Flux, or other GitOps tools?

**Yes!** HelmEnvDelta is designed to complement GitOps workflows:

1. **You** use HelmEnvDelta to sync files locally
2. **You** commit the changes to git
3. **Your GitOps tool** (ArgoCD/Flux) detects the commit and deploys

HelmEnvDelta handles the file synchronization, while your GitOps tool handles the deployment. They work together seamlessly.

---

## Installation & Setup

### 5. Does HelmEnvDelta automatically check for updates?

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

### 6. What are the system requirements?

**Minimum requirements:**

- Node.js >= 22
- npm >= 9
- Any operating system (Linux, macOS, Windows)

**Installation:**

```bash
npm install -g helm-env-delta
```

---

### 7. How do I get started with a minimal configuration?

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

### 8. Can I test HelmEnvDelta without modifying my files?

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

### 9. What's the difference between skipPath and transforms?

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

### 10. How do I handle environment-specific values like namespaces or replica counts?

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

### 11. Can I use a base configuration and override it per environment?

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

### 12. How deep can config inheritance go?

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

### 13. What's the recommended workflow for syncing environments?

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

### 14. Can I sync multiple environment pairs with one config?

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

### 15. How do I integrate HelmEnvDelta into my CI/CD pipeline?

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

### 16. What does the prune option do and when should I use it?

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

### 17. How do transforms work and in what order are they applied?

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

### 18. Can I transform file paths, not just content?

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

### 19. How do I use regex capture groups in transforms?

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

### 20. What JSONPath syntax should I use for skipPath and stopRules?

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

### 21. What are stop rules and when should I use them?

**Stop rules prevent dangerous changes** from being applied:

| Rule Type            | Purpose                       | Example                 |
| -------------------- | ----------------------------- | ----------------------- |
| `semverMajorUpgrade` | Block major version increases | Prevent v1.x → v2.0     |
| `semverDowngrade`    | Block any version downgrades  | Prevent v1.3.2 → v1.2.4 |
| `numeric`            | Validate number ranges        | Ensure replicas 2-10    |
| `regex`              | Block pattern matches         | Reject pre-release tags |

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

### 22. How do I override stop rules when I actually want to make a blocked change?

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

### 23. Can I validate changes without actually syncing files?

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

### 24. Why are my glob patterns not matching files?

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

### 25. Why are some fields still being synced when I have them in skipPath?

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

### 26. What should I do if I get file collision errors?

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

### 27. How do I control output verbosity with --verbose and --quiet?

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

### 28. How can I preview which files will be synced without processing them?

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

### 29. How can I see the final resolved configuration after inheritance?

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

### 30. Does --validate show warnings for potential config issues?

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

### 31. How does the deep merge work and what gets preserved?

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

### 32. Can I sort arrays or enforce key ordering in output YAML?

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

### 33. What's the difference between --diff, --diff-html, and --diff-json?

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

### 34. How can I see field-level changes instead of file-level changes?

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

### 35. Can HelmEnvDelta handle binary files or non-YAML files?

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

**Last Updated:** 2025-12-20
