#!/usr/bin/env bash
set -euo pipefail

BLENDER_APP="/Applications/Blender.app/Contents/MacOS/Blender"

if [[ ! -x "$BLENDER_APP" ]]; then
  echo "Blender executable not found: $BLENDER_APP" >&2
  exit 1
fi

mkdir -p assets/models artifacts/phase-6 docs/phase-6/renders

"$BLENDER_APP" --background --python-exit-code 1 \
  --python scripts/blender/build_typewriter_environment.py -- \
  "$PWD/assets/models/typewriter-environment.blend" \
  "$PWD/assets/models/typewriter-environment.glb" \
  "$PWD/docs/phase-6/renders" \
  "$PWD/artifacts/phase-6/environment-report.json"

node scripts/validate-environment.mjs \
  "$PWD/assets/models/typewriter-environment.glb" \
  "$PWD/artifacts/phase-6/environment-report.json"
