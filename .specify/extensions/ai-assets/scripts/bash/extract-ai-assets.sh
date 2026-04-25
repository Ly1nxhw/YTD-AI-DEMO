#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${PWD}"

for arg in "$@"; do
  if [[ "$arg" == "--json" ]]; then
    continue
  fi
  ROOT_DIR="$arg"
done

python "$SCRIPT_DIR/../scan_repo.py" "$ROOT_DIR"
