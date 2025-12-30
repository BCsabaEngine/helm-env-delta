# Example 2: Stop Rules with Violations

Demonstrates stop rule validation for dangerous changes, how violations are detected, and how to override with --force.

## What This Shows

- **semverMajorUpgrade**: Block major version bumps (v1.x → v2.x)
- **semverDowngrade**: Block any version downgrades (major: v2.0.0 → v1.0.0, minor: v1.3.2 → v1.2.4, patch: v1.2.5 → v1.2.3)
- **versionFormat**: Enforce strict version format (major.minor.patch only, reject incomplete versions and pre-release identifiers)
  - **vPrefix: forbidden** - Version MUST NOT have 'v' prefix (Helm charts)
  - **vPrefix: required** - Version MUST have 'v' prefix (Docker tags)
  - **vPrefix: allowed** - Both formats acceptable (mixed systems)
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
   Message: Version downgrade detected (major downgrade)

❌ File: destination/app-version.yaml
   Rule: versionFormat
   Path: app.releaseVersion
   Change: 1.1.0 → 1.2-rc
   Message: Version "1.2-rc" is incomplete. Expected format: major.minor.patch (e.g., "1.2.3"), got only 2 part(s)

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
   - Invalid version formats (incomplete versions, pre-release identifiers)
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

## vPrefix Modes Explained

The `versionFormat` stop rule supports three modes for handling the 'v' prefix in version numbers:

### forbidden (Helm Charts, Strict Semver)

**Rule:** Version MUST NOT have 'v' prefix

**Valid:** `1.2.3`, `2.0.0`, `10.5.2`
**Invalid:** `v1.2.3`, `v2.0.0`

**Use Cases:**

- Helm chart versions (strict semver standard)
- NPM packages
- Python packages (PEP 440)
- Semantic versioning specifications

**Example:**

```yaml
stopRules:
  'helm-chart.yaml':
    - type: 'versionFormat'
      path: 'spec.chart.chartVersion'
      vPrefix: 'forbidden'
```

### required (Docker Tags, Git Tags)

**Rule:** Version MUST have 'v' prefix

**Valid:** `v1.2.3`, `v2.0.0`, `v10.5.2`
**Invalid:** `1.2.3`, `2.0.0`

**Use Cases:**

- Docker image tags (common convention)
- Git release tags (GitHub/GitLab standard)
- Container registries
- Version tagging in CI/CD pipelines

**Example:**

```yaml
stopRules:
  'docker-tag.yaml':
    - type: 'versionFormat'
      path: 'spec.template.spec.containers.0.imageTag'
      vPrefix: 'required'
```

### allowed (Mixed Systems, Legacy Compatibility)

**Rule:** Both formats are acceptable

**Valid:** `1.2.3` OR `v1.2.3`, `2.0.0` OR `v2.0.0`
**Invalid:** Only incomplete/malformed versions

**Use Cases:**

- Legacy systems with inconsistent versioning
- APIs that accept both formats
- Transition periods when migrating version formats
- Third-party integrations with varying standards

**Example:**

```yaml
stopRules:
  'hybrid-system.yaml':
    - type: 'versionFormat'
      path: 'spec.service.apiVersion'
      vPrefix: 'allowed'
```

**Note:** If `vPrefix` is omitted, it defaults to `'allowed'` (most permissive).

---

## What You'll Learn

- How to configure all 5 stop rule types (semverMajorUpgrade, semverDowngrade, versionFormat, numeric, regex)
- What violations look like in console output
- How violations block sync by default
- When and how to use --force flag
- How to integrate stop rules into CI/CD pipelines
- When to use each vPrefix mode for your specific use case
