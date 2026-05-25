#!/bin/bash
set -euo pipefail
mkdir -p /logs/verifier

# Grab preserve IDs from the task metadata file (comma-separated, may be empty)
PRESERVE_IDS="$(cat /tests/preserve_ids.txt 2>/dev/null || echo '')"

python3 /tests/test_verify.py \
    --produced /workspace/output.svg \
    --target   /tests/target.svg \
    --preserve-ids "$PRESERVE_IDS"
