# Example 3: Multi-Environment Chain (Dev → UAT → Prod)

Demonstrates progressive promotion through 3 environments with cumulative transforms at each stage.

## What This Shows

- **Progressive promotion**: Dev → UAT → Prod workflow
- **Cumulative transforms**: Each stage applies environment-specific transforms
- **Environment-specific resources**: replicaCount and resources preserved via skipPath
- **Production safeguards**: Stop rules only on UAT → Prod sync
- **Realistic workflow**: Shell script to orchestrate multi-stage sync

## File Structure

- `config.dev-to-uat.yaml` - First stage: Dev → UAT
- `config.uat-to-prod.yaml` - Second stage: UAT → Prod (with stop rules)
- `sync-all.sh` - Script to run both stages with prompts
- `dev/`, `uat/`, `prod/` - Three environment folders

## How to Run

### Option 1: Manual Two-Stage Sync

**Stage 1: Dev → UAT**

```bash
# Preview Dev → UAT changes
helm-env-delta --config example-3-multi-env-chain/config.dev-to-uat.yaml --dry-run --diff

# Execute Dev → UAT sync
helm-env-delta --config example-3-multi-env-chain/config.dev-to-uat.yaml
```

**Stage 2: UAT → Prod**

```bash
# Preview UAT → Prod changes
helm-env-delta --config example-3-multi-env-chain/config.uat-to-prod.yaml --dry-run --diff

# Execute UAT → Prod sync
helm-env-delta --config example-3-multi-env-chain/config.uat-to-prod.yaml
```

### Option 2: Automated Script

```bash
cd example-3-multi-env-chain
chmod +x sync-all.sh
./sync-all.sh
```

The script will:

1. Show Dev → UAT diff and prompt for confirmation
2. Execute Dev → UAT sync
3. Show UAT → Prod diff and prompt for confirmation
4. Execute UAT → Prod sync

## Transform Chain Example

**Original (Dev)**:

```yaml
env:
  - name: DATABASE_URL
    value: 'dev-database.postgres.internal'
  - name: CACHE_URL
    value: 'redis.dev.internal'
service:
  name: my-service-dev
```

**After Dev → UAT**:

```yaml
env:
  - name: DATABASE_URL
    value: 'uat-database.postgres.internal' # ← Transformed
  - name: CACHE_URL
    value: 'redis.uat.internal' # ← Transformed
service:
  name: my-service-uat # ← Transformed
```

**After UAT → Prod**:

```yaml
env:
  - name: DATABASE_URL
    value: 'prod-database.postgres.internal' # ← Transformed again
  - name: CACHE_URL
    value: 'redis.prod.internal' # ← Transformed again
service:
  name: my-service-prod # ← Transformed again
```

## Environment-Specific Values

Values preserved by `skipPath`:

| Field              | Dev   | UAT   | Prod  | Why Preserved?               |
| ------------------ | ----- | ----- | ----- | ---------------------------- |
| `replicaCount`     | 1     | 2     | 5     | Environment capacity differs |
| `resources.memory` | 128Mi | 256Mi | 512Mi | Resource allocation differs  |
| `resources.cpu`    | 100m  | 200m  | 500m  | CPU allocation differs       |

These values are NOT synced - each environment maintains its own values.

## Stop Rules (Prod Only)

The UAT → Prod sync includes stop rules to prevent:

- Version downgrades on Chart version
- Major version upgrades on image tag
- Scaling below 3 or above 20 replicas

Dev → UAT has NO stop rules (more permissive for testing).

## Key Concepts

1. **Progressive Promotion**:
   - Changes flow: Dev → UAT → Prod
   - Each stage validates and transforms

2. **Cumulative Transforms**:
   - Dev → UAT: `dev-` → `uat-`
   - UAT → Prod: `uat-` → `prod-`
   - Result: `dev-db` → `uat-db` → `prod-db`

3. **Environment-Specific Config**:
   - skipPath preserves per-environment values
   - Transforms handle environment naming

4. **Safety Increases with Environment**:
   - Dev → UAT: Permissive (no stop rules)
   - UAT → Prod: Strict (stop rules enforced)

## What You'll Learn

- How to set up multi-stage promotion workflows
- How transforms apply cumulatively across stages
- How to preserve environment-specific resources
- How to apply stricter rules for production
- How to script multi-stage sync operations
