#!/usr/bin/env bash
set -euo pipefail

echo "=== b4push: pattern-gen ==="

echo "--- typecheck ---"
pnpm run typecheck

echo "--- test ---"
pnpm run test

echo "--- build ---"
pnpm run build

echo "=== b4push: all checks passed ==="
