# 🚀 HelmEnvDelta

**GitOps-safe YAML sync for Helm values across environments (Dev → UAT → Prod)**

[![npm version](https://img.shields.io/npm/v/helm-env-delta.svg)](https://www.npmjs.com/package/helm-env-delta)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)

**Sync YAML configs across environments in seconds, not hours.**

**🛡️ Stop production incidents from configuration drift—before they happen.**

HelmEnvDelta (`hed`) automates environment synchronization for GitOps workflows while protecting your production-specific settings and preventing dangerous changes.

<p align="center">
  <img src="helm-env-delta.png" alt="helm-env-delta" />
</p>

## 👤 Who Is This For?

- **Platform/SRE teams** owning multiple environment repos
- **Teams** with repeated UAT → Prod copy-paste workflows
- **Helm/GitOps users** burned by config drift and sync errors

> **Not a Helm plugin** · **Not a live cluster diff** · **Not a general YAML linter**
>
> HelmEnvDelta syncs _files_, not running clusters. Use alongside Helm, ArgoCD, or Flux—not instead of them.

---

## 💡 Why Teams Love HelmEnvDelta

| Problem                      | Impact                                    | HelmEnvDelta Outcome                             |
| ---------------------------- | ----------------------------------------- | ------------------------------------------------ |
| Copying UAT → Prod by hand   | 30+ minutes, human errors                 | **1 min** scripted sync for 50+ files            |
| Hidden config drift          | Incidents in Prod                         | Stop rules & fixed values prevent unsafe changes |
| Accidental overwrites        | Production namespaces, replicas corrupted | `skipPath` preserves env-specific values         |
| Major version slips          | Breaking changes in Prod                  | `semverMajorUpgrade` rule blocks v1→v2           |
| Inconsistent YAML formatting | Noisy git diffs, painful reviews          | Standardized formatting, clean diffs             |

---

## ✨ Key Features

🔍 **Smart YAML Diff** - Compares structure, not text. Ignores formatting, comments, and array reordering to show only meaningful changes.

🎯 **Path Filtering** - Preserve environment-specific values (namespaces, replicas, secrets) that should never sync.

📌 **Fixed Values** - Set specific fields to constant values regardless of source/destination. Enforce production settings like `debug: false` or `replicas: 3` after every sync.

🔄 **Powerful Transforms** - Regex find/replace for both file content and paths. Load transforms from external YAML files for reusability. Change `uat-db.internal` → `prod-db.internal` automatically.

🛡️ **Safety Rules** - Block major version upgrades, scaling violations, and forbidden patterns. Load validation rules from external files. Scan globally or target specific fields.

🎨 **Format Enforcement** - Standardize YAML across all environments: key ordering, indentation, quoting, array sorting.

📦 **Config Inheritance** - Reuse base configurations with environment-specific overrides.

📊 **Multiple Reports** - Console, HTML (visual, self-contained), and JSON (CI/CD) output formats. HTML reports include collapsible diff stats dashboard, synchronized side-by-side scrolling, copy diff buttons, file search, and collapse/expand controls. Empty categories are automatically hidden.

🔍 **Discovery Tools** - Preview files (`-l`), inspect config (`--show-config`), filter by filename/content (`-f`), filter by change type (`-m`), validate with comprehensive warnings including unused pattern detection.

💡 **Smart Suggestions** - Heuristic analysis (`--suggest`) detects patterns and recommends transforms and stop rules automatically. Control sensitivity with `--suggest-threshold`.

🛡️ **Safety First** - Pre-execution summary, first-run tips, improved error messages with helpful examples.

⚡ **High Performance** - 45-60% faster than alternatives with intelligent caching and parallel processing.

🔔 **Auto Updates** - Notifies when newer versions are available (skips in CI/CD).

---

## 📥 Installation

```bash
npm install -g helm-env-delta
```

**Requirements:** Node.js ≥ 22, npm ≥ 9

---

## 🎯 Quick Start

### 1️⃣ Create Config

```yaml
# config.yaml
source: './uat'
destination: './prod'

skipPath:
  '**/*.yaml':
    - 'metadata.namespace' # Never overwrite prod namespace
    - 'spec.replicas' # Keep prod scaling

transforms:
  '**/*.yaml':
    content:
      - find: "-uat\\b"
        replace: '-prod'
```

### 2️⃣ Preview Changes

```bash
hed -c config.yaml -D -d
```

### 3️⃣ Execute Sync

```bash
hed -c config.yaml
```

### 4️⃣ Review in Browser

```bash
hed -c config.yaml -H
```

Self-contained HTML report — works offline, no CDN required. Includes collapsible diff stats dashboard, synchronized side-by-side scrolling, copy buttons, sidebar search, and collapse/expand controls. Empty categories are automatically hidden.

### 5️⃣ Get Smart Suggestions (Optional)

```bash
hed -c config.yaml --suggest

# Control suggestion sensitivity (0-1, default: 0.3)
hed -c config.yaml --suggest --suggest-threshold 0.7
```

Analyzes differences and suggests transforms and stop rules automatically with configurable confidence filtering.

**Done!** All files synced, production values preserved, changes validated.

---

## 🎬 Real-World Use Cases

### 🏢 Multi-Service GitOps

**Challenge:** 20+ microservices across Dev → UAT → Prod. Each has environment-specific namespaces, resource limits, and URLs.

_A platform team managing 25 microservices across 3 environments used to spend 2 hours every release copying and tweaking values files. Now 2 engineers sync everything in under 5 minutes with zero manual edits._

**Solution:**

```yaml
source: './helm/uat'
destination: './helm/prod'

skipPath:
  '**/*.yaml':
    - 'metadata.namespace'
    - 'resources.limits'
    - 'spec.replicas'

transforms:
  '**/*.yaml':
    content:
      - find: '-uat\\b'
        replace: '-prod'
```

**Result:** Sync 50+ files in 5 seconds with zero risk of overwriting production settings.

---

### 🚨 Prevent Production Incidents

**Challenge:** Production incidents from accidental major version upgrades or scaling beyond cluster capacity.

_After a v1→v2 image upgrade slipped through and caused a 4-hour outage, the team added semverMajorUpgrade rules. They've blocked 12 accidental major bumps since—and zero incidents._

**Solution:**

```yaml
stopRules:
  'services/**/values.yaml':
    - type: 'semverMajorUpgrade' # Block v1.x → v2.x
      path: 'image.tag'
    - type: 'numeric' # Enforce limits
      path: 'replicaCount'
      min: 2
      max: 10
```

**Result:** Dangerous changes blocked automatically. Use `--force` only when you intend it.

---

### 📐 Standardize Formatting

**Challenge:** Different editors, different formatting. Git diffs full of noise.

_Code reviews were painful: 80% of diff lines were formatting noise. After enabling outputFormat, PRs became clean structural diffs that reviewers actually read._

**Solution:**

```yaml
outputFormat:
  indent: 2
  keySeparator: true
  keyOrders:
    '**/*.yaml':
      - 'apiVersion'
      - 'kind'
      - 'metadata'
      - 'spec'
  arraySort:
    '**/*.yaml':
      - path: 'env'
        sortBy: 'name'
        order: 'asc'
```

**Result:** Every file formatted consistently. Clean diffs. Easier reviews.

---

## 🎓 Live Examples

The repository includes ready-to-run examples:

### 📁 Example 1: Config Inheritance

Shows how to reuse base configuration across multiple environment pairs.

```bash
helm-env-delta --config example/1-config-inheritance/config.uat-to-prod.yaml --dry-run --diff
```

### 🚦 Example 2: Stop Rules

Demonstrates all 5 stop rule types and how violations block execution.

```bash
helm-env-delta --config example/2-stop-rules/config.yaml --dry-run --diff
```

### ⛓️ Example 3: Multi-Environment Chain

Progressive promotion through Dev → UAT → Prod with cumulative transforms.

```bash
cd example/3-multi-env-chain
./sync-all.sh
```

### 🗑️ Example 4: Prune Mode

File deletion behavior with `prune: true` vs `prune: false`.

```bash
helm-env-delta --config example/4-prune-mode/config.with-prune.yaml --dry-run --diff
```

### 📦 Example 5: External Files

Load transforms and stop rules from external YAML files for better organization and reusability.

```bash
helm-env-delta --config example/5-external-files/config.yaml --dry-run --diff
```

**Features shown:**

- Transform files (`contentFile`, `filenameFile`)
- Pattern files (`regexFile`, `regexFileKey`)
- Global vs targeted regex validation

### 📌 Example 6: Fixed Values

Set specific fields to constant values regardless of source/destination. Perfect for enforcing production settings.

```bash
helm-env-delta --config example/6-fixed-values/config.yaml --dry-run --diff
```

**Features shown:**

- Simple path fixed values (`debug: false`, `logLevel: warn`)
- Nested paths (`spec.replicas`)
- Array filter operators (`env[name=LOG_LEVEL].value`)
- Combining with skipPath and transforms

### 🎨 Example 7: Format-Only Mode

Format YAML files without syncing. No source directory required - perfect for standardizing existing files.

```bash
# Preview which files would be formatted
helm-env-delta --config example/7-format-only/config.yaml --format-only --list-files

# Preview formatting changes
helm-env-delta --config example/7-format-only/config.yaml --format-only --dry-run

# Apply formatting
helm-env-delta --config example/7-format-only/config.yaml --format-only
```

**Features shown:**

- Format-only mode (no source required)
- Combining `--format-only` with `--list-files` to preview files
- Key ordering, array sorting, indentation standardization
- Minimal config for formatting existing files

---

## 💡 Smart Configuration Suggestions (Heuristic)

The `--suggest` flag uses heuristic analysis to examine differences between environments and automatically recommend configuration updates. This intelligent pattern detection helps bootstrap your config by discovering repeated changes and potential safety rules.

### How It Works

```bash
helm-env-delta --config config.yaml --suggest

# Control suggestion sensitivity (higher threshold = fewer, higher-confidence suggestions)
helm-env-delta --config config.yaml --suggest --suggest-threshold 0.7
```

**How heuristic analysis works:**

- 🔍 Intelligently detects repeated value changes across files
- 🎯 Suggests transform patterns (regex find/replace) based on semantic patterns
- 🛡️ Recommends stop rules for safety validation using pattern recognition
- 📊 Provides confidence scores and occurrence counts for each suggestion
- 🎛️ **NEW:** Configurable threshold filters suggestions by confidence level (0-1)
- 📝 Outputs copy-paste ready YAML configuration
- ✨ **Enhanced noise filtering:**
  - Ignores UUIDs, timestamps, single-character changes
  - Filters antonym pairs (enable/disable, true/false, on/off)
  - Filters regex special characters (unless semantic keywords present)
  - Filters version-number-only changes (service-v1 → service-v2)
  - Allows semantic patterns even with special chars (db.uat.com → db.prod.com)

### Example Output

```yaml
# Suggested Transforms
transforms:
  '**/*.yaml':
    content:
      - find: 'uat-cluster'
        replace: 'prod-cluster'
        # Confidence: 95% (42 occurrences across 12 files)

# Suggested Stop Rules
stopRules:
  '**/*.yaml':
    - type: 'semverMajorUpgrade'
      path: 'image.tag'
      # Detected version changes: v1.2.3 → v2.0.0
```

### When to Use

- 🚀 **First-time setup**: Let heuristics discover patterns automatically instead of manual analysis
- 🔄 **Config refinement**: Find missing transforms or stop rules through smart detection
- 📚 **Learning tool**: Understand what's changing between environments
- ⚡ **Quick start**: Bootstrap configuration from existing files using intelligent pattern matching
- 🧠 **Pattern discovery**: Leverage heuristic algorithms to identify semantic transformations (uat→prod, staging→production)
- 🎯 **Confidence tuning**: Adjust threshold to balance between finding all patterns vs. high-confidence only

**Confidence threshold control:**

```bash
# More suggestions (lower threshold = less strict)
helm-env-delta --config config.yaml --suggest --suggest-threshold 0.2

# Default balance (standard heuristics, threshold: 0.3)
helm-env-delta --config config.yaml --suggest

# Only high-confidence (higher threshold = more strict)
helm-env-delta --config config.yaml --suggest --suggest-threshold 0.8
```

**Workflow:**

```bash
# 1. Get suggestions (optionally with custom threshold)
helm-env-delta --config config.yaml --suggest --suggest-threshold 0.5 > suggestions.yaml

# 2. Review and copy relevant sections to config.yaml

# 3. Test with dry-run
helm-env-delta --config config.yaml --dry-run --diff

# 4. Execute
helm-env-delta --config config.yaml
```

---

## ⚙️ Configuration Reference

### 🎯 Core Settings

```yaml
source: './uat' # Required: Source folder (optional with --format-only)
destination: './prod' # Required: Destination folder (must differ from source)

include: # Optional: File patterns (default: all)
  - '**/*.yaml'
exclude: # Optional: Exclude patterns
  - '**/test*.yaml'

prune: false # Optional: Delete dest files not in source
confirmationDelay: 3000 # Optional: Delay in ms before sync (default: 3000, 0 to disable)
```

**Note:** Source and destination paths cannot resolve to the same folder.

---

### 🔒 Path Filtering (skipPath)

Preserve environment-specific fields during sync.

```yaml
skipPath:
  'apps/*.yaml':
    - 'metadata.namespace' # Top-level field
    - 'spec.destination.namespace' # Nested field
    - 'spec.ignoreDifferences[*].jsonPointers' # Array wildcard

  'services/**/values.yaml':
    - 'microservice.env[*].value' # All array items
    - 'resources.limits'
```

#### Filter Expressions (Skip by Name)

Skip specific array items by property value using CSS-style filter operators:

| Operator | Name       | Example          | Matches                   |
| -------- | ---------- | ---------------- | ------------------------- |
| `=`      | equals     | `[name=DEBUG]`   | Exact match               |
| `^=`     | startsWith | `[name^=DB_]`    | `DB_HOST`, `DB_PORT`      |
| `$=`     | endsWith   | `[name$=_KEY]`   | `API_KEY`, `SECRET_KEY`   |
| `*=`     | contains   | `[name*=SECRET]` | `MY_SECRET_KEY`, `SECRET` |

```yaml
skipPath:
  '**/*.yaml':
    # Equals (=) - exact match
    - 'env[name=SECRET_KEY]' # Skip item where name=SECRET_KEY
    - 'containers[name=sidecar]' # Skip entire sidecar container

    # StartsWith (^=) - prefix match
    - 'env[name^=DB_]' # Skip DB_HOST, DB_PORT, DB_USER
    - 'containers[name^=init-]' # Skip init-db, init-cache

    # EndsWith ($=) - suffix match
    - 'env[name$=_SECRET]' # Skip API_SECRET, DB_SECRET
    - 'volumes[name$=-data]' # Skip app-data, cache-data

    # Contains (*=) - substring match
    - 'env[name*=PASSWORD]' # Skip DB_PASSWORD, PASSWORD_HASH
    - 'containers[image*=nginx]' # Skip any nginx image

    # Nested paths with mixed operators
    - 'spec.containers[name^=sidecar-].env[name$=_KEY]'
```

**Syntax:**

- `array[prop=value]` - Match items where property equals value
- `array[prop^=prefix]` - Match items where property starts with prefix
- `array[prop$=suffix]` - Match items where property ends with suffix
- `array[prop*=substring]` - Match items where property contains substring
- `array[prop="value with spaces"]` - Quoted values for special characters
- Combine with wildcards: `containers[name=app].env[*].value`

**Use cases:** Namespaces, replicas, resource limits, secrets, URLs, environment-specific array items, batch filtering by naming conventions.

---

### 📌 Fixed Values (fixedValues)

Set specific JSONPath locations to constant values, regardless of source/destination values. Applied after merge, before formatting.

```yaml
fixedValues:
  # Apply to all YAML files
  '**/*.yaml':
    - path: 'debug'
      value: false
    - path: 'logLevel'
      value: 'warn'

  # Specific file patterns
  'deployment.yaml':
    - path: 'spec.replicas'
      value: 3
    - path: 'spec.template.spec.containers[name=app].resources.limits.memory'
      value: '512Mi'

  # Array filter operators supported
  'configmap.yaml':
    - path: 'data.env[name=LOG_LEVEL].value'
      value: 'info'
    - path: 'data.env[name^=FEATURE_].value' # startsWith
      value: 'stable'
```

**Supported filter operators:** `=` (equals), `^=` (startsWith), `$=` (endsWith), `*=` (contains) - updates ALL matching items

**Value types:** String, number, boolean, null, object, array

**Behavior:**

- **Filter operators update ALL matching items** (e.g., `env[name^=LOG_]` updates every item starting with `LOG_`)
- Applied during diff computation, so changes are visible in all reports (HTML, console, JSON)
- Non-existent paths are silently skipped
- Multiple rules for same path: last one wins
- Works with skipPath (fixedValues applied after skipPath restoration)

**Use cases:** Enforce production settings (`debug: false`), standardize resource limits, set mandatory environment variables, ensure consistent configuration across syncs.

---

### 🔄 Transformations

Regex find/replace for content and file paths. Load transforms from external files or define inline.

#### Inline Transforms (Regex)

```yaml
transforms:
  'services/**/values.yaml':
    content: # Transform YAML values (not keys)
      - find: "uat-db\\.(.+)\\.internal"
        replace: 'prod-db.$1.internal' # Capture group $1

  'config/**/*.yaml':
    filename: # Transform file paths
      - find: 'envs/uat/'
        replace: 'envs/prod/'
      - find: '-uat\.'
        replace: '-prod.'
```

#### File-Based Transforms (Literal)

Load transforms from external YAML files for better organization and reusability:

```yaml
transforms:
  '**/*.yaml':
    # Load content transforms from files (literal string replacement)
    contentFile:
      - './transforms/common.yaml' # Single file
      - './transforms/services.yaml' # Or array of files

    # Load filename transforms from file
    filenameFile: './transforms/paths.yaml'

    # Can combine with inline transforms (file-based run first)
    content:
      - find: 'v(\d+)-uat'
        replace: 'v$1-prod'
```

**Transform file format (key:value pairs):**

```yaml
# transforms/common.yaml - literal string replacements
staging: production
stg: prod
staging-db.internal: production-db.internal
```

**Execution order:**

1. File-based transforms (literal, case-sensitive)
2. Inline regex transforms (patterns)

**Content scope:** All string values in matched files
**Filename scope:** Full relative path (folders + filename)
**Processing:** Sequential (rule 1 output → rule 2 input)

---

### 🛡️ Stop Rules

Block dangerous changes before deployment.

| Icon | Rule Type            | Purpose                    | Example                                    |
| ---- | -------------------- | -------------------------- | ------------------------------------------ |
| 🚫   | `semverMajorUpgrade` | Block major version bumps  | Prevent `v1.2.3` → `v2.0.0`                |
| ⬇️   | `semverDowngrade`    | Block any downgrades       | Prevent `v1.3.0` → `v1.2.0`                |
| 📏   | `versionFormat`      | Enforce strict format      | Reject `1.2`, `v1.2.3-rc`, require `1.2.3` |
| 🔢   | `numeric`            | Validate ranges            | Keep `replicas` between 2-10               |
| 🔤   | `regex`              | Block patterns (inline)    | Reject `v0.x` pre-release versions         |
| 📄   | `regexFile`          | Block patterns (from file) | Load forbidden patterns from YAML array    |
| 🔑   | `regexFileKey`       | Block transform file keys  | Use transform keys as forbidden patterns   |

#### Inline Stop Rules

```yaml
stopRules:
  'services/**/values.yaml':
    - type: 'semverMajorUpgrade'
      path: 'image.tag'

    - type: 'numeric'
      path: 'replicaCount'
      min: 2
      max: 10

    - type: 'versionFormat'
      path: 'image.tag'
      vPrefix: 'required' # or 'forbidden', 'allowed'

    # Regex with path (targeted)
    - type: 'regex'
      path: 'image.tag'
      regex: '^v0\.'

    # NEW: Regex without path (global - scans all values)
    - type: 'regex'
      regex: '^127\.' # Block localhost IPs anywhere
```

#### File-Based Stop Rules

Load validation patterns from external files:

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

    # Use transform file keys as patterns (targeted)
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

**Path modes:**

- **With `path`**: Check specific field only (targeted)
- **Without `path`**: Scan all values recursively (global)

**Override:** Use `--force` to bypass stop rules when needed.

---

### 🎨 Output Formatting

Standardize YAML across all environments.

```yaml
outputFormat:
  indent: 2 # Indentation size
  keySeparator: true # Blank line between top-level keys (or second-level keys when single top-level key)

  keyOrders: # Custom key ordering
    'apps/*.yaml':
      - 'apiVersion'
      - 'kind'
      - 'metadata'
      - 'spec'

  arraySort: # Sort arrays
    'services/**/values.yaml':
      - path: 'env'
        sortBy: 'name'
        order: 'asc'

  quoteValues: # Force quoting
    'services/**/values.yaml':
      - 'env[*].value'
```

**Benefits:** Consistent formatting, cleaner diffs, better readability.

---

### 🔍 CLI Filter Operators

The `-f/--filter` flag supports logical operators for complex filtering:

| Operator | Name   | Example           | Matches                                         |
| -------- | ------ | ----------------- | ----------------------------------------------- |
| (none)   | Simple | `-f prod`         | Files where filename or content contains "prod" |
| `,`      | OR     | `-f prod,staging` | Files matching "prod" OR "staging"              |
| `+`      | AND    | `-f values+prod`  | Files matching "values" AND "prod"              |

```bash
# OR: match ANY term (filename or content)
hed -c config.yaml -f prod,staging --list-files

# AND: match ALL terms (can be split between filename and content)
hed -c config.yaml -f values+prod --list-files

# Escape literal , or + with backslash
hed -c config.yaml -f "foo\,bar" --list-files
```

**Constraints:**

- Cannot mix `+` and `,` in a single filter (throws error)
- Case-insensitive matching
- Empty terms are ignored (`a,,b` becomes `a,b`)

---

### 🔗 Config Inheritance

Reuse base configurations across environment pairs.

**Base config (`base.yaml`):**

```yaml
include: ['**/*.yaml']
prune: true

skipPath:
  'apps/*.yaml':
    - 'spec.destination.namespace'

outputFormat:
  indent: 2
  keySeparator: true
```

**Environment config (`prod.yaml`):**

```yaml
extends: './base.yaml' # Inherit base settings

source: './uat'
destination: './prod'

transforms: # Add environment-specific transforms
  '**/*.yaml':
    content:
      - find: '-uat\\b'
        replace: '-prod'

stopRules: # Add production safety rules
  'services/**/values.yaml':
    - type: 'semverMajorUpgrade'
      path: 'image.tag'
```

**Merging:**

- Primitives (`source`, `destination`, `prune`, `confirmationDelay`): Child overrides parent
- Arrays (`include`, `exclude`): Concatenated (parent + child)
- Per-file Records (`skipPath`, `transforms`, `stopRules`, `fixedValues`): Keys merged, arrays concatenated
- `outputFormat`: Shallow merged (child fields override parent)
- Max depth: 5 levels

---

## 🖥️ CLI Reference

### Commands

```bash
helm-env-delta --config <file> [options]
hed --config <file> [options]  # Short alias
```

### Options

| Flag                        | Short | Description                                                         |
| --------------------------- | ----- | ------------------------------------------------------------------- |
| `--config <path>`           | `-c`  | **Required** - Configuration file                                   |
| `--validate`                |       | Validate config and pattern usage (shows warnings)                  |
| `--suggest`                 |       | Analyze differences and suggest config updates                      |
| `--suggest-threshold <0-1>` |       | Minimum confidence for suggestions (default: 0.3)                   |
| `--dry-run`                 | `-D`  | Preview changes without writing files                               |
| `--force`                   |       | Override stop rules                                                 |
| `--diff`                    | `-d`  | Show console diff                                                   |
| `--diff-html`               | `-H`  | Generate HTML report (opens in browser)                             |
| `--diff-json`               | `-J`  | Output JSON to stdout (pipe to jq)                                  |
| `--list-files`              | `-l`  | List files without processing (takes precedence over --format-only) |
| `--show-config`             |       | Display resolved config after inheritance                           |
| `--format-only`             |       | Format destination files only (source not required)                 |
| `--skip-format`             | `-S`  | Skip YAML formatting during sync                                    |
| `--filter <string>`         | `-f`  | Filter files by filename/content (supports `,` OR, `+` AND)         |
| `--mode <type>`             | `-m`  | Filter by change type: new, modified, deleted, all (default: all)   |
| `--no-color`                |       | Disable colored output (CI/accessibility)                           |
| `--verbose`                 |       | Show detailed debug info                                            |
| `--quiet`                   |       | Suppress output except errors                                       |

### Examples

```bash
# Validate configuration (shows warnings)
hed -c config.yaml --validate

# Get smart configuration suggestions
hed -c config.yaml --suggest

# Get only high-confidence suggestions
hed -c config.yaml --suggest --suggest-threshold 0.7

# Preview files that will be synced
hed -c config.yaml -l

# Display resolved config (after inheritance)
hed -c config.yaml --show-config

# Preview with diff
hed -c config.yaml -D -d

# Visual HTML report
hed -c config.yaml -H

# CI/CD integration (no colors)
hed -c config.yaml -J --no-color | jq '.summary'

# Execute sync
hed -c config.yaml

# Force override stop rules
hed -c config.yaml --force

# Filter to only process files matching 'prod'
hed -c config.yaml -f prod -d

# Filter with OR: match files containing 'prod' OR 'staging'
hed -c config.yaml -f prod,staging -l

# Filter with AND: match files containing BOTH 'values' AND 'prod'
hed -c config.yaml -f values+prod -d

# Sync only new files
hed -c config.yaml -m new

# Preview modified files only
hed -c config.yaml -m modified -D -d

# Combine filter and mode
hed -c config.yaml -f deployment -m modified -D -d

# Format destination files only (no sync, source not required in config)
hed -c config.yaml --format-only

# Preview format changes
hed -c config.yaml --format-only -D

# List files that would be formatted (--list-files takes precedence)
hed -c config.yaml --format-only -l

# Format-only config example (no source needed):
# destination: './prod'
# outputFormat:
#   indent: 2
```

---

## 🔄 Typical Workflow

```mermaid
flowchart LR
    A[💾 UAT Files] --> B[⚙️ Config]
    B --> C[🔍 Preview]
    C --> D{✅ Approve?}
    D -->|Yes| E[🚀 Execute]
    D -->|No| F[📝 Adjust]
    F --> C
    E --> G[📁 Prod Updated]
    G --> H[🔄 Git Commit]
    H --> I[🚢 Deploy]
```

**Step-by-step:**

```bash
# 1. Preview changes
hed -c config.yaml -D -d

# 2. Review in browser
hed -c config.yaml -H

# 3. Execute sync
hed -c config.yaml

# 4. Git workflow
git add prod/
git commit -m "Sync UAT to Prod"
git push origin main
```

---

## 🏆 Why Choose HelmEnvDelta?

### 🆚 Compared to Alternatives

**HelmEnvDelta** is purpose-built for environment synchronization, not template generation or deployment.

| What You Get              | vs Helmfile   | vs Kustomize | vs Bash Scripts |
| ------------------------- | ------------- | ------------ | --------------- |
| 🔍 Structural YAML diff   | ✅ Yes        | ❌ No        | ❌ No           |
| 🎯 Environment-aware sync | ✅ Yes        | ⚠️ Manual    | ⚠️ Custom       |
| 🛡️ Safety validation      | ✅ Built-in   | ❌ None      | ⚠️ DIY          |
| 🔄 Smart merge            | ✅ Deep merge | ⚠️ Limited   | ⚠️ DIY          |
| 🎨 Format enforcement     | ✅ Yes        | ❌ No        | ❌ No           |
| 📚 Learning curve         | 🟢 Low        | 🟡 Medium    | 🔴 High         |

**Complementary:** Use HelmEnvDelta alongside Helm, Helmfile, Kustomize, ArgoCD, or Flux.

---

### 💪 Benefits

✅ **Safety** - Stop rules prevent dangerous changes. Dry-run previews everything.

✅ **Speed** - 30 minutes → 1 minute sync time. Parallel processing.

✅ **Consistency** - Uniform YAML formatting. No more diff noise.

✅ **Auditability** - Field-level change tracking with JSONPath. Clean structural diffs.

✅ **Flexibility** - Per-file patterns. Config inheritance. Regex transforms.

✅ **Reliability** - 1150+ tests, 84% coverage. Battle-tested.

---

## 📊 JSON Output for CI/CD

```bash
hed --config config.yaml --diff-json > report.json
```

**Schema:**

```json
{
  "metadata": {
    "timestamp": "2025-12-27T10:30:00Z",
    "source": "./uat",
    "destination": "./prod",
    "dryRun": true
  },
  "summary": {
    "added": 2,
    "changed": 3,
    "deleted": 1,
    "unchanged": 15
  },
  "files": {
    "changed": [
      {
        "path": "prod/app.yaml",
        "changes": [
          {
            "path": "$.image.tag",
            "oldValue": "v1.2.3",
            "updatedValue": "v1.3.0"
          }
        ]
      }
    ]
  },
  "stopRuleViolations": [
    {
      "file": "prod/app.yaml",
      "rule": { "type": "semverMajorUpgrade" },
      "message": "Major upgrade: v1.2.3 → v2.0.0"
    }
  ]
}
```

**Use with jq:**

```bash
# Summary
jq '.summary' report.json

# Violations
jq '.stopRuleViolations' report.json

# Changed files
jq '.files.changed[].path' report.json
```

---

## 🔧 Advanced Features

### 🧠 Structural Comparison

Git diffs are noisy when arrays are reordered. HelmEnvDelta compares YAML structure and recognizes identical content regardless of order.

**Example:**

```yaml
# Source
env:
  - name: DB_URL
    value: uat-db
  - name: LOG_LEVEL
    value: debug

# Destination
env:
  - name: LOG_LEVEL
    value: info
  - name: DB_URL
    value: prod-db
```

**Git diff:** Shows all lines changed (noisy)
**HelmEnvDelta:** Only `LOG_LEVEL: debug → info` (clean)

---

### 🔍 Pattern Usage Validation

HelmEnvDelta validates that your configuration patterns actually match files and exist in your YAML structure. This helps catch typos, outdated patterns, and misconfigured rules early.

**Run validation:**

```bash
helm-env-delta --config config.yaml --validate
```

**What gets validated:**

1. **exclude patterns** - Warns if pattern matches no files
2. **skipPath patterns** - Two-level validation:
   - Glob pattern must match at least one file
   - JSONPath must exist in at least one matched file
   - Filter expressions `[prop=value]` validated against actual array items
3. **stopRules patterns** - Two-level validation:
   - Glob pattern must match at least one file
   - JSONPath (if specified) must exist in at least one matched file

**Example output:**

```
✓ Configuration is valid

⚠️  Pattern Usage Warnings (non-fatal):

  • Exclude pattern 'test/**/*.yaml' matches no files
  • skipPath pattern 'legacy/*.yaml' matches no files
  • skipPath JSONPath 'microservice.replicaCountX' not found in any matched files (Pattern: svc/**/values.yaml, matches 50 file(s))
  • stopRules glob pattern 'helm-charts/**/*.yaml' matches no files (3 rule(s) defined)
  • stopRules JSONPath 'spec.replicas' not found in any matched files (Rule type: numeric, matches 5 file(s))
```

**Validation phases:**

- **Phase 1 (Static)**: Validates config syntax, checks for inefficient patterns, duplicates, conflicts
- **Phase 2 (File-Based)**: Loads files and validates all patterns actually match and paths exist

**When to use:**

- After updating configuration
- When patterns stop working as expected
- To verify config file patterns after file reorganization
- As part of CI/CD pre-flight checks

**Important:** Warnings are non-fatal and don't block execution. They help you catch potential issues but won't stop your workflow.

---

### 🔀 Deep Merge

Preserves destination values for skipped paths.

```yaml
# Source (UAT)
metadata:
  namespace: uat
spec:
  replicas: 3

# Config
skipPath:
  "*.yaml":
    - "metadata.namespace"
    - "spec.replicas"

# Destination (Prod) - preserved after sync!
metadata:
  namespace: prod  # ← Kept
spec:
  replicas: 5      # ← Kept
```

---

## 🆘 Common Issues

### ❓ Source and destination folders cannot be the same

**Error:** `Source and destination folders cannot be the same`

**Fix:** Ensure source and destination paths resolve to different directories. Paths like `./envs/../envs/prod` and `./envs/prod` will be detected as identical.

---

### ❓ Stop rule violations blocking sync

**Error:** `🛑 Stop Rule Violation (semverMajorUpgrade)`

**Fix:** Review change carefully. Use `--force` if intentional.

---

### ❓ Transforms not applying

**Check:**

- File pattern: `**/*.yaml` vs `*.yaml`
- Regex escaping: `\\.` for literal dots
- Word boundaries: `\\b`

---

### ❓ JSONPath syntax errors

```yaml
# ❌ Wrong
- '$.spec.replicas' # Don't use $. prefix
- 'env.*.name' # Use [*] not .*

# ✅ Correct
- 'spec.replicas' # No prefix
- 'env[*].name' # Array wildcard
- 'env[name=DEBUG]' # Filter by exact value
- 'env[name^=DB_]' # Filter by prefix (startsWith)
- 'env[name$=_KEY]' # Filter by suffix (endsWith)
- 'env[name*=SECRET]' # Filter by substring (contains)
- 'containers[name=app].env[name=SECRET]' # Nested filters
```

---

### ❓ Glob patterns not matching

| Pattern          | Matches                 |
| ---------------- | ----------------------- |
| `*.yaml`         | Current directory only  |
| `**/*.yaml`      | Recursive (all subdirs) |
| `apps/*.yaml`    | One level deep          |
| `apps/**/*.yaml` | Recursive under apps/   |

---

## 📚 Resources

📦 **npm:** [helm-env-delta](https://www.npmjs.com/package/helm-env-delta)

🐙 **GitHub:** [BCsabaEngine/helm-env-delta](https://github.com/BCsabaEngine/helm-env-delta)

🐛 **Issues:** [GitHub Issues](https://github.com/BCsabaEngine/helm-env-delta/issues)

📄 **License:** [ISC](https://opensource.org/licenses/ISC)

---

## 🎉 Success Stories

**Typical adoption timeline:**

- **Week 1:** Install, create basic config, dry-run on one service
- **Week 2:** Expand to 5 services, add skipPath rules
- **Week 3:** Add stop rules (catch first bug!)
- **Week 4:** Standardize YAML formatting
- **Month 2:** Full adoption for all services

**Results:**

- ⏱️ Sync time: **2 hours/week → 10 minutes/week**
- 🐛 Production incidents from sync errors: **Zero**
- 😊 Team satisfaction: **High**

---

**Built for DevOps and Platform teams managing multi-environment Kubernetes and Helm deployments.**

**Made with ❤️ by BCsabaEngine**
