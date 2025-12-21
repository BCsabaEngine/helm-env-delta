# Example 1: Config Inheritance

Demonstrates the `extends` pattern for reusing base configuration across multiple environment pairs.

## What This Shows

- **Base configuration**: Shared settings across all environments
- **Config inheritance**: Child configs extend and override base
- **Array concatenation**: skipPath rules are merged
- **Object merging**: Child-specific stopRules added to parent

## File Structure

- `config.base.yaml` - Common settings (skipPath, outputFormat)
- `config.dev-to-uat.yaml` - Dev → UAT sync (extends base)
- `config.uat-to-prod.yaml` - UAT → Prod sync (extends base + adds stopRules)
- `dev/`, `uat/`, `prod/` - Environment folders

## How to Run

### Step 1: Dev → UAT Sync

```bash
# Dry-run to preview
helm-env-delta --config example-1-config-inheritance/config.dev-to-uat.yaml --dry-run --diff

# Execute sync
helm-env-delta --config example-1-config-inheritance/config.dev-to-uat.yaml
```

**Expected behavior**:

- Copies `dev/service.yaml` to `uat/service.yaml`
- Transforms `-dev` → `-uat` and `dev-cluster` → `uat-cluster`
- Preserves `metadata.namespace` and `metadata.labels.environment` (skipPath)

### Step 2: UAT → Prod Sync

```bash
# Dry-run to preview
helm-env-delta --config example-1-config-inheritance/config.uat-to-prod.yaml --dry-run --diff

# Execute sync
helm-env-delta --config example-1-config-inheritance/config.uat-to-prod.yaml
```

**Expected behavior**:

- Copies `uat/service.yaml` to `prod/service.yaml`
- Transforms `-uat` → `-prod` and `uat-cluster` → `prod-cluster`
- Validates minimum 3 replicas (would fail with current data - demonstrates stopRule)

## Key Concepts

1. **Base Config**: Common settings defined once, reused everywhere
2. **Inheritance**: Child configs extend base with `extends: "./config.base.yaml"`
3. **Merging Rules**:
   - Arrays (include, exclude, skipPath) are **concatenated**
   - Objects (outputFormat) are **deep merged**
   - Child overrides parent when keys conflict
4. **Environment-Specific**: Each child adds its own transforms and stopRules

## What You'll Learn

- How to create reusable base configurations
- How inheritance works (arrays concatenate, objects merge)
- How to add environment-specific rules on top of base config
- The difference between partial (base) and final (child) configs
