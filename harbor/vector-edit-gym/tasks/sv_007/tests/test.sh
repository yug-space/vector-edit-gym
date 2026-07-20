#!/bin/sh
set -eu
mkdir -p /logs/verifier
python3 /tests/test_verify.py \
  --produced /workspace/output.svg \
  --target /tests/target.svg \
  --metadata /tests/metadata.json
