# Example 4: Prune Mode in Action

Demonstrates file deletion behavior with `prune: true` vs `prune: false`.

## What This Shows

- **prune: false** (default): Extra files in destination are KEPT
- **prune: true**: Files in destination but NOT in source are DELETED
- **Dry-run safety**: Always preview deletions before executing
- **Clear visualization**: See exactly what will be deleted

## File Structure

- `config.with-prune.yaml` - Prune enabled (deletes extra files)
- `config.without-prune.yaml` - Prune disabled (keeps extra files)
- `source/` - 2 active services (service-a, service-b)
- `destination/` - 4 services (2 active + 2 old/deprecated)

## Initial State

**Source** (2 files):
- `active-service-a.yaml` ✓
- `active-service-b.yaml` ✓

**Destination** (4 files):
- `active-service-a.yaml` ✓ (exists in source)
- `active-service-b.yaml` ✓ (exists in source)
- `old-service-c.yaml` ❌ (NOT in source)
- `deprecated-service-d.yaml` ❌ (NOT in source)

## How to Run

### Scenario 1: Without Prune (Default Behavior)

```bash
# Dry-run to preview
helm-env-delta --config example-4-prune-mode/config.without-prune.yaml --dry-run --diff

# Execute sync
helm-env-delta --config example-4-prune-mode/config.without-prune.yaml
```

**Expected output**:
```
✓ Files updated successfully:
  0 files added
  2 files updated
  0 files deleted  ← No deletions!
```

**Result**:
- `active-service-a.yaml` - UPDATED
- `active-service-b.yaml` - UPDATED
- `old-service-c.yaml` - KEPT (not touched)
- `deprecated-service-d.yaml` - KEPT (not touched)

**Final destination**: 4 files (2 active + 2 old)

---

### Scenario 2: With Prune (Delete Extra Files)

```bash
# ⚠️ IMPORTANT: Always dry-run first to review deletions!
helm-env-delta --config example-4-prune-mode/config.with-prune.yaml --dry-run --diff

# Execute sync (after reviewing deletions)
helm-env-delta --config example-4-prune-mode/config.with-prune.yaml
```

**Expected output**:
```
⚠️  The following files will be DELETED:
  - destination/old-service-c.yaml
  - destination/deprecated-service-d.yaml

✓ Files updated successfully:
  0 files added
  2 files updated
  2 files deleted  ← Files removed!
```

**Result**:
- `active-service-a.yaml` - UPDATED
- `active-service-b.yaml` - UPDATED
- `old-service-c.yaml` - DELETED ❌
- `deprecated-service-d.yaml` - DELETED ❌

**Final destination**: 2 files (only active services)

---

### Scenario 3: JSON Output to See Deletions

```bash
helm-env-delta --config example-4-prune-mode/config.with-prune.yaml --diff-json | jq '.files.deleted'
```

**Output**:
```json
[
  "destination/old-service-c.yaml",
  "destination/deprecated-service-d.yaml"
]
```

## Side-by-Side Comparison

| Aspect | `prune: false` | `prune: true` |
|--------|----------------|---------------|
| **Files synced** | 2 updated | 2 updated |
| **Extra files** | KEPT | DELETED |
| **Final count** | 4 files | 2 files |
| **Safety** | Safer (no deletions) | Riskier (permanent deletions) |
| **Use case** | Incremental sync | Mirror source exactly |

## When to Use Prune Mode

### Use `prune: true` when:
- ✓ Destination should mirror source exactly
- ✓ Old files need automatic cleanup
- ✓ You have version control for rollback
- ✓ You've carefully reviewed deletions in dry-run

### Use `prune: false` when:
- ✓ Destination may have extra files intentionally
- ✓ Manual cleanup is preferred
- ✓ Safer incremental sync is desired
- ✓ You're unsure about deletions

## Safety Best Practices

1. **Always dry-run first**:
   ```bash
   helm-env-delta --config config.yaml --dry-run --diff
   ```

2. **Review deleted files list**:
   ```bash
   helm-env-delta --config config.yaml --diff-json | jq '.files.deleted'
   ```

3. **Use version control**:
   ```bash
   git status  # Review before sync
   git diff    # See changes after sync
   ```

4. **Test on non-critical environments first**

## Key Concepts

1. **Prune Default**: `false` (safer - no deletions)

2. **Deletion Behavior**:
   - Only affects files matching include/exclude patterns
   - Files outside patterns are never touched

3. **Dry-Run Protection**:
   - Deletions are previewed before execution
   - No files deleted in dry-run mode

4. **Rollback**:
   - Use git to rollback accidental deletions
   - Consider backups for critical data

## What You'll Learn

- How prune mode works (mirror source to destination)
- The difference between prune: true and prune: false
- How to safely preview deletions with dry-run
- When to use prune mode vs manual cleanup
- How to integrate prune mode into your workflow
