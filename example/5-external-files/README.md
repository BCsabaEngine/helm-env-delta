# Example 5: External Files for Transforms and Stop Rules

This example demonstrates the new features for managing transforms and stop rules using external YAML files instead of inline definitions.

## Features Demonstrated

### 1. Transform Files (`contentFile`, `filenameFile`)

Load literal string replacements from external YAML files:

- **Multiple files**: Process transforms in order (common → specific)
- **Literal matching**: Keys are escaped for regex safety (case-sensitive)
- **File/path transforms**: Separate files for content vs filename transforms
- **Flexible syntax**: Single file or array of files

### 2. Stop Rule Files (`regexFile`, `regexFileKey`)

Load validation patterns from external files:

- **`regexFile`**: Load array of regex patterns from YAML
- **`regexFileKey`**: Use transform file keys as patterns
- **Reusability**: Share patterns across multiple projects

### 3. Optional Path for Regex Rules

Regex stop rules now support two modes:

- **Targeted mode** (path set): Check specific JSONPath field
- **Global mode** (path NOT set): Recursively scan ALL values in file

## Directory Structure

```
example/5-external-files/
├── config.yaml                              # Main configuration
├── transforms-content-common.yaml           # Common environment mappings
├── transforms-content-services.yaml         # Service-specific transforms
├── transforms-filename-paths.yaml           # Path transformation rules
├── patterns-forbidden-versions.yaml         # Forbidden version patterns
├── patterns-forbidden-global.yaml           # Global forbidden values
├── source/
│   ├── envs/staging/app-staging.yaml        # Staging deployment
│   └── configs/stg/service-config.yaml      # Staging service config
└── destination/
    ├── envs/production/app-production.yaml  # Production deployment
    └── configs/prod/service-config.yaml     # Production service config
```

## Transform File Format

Transform files use simple key:value pairs for literal string replacement:

```yaml
# transforms-content-common.yaml
staging: production
stg: prod
staging.example.com: production.example.com
staging-db: production-db
```

**Features:**

- Keys and values are escaped for regex (literal matching only)
- Case-sensitive matching
- Processed in order (first file → last file)
- Applied BEFORE inline regex transforms

## Pattern File Formats

### Array Format (for `regexFile`)

```yaml
# patterns-forbidden-versions.yaml
- ^0\..* # Block 0.x.x versions
- .*-alpha.* # Block alpha releases
- .*-beta.* # Block beta releases
```

### Object Format (for `regexFileKey`)

Uses keys from transform files as regex patterns:

```yaml
# transforms-content-common.yaml keys:
# staging, stg, staging.example.com, etc.
# These become patterns to block in stop rules
```

## Configuration Breakdown

### Transform Configuration

```yaml
transforms:
  '**/*.yaml':
    # Load multiple content transform files
    contentFile:
      - './transforms-content-common.yaml'
      - './transforms-content-services.yaml'

    # Load filename transform file
    filenameFile: './transforms-filename-paths.yaml'

    # Inline regex transforms (applied AFTER file-based)
    content:
      - find: 'v(\d+)\.(\d+)\.(\d+)-stg'
        replace: 'v$1.$2.$3-prod'
```

**Execution Order:**

1. File-based transforms (literal, in order)
2. Inline regex transforms (patterns)

### Stop Rules Configuration

```yaml
stopRules:
  '**/*.yaml':
    # Targeted mode: Check specific field
    - type: regexFile
      path: spec.template.spec.containers.0.image
      file: './patterns-forbidden-versions.yaml'

    # Global mode: Scan all values recursively
    - type: regexFile
      file: './patterns-forbidden-global.yaml'

    # Use transform file keys as patterns
    - type: regexFileKey
      path: service.name
      file: './transforms-content-common.yaml'

    # Standard regex with optional path (global mode)
    - type: regex
      regex: '^127\.' # No path = scan everywhere
```

## Usage Examples

### Dry Run with Diff

Preview changes before applying:

```bash
helm-env-delta --config example/5-external-files/config.yaml --dry-run --diff
```

### Preview Files

List files that will be synced:

```bash
helm-env-delta --config example/5-external-files/config.yaml --list-files
```

### HTML Diff Report

Generate browser-viewable diff:

```bash
helm-env-delta --config example/5-external-files/config.yaml --dry-run --diff-html
```

### Validate Configuration

Check config and external files:

```bash
helm-env-delta --config example/5-external-files/config.yaml --validate
```

### Apply Changes

Execute the sync:

```bash
helm-env-delta --config example/5-external-files/config.yaml
```

## Expected Transformations

### Content Transforms

**Source:** `source/envs/staging/app-staging.yaml`

- `staging` → `production`
- `stg` → `prod`
- `staging-db` → `production-db`
- `stg-cache` → `prod-cache`
- `staging-api` → `production-api`
- `debug-mode` → `production-mode`
- `memory-512Mi` → `memory-2Gi`
- `cpu-100m` → `cpu-500m`
- `replicas-2` → `replicas-5`

### Filename Transforms

**Source:** `envs/staging/app-staging.yaml`
**Destination:** `envs/production/app-production.yaml`

Transformations applied:

1. `envs/staging/` → `envs/production/` (from transforms-filename-paths.yaml)
2. `-staging.yaml` → `-production.yaml` (from transforms-filename-paths.yaml)

### Stop Rule Validations

The following would be blocked:

**Version patterns** (regexFile with path):

- `image: myapp:0.9.1` ❌ (0.x.x version)
- `image: myapp:1.5.2-alpha` ❌ (alpha release)
- `image: myapp:2.0.0-beta.1` ❌ (beta release)

**Global patterns** (regexFile without path):

- Any `localhost` reference ❌
- Any `127.0.0.1` IP ❌
- Any `test-*` prefixes ❌
- Any `*-debug` suffixes ❌

**Transform key patterns** (regexFileKey):

- `service.name: staging` ❌ (matches transform key)
- `service.name: stg` ❌ (matches transform key)

## Key Benefits

### 1. Cleaner Configuration

Move repetitive transforms to external files:

```yaml
# Before (inline)
transforms:
  '**/*.yaml':
    content:
      - { find: 'staging', replace: 'production' }
      - { find: 'stg', replace: 'prod' }
      - { find: 'staging.example.com', replace: 'production.example.com' }
      # ... 50 more lines

# After (external)
transforms:
  '**/*.yaml':
    contentFile: './transforms-content-common.yaml'
```

### 2. Reusability

Share transform files across multiple projects:

```bash
transforms/
  ├── common.yaml          # Shared across all projects
  ├── project-a.yaml       # Project-specific
  └── project-b.yaml       # Project-specific
```

### 3. Maintainability

Update transforms in one place:

```yaml
# Update transforms-content-common.yaml and all configs using it get the changes
staging-api: production-api # Add new mapping
staging-worker: production-worker
```

### 4. Validation Consistency

Use the same forbidden patterns across environments:

```yaml
# patterns-forbidden-global.yaml applies to all envs
- localhost
- 127\.0\.0\.1
- ^test-.*
```

## Use Cases

### Multi-Environment GitOps

```yaml
# Staging → Production
contentFile:
  - './transforms/common/env-mappings.yaml'
  - './transforms/staging-to-prod.yaml'

# UAT → Production
contentFile:
  - './transforms/common/env-mappings.yaml'
  - './transforms/uat-to-prod.yaml'
```

### Security Compliance

Block forbidden values globally:

```yaml
stopRules:
  '**/*.yaml':
    - type: regexFile
      file: './security/forbidden-patterns.yaml'
```

### Version Control

Prevent dangerous version changes:

```yaml
stopRules:
  '**/*.yaml':
    - type: regexFile
      path: image
      file: './versions/forbidden-versions.yaml'
```

## Tips

1. **File Paths**: Paths are relative to config file directory
2. **Execution Order**: File-based transforms run before inline regex
3. **Case Sensitivity**: Transform files are case-sensitive (literal)
4. **Global Scanning**: Omit `path` in regex rules to scan entire file
5. **Error Handling**: Missing files cause immediate failure

## Backward Compatibility

All existing configs work unchanged. New features are additive:

```yaml
# Old config (still works)
transforms:
  '**/*.yaml':
    content: [{ find: 'stg', replace: 'prod' }]

# New config (enhanced)
transforms:
  '**/*.yaml':
    contentFile: './transforms-content-common.yaml'  # NEW
    content: [{ find: 'stg', replace: 'prod' }]  # OLD
```

## Related Examples

- **Example 0**: Basic sync operations
- **Example 2**: Inline stop rules
- **Example 3**: Multi-environment chaining

## Next Steps

Try modifying:

- Transform files to add new mappings
- Pattern files to add new validations
- Config to use different file combinations
- Stop rules to use global vs targeted modes
