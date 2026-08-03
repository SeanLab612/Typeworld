#!/usr/bin/env bash
set -euo pipefail

BLENDER_APP="/Applications/Blender.app/Contents/MacOS/Blender"

if [[ ! -x "$BLENDER_APP" ]]; then
  echo "Blender executable not found: $BLENDER_APP" >&2
  exit 1
fi

mkdir -p assets/models artifacts/phase-4 docs/phase-4/renders

TYPEWRITER_PHASE=4 "$BLENDER_APP" --background --python-exit-code 1 \
  --python scripts/blender/build_typewriter_blockout.py -- \
  "$PWD/specs/keyboard-layout.json" \
  "$PWD/assets/models/typewriter-interactive.blend" \
  "$PWD/assets/models/typewriter-interactive.glb" \
  "$PWD/docs/phase-4/renders" \
  "$PWD/artifacts/phase-4/interaction-report.json"

node scripts/validate-blockout.mjs \
  "$PWD/specs/keyboard-layout.json" \
  "$PWD/assets/models/typewriter-interactive.glb" \
  "$PWD/artifacts/phase-4/interaction-report.json"
