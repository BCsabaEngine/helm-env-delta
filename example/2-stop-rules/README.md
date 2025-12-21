# Example 2: Stop Rules with Violations

Demonstrates stop rule validation for dangerous changes, how violations are detected, and how to override with --force.

## What This Shows

- **semverMajorUpgrade**: Block major version bumps (v1.x → v2.x)
- **semverDowngrade**: Block version downgrades (v2.x → v1.x)
- **numeric**: Enforce value ranges (min/max)
- **regex**: Block pattern matches (reject v0.x versions)

## File Structure

- `config.yaml` - Stop rules for all violation types
- `source/*.yaml` - Files with changes that will trigger violations
- `destination/*.yaml` - Current files with values that will be violated

## How to Run

### Step 1: Dry-Run (See Violations)

```bash
helm-env-delta --config example-2-stop-rules/config.yaml --dry-run --diff
```

**Expected output**:

```
🛑 Stop Rule Violations Detected!

❌ File: destination/app-version.yaml
   Rule: semverMajorUpgrade
   Path: image.tag
   Change: v1.5.0 → v2.0.0
   Message: Major version upgrade detected

❌ File: destination/app-version.yaml
   Rule: semverDowngrade
   Path: chart.version
   Change: v2.1.0 → v1.2.3
   Message: Version downgrade detected

❌ File: destination/scaling.yaml
   Rule: numeric (min: 2, max: 10)
   Path: spec.replicas
   Change: 5 → 15
   Message: Value 15 exceeds maximum 10

✓ File: destination/environment.yaml
  No violations (v0.9.5 → v1.0.0 is valid upgrade)
```

**Exit code**: Non-zero (indicates violations)

### Step 2: Try Without Force (Fails)

```bash
helm-env-delta --config example-2-stop-rules/config.yaml
```

**Result**: Fails with violations error, files NOT updated

### Step 3: Override with Force

```bash
helm-env-delta --config example-2-stop-rules/config.yaml --force
```

**Result**:

- Violations are logged but NOT enforced
- Files ARE updated despite violations
- Use with extreme caution!

### Step 4: JSON Output for CI/CD

```bash
helm-env-delta --config example-2-stop-rules/config.yaml --diff-json | jq '.stopRuleViolations'
```

**Output**:

```json
[
  {
    "file": "destination/app-version.yaml",
    "rule": {
      "type": "semverMajorUpgrade",
      "path": "image.tag"
    },
    "path": "image.tag",
    "oldValue": "v1.5.0",
    "updatedValue": "v2.0.0",
    "message": "Major version upgrade detected: v1.5.0 → v2.0.0"
  }
]
```

## Key Concepts

1. **Stop Rules Prevent Dangerous Changes**:
   - Major version upgrades (breaking changes)
   - Version downgrades (regression)
   - Scaling beyond safe limits
   - Forbidden patterns (pre-release versions)

2. **Violations Block Execution**:
   - By default, violations prevent file updates
   - Exit code is non-zero for CI/CD pipelines

3. **Force Override**:
   - Use `--force` when violations are intentional
   - Always review violations before using --force

4. **CI/CD Integration**:
   - JSON output provides structured violation data
   - Can be parsed and enforced in pipelines

## What You'll Learn

- How to configure all 4 stop rule types
- What violations look like in console output
- How violations block sync by default
- When and how to use --force flag
- How to integrate stop rules into CI/CD pipelines
