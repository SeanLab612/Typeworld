#!/usr/bin/env bash
set -euo pipefail

BLENDER_APP="/Applications/Blender.app/Contents/MacOS/Blender"

if [[ ! -x "$BLENDER_APP" ]]; then
  echo "Blender executable not found: $BLENDER_APP" >&2
  exit 1
fi

mkdir -p artifacts
"$BLENDER_APP" --background --python scripts/blender/smoke_export.py -- \
  "$PWD/artifacts/blender-smoke.glb"
