# Format-Only Example

This example demonstrates the `--format-only` flag, which formats YAML files without syncing from a source. This is useful for standardizing file formatting across your codebase.

## Scenario

You have YAML files with inconsistent formatting - different indentation, random key ordering, and varying spacing. You want to apply consistent formatting rules without needing a source directory.

## Files

- `config.yaml` - Configuration with `outputFormat` rules (no source required)
- `files/deployment.yaml` - Sample deployment with inconsistent formatting
- `files/service.yaml` - Sample service with inconsistent key ordering

## What This Example Does

1. **Standardizes indentation**: All files use 2-space indentation
2. **Orders keys consistently**: `apiVersion`, `kind`, `metadata` always come first
3. **Sorts arrays**: Arrays with `name` keys are sorted alphabetically
4. **Normalizes spacing**: Consistent `key: value` separator

## Try It

Run from the example directory:

```bash
cd example/7-format-only

# Preview which files would be formatted
hed --config config.yaml --format-only --list-files

# Preview formatting changes without writing
hed --config config.yaml --format-only --dry-run

# Apply formatting
hed --config config.yaml --format-only

# View formatting changes in browser
hed --config config.yaml --format-only --dry-run --diff-html
```

Or from the project root:

```bash
cd example/7-format-only && hed --config config.yaml --format-only --list-files
```

## Key Differences from Normal Sync

| Normal Sync                             | Format-Only Mode             |
| --------------------------------------- | ---------------------------- |
| Requires `source` and `destination`     | Only requires `destination`  |
| Syncs values from source to destination | No syncing, only formatting  |
| Applies transforms, skipPath, stopRules | Only applies `outputFormat`  |
| Creates/updates files based on source   | Only modifies existing files |

## Config Structure

The `outputFormat` section uses glob patterns to target files:

```yaml
outputFormat:
  indent: 2
  keySeparator: true # Use ': ' instead of ':'

  # Per-file glob patterns -> arrays of JSONPaths/rules
  quoteValues:
    '**/*.yaml':
      - 'env[].value'

  keyOrders:
    '**/*.yaml':
      - 'apiVersion'
      - 'kind'
      - 'metadata'
      # ... more keys

  arraySort:
    '**/*.yaml':
      - path: 'env'
        sortBy: 'name'
```

## Expected Output

### Before Formatting (`files/deployment.yaml`):

```yaml
spec:
  replicas: 3
  ...
kind: Deployment
metadata:
    labels:
        app: web
    name: web-deployment
apiVersion: apps/v1
```

### After Formatting:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-deployment
  labels:
    app: web
  ...
spec:
  replicas: 3
  ...
```

## Use Cases

- **CI/CD formatting checks**: Run `--format-only --dry-run` to verify files are formatted
- **Bulk reformatting**: Apply consistent style to existing YAML files
- **Pre-commit hooks**: Format files before committing
- **Standardizing Helm values**: Ensure all values files follow the same structure
