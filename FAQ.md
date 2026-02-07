# Frequently Asked Questions (FAQ)

Common questions and answers about HelmEnvDelta.

## Table of Contents

- [General Questions](#general-questions)
- [Installation & Setup](#installation--setup)
- [Configuration](#configuration)
- [Usage & Workflow](#usage--workflow)
- [CLI Shortcuts & Filtering](#cli-shortcuts--filtering)
- [Transforms & Path Filtering](#transforms--path-filtering)
- [Stop Rules & Safety](#stop-rules--safety)
- [Team & Collaboration](#team--collaboration)
- [Performance & Scaling](#performance--scaling)
- [Adoption & Migration](#adoption--migration)
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

### Is this a Helm plugin or a generic YAML tool?

**HelmEnvDelta is a standalone CLI tool, not a Helm plugin.** It works with any YAML files:

- **Not a Helm plugin**: No Helm installation required, doesn't integrate with `helm` CLI
- **Not limited to Helm**: Works with any YAML configuration (Kubernetes manifests, ArgoCD apps, CI configs)
- **Name origin**: Originally designed for Helm values files, but the underlying technology is YAML-agnostic

**Think of it as:** A specialized diff/sync tool that understands YAML structure, with features tailored for GitOps environment promotion workflows.

---

### When should I not use HelmEnvDelta?

**HelmEnvDelta may not be the right fit when:**

- **Real-time sync needed**: HelmEnvDelta is a batch tool, not a continuous sync daemon
- **Non-YAML configs**: JSON, TOML, INI files won't benefit from YAML-aware features
- **Identical environments**: If source and destination should be exact copies, `rsync` or `cp` is simpler
- **Complex templating**: If you need Helm's `{{ .Values }}` templating, use Helm itself
- **Single-file changes**: For one-off edits, manual changes may be faster
- **No environment differences**: If there are no transforms or skipPath needs, plain file copy works

**Better alternatives for specific cases:**

| Scenario            | Consider Instead         |
| ------------------- | ------------------------ |
| Helm templating     | `helm template`          |
| Identical file copy | `rsync`, `cp -r`         |
| JSON config sync    | Custom scripts with `jq` |
| Real-time GitOps    | ArgoCD ApplicationSets   |

---

### How does this compare to Helmfile / Kustomize / plain scripts?

**Different tools for different purposes:**

| Tool              | Purpose                                     | When to Use                                   |
| ----------------- | ------------------------------------------- | --------------------------------------------- |
| **HelmEnvDelta**  | Environment-aware YAML sync with validation | Promoting configs between environments safely |
| **Helmfile**      | Declarative Helm release management         | Managing multiple Helm releases               |
| **Kustomize**     | Kubernetes manifest patching                | Overlaying environment-specific patches       |
| **Plain scripts** | Custom automation                           | Simple or highly unique requirements          |

**HelmEnvDelta complements these tools:**

```bash
# Kustomize generates manifests, HelmEnvDelta syncs them between environments
kustomize build overlays/uat > uat/
helm-env-delta --config config.yaml  # Sync uat/ → prod/
```

**See [README.md](README.md#comparison-with-alternatives) for detailed comparisons.**

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

**Yes!** Always use `--dry-run` (or `-D`) to preview changes:

```bash
# Console output (using short flags)
hed -c config.yaml -D -d

# Visual HTML report
hed -c config.yaml -D -H

# JSON output for programmatic analysis
hed -c config.yaml -D -J
```

Dry-run shows exactly what would change without writing any files.

---

## CLI Shortcuts & Filtering

### What are the command-line shortcuts?

HelmEnvDelta provides short flags for common options:

| Long Flag       | Short | Description                                      |
| --------------- | ----- | ------------------------------------------------ |
| `--config`      | `-c`  | Configuration file (required)                    |
| `--dry-run`     | `-D`  | Preview changes without writing                  |
| `--diff`        | `-d`  | Show console diff                                |
| `--diff-html`   | `-H`  | Generate HTML report                             |
| `--diff-json`   | `-J`  | Output JSON to stdout                            |
| `--skip-format` | `-S`  | Skip YAML formatting                             |
| `--list-files`  | `-l`  | List files without processing                    |
| `--filter`      | `-f`  | Filter files by filename/content                 |
| `--mode`        | `-m`  | Filter by change type (new/modified/deleted/all) |

**Examples using short flags:**

```bash
# Preview with console diff
hed -c config.yaml -D -d

# HTML report
hed -c config.yaml -H

# JSON output piped to jq
hed -c config.yaml -J | jq '.summary'

# Filter and preview modified files
hed -c config.yaml -f api -m modified -D -d

# List files
hed -c config.yaml -l
```

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
hed -c config.yaml --suggest > suggestions.yaml

# 3. Review suggestions and copy relevant sections to config.yaml

# 4. Test with dry-run
hed -c config.yaml -D -d

# 5. Execute sync
hed -c config.yaml
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
# 1. Review changes with dry-run (using short flags)
hed -c config.yaml -D -d

# 2. Generate detailed HTML report
hed -c config.yaml -D -H

# 3. Execute sync if changes look good
hed -c config.yaml

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

### What filter operators are available for array matching?

HelmEnvDelta supports **CSS-style filter operators** for flexible array item matching:

| Operator | Name       | Example          | Matches                                   |
| -------- | ---------- | ---------------- | ----------------------------------------- |
| `=`      | equals     | `[name=DEBUG]`   | Exact match only                          |
| `^=`     | startsWith | `[name^=DB_]`    | `DB_HOST`, `DB_PORT`, `DB_USER`           |
| `$=`     | endsWith   | `[name$=_KEY]`   | `API_KEY`, `SECRET_KEY`                   |
| `*=`     | contains   | `[name*=SECRET]` | `MY_SECRET_KEY`, `SECRET`, `SECRET_TOKEN` |

**Examples:**

```yaml
skipPath:
  '**/*.yaml':
    # Skip all env vars starting with DB_
    - 'env[name^=DB_]'

    # Skip all secrets (ending with _SECRET or _KEY)
    - 'env[name$=_SECRET]'
    - 'env[name$=_KEY]'

    # Skip anything containing PASSWORD
    - 'env[name*=PASSWORD]'

    # Combine with nested paths
    - 'containers[name^=init-].resources'
    - 'spec.containers[name*=sidecar].env[name$=_TOKEN]'
```

**Use cases:**

- **startsWith (`^=`)**: Skip all `DB_*` environment variables, all `init-*` containers
- **endsWith (`$=`)**: Skip all `*_KEY` secrets, all `*-data` volumes
- **contains (`*=`)**: Skip anything with `PASSWORD`, `SECRET`, or `TOKEN` in the name

**Note:** Values are converted to strings for comparison (numbers work too: `[id^=100]` matches `1001`, `1002`)

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

### What happens if something goes wrong, how do I roll back?

**HelmEnvDelta only modifies files in your Git repository—rollback is simple:**

```bash
# Option 1: Discard uncommitted changes
git checkout -- .

# Option 2: Revert after commit
git revert HEAD

# Option 3: Reset to previous commit
git reset --hard HEAD~1
```

**Best practices for safe rollback:**

1. **Always use `--dry-run` first** to preview changes
2. **Commit before syncing** so you have a clean rollback point
3. **Review `git diff`** after sync before committing
4. **Use feature branches** for risky syncs

**Recovery scenarios:**

| Situation                  | Recovery                           |
| -------------------------- | ---------------------------------- |
| Sync ran but not committed | `git checkout -- .`                |
| Committed but not pushed   | `git reset --hard HEAD~1`          |
| Pushed to remote           | `git revert HEAD` + push           |
| GitOps deployed bad config | Revert commit, let GitOps redeploy |

**Note:** HelmEnvDelta never directly modifies your Kubernetes cluster—only Git files.

---

### Can HelmEnvDelta break my production cluster?

**No—HelmEnvDelta cannot directly break your cluster.** It only modifies files in your local Git repository:

1. **HelmEnvDelta** syncs files locally (Git working directory)
2. **You** review and commit the changes
3. **You** push to remote
4. **Your GitOps tool** (ArgoCD/Flux) deploys the changes

**Multiple safety layers:**

- `--dry-run` lets you preview without any file changes
- Stop rules block dangerous changes (version downgrades, forbidden patterns)
- Git diff shows exactly what changed before commit
- GitOps tools often have their own sync/approval workflows

**The worst case scenario:** Bad config files get committed and deployed. Recovery is a `git revert` away.

**To maximize safety:**

```bash
# 1. Preview changes
helm-env-delta --config config.yaml --dry-run --diff-html

# 2. Run with stop rules enabled
helm-env-delta --config config.yaml  # Will fail on violations

# 3. Review git diff before committing
git diff

# 4. Use protected branches with PR reviews
```

---

### How do I enforce mandatory dry-run / approvals in teams?

**Use CI/CD pipelines to enforce process:**

**GitHub Actions example:**

```yaml
name: Sync Validation

on:
  pull_request:
    paths: ['environments/**']

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install HelmEnvDelta
        run: npm install -g helm-env-delta

      - name: Dry-run validation (mandatory)
        run: |
          helm-env-delta --config config.yaml --dry-run --diff-json > report.json

          # Fail on stop rule violations
          VIOLATIONS=$(jq '.stopRuleViolations | length' report.json)
          if [ "$VIOLATIONS" -gt 0 ]; then
            echo "❌ Stop rule violations detected!"
            jq '.stopRuleViolations' report.json
            exit 1
          fi

      - name: Post diff as PR comment
        uses: actions/github-script@v7
        with:
          script: |
            const report = require('./report.json');
            // Format and post as PR comment
```

**Enforcement strategies:**

| Strategy           | Implementation                       |
| ------------------ | ------------------------------------ |
| Mandatory dry-run  | CI job must pass before merge        |
| Required approvals | GitHub branch protection rules       |
| Audit trail        | `--diff-json` artifacts stored in CI |
| No direct pushes   | Protected branches, PR-only workflow |

**Team workflow:**

1. Developer creates PR with sync changes
2. CI runs `--dry-run --validate` automatically
3. Team reviews diff in PR comments
4. Approval required before merge
5. Merge triggers actual sync + GitOps deployment

---

## Team & Collaboration

### How should multiple teams share transforms and stop rule presets?

**Use external files and config inheritance:**

**Shared transform library:**

```
configs/
├── shared/
│   ├── transforms/
│   │   ├── common-env.yaml      # uat→prod, staging→prod
│   │   ├── database-urls.yaml   # DB connection patterns
│   │   └── service-names.yaml   # Service naming conventions
│   ├── stop-rules/
│   │   ├── forbidden-versions.yaml
│   │   └── security-patterns.yaml
│   └── base-config.yaml         # Shared base configuration
├── team-a/
│   └── config.yaml              # extends: ../shared/base-config.yaml
└── team-b/
    └── config.yaml              # extends: ../shared/base-config.yaml
```

**Shared base config:**

```yaml
# configs/shared/base-config.yaml
transforms:
  '**/*.yaml':
    contentFile:
      - './transforms/common-env.yaml'
      - './transforms/database-urls.yaml'

stopRules:
  '**/*.yaml':
    - type: 'regexFile'
      file: './stop-rules/forbidden-versions.yaml'
    - type: 'semverDowngrade'
      path: 'image.tag'
```

**Team-specific config:**

```yaml
# configs/team-a/config.yaml
extends: '../shared/base-config.yaml'

source: '../../services/team-a/uat'
destination: '../../services/team-a/prod'

# Team-specific additions
transforms:
  '**/*.yaml':
    content:
      - find: 'team-a-uat'
        replace: 'team-a-prod'
```

**Benefits:**

- Consistent patterns across teams
- Central updates propagate automatically
- Teams can still customize as needed
- Version control tracks shared config changes

---

### Can different teams use different configs in the same mono-repo?

**Yes!** Each team maintains their own config file:

**Mono-repo structure:**

```
mono-repo/
├── services/
│   ├── team-alpha/
│   │   ├── uat/
│   │   ├── prod/
│   │   └── hed-config.yaml
│   ├── team-beta/
│   │   ├── uat/
│   │   ├── prod/
│   │   └── hed-config.yaml
│   └── team-gamma/
│       ├── uat/
│       ├── prod/
│       └── hed-config.yaml
└── shared/
    └── base-config.yaml
```

**Team-specific execution:**

```bash
# Team Alpha syncs their services
helm-env-delta --config services/team-alpha/hed-config.yaml

# Team Beta syncs their services
helm-env-delta --config services/team-beta/hed-config.yaml

# Or script for all teams
for config in services/*/hed-config.yaml; do
  helm-env-delta --config "$config" --dry-run --diff
done
```

**CI/CD with path filtering:**

```yaml
# GitHub Actions - only run for changed team
on:
  push:
    paths: ['services/team-alpha/**']

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - run: helm-env-delta --config services/team-alpha/hed-config.yaml
```

---

### How do I review HelmEnvDelta changes in pull requests?

**Generate diff reports for PR review:**

**Option 1: JSON diff as PR comment**

```yaml
- name: Generate diff
  run: |
    helm-env-delta --config config.yaml --dry-run --diff-json > diff.json

- name: Post PR comment
  uses: actions/github-script@v7
  with:
    script: |
      const fs = require('fs');
      const diff = JSON.parse(fs.readFileSync('diff.json', 'utf8'));

      let comment = '## HelmEnvDelta Sync Preview\n\n';
      comment += `**Files changed:** ${diff.files.changed.length}\n`;
      comment += `**Files added:** ${diff.files.added.length}\n`;
      comment += `**Stop rule violations:** ${diff.stopRuleViolations.length}\n`;

      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: comment
      });
```

**Option 2: HTML report as artifact**

```yaml
- name: Generate HTML report
  run: |
    helm-env-delta --config config.yaml --dry-run --diff-html
    mv helm-env-delta-report.html report.html

- name: Upload artifact
  uses: actions/upload-artifact@v4
  with:
    name: sync-diff-report
    path: report.html
```

**Option 3: Inline diff in PR**

````yaml
- name: Show console diff
  run: |
    echo '```diff' >> $GITHUB_STEP_SUMMARY
    helm-env-delta --config config.yaml --dry-run --diff >> $GITHUB_STEP_SUMMARY
    echo '```' >> $GITHUB_STEP_SUMMARY
````

**Review checklist for PRs:**

- [ ] All stop rule violations explained/approved
- [ ] Transforms applied correctly (check diff)
- [ ] No unexpected files changed
- [ ] skipPath working as expected

---

## Performance & Scaling

### How does it perform on large repos?

**HelmEnvDelta is optimized for large repositories:**

**Performance characteristics:**

| Repo Size  | Files    | Typical Runtime |
| ---------- | -------- | --------------- |
| Small      | 10-50    | < 1 second      |
| Medium     | 50-200   | 1-3 seconds     |
| Large      | 200-1000 | 3-10 seconds    |
| Very large | 1000+    | 10-30 seconds   |

**Optimization strategies used:**

- **Parallel file loading**: Uses `Promise.all` for concurrent I/O
- **Pattern caching**: Glob patterns compiled once and reused
- **Memoization**: JSONPath parsing, serialization cached
- **Early exit**: Files with no differences skip further processing
- **Lazy loading**: External transform/rule files loaded on-demand

**Tips for large repos:**

```yaml
# Be specific with patterns (faster than **/*)
include:
  - 'services/*/values.yaml'
  - 'apps/*/deployment.yaml'

# Exclude large/irrelevant directories
exclude:
  - '**/node_modules/**'
  - '**/vendor/**'
  - '**/test/**'
```

**Run performance benchmarks:**

```bash
npm run test:perf  # Shows detailed timing
```

---

### Can I limit runs to a subset of services?

**Yes!** Use CLI filters, specific include patterns, or multiple config files:

**Option 1: CLI Filter (NEW - Recommended for ad-hoc filtering)**

Use `-f, --filter` to filter files by filename or content, and `-m, --mode` to filter by change type:

```bash
# Filter to only process files matching 'frontend'
hed -c config.yaml -f frontend -d

# Sync only new files
hed -c config.yaml -m new

# Preview modified files only
hed -c config.yaml -m modified -D -d

# Combine filter and mode: only modified files containing 'api'
hed -c config.yaml -f api -m modified -D -d

# Filter by change type: new, modified, deleted, or all (default)
hed -c config.yaml -m deleted -D  # Preview files that would be deleted
```

**Option 2: Targeted include patterns (in config)**

```yaml
# config-frontend-only.yaml
source: './uat'
destination: './prod'

include:
  - 'services/frontend/**/*.yaml'
  - 'services/web-app/**/*.yaml'
```

**Option 3: Multiple configs per service group**

```bash
# Sync only critical services
helm-env-delta -c config.critical.yaml

# Sync non-critical later
helm-env-delta -c config.non-critical.yaml
```

**Option 4: Directory-scoped configs**

```yaml
# services/api/config.yaml
source: './uat'
destination: './prod'
include:
  - '*.yaml' # Only files in this directory
```

Run from service directory:

```bash
cd services/api
helm-env-delta -c config.yaml
```

**CI/CD with changed-file detection:**

```yaml
- name: Detect changed services
  id: changes
  run: |
    CHANGED=$(git diff --name-only HEAD~1 | grep -o 'services/[^/]*' | sort -u)
    echo "services=$CHANGED" >> $GITHUB_OUTPUT

- name: Sync only changed
  run: |
    for svc in ${{ steps.changes.outputs.services }}; do
      if [ -f "$svc/hed-config.yaml" ]; then
        helm-env-delta -c "$svc/hed-config.yaml"
      fi
    done
```

---

## Adoption & Migration

### How do I introduce HelmEnvDelta into an existing GitOps setup?

**Gradual adoption strategy:**

**Week 1: Discovery (read-only)**

```bash
# Create minimal config
cat > config.yaml <<EOF
source: './uat'
destination: './prod'
EOF

# Discover differences
helm-env-delta --config config.yaml --dry-run --diff-html

# Get transform suggestions
helm-env-delta --config config.yaml --suggest > suggestions.yaml
```

**Week 2: Configure & validate**

```bash
# Add transforms and skipPath based on suggestions
# Test thoroughly with dry-run
helm-env-delta --config config.yaml --dry-run --diff

# Validate config
helm-env-delta --config config.yaml --validate
```

**Week 3: Pilot with non-critical service**

```bash
# Narrow scope to one service
# config.yaml: include: ['services/low-risk-app/**']

helm-env-delta --config config.yaml
git diff  # Review
git commit -m "Pilot: HelmEnvDelta sync for low-risk-app"
```

**Week 4+: Expand gradually**

- Add more services to include patterns
- Refine transforms based on real usage
- Add stop rules for safety
- Integrate into CI/CD

**Coexistence with existing processes:**

- HelmEnvDelta doesn't require exclusive control
- Continue manual syncs for services not yet migrated
- Mix automated and manual approaches during transition

---

### Can I import my existing scripts/regexes?

**Yes!** HelmEnvDelta supports external files for transforms and stop rules:

**Importing existing regex patterns:**

If you have existing scripts with patterns like:

```bash
# Old script
sed -i 's/uat-db/prod-db/g' "$file"
sed -i 's/staging/production/g' "$file"
```

Convert to HelmEnvDelta transform file:

```yaml
# transforms/migrated.yaml
uat-db: prod-db
staging: production
```

**Importing from shell scripts:**

```bash
# Extract patterns from existing sed commands
grep -oP "s/\K[^/]+(?=/[^/]+/)" sync-script.sh > patterns.txt

# Convert to YAML format
while IFS= read -r pattern; do
  read -r replacement
  echo "$pattern: $replacement"
done < patterns.txt > transforms/extracted.yaml
```

**Using in config:**

```yaml
transforms:
  '**/*.yaml':
    contentFile: './transforms/migrated.yaml'

    # Or combine with inline patterns
    content:
      - find: 'complex-(.+)-pattern'
        replace: 'new-$1-pattern'
```

**Importing forbidden patterns:**

```yaml
# stop-rules/forbidden.yaml (array format)
- localhost
- '127\.0\.0\.1'
- '-debug$'
- '^test-'
```

```yaml
stopRules:
  '**/*.yaml':
    - type: 'regexFile'
      file: './stop-rules/forbidden.yaml'
```

---

### What is a sensible first week adoption plan?

**Day 1-2: Assessment**

```bash
# Install globally
npm install -g helm-env-delta

# Create discovery config
cat > config.yaml <<EOF
source: './uat'        # Adjust paths
destination: './prod'
EOF

# Run discovery
helm-env-delta --config config.yaml --dry-run --diff-html
helm-env-delta --config config.yaml --suggest > suggestions.yaml

# Review: How many files? What patterns? What differences?
```

**Day 3: Basic configuration**

```bash
# Add transforms from suggestions (review first!)
# Add skipPath for environment-specific fields
# Add stop rules for safety

helm-env-delta --config config.yaml --validate
helm-env-delta --config config.yaml --dry-run --diff
```

**Day 4-5: Testing**

```bash
# Test on a copy of your repo
git checkout -b test-helm-env-delta
helm-env-delta --config config.yaml
git diff  # Review all changes

# If good, create PR for review
# If issues, refine config and repeat
```

**Day 6-7: Documentation & CI**

```bash
# Document your config choices
# Set up CI validation (--dry-run in PRs)
# Train team on workflow
```

**Success metrics for week 1:**

- [ ] Config file created and validated
- [ ] Dry-run produces expected results
- [ ] At least one successful sync (even small scope)
- [ ] Team understands basic workflow
- [ ] CI validation job created (optional but recommended)

**Common first-week pitfalls:**

| Pitfall            | Solution                            |
| ------------------ | ----------------------------------- |
| Too broad scope    | Start with 1-2 services             |
| Missing transforms | Use `--suggest`, refine iteratively |
| Over-engineering   | Start minimal, add rules as needed  |
| Skipping dry-run   | Always preview first!               |

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

### How do I filter files by name or show only certain change types?

**Use the CLI filter options for ad-hoc filtering:**

**Filter by filename or content (`-f, --filter`):**

```bash
# Only process files with 'prod' in filename or content (case-insensitive)
hed -c config.yaml -f prod -d

# Filter to deployment files
hed -c config.yaml -f deployment -D -d

# Filter to files containing specific service name
hed -c config.yaml -f my-service -d
```

**Filter by change type (`-m, --mode`):**

```bash
# Only show/sync new files (files in source but not in destination)
hed -c config.yaml -m new -D -d

# Only show/sync modified files (files that exist in both but differ)
hed -c config.yaml -m modified -D -d

# Only show files that would be deleted (with prune: true)
hed -c config.yaml -m deleted -D -d

# Show all changes (default)
hed -c config.yaml -m all -d
```

**Combine both filters:**

```bash
# Only modified files containing 'api' in name/content
hed -c config.yaml -f api -m modified -D -d

# Only new deployment files
hed -c config.yaml -f deployment -m new -D -d
```

**Use cases:**

- **Large repos**: Focus on specific services without modifying config
- **Debugging**: Isolate changes to specific files
- **Incremental sync**: Process only new or modified files
- **Review deleted files**: Preview what `prune: true` would remove

---

### How can I preview which files will be synced without processing them?

**Use `--list-files` (or `-l`)** to quickly see which files match your glob patterns:

```bash
hed -c config.yaml -l
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

**Yes!** The `--validate` flag performs comprehensive validation in two phases:

```bash
helm-env-delta --config config.yaml --validate
```

**Phase 1 - Static Config Warnings:**

- ✅ Inefficient glob patterns (e.g., `**/**` should be `**/*`)
- ✅ Duplicate patterns in include/exclude arrays
- ✅ Conflicting patterns (same pattern in both include and exclude)
- ✅ Empty skipPath arrays (no effect)
- ✅ Empty transform arrays (no content or filename transforms)

**Phase 2 - Pattern Usage Validation (NEW):**

- ✅ Unused exclude patterns (patterns that match no files)
- ✅ Unused skipPath glob patterns (patterns that match no files)
- ✅ Unused skipPath JSONPath fields (paths that don't exist in any matched files)
- ✅ Unused stopRules glob patterns (patterns that match no files)
- ✅ stopRules JSONPath fields that don't exist in any matched files

**Example output:**

```
✓ Validating configuration...

⚠️  Configuration Warnings (non-fatal):

  • Inefficient glob pattern '**/**/*.yaml' detected (use '**/*' instead)
  • Duplicate patterns found in include array

⚠️  Pattern Usage Warnings (non-fatal):

  • Exclude pattern 'test/**/*.yaml' matches no files
  • skipPath pattern 'legacy/*.yaml' matches no files
  • skipPath JSONPath 'microservice.replicaCountX' not found in any matched files (Pattern: svc/**/values.yaml, matches 50 file(s))
  • stopRules glob pattern 'helm-charts/**/*.yaml' matches no files (3 rule(s) defined)
  • stopRules JSONPath 'spec.replicas' not found in any matched files (Rule type: numeric, matches 5 file(s))

✓ Configuration is valid
```

**What gets validated:**

- **Static validation**: Syntax, structure, inefficiencies
- **File-based validation**: Loads source and destination files to verify all patterns actually match

**Warnings vs Errors:**

- **Errors** = Config is invalid, tool won't run
- **Warnings** = Config works but has potential issues (typos, outdated patterns, etc.)

**When to use:**

- After updating configuration files
- When troubleshooting why patterns aren't working
- As part of CI/CD pre-flight checks
- After reorganizing your file structure

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

### Can I format files without syncing?

**Yes!** Use `--format-only` to apply `outputFormat` rules to destination files without performing any sync:

```bash
# Preview what would be formatted
helm-env-delta --config config.yaml --format-only --dry-run

# Format destination files
helm-env-delta --config config.yaml --format-only
```

**Use cases:**

- Standardize YAML formatting across an existing environment
- Apply formatting rules after manual edits
- Enforce consistent style before committing

**Behavior:**

- Only processes files in the `destination` directory
- Applies `outputFormat` rules (indent, keySeparator, keyOrders, arraySort, quoteValues)
- Respects `include`/`exclude` patterns
- Skips non-YAML files automatically
- Works with `--dry-run` to preview changes

**Note:** `--format-only` and `--skip-format` are mutually exclusive (error if both provided).

---

### What's the difference between --diff, --diff-html, and --diff-json?

**Different output formats for different needs:**

| Flag          | Output               | Use Case                                                                                                                                     |
| ------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `--diff`      | Console unified diff | Quick review in terminal                                                                                                                     |
| `--diff-html` | HTML side-by-side    | Visual review, opens browser. Includes collapsible stats dashboard, synchronized scrolling, sidebar search, and auto-hidden empty categories |
| `--diff-json` | JSON to stdout       | CI/CD, programmatic analysis                                                                                                                 |

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

**Last Updated:** 2026-01-30 (Added CLI filter/mode options, command-line shortcuts)
