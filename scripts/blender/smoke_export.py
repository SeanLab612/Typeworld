import pathlib
import sys

import bpy


def output_path() -> pathlib.Path:
    if "--" not in sys.argv:
        raise SystemExit("Expected output path after --")
    value = sys.argv[sys.argv.index("--") + 1]
    return pathlib.Path(value).resolve()


target = output_path()
target.parent.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_cube_add(location=(0.0, 0.0, 0.5))
cube = bpy.context.active_object
cube.name = "ENVIRONMENT_SMOKE_CUBE"

bpy.ops.export_scene.gltf(
    filepath=str(target),
    export_format="GLB",
    export_apply=True,
)

if not target.exists() or target.stat().st_size == 0:
    raise SystemExit("Blender glTF smoke export failed")

print(f"BLENDER_SMOKE_OK {target} {target.stat().st_size} bytes")
