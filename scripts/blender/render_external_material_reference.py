from __future__ import annotations

import json
import pathlib
import sys

import bpy
from mathutils import Vector


def parse_args() -> tuple[pathlib.Path, pathlib.Path, pathlib.Path]:
    if "--" not in sys.argv:
        raise SystemExit("Expected <source.glb> <render-dir> <report.json> after --")
    args = sys.argv[sys.argv.index("--") + 1 :]
    if len(args) != 3:
        raise SystemExit(
            "Usage: render_external_material_reference.py -- "
            "<source.glb> <render-dir> <report.json>"
        )
    return tuple(pathlib.Path(value).resolve() for value in args)


SOURCE, RENDER_DIR, REPORT_PATH = parse_args()


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points = [
        obj.matrix_world @ Vector(corner)
        for obj in objects
        if obj.type == "MESH"
        for corner in obj.bound_box
    ]
    return (
        Vector(tuple(min(point[index] for point in points) for index in range(3))),
        Vector(tuple(max(point[index] for point in points) for index in range(3))),
    )


def add_camera(name: str, location: Vector, target: Vector, lens: float) -> bpy.types.Object:
    data = bpy.data.cameras.new(f"{name}_DATA")
    data.lens = lens
    camera = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = location
    look_at(camera, target)
    return camera


def add_area(name: str, location: Vector, target: Vector, energy: float, size: float) -> None:
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.active_object
    light.name = name
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    look_at(light, target)


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"Missing external GLB: {SOURCE}")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    imported = list(bpy.context.scene.objects)
    mesh_objects = [obj for obj in imported if obj.type == "MESH"]
    minimum, maximum = bounds(mesh_objects)
    center = (minimum + maximum) * 0.5
    extent = maximum - minimum
    scale = max(extent)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -0.8
    if scene.world is None:
        scene.world = bpy.data.worlds.new("REFERENCE_REVIEW_WORLD")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.012, 0.012, 0.012, 1.0)
    background.inputs["Strength"].default_value = 0.25

    bpy.ops.mesh.primitive_plane_add(size=scale * 5.0, location=(center.x, center.y, minimum.z))
    floor = bpy.context.active_object
    floor.name = "REFERENCE_REVIEW_FLOOR"
    floor_mat = bpy.data.materials.new("REFERENCE_REVIEW_FLOOR_MAT")
    floor_mat.diffuse_color = (0.025, 0.023, 0.021, 1.0)
    floor.data.materials.append(floor_mat)

    add_area(
        "REFERENCE_KEY",
        center + Vector((-1.2, -1.1, 1.7)) * scale,
        center,
        105.0,
        scale * 0.9,
    )
    add_area(
        "REFERENCE_FILL",
        center + Vector((1.3, -0.4, 0.7)) * scale,
        center,
        38.0,
        scale * 0.7,
    )
    add_area(
        "REFERENCE_RIM",
        center + Vector((0.3, 1.4, 1.2)) * scale,
        center,
        72.0,
        scale * 0.65,
    )

    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    views = (
        (
            "sketchfab-reference-hero",
            center + Vector((-1.15, -1.55, 0.85)) * scale,
            center + Vector((0.0, 0.0, 0.08)) * scale,
            58.0,
        ),
        (
            "sketchfab-reference-side",
            center + Vector((-1.8, 0.0, 0.55)) * scale,
            center,
            65.0,
        ),
    )
    renders: list[str] = []
    for name, location, target, lens in views:
        camera = add_camera(f"CAM_{name.upper().replace('-', '_')}", location, target, lens)
        scene.camera = camera
        output = RENDER_DIR / f"{name}.png"
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        renders.append(str(output))

    report = {
        "source": str(SOURCE),
        "license": "CC-BY-4.0",
        "author": "Kuba \"Volant\" Wójcik",
        "sourcePage": "https://sketchfab.com/3d-models/1930s-style-typewriter-wo-branding-1d6009449fe84fd79454c4081eb743bf",
        "meshCount": len(mesh_objects),
        "materialCount": len(bpy.data.materials) - 1,
        "imageCount": len(bpy.data.images),
        "bounds": {"min": list(minimum), "max": list(maximum)},
        "renders": renders,
        "usage": "read-only material and weathering comparison; not merged into production model",
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"EXTERNAL_REFERENCE_RENDER_OK {REPORT_PATH}")


main()
