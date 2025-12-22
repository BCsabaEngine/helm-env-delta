# Basic Example

This is the simplest possible example showing how `helm-env-delta` syncs changes from a source environment (UAT) to a destination environment (Production).

## Scenario

You have a UAT environment and a Production environment. When you update configuration in UAT (like upgrading a Docker image), you want to sync those changes to Production while keeping environment-specific values intact.

## Files

- `config.yaml` - Configuration defining source, destination, and sync rules
- `source/app.yaml` - UAT environment values
- `destination/app.yaml` - Production environment values (will be updated)

## What This Example Does

1. **Syncs version updates**: When `image.tag` changes in UAT, it syncs to Production
2. **Preserves environment values**: `environment` field stays as 'production' (not overwritten)
3. **Transforms cluster references**: Replaces 'uat-cluster' with 'prod-cluster' in values

## Try It

Run from the example directory:

```bash
cd example/0-basic

# Preview changes without writing
hed --config config.yaml --dry-run --diff

# Apply changes
hed --config config.yaml

# View changes in browser
hed --config config.yaml --diff-html
```

Or from the project root:

```bash
cd example/0-basic && hed --config config.yaml --dry-run --diff
```

## Expected Behavior

When you update `source/app.yaml` (e.g., change `image.tag` from `1.0.0` to `1.1.0`), running the tool will:

- Update `image.tag` in `destination/app.yaml` to `1.1.0`
- Keep `environment: production` unchanged (due to `skipPath`)
- Transform any `uat-cluster` references to `prod-cluster`
