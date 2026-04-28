#!/bin/bash
set -e

echo "=== Multi-Environment Sync Chain ==="
echo ""

echo "Step 1: Dev → UAT"
helm-env-delta diff -c example-3-multi-env-chain/config.dev-to-uat.yaml
read -p "Continue with Dev → UAT sync? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  helm-env-delta run -c example-3-multi-env-chain/config.dev-to-uat.yaml
  echo "✓ Dev → UAT complete"
fi

echo ""
echo "Step 2: UAT → Prod"
helm-env-delta diff -c example-3-multi-env-chain/config.uat-to-prod.yaml
read -p "Continue with UAT → Prod sync? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  helm-env-delta run -c example-3-multi-env-chain/config.uat-to-prod.yaml
  echo "✓ UAT → Prod complete"
fi

echo ""
echo "=== Sync chain complete ==="
