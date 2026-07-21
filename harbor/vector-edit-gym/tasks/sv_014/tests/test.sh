#!/bin/sh
set -eu
mkdir -p /logs/verifier
python3 /tests/test_verify.py \
  --produced /workspace/output.svg \
  --initial /workspace/initial.svg \
  --target /tests/target.svg \
  --metadata /tests/metadata.json
