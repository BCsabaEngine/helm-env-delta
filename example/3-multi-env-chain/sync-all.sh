#!/bin/bash
set -e

echo "=== Multi-Environment Sync Chain ==="
echo ""

echo "Step 1: Dev → UAT"
helm-env-delta --config example-3-multi-env-chain/config.dev-to-uat.yaml --dry-run --diff
read -p "Continue with Dev → UAT sync? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  helm-env-delta --config example-3-multi-env-chain/config.dev-to-uat.yaml
  echo "✓ Dev → UAT complete"
fi

echo ""
echo "Step 2: UAT → Prod"
helm-env-delta --config example-3-multi-env-chain/config.uat-to-prod.yaml --dry-run --diff
read -p "Continue with UAT → Prod sync? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  helm-env-delta --config example-3-multi-env-chain/config.uat-to-prod.yaml
  echo "✓ UAT → Prod complete"
fi

echo ""
echo "=== Sync chain complete ==="
