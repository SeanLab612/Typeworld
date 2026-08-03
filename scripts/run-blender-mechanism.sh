#!/usr/bin/env bash
set -euo pipefail

BLENDER_APP="/Applications/Blender.app/Contents/MacOS/Blender"

if [[ ! -x "$BLENDER_APP" ]]; then
  echo "Blender executable not found: $BLENDER_APP" >&2
  exit 1
fi

mkdir -p assets/models artifacts/phase-2 docs/phase-2/renders

TYPEWRITER_PHASE=2 "$BLENDER_APP" --background --python-exit-code 1 \
  --python scripts/blender/build_typewriter_blockout.py -- \
  "$PWD/specs/keyboard-layout.json" \
  "$PWD/assets/models/typewriter-mechanism.blend" \
  "$PWD/assets/models/typewriter-mechanism.glb" \
  "$PWD/docs/phase-2/renders" \
  "$PWD/artifacts/phase-2/mechanism-report.json"

node scripts/validate-blockout.mjs \
  "$PWD/specs/keyboard-layout.json" \
  "$PWD/assets/models/typewriter-mechanism.glb" \
  "$PWD/artifacts/phase-2/mechanism-report.json"
