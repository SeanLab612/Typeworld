from __future__ import annotations

import json
import math
import os
import pathlib
import struct
import sys
import zlib
from dataclasses import dataclass
from typing import Iterable

import bpy
from mathutils import Quaternion, Vector


@dataclass(frozen=True)
class Paths:
    keyboard: pathlib.Path
    blend: pathlib.Path
    glb: pathlib.Path
    renders: pathlib.Path
    report: pathlib.Path


def parse_paths() -> Paths:
    if "--" not in sys.argv:
        raise SystemExit("Expected five paths after --")
    args = sys.argv[sys.argv.index("--") + 1 :]
    if len(args) != 5:
        raise SystemExit(
            "Usage: build_typewriter_blockout.py -- "
            "<keyboard.json> <output.blend> <output.glb> <render-dir> <report.json>"
        )
    return Paths(*(pathlib.Path(value).resolve() for value in args))


PATHS = parse_paths()
PHASE = int(os.environ.get("TYPEWRITER_PHASE", "1"))
MODEL_COLLECTION: bpy.types.Collection
REVIEW_COLLECTION: bpy.types.Collection
MATERIALS: dict[str, bpy.types.Material] = {}
SURFACE_MAPS: dict[str, dict[str, bpy.types.Image]] = {}


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    scene.unit_settings.scale_length = 1.0

    global MODEL_COLLECTION, REVIEW_COLLECTION
    MODEL_COLLECTION = bpy.data.collections.new("TYPEWRITER_MODEL")
    REVIEW_COLLECTION = bpy.data.collections.new("REVIEW_ONLY")
    scene.collection.children.link(MODEL_COLLECTION)
    scene.collection.children.link(REVIEW_COLLECTION)


def move_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    for existing in list(obj.users_collection):
        existing.objects.unlink(obj)
    collection.objects.link(obj)


def parent_keep_world(obj: bpy.types.Object, parent: bpy.types.Object | None) -> None:
    if parent is None:
        return
    obj.update_tag()
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world


def material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    metallic: float = 0.0,
    roughness: float = 0.5,
    alpha: float = 1.0,
    coat_weight: float = 0.0,
    coat_roughness: float = 0.03,
    ior: float = 1.5,
    specular_ior_level: float = 0.5,
    transmission: float = 0.0,
    surface_profile: str | None = None,
) -> bpy.types.Material:
    result = bpy.data.materials.new(name)
    result.diffuse_color = color
    result.use_nodes = True
    principled = result.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Alpha"].default_value = alpha
    for input_name, value in (
        ("Coat Weight", coat_weight),
        ("Coat Roughness", coat_roughness),
        ("IOR", ior),
        ("IOR Level", specular_ior_level),
        ("Transmission Weight", transmission),
    ):
        socket = principled.inputs.get(input_name)
        if socket is not None:
            socket.default_value = value
    if alpha < 1.0:
        result.surface_render_method = "DITHERED"
    if PHASE >= 3 and surface_profile:
        attach_surface_maps(result, principled, surface_profile, color[:3], roughness)
    MATERIALS[name] = result
    return result


def texture_noise(x: int, y: int, seed: int) -> float:
    value = math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453
    return value - math.floor(value)


def linear_to_srgb(value: float) -> float:
    value = max(0.0, min(1.0, value))
    if value <= 0.0031308:
        return value * 12.92
    return 1.055 * (value ** (1.0 / 2.4)) - 0.055


def generate_surface_maps(
    profile: str,
    base_color: tuple[float, float, float],
    base_roughness: float,
) -> dict[str, bpy.types.Image]:
    cache_key = (
        f"{profile}-"
        f"{round(base_color[0], 4)}-{round(base_color[1], 4)}-{round(base_color[2], 4)}-"
        f"{round(base_roughness, 4)}"
    )
    if cache_key in SURFACE_MAPS:
        return SURFACE_MAPS[cache_key]

    # img2threejs material-pass requires close-up materials to retain distinct
    # macro/meso/micro frequency bands. Hero-facing enamel and ivory therefore
    # receive 1K maps; secondary mechanisms use smaller maps to preserve the
    # browser delivery budget. The maps remain deterministic and independent.
    size = {
        "enamel": 1024,
        "ivory": 768,
        "metal": 640,
        "brass": 640,
        "black": 448,
        "keybed": 448,
        "paper": 384,
        "fabric": 384,
    }[profile]
    seed = sum(ord(character) for character in cache_key)
    heights = [0.0] * (size * size)
    albedo_pixels: list[float] = []
    roughness_pixels: list[float] = []

    profile_strength = {
        # Normal amplitudes are deliberately restrained. The previous
        # high-frequency noise read as sand-blasted plastic in grazing light.
        "enamel": (0.28, 0.26, 0.13),
        "metal": (0.17, 0.32, 0.30),
        "brass": (0.20, 0.34, 0.26),
        "ivory": (0.075, 0.14, 0.075),
        "black": (0.09, 0.22, 0.14),
        "keybed": (0.045, 0.13, 0.18),
        "paper": (0.035, 0.16, 0.05),
        "fabric": (0.07, 0.24, 0.22),
    }
    color_variation, rough_variation, normal_strength = profile_strength[profile]

    for y in range(size):
        for x in range(size):
            fine = texture_noise(x, y, seed)
            medium = (
                math.sin((x + seed) * 0.071)
                + math.sin((y - seed) * 0.053)
                + math.sin((x + y) * 0.031)
            ) / 6.0 + 0.5
            broad = (
                math.sin(x * 0.011 + seed * 0.13)
                + math.sin(y * 0.014 - seed * 0.07)
                + math.sin((x - y) * 0.006 + seed * 0.19)
            ) / 6.0 + 0.5
            mottling = 0.60 * medium + 0.30 * broad + 0.10 * fine
            directional = math.sin(y * 0.19 + x * 0.011 + seed)
            scratch_distance = abs(((x * 0.055 + y * 0.96 + seed) % 223.0) - 111.5)
            scratch = 1.0 if scratch_distance < 0.34 and fine > 0.73 else 0.0
            # Enamel/ivory/paper pitting is represented by deliberate local
            # features instead of white salt-and-pepper pixels in the normal map.
            pit_threshold = 1.1 if profile in {"enamel", "ivory", "paper"} else 0.993
            pit = 1.0 if fine > pit_threshold else 0.0
            cloud = (
                math.sin(x * 0.024 + seed)
                + math.sin(y * 0.031 - seed * 0.3)
                + math.sin((x + y) * 0.017)
            ) / 6.0 + 0.5
            edge_distance = min(x, y, size - 1 - x, size - 1 - y) / (size * 0.10)
            edge_wear = max(0.0, 1.0 - edge_distance) ** 3
            contact_wear = math.exp(
                -(((x / size - 0.57) / 0.25) ** 2 + ((y / size - 0.47) / 0.30) ** 2)
            )
            grime = max(0.0, 0.42 - medium) * 0.42 + max(0.0, 0.46 - cloud) * 0.18
            micro_ao = max(0.72, 1.0 - pit * 0.18 - grime * 0.11)

            color_factor = 0.95 + (mottling - 0.5) * color_variation
            if profile == "enamel":
                orange_peel = math.sin(x * 0.47) * math.sin(y * 0.41) * 0.012
                faded_patch = max(0.0, broad - 0.56) * 0.16
                old_stain = max(0.0, 0.46 - broad) * 0.48
                color_factor += orange_peel
                color_factor -= grime * 0.24 + old_stain
                color_factor += contact_wear * 0.035 + faded_patch
            elif profile == "metal":
                color_factor += directional * 0.030 + scratch * 0.10
                color_factor -= pit * 0.22 + grime * 0.22
            elif profile == "brass":
                tarnish = max(0.0, 0.56 - cloud) * 0.46
                color_factor += directional * 0.020 + scratch * 0.075
                color_factor -= pit * 0.18 + tarnish + grime * 0.20
            elif profile in {"black", "keybed"}:
                color_factor += contact_wear * 0.065 + scratch * 0.04
                color_factor -= pit * 0.12 + grime * 0.30
            elif profile == "ivory":
                yellowing = (1.0 - contact_wear) * 0.035 + max(0.0, 0.47 - cloud) * 0.055
                hairline = 0.035 if abs(math.sin(x * 0.041 + y * 0.012 + seed)) > 0.9993 else 0.0
                color_factor -= yellowing + hairline
                color_factor += contact_wear * 0.025
            elif profile == "paper":
                color_factor += (medium - 0.5) * 0.035
            color_factor *= micro_ao

            color = [base_color[channel] * color_factor for channel in range(3)]
            if profile == "enamel":
                # Sparse scratches expose a warm oxidized substrate; larger
                # silhouette chips remain explicit geometry/material patches.
                exposure = min(0.24, scratch * 0.22 + edge_wear * 0.10)
                substrate = (0.010, 0.006, 0.004)
                color = [
                    color[channel] * (1.0 - exposure) + substrate[channel] * exposure
                    for channel in range(3)
                ]
            elif profile == "metal":
                oxidation = max(pit * 0.64, grime * 0.42)
                oxide = (0.040, 0.030, 0.022)
                color = [
                    color[channel] * (1.0 - oxidation) + oxide[channel] * oxidation
                    for channel in range(3)
                ]
            elif profile == "brass":
                oxidation = max(pit * 0.52, max(0.0, 0.54 - cloud) * 0.38)
                patina = (0.034, 0.039, 0.027)
                color = [
                    color[channel] * (1.0 - oxidation) + patina[channel] * oxidation
                    for channel in range(3)
                ]

            albedo_pixels.extend(
                (
                    linear_to_srgb(color[0]),
                    linear_to_srgb(color[1]),
                    linear_to_srgb(color[2]),
                    1.0,
                )
            )

            roughness = base_roughness + (mottling - 0.5) * rough_variation
            roughness += pit * 0.18 - scratch * 0.12
            if profile in {"metal", "brass"}:
                roughness += max(0.0, 0.55 - cloud) * 0.17 - contact_wear * 0.055
            elif profile == "enamel":
                roughness += grime * 0.15 + edge_wear * 0.16 - contact_wear * 0.065
            elif profile == "ivory":
                roughness += max(0.0, 0.47 - cloud) * 0.055 - contact_wear * 0.045
            if profile == "fabric":
                roughness += abs(math.sin(x * 0.42) * math.sin(y * 0.36)) * 0.12
            roughness = max(0.04, min(0.98, roughness))
            roughness_pixels.extend((roughness, roughness, roughness, 1.0))

            height = (mottling - 0.5) * 0.11 + pit * 0.38 - scratch * 0.24
            if profile in {"metal", "brass"}:
                height += directional * 0.045 - max(0.0, 0.55 - cloud) * 0.055
            elif profile == "enamel":
                height += math.sin(x * 0.47) * math.sin(y * 0.41) * 0.022
            elif profile == "ivory":
                height += math.sin(x * 0.041 + y * 0.012 + seed) * 0.012
            if profile == "fabric":
                height += math.sin(x * 0.45) * math.sin(y * 0.45) * 0.16
            elif profile == "paper":
                height += math.sin(x * 0.77 + y * 0.17) * 0.055
            heights[y * size + x] = height

    normal_pixels: list[float] = []
    for y in range(size):
        for x in range(size):
            left = heights[y * size + ((x - 1) % size)]
            right = heights[y * size + ((x + 1) % size)]
            down = heights[((y - 1) % size) * size + x]
            up = heights[((y + 1) % size) * size + x]
            nx = (left - right) * normal_strength
            ny = (down - up) * normal_strength
            nz = 1.0
            length = math.sqrt(nx * nx + ny * ny + nz * nz)
            normal_pixels.extend(
                (
                    nx / length * 0.5 + 0.5,
                    ny / length * 0.5 + 0.5,
                    nz / length * 0.5 + 0.5,
                    1.0,
                )
            )

    texture_dir = PATHS.blend.parent.parent / "textures" / "generated"
    texture_dir.mkdir(parents=True, exist_ok=True)
    safe_name = "".join(character if character.isalnum() else "-" for character in cache_key)
    images: dict[str, bpy.types.Image] = {}
    for channel, pixels, colorspace in (
        ("albedo", albedo_pixels, "sRGB"),
        ("roughness", roughness_pixels, "Non-Color"),
        ("normal", normal_pixels, "Non-Color"),
    ):
        texture_path = texture_dir / f"{safe_name}-{channel}.png"
        write_png_rgba(texture_path, size, size, pixels)
        image = bpy.data.images.load(str(texture_path), check_existing=False)
        image.name = f"TEX_{safe_name}_{channel.upper()}"
        image.colorspace_settings.name = colorspace
        images[channel] = image
    SURFACE_MAPS[cache_key] = images
    return images


def write_png_rgba(
    path: pathlib.Path,
    width: int,
    height: int,
    pixels: list[float],
) -> None:
    def chunk(name: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + name
            + data
            + struct.pack(">I", zlib.crc32(name + data) & 0xFFFFFFFF)
        )

    rows = bytearray()
    stride = width * 4
    for y in range(height):
        rows.append(0)
        start = y * stride
        rows.extend(
            max(0, min(255, round(component * 255.0)))
            for component in pixels[start : start + stride]
        )
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(rows), level=9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


def attach_surface_maps(
    result: bpy.types.Material,
    principled: bpy.types.Node,
    profile: str,
    base_color: tuple[float, float, float],
    base_roughness: float,
) -> None:
    maps = generate_surface_maps(profile, base_color, base_roughness)
    nodes = result.node_tree.nodes
    links = result.node_tree.links

    albedo = nodes.new("ShaderNodeTexImage")
    albedo.name = f"{profile.upper()}_ALBEDO"
    albedo.image = maps["albedo"]
    links.new(albedo.outputs["Color"], principled.inputs["Base Color"])
    principled.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)

    roughness = nodes.new("ShaderNodeTexImage")
    roughness.name = f"{profile.upper()}_ROUGHNESS"
    roughness.image = maps["roughness"]
    roughness.image.colorspace_settings.name = "Non-Color"
    links.new(roughness.outputs["Color"], principled.inputs["Roughness"])
    principled.inputs["Roughness"].default_value = 1.0

    normal = nodes.new("ShaderNodeTexImage")
    normal.name = f"{profile.upper()}_NORMAL"
    normal.image = maps["normal"]
    normal.image.colorspace_settings.name = "Non-Color"
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.inputs["Strength"].default_value = {
        "enamel": 0.18,
        "metal": 0.34,
        "brass": 0.30,
        "ivory": 0.12,
        "black": 0.20,
        "keybed": 0.26,
        "paper": 0.10,
        "fabric": 0.30,
    }[profile]
    links.new(normal.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], principled.inputs["Normal"])


def create_materials() -> None:
    if PHASE >= 3:
        material(
            "MAT_BLOCKOUT_BURGUNDY",
            (0.018, 0.0010, 0.0018, 1.0),
            metallic=0.0,
            roughness=0.68,
            coat_weight=0.0,
            coat_roughness=0.40,
            ior=1.38,
            specular_ior_level=0.14,
            surface_profile="enamel",
        )
        material(
            "MAT_BLOCKOUT_BURGUNDY_DARK",
            (0.0085, 0.00055, 0.00085, 1.0),
            metallic=0.0,
            roughness=0.74,
            coat_weight=0.0,
            coat_roughness=0.40,
            ior=1.36,
            specular_ior_level=0.10,
            surface_profile="enamel",
        )
        material(
            "MAT_BLOCKOUT_IVORY",
            (0.68, 0.53, 0.31, 1.0),
            roughness=0.36,
            coat_weight=0.20,
            coat_roughness=0.16,
            surface_profile="ivory",
        )
        material("MAT_IVORY_AGED", (0.49, 0.33, 0.15, 1.0), roughness=0.46, coat_weight=0.10)
        material("MAT_IVORY_DARKENED", (0.34, 0.19, 0.070, 1.0), roughness=0.56, coat_weight=0.04)
        material("MAT_BLOCKOUT_CHROME", (0.085, 0.073, 0.060, 1.0), metallic=0.90, roughness=0.56, surface_profile="metal")
        material("MAT_CHROME_OXIDIZED", (0.055, 0.044, 0.034, 1.0), metallic=0.72, roughness=0.72)
        material("MAT_BLOCKOUT_BRASS", (0.078, 0.036, 0.010, 1.0), metallic=0.84, roughness=0.62, surface_profile="brass")
        material("MAT_BRASS_TARNISHED", (0.050, 0.026, 0.007, 1.0), metallic=0.66, roughness=0.76)
        material("MAT_BLOCKOUT_STEEL", (0.068, 0.059, 0.048, 1.0), metallic=0.86, roughness=0.56, surface_profile="metal")
        material("MAT_STEEL_OXIDIZED", (0.026, 0.019, 0.013, 1.0), metallic=0.60, roughness=0.80)
        material("MAT_BLOCKOUT_BLACK", (0.0012, 0.0010, 0.0008, 1.0), metallic=0.03, roughness=0.80, surface_profile="black")
        material("MAT_SPOOL_BLACK", (0.00035, 0.00028, 0.00022, 1.0), metallic=0.0, roughness=0.86)
        material("MAT_RUBBER_BLACK", (0.00022, 0.00022, 0.00024, 1.0), metallic=0.0, roughness=0.92)
        material("MAT_BLOCKOUT_PAPER", (0.78, 0.70, 0.56, 1.0), roughness=0.88, surface_profile="paper")
        material("MAT_KEYBED", (0.0025, 0.0018, 0.0014, 1.0), metallic=0.30, roughness=0.70, surface_profile="keybed")
        material(
            "MAT_KEY_GLASS",
            (0.90, 0.82, 0.66, 0.16),
            roughness=0.08,
            alpha=0.16,
            coat_weight=0.65,
            coat_roughness=0.025,
            ior=1.46,
            transmission=0.18,
        )
        material("MAT_RIBBON_RED", (0.028, 0.001, 0.003, 1.0), roughness=0.76, surface_profile="fabric")
        material("MAT_WORN_EDGE", (0.19, 0.15, 0.10, 1.0), metallic=0.90, roughness=0.43, surface_profile="metal")
        material("MAT_CHIPPED_EDGE", (0.028, 0.018, 0.010, 1.0), metallic=0.78, roughness=0.68)
        material("MAT_MACHINE_GRIME", (0.0015, 0.0007, 0.00025, 1.0), metallic=0.05, roughness=0.96)
        material("MAT_LEGEND_INK", (0.022, 0.014, 0.009, 1.0), roughness=0.82)
        material("MAT_REVIEW_FLOOR", (0.075, 0.068, 0.064, 1.0), roughness=0.90)
    else:
        material("MAT_BLOCKOUT_BURGUNDY", (0.042, 0.0025, 0.006, 1.0), metallic=0.55, roughness=0.27)
        material("MAT_BLOCKOUT_BURGUNDY_DARK", (0.010, 0.001, 0.002, 1.0), metallic=0.35, roughness=0.36)
        material("MAT_BLOCKOUT_IVORY", (0.92, 0.82, 0.64, 1.0), roughness=0.32)
        material("MAT_BLOCKOUT_CHROME", (0.48, 0.50, 0.52, 1.0), metallic=0.95, roughness=0.17)
        material("MAT_BLOCKOUT_BRASS", (0.20, 0.10, 0.025, 1.0), metallic=0.88, roughness=0.28)
        material("MAT_BLOCKOUT_STEEL", (0.18, 0.20, 0.22, 1.0), metallic=0.82, roughness=0.3)
        material("MAT_BLOCKOUT_BLACK", (0.008, 0.009, 0.011, 1.0), metallic=0.18, roughness=0.58)
        material("MAT_BLOCKOUT_PAPER", (0.93, 0.90, 0.82, 1.0), roughness=0.82)
        material("MAT_REVIEW_FLOOR", (0.025, 0.022, 0.023, 1.0), roughness=0.78)
    material("MAT_CHAIN_A", (1.0, 0.22, 0.035, 1.0), metallic=0.35, roughness=0.28)
    material("MAT_CHAIN_M", (0.0, 0.72, 0.86, 1.0), metallic=0.35, roughness=0.28)
    material("MAT_CHAIN_Z", (0.56, 0.12, 0.88, 1.0), metallic=0.35, roughness=0.28)
    material("MAT_HIT_PROXY", (0.1, 0.8, 0.2, 0.0), roughness=1.0, alpha=0.0)


def add_empty(
    name: str,
    location: tuple[float, float, float] = (0.0, 0.0, 0.0),
    *,
    parent: bpy.types.Object | None = None,
) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    MODEL_COLLECTION.objects.link(obj)
    obj.location = location
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.012
    parent_keep_world(obj, parent)
    return obj


def apply_bevel(obj: bpy.types.Object, amount: float, segments: int = 3) -> None:
    if amount <= 0.0:
        return
    modifier = obj.modifiers.new("BLOCKOUT_BEVEL", "BEVEL")
    modifier.width = amount
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)


def add_cube(
    name: str,
    size: tuple[float, float, float],
    location: tuple[float, float, float],
    material_name: str,
    *,
    bevel: float = 0.0,
    parent: bpy.types.Object | None = None,
    collection: bpy.types.Collection | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    apply_bevel(obj, bevel)
    obj.data.materials.append(MATERIALS[material_name])
    move_to_collection(obj, collection or MODEL_COLLECTION)
    parent_keep_world(obj, parent)
    return obj


def add_flexible_paper(
    name: str,
    *,
    width: float,
    height: float,
    location: tuple[float, float, float],
    material_name: str,
    columns: int = 48,
    rows: int = 32,
    parent: bpy.types.Object | None = None,
) -> bpy.types.Object:
    """Create a UV-stable paper sheet with enough topology for deterministic web deformation."""
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for row in range(rows + 1):
        v = row / rows
        local_z = (v - 0.5) * height
        # The lower edge lightly wraps the platen; the upper sheet relaxes backward.
        platen_wrap = -0.0105 * math.exp(-v * 7.0)
        upper_relax = -0.0030 * v * v
        for column in range(columns + 1):
            u = column / columns
            local_x = (u - 0.5) * width
            edge_ratio = abs(local_x / (width * 0.5))
            # Keep the static sheet developable: x-only curl avoids diagonal faceting.
            edge_curl = 0.0010 * (edge_ratio ** 3)
            vertices.append((local_x, platen_wrap + upper_relax + edge_curl, local_z))

    stride = columns + 1
    for row in range(rows):
        for column in range(columns):
            lower_left = row * stride + column
            faces.append(
                (
                    lower_left,
                    lower_left + 1,
                    lower_left + stride + 1,
                    lower_left + stride,
                )
            )

    mesh = bpy.data.meshes.new(f"{name}_GEOMETRY")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    uv_layer = mesh.uv_layers.new(name="PAPER_UV")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            row = vertex_index // stride
            column = vertex_index % stride
            uv_layer.data[loop_index].uv = (column / columns, row / rows)

    obj = bpy.data.objects.new(name, mesh)
    MODEL_COLLECTION.objects.link(obj)
    obj.location = location
    obj.data.materials.append(MATERIALS[material_name])
    obj["flexible"] = True
    obj["gridColumns"] = columns
    obj["gridRows"] = rows
    obj["paperWidthMeters"] = width
    obj["paperHeightMeters"] = height
    parent_keep_world(obj, parent)
    return obj


def add_cylinder(
    name: str,
    radius: float,
    depth: float,
    location: tuple[float, float, float],
    material_name: str,
    *,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    vertices: int = 24,
    bevel: float = 0.0,
    parent: bpy.types.Object | None = None,
    collection: bpy.types.Collection | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.active_object
    obj.name = name
    if bevel:
        apply_bevel(obj, bevel, 1)
    obj.data.materials.append(MATERIALS[material_name])
    move_to_collection(obj, collection or MODEL_COLLECTION)
    parent_keep_world(obj, parent)
    return obj


def add_uv_sphere(
    name: str,
    radius: float,
    location: tuple[float, float, float],
    material_name: str,
    *,
    parent: bpy.types.Object | None = None,
    collection: bpy.types.Collection | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=10, radius=radius, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(MATERIALS[material_name])
    move_to_collection(obj, collection or MODEL_COLLECTION)
    parent_keep_world(obj, parent)
    return obj


def add_rod(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float,
    material_name: str,
    *,
    parent: bpy.types.Object | None = None,
    vertices: int = 12,
) -> bpy.types.Object:
    a = Vector(start)
    b = Vector(end)
    direction = b - a
    obj = add_cylinder(
        name,
        radius,
        direction.length,
        tuple((a + b) * 0.5),
        material_name,
        vertices=vertices,
        parent=parent,
    )
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    return obj


def add_beam(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    width: float,
    depth: float,
    material_name: str,
    *,
    bevel: float = 0.002,
    parent: bpy.types.Object | None = None,
) -> bpy.types.Object:
    a = Vector(start)
    b = Vector(end)
    direction = b - a
    obj = add_cube(
        name,
        (width, depth, direction.length),
        tuple((a + b) * 0.5),
        material_name,
        bevel=bevel,
        parent=parent,
    )
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    return obj


def add_arc_tube(
    name: str,
    points: Iterable[tuple[float, float, float]],
    radius: float,
    material_name: str,
    *,
    parent: bpy.types.Object | None = None,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(f"{name}_CURVE", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new("BEZIER")
    points_list = list(points)
    spline.bezier_points.add(len(points_list) - 1)
    for bezier, point in zip(spline.bezier_points, points_list):
        bezier.co = point
        bezier.handle_left_type = "AUTO"
        bezier.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    MODEL_COLLECTION.objects.link(obj)
    curve.materials.append(MATERIALS[material_name])
    parent_keep_world(obj, parent)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.active_object
    obj.name = name
    obj.select_set(False)
    return obj


def add_half_disc(
    name: str,
    radius: float,
    depth: float,
    location: tuple[float, float, float],
    material_name: str,
    *,
    parent: bpy.types.Object | None = None,
    segments: int = 32,
) -> bpy.types.Object:
    cx, cy, cz = location
    vertices: list[tuple[float, float, float]] = []
    for y_offset in (-depth * 0.5, depth * 0.5):
        vertices.append((cx, cy + y_offset, cz))
        for index in range(segments + 1):
            angle = index * math.pi / segments
            vertices.append(
                (
                    cx + math.cos(angle) * radius,
                    cy + y_offset,
                    cz + math.sin(angle) * radius,
                )
            )
    ring_size = segments + 2
    faces: list[tuple[int, ...]] = []
    for index in range(segments):
        faces.append((0, index + 1, index + 2))
        faces.append((ring_size, ring_size + index + 2, ring_size + index + 1))
    for index in range(segments):
        front_a = index + 1
        front_b = index + 2
        back_a = ring_size + front_a
        back_b = ring_size + front_b
        faces.append((front_a, back_a, back_b, front_b))
    faces.append((0, ring_size, ring_size + 1, 1))
    faces.append((0, segments + 1, ring_size + segments + 1, ring_size))
    mesh = bpy.data.meshes.new(f"{name}_MESH")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(MATERIALS[material_name])
    obj = bpy.data.objects.new(name, mesh)
    MODEL_COLLECTION.objects.link(obj)
    apply_bevel(obj, 0.0008, 2)
    parent_keep_world(obj, parent)
    return obj


def add_profile_plate_yz(
    name: str,
    x: float,
    thickness: float,
    points: list[tuple[float, float]],
    material_name: str,
    *,
    bevel: float = 0.0015,
    parent: bpy.types.Object | None = None,
) -> bpy.types.Object:
    vertices = [
        (x + x_offset, y, z)
        for x_offset in (-thickness * 0.5, thickness * 0.5)
        for y, z in points
    ]
    point_count = len(points)
    faces: list[tuple[int, ...]] = [
        tuple(range(point_count - 1, -1, -1)),
        tuple(range(point_count, point_count * 2)),
    ]
    for index in range(point_count):
        next_index = (index + 1) % point_count
        faces.append(
            (
                index,
                next_index,
                point_count + next_index,
                point_count + index,
            )
        )
    mesh = bpy.data.meshes.new(f"{name}_MESH")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(MATERIALS[material_name])
    obj = bpy.data.objects.new(name, mesh)
    MODEL_COLLECTION.objects.link(obj)
    apply_bevel(obj, bevel, 2)
    parent_keep_world(obj, parent)
    return obj


def add_profile_plate_xy(
    name: str,
    points: list[tuple[float, float]],
    z: float,
    thickness: float,
    material_name: str,
    *,
    bevel: float,
    parent: bpy.types.Object,
) -> bpy.types.Object:
    vertices = [
        (x, y, z + z_offset)
        for z_offset in (-thickness * 0.5, thickness * 0.5)
        for x, y in points
    ]
    point_count = len(points)
    faces: list[tuple[int, ...]] = [
        tuple(range(point_count - 1, -1, -1)),
        tuple(range(point_count, point_count * 2)),
    ]
    for index in range(point_count):
        next_index = (index + 1) % point_count
        faces.append(
            (
                index,
                next_index,
                point_count + next_index,
                point_count + index,
            )
        )
    mesh = bpy.data.meshes.new(f"{name}_MESH")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(MATERIALS[material_name])
    obj = bpy.data.objects.new(name, mesh)
    MODEL_COLLECTION.objects.link(obj)
    apply_bevel(obj, bevel, 3)
    parent_keep_world(obj, parent)
    return obj


def add_profile_strip_xy(
    name: str,
    outer: list[tuple[float, float]],
    inner: list[tuple[float, float]],
    z: float,
    thickness: float,
    material_name: str,
    *,
    bevel: float,
    parent: bpy.types.Object,
) -> bpy.types.Object:
    if len(outer) != len(inner) or len(outer) < 2:
        raise ValueError("Profile strip requires matching outer and inner paths")
    path_count = len(outer)
    vertices = [
        (x, y, z + z_offset)
        for z_offset in (-thickness * 0.5, thickness * 0.5)
        for path in (outer, inner)
        for x, y in path
    ]
    outer_bottom = 0
    inner_bottom = path_count
    outer_top = path_count * 2
    inner_top = path_count * 3
    faces: list[tuple[int, ...]] = []
    for index in range(path_count - 1):
        next_index = index + 1
        faces.extend(
            (
                (
                    outer_top + index,
                    outer_top + next_index,
                    inner_top + next_index,
                    inner_top + index,
                ),
                (
                    outer_bottom + index,
                    inner_bottom + index,
                    inner_bottom + next_index,
                    outer_bottom + next_index,
                ),
                (
                    outer_bottom + index,
                    outer_bottom + next_index,
                    outer_top + next_index,
                    outer_top + index,
                ),
                (
                    inner_bottom + next_index,
                    inner_bottom + index,
                    inner_top + index,
                    inner_top + next_index,
                ),
            )
        )
    for index in (0, path_count - 1):
        faces.append(
            (
                outer_bottom + index,
                outer_top + index,
                inner_top + index,
                inner_bottom + index,
            )
        )
    mesh = bpy.data.meshes.new(f"{name}_MESH")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(MATERIALS[material_name])
    obj = bpy.data.objects.new(name, mesh)
    MODEL_COLLECTION.objects.link(obj)
    apply_bevel(obj, bevel, 3)
    parent_keep_world(obj, parent)
    return obj


def add_key_legend(
    name: str,
    text: str,
    location: tuple[float, float, float],
    size: float,
    *,
    parent: bpy.types.Object,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(f"{name}_CURVE", "FONT")
    curve.body = text
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.size = size
    curve.resolution_u = 1
    curve.extrude = 0.00008
    curve.offset = 0.0001
    obj = bpy.data.objects.new(name, curve)
    MODEL_COLLECTION.objects.link(obj)
    obj.location = location
    curve.materials.append(MATERIALS["MAT_LEGEND_INK" if PHASE >= 3 else "MAT_BLOCKOUT_BLACK"])
    parent_keep_world(obj, parent)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.active_object
    obj.name = name
    obj.select_set(False)
    return obj


def build_frame(root: bpy.types.Object) -> bpy.types.Object:
    frame_root = add_empty("FRAME_ROOT", parent=root)
    refined = PHASE >= 2
    if PHASE >= 3:
        add_cube("FRAME_BASE_FRONT", (0.388, 0.020, 0.020), (0.0, -0.160, 0.030), "MAT_BLOCKOUT_BURGUNDY_DARK", bevel=0.005, parent=frame_root)
        add_cube("FRAME_BASE_REAR", (0.392, 0.018, 0.022), (0.0, 0.148, 0.038), "MAT_BLOCKOUT_BURGUNDY_DARK", bevel=0.004, parent=frame_root)
        add_cube("FRAME_SIDE_LEFT", (0.018, 0.280, 0.022), (-0.194, -0.002, 0.043), "MAT_BLOCKOUT_BURGUNDY_DARK", bevel=0.004, parent=frame_root)
        add_cube("FRAME_SIDE_RIGHT", (0.018, 0.280, 0.022), (0.194, -0.002, 0.043), "MAT_BLOCKOUT_BURGUNDY_DARK", bevel=0.004, parent=frame_root)
        add_profile_strip_xy(
            "FRAME_VINTAGE_PERIMETER",
            [
                (-0.196, 0.145),
                (-0.205, -0.105),
                (-0.198, -0.150),
                (-0.170, -0.176),
                (0.0, -0.185),
                (0.170, -0.176),
                (0.198, -0.150),
                (0.205, -0.105),
                (0.196, 0.145),
            ],
            [
                (-0.169, 0.140),
                (-0.179, -0.100),
                (-0.171, -0.134),
                (-0.148, -0.150),
                (0.0, -0.158),
                (0.148, -0.150),
                (0.171, -0.134),
                (0.179, -0.100),
                (0.169, 0.140),
            ],
            0.041,
            0.022,
            "MAT_BLOCKOUT_BURGUNDY",
            bevel=0.0055,
            parent=frame_root,
        )
        add_profile_plate_xy(
            "FRAME_KEYBED",
            [
                (-0.168, -0.153),
                (0.168, -0.153),
                (0.184, -0.126),
                (0.181, 0.085),
                (0.154, 0.102),
                (-0.154, 0.102),
                (-0.181, 0.085),
                (-0.184, -0.126),
            ],
            0.066,
            0.012,
            "MAT_KEYBED",
            bevel=0.006,
            parent=frame_root,
        )
        add_cube(
            "FRAME_KEYBOARD_APRON",
            (0.350, 0.022, 0.032),
            (0.0, 0.078, 0.085),
            "MAT_BLOCKOUT_BLACK",
            bevel=0.005,
            parent=frame_root,
        )
    else:
        add_cube("FRAME_BASE_FRONT", (0.43, 0.032, 0.034), (0.0, -0.158, 0.027), "MAT_BLOCKOUT_BURGUNDY", bevel=0.005 if refined else 0.012, parent=frame_root)
        add_cube("FRAME_BASE_REAR", (0.43, 0.028, 0.034), (0.0, 0.148, 0.032), "MAT_BLOCKOUT_BURGUNDY", bevel=0.004 if refined else 0.009, parent=frame_root)
        add_cube("FRAME_SIDE_LEFT", (0.028 if refined else 0.034, 0.286, 0.034), (-0.198, -0.004, 0.044), "MAT_BLOCKOUT_BURGUNDY", bevel=0.004 if refined else 0.009, parent=frame_root)
        add_cube("FRAME_SIDE_RIGHT", (0.028 if refined else 0.034, 0.286, 0.034), (0.198, -0.004, 0.044), "MAT_BLOCKOUT_BURGUNDY", bevel=0.004 if refined else 0.009, parent=frame_root)
        add_cube(
            "FRAME_KEYBED",
            (0.368, 0.210, 0.016),
            (0.0, -0.052, 0.071),
            "MAT_BLOCKOUT_STEEL",
            bevel=0.006,
            parent=frame_root,
        )

    for side, x in (("LEFT", -0.198), ("RIGHT", 0.198)):
        if PHASE >= 3:
            inner_x = x + (0.012 if side == "LEFT" else -0.012)
            add_beam(
                f"FRAME_OPEN_RAIL_{side}",
                (inner_x, -0.128, 0.069),
                (inner_x, 0.103, 0.123),
                0.018,
                0.013,
                "MAT_BLOCKOUT_BURGUNDY",
                bevel=0.003,
                parent=frame_root,
            )
            add_profile_plate_yz(
                f"FRAME_REAR_CHEEK_{side}",
                x,
                0.018,
                [
                    (-0.151, 0.048),
                    (-0.105, 0.054),
                    (0.084, 0.076),
                    (0.109, 0.108),
                    (0.132, 0.206),
                    (0.154, 0.246),
                    (0.181, 0.254),
                    (0.193, 0.234),
                    (0.171, 0.198),
                    (0.151, 0.102),
                    (-0.125, 0.050),
                ],
                "MAT_BLOCKOUT_BURGUNDY",
                bevel=0.0022,
                parent=frame_root,
            )
            outward_x = x + (-0.0135 if side == "LEFT" else 0.0135)
            mechanism_x = x + (-0.014 if side == "LEFT" else 0.014)
            cutout = add_profile_plate_yz(
                f"FRAME_REAR_CHEEK_CUTOUT_{side}",
                outward_x,
                0.0025,
                [
                    (-0.125, 0.054),
                    (-0.072, 0.061),
                    (0.077, 0.083),
                    (0.099, 0.106),
                    (0.111, 0.141),
                    (0.096, 0.151),
                    (0.071, 0.118),
                    (-0.099, 0.061),
                ],
                "MAT_BLOCKOUT_BLACK",
                bevel=0.0018,
                parent=frame_root,
            )
            cutout["surfaceGapMeters"] = 0.00325
            add_profile_plate_yz(
                f"FRAME_CARRIAGE_SADDLE_{side}",
                mechanism_x,
                0.008,
                [
                    (0.112, 0.145),
                    (0.136, 0.226),
                    (0.156, 0.261),
                    (0.185, 0.257),
                    (0.197, 0.232),
                    (0.177, 0.204),
                    (0.152, 0.151),
                ],
                "MAT_BLOCKOUT_CHROME",
                bevel=0.0013,
                parent=frame_root,
            )
            add_cylinder(
                f"FRAME_CARRIAGE_MAIN_BEARING_{side}",
                0.024,
                0.018,
                (mechanism_x, 0.166, 0.232),
                "MAT_BLOCKOUT_CHROME",
                rotation=(0.0, math.pi / 2, 0.0),
                vertices=32,
                bevel=0.0012,
                parent=frame_root,
            )
            add_cylinder(
                f"FRAME_CARRIAGE_MAIN_HUB_{side}",
                0.012,
                0.021,
                (mechanism_x, 0.166, 0.232),
                "MAT_BLOCKOUT_BRASS",
                rotation=(0.0, math.pi / 2, 0.0),
                vertices=24,
                parent=frame_root,
            )
            add_cylinder(
                f"FRAME_CARRIAGE_SECONDARY_BEARING_{side}",
                0.014,
                0.020,
                (mechanism_x, 0.132, 0.176),
                "MAT_BLOCKOUT_STEEL",
                rotation=(0.0, math.pi / 2, 0.0),
                vertices=24,
                bevel=0.001,
                parent=frame_root,
            )
            add_cylinder(
                f"FRAME_CARRIAGE_SECONDARY_HUB_{side}",
                0.006,
                0.023,
                (mechanism_x, 0.132, 0.176),
                "MAT_BLOCKOUT_BRASS",
                rotation=(0.0, math.pi / 2, 0.0),
                vertices=18,
                parent=frame_root,
            )
            add_rod(
                f"FRAME_CARRIAGE_LINK_{side}_FRONT",
                (mechanism_x, 0.103, 0.126),
                (mechanism_x, 0.145, 0.219),
                0.0042,
                "MAT_BLOCKOUT_CHROME",
                parent=frame_root,
                vertices=14,
            )
            add_rod(
                f"FRAME_CARRIAGE_LINK_{side}_REAR",
                (mechanism_x, 0.139, 0.145),
                (mechanism_x, 0.185, 0.236),
                0.0036,
                "MAT_BLOCKOUT_CHROME",
                parent=frame_root,
                vertices=14,
            )
            add_rod(
                f"FRAME_CARRIAGE_LINK_{side}_KNEE",
                (mechanism_x, 0.132, 0.176),
                (mechanism_x, 0.185, 0.211),
                0.0032,
                "MAT_BLOCKOUT_STEEL",
                parent=frame_root,
                vertices=12,
            )
            for index, (y, z) in enumerate(
                ((0.111, 0.113), (0.151, 0.250), (0.187, 0.230)),
                start=1,
            ):
                add_cylinder(
                    f"FRAME_CARRIAGE_FASTENER_{side}_{index:02d}",
                    0.0044,
                    0.022,
                    (mechanism_x, y, z),
                    "MAT_WORN_EDGE",
                    rotation=(0.0, math.pi / 2, 0.0),
                    vertices=18,
                    bevel=0.0005,
                    parent=frame_root,
                )
        elif refined:
            add_beam(
                f"FRAME_OPEN_RAIL_{side}",
                (x, -0.128, 0.064),
                (x, 0.112, 0.135),
                0.020,
                0.014,
                "MAT_BLOCKOUT_BURGUNDY",
                bevel=0.003,
                parent=frame_root,
            )
            add_cube(
                f"FRAME_CARRIAGE_TOWER_{side}",
                (0.028, 0.038, 0.090),
                (x, 0.124, 0.105),
                "MAT_BLOCKOUT_BURGUNDY",
                bevel=0.004,
                parent=frame_root,
            )
            add_beam(
                f"FRAME_CARRIAGE_BRACKET_{side}_FRONT",
                (x, 0.105, 0.140),
                (x, 0.150, 0.235),
                0.010,
                0.012,
                "MAT_BLOCKOUT_CHROME",
                bevel=0.0015,
                parent=frame_root,
            )
            add_beam(
                f"FRAME_CARRIAGE_BRACKET_{side}_REAR",
                (x, 0.142, 0.140),
                (x, 0.180, 0.240),
                0.009,
                0.011,
                "MAT_BLOCKOUT_CHROME",
                bevel=0.0015,
                parent=frame_root,
            )
            add_cylinder(
                f"FRAME_CARRIAGE_BEARING_{side}",
                0.021,
                0.014,
                (x, 0.164, 0.233),
                "MAT_BLOCKOUT_CHROME",
                rotation=(0.0, math.pi / 2, 0.0),
                vertices=24,
                bevel=0.0015,
                parent=frame_root,
            )
            add_cylinder(
                f"FRAME_CARRIAGE_WASHER_{side}",
                0.011,
                0.017,
                (x, 0.164, 0.233),
                "MAT_BLOCKOUT_BRASS",
                rotation=(0.0, math.pi / 2, 0.0),
                vertices=20,
                parent=frame_root,
            )
        else:
            add_rod(
                f"FRAME_OPEN_RAIL_{side}",
                (x, -0.125, 0.070),
                (x, 0.128, 0.145),
                0.012,
                "MAT_BLOCKOUT_BURGUNDY",
                parent=frame_root,
                vertices=16,
            )
            add_cube(
                f"FRAME_CARRIAGE_TOWER_{side}",
                (0.035, 0.048, 0.155),
                (x, 0.130, 0.130),
                "MAT_BLOCKOUT_BURGUNDY",
                bevel=0.008,
                parent=frame_root,
            )

    if PHASE >= 3:
        add_cube(
            "FRAME_REAR_BULKHEAD",
            (0.366, 0.018, 0.118),
            (0.0, 0.168, 0.145),
            "MAT_BLOCKOUT_BURGUNDY_DARK",
            bevel=0.007,
            parent=frame_root,
        )
        add_profile_plate_xy(
            "FRAME_INTERNAL_DECK",
            [
                (-0.176, 0.060),
                (0.176, 0.060),
                (0.181, 0.142),
                (0.160, 0.157),
                (-0.160, 0.157),
                (-0.181, 0.142),
            ],
            0.105,
            0.014,
            "MAT_BLOCKOUT_BLACK",
            bevel=0.005,
            parent=frame_root,
        )
        for side, x in (("LEFT", -0.170), ("RIGHT", 0.170)):
            add_profile_plate_yz(
                f"FRAME_REAR_SHOULDER_{side}",
                x,
                0.034,
                [
                    (0.050, 0.086),
                    (0.151, 0.092),
                    (0.181, 0.126),
                    (0.184, 0.220),
                    (0.151, 0.235),
                    (0.105, 0.215),
                    (0.078, 0.142),
                ],
                "MAT_BLOCKOUT_BURGUNDY",
                bevel=0.004,
                parent=frame_root,
            )
            add_cube(
                f"FRAME_SPOOL_PEDESTAL_{side}",
                (0.068, 0.075, 0.036),
                (x * 0.86, 0.112, 0.193),
                "MAT_BLOCKOUT_BURGUNDY_DARK",
                bevel=0.008,
                parent=frame_root,
            )

    add_cube("FRAME_TYPEBASKET_SUPPORT", (0.335, 0.026, 0.026), (0.0, 0.082, 0.126), "MAT_BLOCKOUT_CHROME", bevel=0.006, parent=frame_root)
    add_arc_tube(
        "FRAME_FRONT_CHROME_RAIL",
        [
            (-0.175, 0.104, 0.181),
            (-0.105, 0.104, 0.181),
            (0.0, 0.104, 0.181),
            (0.105, 0.104, 0.181),
            (0.175, 0.104, 0.181),
        ],
        0.0045,
        "MAT_BLOCKOUT_CHROME",
        parent=frame_root,
    )

    for name, x, y in (
        ("FOOT_FRONT_LEFT", -0.190, -0.156),
        ("FOOT_FRONT_RIGHT", 0.190, -0.156),
        ("FOOT_REAR_LEFT", -0.190, 0.145),
        ("FOOT_REAR_RIGHT", 0.190, 0.145),
    ):
        add_cylinder(
            name,
            0.015,
            0.012,
            (x, y, 0.006),
            "MAT_RUBBER_BLACK" if PHASE >= 3 else "MAT_BLOCKOUT_CHROME",
            vertices=24,
            bevel=0.0015,
            parent=frame_root,
        )
        if PHASE >= 3:
            add_cylinder(
                f"{name}_MOUNT",
                0.009,
                0.026,
                (x, y, 0.023),
                "MAT_STEEL_OXIDIZED",
                vertices=20,
                bevel=0.001,
                parent=frame_root,
            )
    return frame_root


def build_keyboard(root: bpy.types.Object, keyboard: dict) -> dict[str, bpy.types.Object]:
    keyboard_root = add_empty("KEYBOARD_ROOT", parent=root)
    linkage_root = add_empty("LINKAGE_ROOT", parent=root)
    hit_root = add_empty("HIT_ROOT", parent=root)
    pitch = keyboard["units"]["keyPitchMeters"]
    key_radius = keyboard["units"]["roundKeyDiameterMeters"] * 0.5
    row_geometry = {
        "R0": (0.048, 0.112),
        "R1": (0.016, 0.101),
        "R2": (-0.016, 0.091),
        "R3": (-0.049, 0.082),
        "R4": (-0.094, 0.076),
    }
    pivots: dict[str, bpy.types.Object] = {}
    chain_materials = (
        {}
        if PHASE >= 3
        else {"A": "MAT_CHAIN_A", "M": "MAT_CHAIN_M", "Z": "MAT_CHAIN_Z"}
    )

    for key in keyboard["keys"]:
        key_id = key["id"]
        x = (float(key["x"]) - 6.5) * pitch
        y, top_z = row_geometry[key["row"]]
        pivot = add_empty(f"KEY_{key_id}_PIVOT", (x, y, top_z - 0.014), parent=keyboard_root)
        pivot["keyId"] = key_id
        pivot["keyboardCode"] = key["code"]
        pivot["kind"] = key["kind"]
        pivot["pressDepthMeters"] = 0.006
        pivots[key_id] = pivot

        if key_id == "SPACE":
            add_cube(
                "KEY_SPACE_MESH",
                (keyboard["units"]["spaceWidthMeters"], 0.020, 0.012),
                (x, y, top_z),
                "MAT_BLOCKOUT_BLACK",
                bevel=0.005,
                parent=pivot,
            )
            add_cube(
                "KEY_SPACE_STEM",
                (0.120, 0.010, 0.014),
                (x, y + 0.004, top_z - 0.010),
                "MAT_BLOCKOUT_STEEL",
                bevel=0.002,
                parent=pivot,
            )
            hit_size = (keyboard["units"]["spaceWidthMeters"] + 0.008, 0.030, 0.022)
        else:
            ivory_material = "MAT_BLOCKOUT_IVORY"
            brass_material = "MAT_BLOCKOUT_BRASS"
            if PHASE >= 3:
                aging_code = sum(ord(character) for character in key_id)
                if aging_code % 13 == 0:
                    ivory_material = "MAT_IVORY_DARKENED"
                elif aging_code % 5 == 0:
                    ivory_material = "MAT_IVORY_AGED"
                if aging_code % 4 == 0:
                    brass_material = "MAT_BRASS_TARNISHED"
            add_cylinder(
                f"KEY_{key_id}_RING",
                key_radius + 0.0024,
                0.006,
                (x, y, top_z - 0.002),
                brass_material if PHASE >= 3 else "MAT_BLOCKOUT_CHROME",
                vertices=20,
                bevel=0.0007,
                parent=pivot,
            )
            if PHASE >= 3:
                add_cylinder(
                    f"KEY_{key_id}_GASKET",
                    key_radius + 0.0005,
                    0.0018,
                    (x, y, top_z + 0.0014),
                    "MAT_BLOCKOUT_BLACK",
                    vertices=24,
                    bevel=0.0003,
                    parent=pivot,
                )
            add_cylinder(
                f"KEY_{key_id}_MESH",
                key_radius,
                0.007,
                (x, y, top_z + 0.001),
                ivory_material,
                vertices=20,
                bevel=0.0008,
                parent=pivot,
            )
            add_cylinder(
                f"KEY_{key_id}_STEM",
                0.0032,
                0.019,
                (x, y, top_z - 0.012),
                "MAT_BLOCKOUT_STEEL",
                vertices=12,
                parent=pivot,
            )
            if PHASE >= 2:
                if key["kind"] == "print":
                    legend = key["base"].upper() if key["base"].isalpha() else key["base"]
                else:
                    legend = {
                        "BACKSPACE": "←",
                        "ENTER": "↵",
                        "SHIFT_LEFT": "⇧",
                        "SHIFT_RIGHT": "⇧",
                    }.get(key_id, "")
                if legend:
                    add_key_legend(
                        f"KEY_{key_id}_LEGEND",
                        legend,
                        (x, y, top_z + 0.0052),
                        0.0075,
                        parent=pivot,
                    )
            if PHASE >= 3:
                glass = add_cylinder(
                    f"KEY_{key_id}_GLASS",
                    key_radius - 0.0006,
                    0.0015,
                    (x, y, top_z + 0.0064),
                    "MAT_KEY_GLASS",
                    vertices=24,
                    bevel=0.0007,
                    parent=pivot,
                )
                glass["layer"] = "glass-lens"
            hit_size = (0.023, 0.023, 0.020)

        hit = add_cube(
            f"HIT_KEY_{key_id}",
            hit_size,
            (x, y, top_z),
            "MAT_HIT_PROXY",
            parent=hit_root,
        )
        hit["keyId"] = key_id
        hit.display_type = "WIRE"
        hit.hide_render = True

        linkage_pivot = add_empty(
            f"LINK_{key_id}_PIVOT",
            (x, y + 0.012, top_z - 0.040),
            parent=linkage_root,
        )
        linkage_pivot["keyId"] = key_id
        linkage_pivot["travelAngleRad"] = -0.34
        if key_id in chain_materials:
            material_name = chain_materials[key_id]
            add_rod(
                f"LINK_{key_id}_MESH",
                (x, y + 0.012, top_z - 0.040),
                (x * 0.55, 0.086, 0.124),
                0.0022,
                material_name,
                parent=linkage_pivot,
                vertices=10,
            )
            add_uv_sphere(
                f"LINK_{key_id}_JOINT",
                0.0045,
                (x * 0.55, 0.086, 0.124),
                material_name,
                parent=linkage_pivot,
            )
    return pivots


def build_typebasket(root: bpy.types.Object, keyboard: dict) -> dict[str, bpy.types.Object]:
    typebasket_root = add_empty("TYPEBASKET_ROOT", parent=root)
    add_arc_tube(
        "TYPEBASKET_FRAME",
        [
            (
                0.158 * math.sin(angle),
                0.095 + 0.018 * math.cos(angle),
                0.132 + 0.024 * math.cos(angle),
            )
            for angle in [(-1.25 + index * 2.5 / 32) for index in range(33)]
        ],
        0.005,
        "MAT_BLOCKOUT_CHROME",
        parent=typebasket_root,
    )
    add_cube("TYPEBASKET_COMB", (0.305, 0.018, 0.012), (0.0, 0.100, 0.139), "MAT_BLOCKOUT_STEEL", bevel=0.003, parent=typebasket_root)
    add_cube("TYPEGUIDE_LEFT", (0.009, 0.018, 0.042), (-0.013, 0.149, 0.230), "MAT_BLOCKOUT_CHROME", bevel=0.002, parent=typebasket_root)
    add_cube("TYPEGUIDE_RIGHT", (0.009, 0.018, 0.042), (0.013, 0.149, 0.230), "MAT_BLOCKOUT_CHROME", bevel=0.002, parent=typebasket_root)
    print_point = add_empty("PRINT_POINT", (0.0, 0.166, 0.245), parent=typebasket_root)
    print_point.empty_display_type = "SPHERE"
    print_point.empty_display_size = 0.006

    printable = [key for key in keyboard["keys"] if key["kind"] == "print"]
    pivots: dict[str, bpy.types.Object] = {}
    highlight = (
        {}
        if PHASE >= 3
        else {"A": "MAT_CHAIN_A", "M": "MAT_CHAIN_M", "Z": "MAT_CHAIN_Z"}
    )
    strike_point = Vector((0.0, 0.166, 0.245))
    for index, key in enumerate(printable):
        fraction = index / (len(printable) - 1)
        angle = -1.22 + fraction * 2.44
        px = 0.151 * math.sin(angle)
        py = 0.102 + 0.020 * math.cos(angle)
        pz = 0.139 + 0.016 * math.cos(angle)
        pivot_point = Vector((px, py, pz))
        if PHASE >= 2:
            visual_head = Vector(
                (
                    0.106 * math.sin(angle),
                    0.132 + 0.020 * math.cos(angle),
                    0.194 + 0.022 * math.cos(angle),
                )
            )
            strike_vector = strike_point - pivot_point
            rest_direction = (visual_head - pivot_point).normalized()
            rest_vector = rest_direction * strike_vector.length
            head_point = pivot_point + rest_vector
            hinge_axis = rest_vector.cross(strike_vector).normalized()
            strike_angle = rest_vector.angle(strike_vector)
            hx, hy, hz = head_point
        else:
            strike_angle = 1.05 + abs(angle) * 0.08
            hx = 0.106 * math.sin(angle)
            hy = 0.132 + 0.020 * math.cos(angle)
            hz = 0.194 + 0.022 * math.cos(angle)
        key_id = key["id"]
        pivot = add_empty(f"TYPEBAR_{key_id}_PIVOT", (px, py, pz), parent=typebasket_root)
        if PHASE >= 2:
            pivot.rotation_mode = "QUATERNION"
            pivot.rotation_quaternion = hinge_axis.to_track_quat("X", "Z")
        pivot["typebarId"] = key_id
        pivot["restAngleRad"] = 0.0
        pivot["strikeAngleRad"] = strike_angle
        pivot["strikeOrder"] = index
        pivots[key_id] = pivot
        material_name = highlight.get(key_id, "MAT_BLOCKOUT_STEEL")
        if PHASE >= 3 and index % 7 in {0, 1}:
            material_name = "MAT_STEEL_OXIDIZED"
        add_rod(
            f"TYPEBAR_{key_id}_ARM",
            (px, py, pz),
            (hx, hy, hz),
            0.0017,
            material_name,
            parent=pivot,
            vertices=8,
        )
        head = add_cube(
            f"TYPEBAR_{key_id}_HEAD",
            (0.0085, 0.005, 0.012),
            (hx, hy, hz),
            material_name,
            bevel=0.0012,
            parent=pivot,
        )
        head["typebarId"] = key_id
    return pivots


def build_ribbon(root: bpy.types.Object) -> None:
    ribbon_root = add_empty("RIBBON_ROOT", parent=root)
    for side, x in (("LEFT", -0.146), ("RIGHT", 0.146)):
        pivot = add_empty(f"RIBBON_{side}_SPOOL_PIVOT", (x, 0.112, 0.226), parent=ribbon_root)
        add_cylinder(
            f"RIBBON_{side}_SPOOL_MESH",
            0.046,
            0.012,
            (x, 0.112, 0.226),
            "MAT_SPOOL_BLACK",
            vertices=36,
            bevel=0.002,
            parent=pivot,
        )
        add_cylinder(
            f"RIBBON_{side}_SPOOL_HUB",
            0.009,
            0.015,
            (x, 0.112, 0.229),
            "MAT_BLOCKOUT_CHROME",
            vertices=20,
            parent=pivot,
        )

    add_cube("RIBBON_LEFT_SEGMENT", (0.142, 0.004, 0.018), (-0.071, 0.144, 0.226), "MAT_BLOCKOUT_BLACK", parent=ribbon_root)
    strike = add_empty("RIBBON_STRIKE_ZONE_PIVOT", (0.0, 0.146, 0.226), parent=ribbon_root)
    add_cube("RIBBON_STRIKE_ZONE_MESH", (0.046, 0.004, 0.020), (0.0, 0.146, 0.226), "MAT_BLOCKOUT_BLACK", parent=strike)
    add_cube("RIBBON_RIGHT_SEGMENT", (0.142, 0.004, 0.018), (0.071, 0.144, 0.226), "MAT_BLOCKOUT_BLACK", parent=ribbon_root)
    if PHASE >= 3:
        add_cube(
            "RIBBON_LEFT_RED_STRIPE",
            (0.142, 0.0046, 0.006),
            (-0.071, 0.1437, 0.231),
            "MAT_RIBBON_RED",
            parent=ribbon_root,
        )
        add_cube(
            "RIBBON_STRIKE_RED_STRIPE",
            (0.046, 0.0046, 0.006),
            (0.0, 0.1457, 0.231),
            "MAT_RIBBON_RED",
            parent=strike,
        )
        add_cube(
            "RIBBON_RIGHT_RED_STRIPE",
            (0.142, 0.0046, 0.006),
            (0.071, 0.1437, 0.231),
            "MAT_RIBBON_RED",
            parent=ribbon_root,
        )
    add_cube("RIBBON_GUIDE_LEFT", (0.007, 0.010, 0.035), (-0.025, 0.145, 0.225), "MAT_BLOCKOUT_CHROME", bevel=0.001, parent=ribbon_root)
    add_cube("RIBBON_GUIDE_RIGHT", (0.007, 0.010, 0.035), (0.025, 0.145, 0.225), "MAT_BLOCKOUT_CHROME", bevel=0.001, parent=ribbon_root)


def build_carriage(root: bpy.types.Object) -> None:
    add_cylinder("CARRIAGE_RAIL_FRONT", 0.006, 0.430, (0.0, 0.139, 0.215), "MAT_BLOCKOUT_CHROME", rotation=(0.0, math.pi / 2, 0.0), vertices=20, parent=root)
    add_cylinder("CARRIAGE_RAIL_REAR", 0.005, 0.430, (0.0, 0.179, 0.220), "MAT_BLOCKOUT_CHROME", rotation=(0.0, math.pi / 2, 0.0), vertices=20, parent=root)

    carriage = add_empty("CARRIAGE_ROOT", (0.0, 0.0, 0.0), parent=root)
    carriage["travelMinMeters"] = -0.084
    carriage["travelMaxMeters"] = 0.084
    add_cube("CARRIAGE_FRAME", (0.438, 0.032, 0.024), (0.0, 0.166, 0.225), "MAT_BLOCKOUT_CHROME", bevel=0.005, parent=carriage)
    if PHASE >= 2:
        for side, x in (("LEFT", -0.212), ("RIGHT", 0.212)):
            add_cube(
                f"CARRIAGE_END_{side}",
                (0.022, 0.038, 0.046),
                (x, 0.166, 0.266),
                "MAT_BLOCKOUT_STEEL",
                bevel=0.003,
                parent=carriage,
            )
            add_beam(
                f"CARRIAGE_END_{side}_FRONT_STRUT",
                (x, 0.145, 0.217),
                (x, 0.151, 0.292),
                0.010,
                0.010,
                "MAT_BLOCKOUT_CHROME",
                bevel=0.001,
                parent=carriage,
            )
            add_beam(
                f"CARRIAGE_END_{side}_REAR_STRUT",
                (x, 0.186, 0.217),
                (x, 0.181, 0.292),
                0.009,
                0.009,
                "MAT_BLOCKOUT_CHROME",
                bevel=0.001,
                parent=carriage,
            )
            add_cylinder(
                f"CARRIAGE_END_{side}_BEARING",
                0.019,
                0.014,
                (x, 0.172, 0.270),
                "MAT_BLOCKOUT_CHROME",
                rotation=(0.0, math.pi / 2, 0.0),
                vertices=24,
                bevel=0.001,
                parent=carriage,
            )
            add_cylinder(
                f"CARRIAGE_END_{side}_CAP",
                0.010,
                0.017,
                (x, 0.172, 0.270),
                "MAT_BLOCKOUT_BRASS",
                rotation=(0.0, math.pi / 2, 0.0),
                vertices=20,
                parent=carriage,
            )
    else:
        add_cube("CARRIAGE_END_LEFT", (0.033, 0.075, 0.105), (-0.212, 0.166, 0.247), "MAT_BLOCKOUT_STEEL", bevel=0.006, parent=carriage)
        add_cube("CARRIAGE_END_RIGHT", (0.033, 0.075, 0.105), (0.212, 0.166, 0.247), "MAT_BLOCKOUT_STEEL", bevel=0.006, parent=carriage)
    add_cube("CARRIAGE_RACK", (0.388, 0.010, 0.010), (0.0, 0.151, 0.205), "MAT_BLOCKOUT_STEEL", parent=carriage)

    platen = add_empty("PLATEN_PIVOT", (0.0, 0.172, 0.270), parent=carriage)
    platen["axis"] = "LOCAL_X"
    add_cylinder("PLATEN_MESH", 0.026, 0.405, (0.0, 0.172, 0.270), "MAT_RUBBER_BLACK" if PHASE >= 3 else "MAT_BLOCKOUT_BLACK", rotation=(0.0, math.pi / 2, 0.0), vertices=40, bevel=0.001, parent=platen)
    add_cylinder("PLATEN_KNOB_LEFT", 0.016, 0.022, (-0.222, 0.172, 0.270), "MAT_RUBBER_BLACK" if PHASE >= 3 else "MAT_BLOCKOUT_BLACK", rotation=(0.0, math.pi / 2, 0.0), vertices=24, bevel=0.002, parent=platen)
    add_cylinder("PLATEN_KNOB_RIGHT", 0.016, 0.022, (0.222, 0.172, 0.270), "MAT_RUBBER_BLACK" if PHASE >= 3 else "MAT_BLOCKOUT_BLACK", rotation=(0.0, math.pi / 2, 0.0), vertices=24, bevel=0.002, parent=platen)

    paper_root = add_empty("PAPER_ROOT", (0.0, 0.0, 0.0), parent=platen)
    if PHASE >= 4:
        add_flexible_paper(
            "PAPER_MESH",
            width=0.340,
            height=0.180,
            location=(0.0, 0.190, 0.352),
            material_name="MAT_BLOCKOUT_PAPER",
            parent=paper_root,
        )
    else:
        add_cube("PAPER_MESH", (0.340, 0.003, 0.180), (0.0, 0.188, 0.352), "MAT_BLOCKOUT_PAPER", bevel=0.002, parent=paper_root)
    add_cube("PAPER_GUIDE_REAR", (0.365, 0.010, 0.085), (0.0, 0.199, 0.302), "MAT_BLOCKOUT_STEEL", bevel=0.004, parent=carriage)

    bail = add_empty("PAPER_BAIL_PIVOT", (0.0, 0.140, 0.292), parent=carriage)
    add_cylinder("PAPER_BAIL_BAR", 0.003, 0.374, (0.0, 0.140, 0.292), "MAT_BLOCKOUT_CHROME", rotation=(0.0, math.pi / 2, 0.0), vertices=16, parent=bail)
    for index, x in enumerate((-0.115, 0.115), start=1):
        add_cylinder(
            f"PAPER_BAIL_ROLLER_{index:02d}",
            0.007,
            0.014,
            (x, 0.140, 0.292),
            "MAT_BLOCKOUT_BLACK",
            rotation=(0.0, math.pi / 2, 0.0),
            vertices=16,
            parent=bail,
        )

    return_pivot = add_empty("RETURN_LEVER_PIVOT", (-0.220, 0.164, 0.286), parent=carriage)
    return_pivot["axis"] = "LOCAL_Y"
    add_arc_tube(
        "RETURN_LEVER_MESH",
        [
            (-0.220, 0.164, 0.286),
            (-0.264, 0.145, 0.315),
            (-0.317, 0.080, 0.332),
            (-0.352, -0.008, 0.330),
        ],
        0.006,
        "MAT_BLOCKOUT_CHROME",
        parent=return_pivot,
    )
    add_uv_sphere("RETURN_LEVER_GRIP", 0.009, (-0.352, -0.008, 0.330), "MAT_BLOCKOUT_CHROME", parent=return_pivot)
    add_cylinder("LINE_FEED_RATCHET_PIVOT", 0.021, 0.012, (-0.202, 0.171, 0.270), "MAT_BLOCKOUT_CHROME", rotation=(0.0, math.pi / 2, 0.0), vertices=20, parent=carriage)
    add_cube("MARGIN_STOP_LEFT", (0.012, 0.022, 0.022), (-0.165, 0.181, 0.229), "MAT_BLOCKOUT_CHROME", bevel=0.002, parent=carriage)
    add_cube("MARGIN_STOP_RIGHT", (0.012, 0.022, 0.022), (0.165, 0.181, 0.229), "MAT_BLOCKOUT_CHROME", bevel=0.002, parent=carriage)


def build_bell(root: bpy.types.Object) -> None:
    bell_root = add_empty("BELL_ROOT", parent=root)
    add_cylinder("BELL_BODY", 0.020, 0.015, (0.166, 0.126, 0.165), "MAT_BLOCKOUT_CHROME", vertices=24, bevel=0.002, parent=bell_root)
    hammer = add_empty("BELL_HAMMER_PIVOT", (0.141, 0.125, 0.170), parent=bell_root)
    add_rod("BELL_HAMMER_MESH", (0.141, 0.125, 0.170), (0.158, 0.125, 0.177), 0.002, "MAT_BLOCKOUT_STEEL", parent=hammer, vertices=8)
    add_uv_sphere("BELL_HAMMER_HEAD", 0.004, (0.158, 0.125, 0.177), "MAT_BLOCKOUT_STEEL", parent=hammer)


def build_phase3_details(root: bpy.types.Object) -> None:
    if PHASE < 3:
        return
    detail_root = add_empty("DETAIL_ROOT", parent=root)

    for index, x in enumerate(
        (-0.154, -0.128, -0.102, -0.076, 0.076, 0.102, 0.128, 0.154),
        start=1,
    ):
        add_rod(
            f"INTERNAL_RELAY_LINK_{index:02d}",
            (x, 0.064, 0.094),
            (x * 0.82, 0.122, 0.154 + (index % 2) * 0.008),
            0.0024,
            "MAT_BLOCKOUT_STEEL",
            parent=detail_root,
            vertices=10,
        )
        add_cylinder(
            f"INTERNAL_RELAY_JOINT_{index:02d}",
            0.005,
            0.008,
            (x * 0.82, 0.122, 0.154 + (index % 2) * 0.008),
            "MAT_BLOCKOUT_BRASS",
            rotation=(0.0, math.pi / 2, 0.0),
            vertices=16,
            parent=detail_root,
        )

    for side, x in (("LEFT", -0.146), ("RIGHT", 0.146)):
        add_cylinder(
            f"INTERNAL_DRIVE_GEAR_{side}",
            0.020,
            0.012,
            (x, 0.124, 0.158),
            "MAT_BLOCKOUT_BLACK",
            rotation=(0.0, math.pi / 2, 0.0),
            vertices=28,
            bevel=0.0012,
            parent=detail_root,
        )
        add_cylinder(
            f"INTERNAL_DRIVE_GEAR_HUB_{side}",
            0.008,
            0.016,
            (x, 0.124, 0.158),
            "MAT_BLOCKOUT_BRASS",
            rotation=(0.0, math.pi / 2, 0.0),
            vertices=18,
            parent=detail_root,
        )
        add_rod(
            f"INTERNAL_SPOOL_DRIVE_LINK_{side}",
            (x, 0.124, 0.158),
            (x, 0.112, 0.211),
            0.003,
            "MAT_BLOCKOUT_STEEL",
            parent=detail_root,
            vertices=12,
        )

    add_half_disc(
        "TYPEBASKET_ESCUTCHEON",
        0.045,
        0.004,
        (0.0, 0.115, 0.158),
        "MAT_BLOCKOUT_BRASS",
        parent=detail_root,
    )
    for index, x in enumerate((-0.026, 0.0, 0.026), start=1):
        add_cylinder(
            f"TYPEBASKET_ESCUTCHEON_SCREW_{index:02d}",
            0.0032,
            0.005,
            (x, 0.1125, 0.169),
            "MAT_WORN_EDGE",
            rotation=(math.pi / 2, 0.0, 0.0),
            vertices=16,
            parent=detail_root,
        )

    for side, x in (("LEFT", -0.202), ("RIGHT", 0.202)):
        for index, (y, z) in enumerate(((-0.082, 0.060), (0.060, 0.098), (0.129, 0.118)), start=1):
            add_cylinder(
                f"FRAME_SIDE_SCREW_{side}_{index:02d}",
                0.0052,
                0.006,
                (x, y, z),
                "MAT_WORN_EDGE",
                rotation=(0.0, math.pi / 2, 0.0),
                vertices=20,
                bevel=0.0005,
                parent=detail_root,
            )

    for index, (x, y) in enumerate(
        ((-0.171, -0.132), (0.171, -0.132), (-0.171, 0.055), (0.171, 0.055)),
        start=1,
    ):
        add_cylinder(
            f"KEYBED_SCREW_{index:02d}",
            0.004,
            0.003,
            (x, y, 0.0805),
            "MAT_BLOCKOUT_BRASS",
            vertices=18,
            bevel=0.0005,
            parent=detail_root,
        )

    for side, x in (("LEFT", -0.146), ("RIGHT", 0.146)):
        add_cylinder(
            f"RIBBON_{side}_SPOOL_TOP_PLATE",
            0.033,
            0.002,
            (x, 0.112, 0.233),
            "MAT_SPOOL_BLACK",
            vertices=48,
            bevel=0.0006,
            parent=detail_root,
        )
        for hole_index, angle in enumerate((0.0, math.pi * 0.5, math.pi, math.pi * 1.5), start=1):
            add_cylinder(
                f"RIBBON_{side}_SPOOL_RIVET_{hole_index:02d}",
                0.0022,
                0.0025,
                (
                    x + math.cos(angle) * 0.018,
                    0.112 + math.sin(angle) * 0.018,
                    0.2345,
                ),
                "MAT_BLOCKOUT_BRASS",
                vertices=12,
                parent=detail_root,
            )

    for index, (x, width, z) in enumerate(
        (
            (-0.150, 0.022, 0.0430),
            (-0.096, 0.014, 0.0426),
            (-0.018, 0.026, 0.0428),
            (0.067, 0.012, 0.0427),
            (0.135, 0.020, 0.0431),
        ),
        start=1,
    ):
        add_cube(
            "FRAME_FRONT_WEAR_STRIP" if index == 1 else f"FRAME_FRONT_CHIP_{index:02d}",
            (width, 0.0022, 0.0020),
            (x, -0.1785, z),
            "MAT_CHIPPED_EDGE",
            bevel=0.0005,
            parent=detail_root,
        )

    for side, x in (("LEFT", -0.203), ("RIGHT", 0.203)):
        for index, (y, height) in enumerate(
            ((-0.128, 0.016), (-0.038, 0.010), (0.071, 0.018)),
            start=1,
        ):
            add_cube(
                f"FRAME_SIDE_CHIP_{side}_{index:02d}",
                (0.0022, height, 0.0024),
                (x, y, 0.056 + index * 0.010),
                "MAT_CHIPPED_EDGE",
                bevel=0.0005,
                parent=detail_root,
            )

    add_cube(
        "KEYBED_GRIME_REAR",
        (0.342, 0.004, 0.002),
        (0.0, 0.092, 0.074),
        "MAT_MACHINE_GRIME",
        bevel=0.001,
        parent=detail_root,
    )
    for index, (x, y, radius) in enumerate(
        (
            (-0.145, 0.083, 0.010),
            (-0.102, 0.121, 0.007),
            (0.118, 0.103, 0.009),
            (0.153, 0.137, 0.006),
        ),
        start=1,
    ):
        add_cylinder(
            f"INTERNAL_OIL_STAIN_{index:02d}",
            radius,
            0.0010,
            (x, y, 0.113),
            "MAT_MACHINE_GRIME",
            vertices=24,
            bevel=0.0004,
            parent=detail_root,
        )
    add_cube(
        "CARRIAGE_SCALE_STRIP",
        (0.285, 0.0025, 0.006),
        (0.0, 0.148, 0.212),
        "MAT_BLOCKOUT_BRASS",
        bevel=0.0006,
        parent=detail_root,
    )


def add_audio_nodes(root: bpy.types.Object) -> None:
    audio_root = add_empty("AUDIO_ROOT", parent=root)
    for name, location in (
        ("AUDIO_KEYBED", (0.0, -0.035, 0.090)),
        ("AUDIO_PRINT_POINT", (0.0, 0.160, 0.245)),
        ("AUDIO_CARRIAGE", (0.0, 0.170, 0.240)),
        ("AUDIO_BELL", (0.166, 0.126, 0.165)),
    ):
        add_empty(name, location, parent=audio_root)


def build_model(keyboard: dict) -> bpy.types.Object:
    root = add_empty("TYPEWRITER_ROOT")
    root["assetType"] = "fictional-interactive-typewriter"
    root["phase"] = (
        "phase-4-interaction"
        if PHASE >= 4
        else "phase-3-materials"
        if PHASE >= 3
        else ("phase-2-mechanism" if PHASE >= 2 else "phase-1-blockout")
    )
    root["units"] = "meters"
    build_frame(root)
    build_keyboard(root, keyboard)
    build_typebasket(root, keyboard)
    build_ribbon(root)
    build_carriage(root)
    build_bell(root)
    build_phase3_details(root)
    add_audio_nodes(root)
    return root


def look_at(camera: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_review_scene() -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -0.35 if PHASE >= 3 else 0.0
    if scene.world is None:
        scene.world = bpy.data.worlds.new("REVIEW_WORLD")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (
        (0.12, 0.115, 0.11, 1.0) if PHASE >= 3 else (0.006, 0.006, 0.008, 1.0)
    )
    background.inputs["Strength"].default_value = 0.28 if PHASE >= 3 else 0.16

    add_cube(
        "REVIEW_FLOOR",
        (1.8, 1.8, 0.02),
        (0.0, 0.0, -0.018),
        "MAT_REVIEW_FLOOR",
        bevel=0.01,
        collection=REVIEW_COLLECTION,
    )

    bpy.ops.object.light_add(type="AREA", location=(-0.45, -0.40, 0.72))
    key = bpy.context.active_object
    key.name = "REVIEW_KEY_LIGHT"
    key.data.energy = 125 if PHASE >= 3 else 180
    key.data.shape = "DISK"
    key.data.size = 0.46
    move_to_collection(key, REVIEW_COLLECTION)
    look_at(key, (0.0, 0.02, 0.14))

    bpy.ops.object.light_add(type="AREA", location=(0.48, -0.10, 0.40))
    fill = bpy.context.active_object
    fill.name = "REVIEW_FILL_LIGHT"
    fill.data.energy = 62 if PHASE >= 3 else 75
    fill.data.size = 0.34
    move_to_collection(fill, REVIEW_COLLECTION)
    look_at(fill, (0.0, 0.04, 0.16))

    bpy.ops.object.light_add(type="AREA", location=(0.0, 0.55, 0.55))
    rim = bpy.context.active_object
    rim.name = "REVIEW_RIM_LIGHT"
    rim.data.energy = 105 if PHASE >= 3 else 145
    rim.data.size = 0.30
    move_to_collection(rim, REVIEW_COLLECTION)
    look_at(rim, (0.0, 0.10, 0.20))


def create_camera(
    name: str,
    location: tuple[float, float, float],
    target: tuple[float, float, float],
    *,
    orthographic: bool,
    ortho_scale: float = 0.55,
    lens: float = 55.0,
) -> bpy.types.Object:
    data = bpy.data.cameras.new(f"{name}_DATA")
    camera = bpy.data.objects.new(name, data)
    REVIEW_COLLECTION.objects.link(camera)
    camera.location = location
    if orthographic:
        data.type = "ORTHO"
        data.ortho_scale = ortho_scale
    else:
        data.type = "PERSP"
        data.lens = lens
    look_at(camera, target)
    return camera


def render_reviews() -> list[str]:
    PATHS.renders.mkdir(parents=True, exist_ok=True)
    prefix = f"phase-{PHASE}"
    cameras = [
        (
            f"{prefix}-front",
            (0.0, -1.0, 0.36 if PHASE >= 3 else 0.245),
            (0.0, 0.025, 0.155 if PHASE >= 3 else 0.185),
            True,
            0.55,
            55.0,
        ),
        (f"{prefix}-left", (-1.0, 0.0, 0.235), (0.0, 0.020, 0.180), True, 0.50, 55.0),
        (f"{prefix}-top", (0.0, 0.02, 1.10), (0.0, 0.015, 0.090), True, 0.55, 55.0),
        (f"{prefix}-rear", (0.0, 1.0, 0.245), (0.0, 0.040, 0.185), True, 0.55, 55.0),
        (f"{prefix}-hero", (-0.70, -0.92, 0.58), (0.0, 0.015, 0.175), False, 0.55, 60.0),
        (f"{prefix}-mechanism-clearance", (-0.28, -0.46, 0.30), (0.0, 0.085, 0.175), False, 0.55, 72.0),
    ]
    outputs: list[str] = []
    scene = bpy.context.scene
    for name, location, target, orthographic, ortho_scale, lens in cameras:
        camera = create_camera(
            f"CAM_{name.upper().replace('-', '_')}",
            location,
            target,
            orthographic=orthographic,
            ortho_scale=ortho_scale,
            lens=lens,
        )
        scene.camera = camera
        output = PATHS.renders / f"{name}.png"
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        outputs.append(str(output))
    return outputs


def render_material_grazing_preview() -> list[str]:
    if PHASE < 3:
        return []
    scene = bpy.context.scene
    key = bpy.data.objects["REVIEW_KEY_LIGHT"]
    fill = bpy.data.objects["REVIEW_FILL_LIGHT"]
    rim = bpy.data.objects["REVIEW_RIM_LIGHT"]
    background = scene.world.node_tree.nodes.get("Background")
    saved = {
        "key_location": key.location.copy(),
        "key_rotation": key.rotation_euler.copy(),
        "key_energy": key.data.energy,
        "key_size": key.data.size,
        "fill_energy": fill.data.energy,
        "rim_energy": rim.data.energy,
        "world_strength": background.inputs["Strength"].default_value,
    }
    key.location = (-0.56, -0.34, 0.24)
    key.data.energy = 155
    key.data.size = 0.16
    look_at(key, (0.0, -0.035, 0.105))
    fill.data.energy = 18
    rim.data.energy = 42
    background.inputs["Strength"].default_value = 0.12
    camera = create_camera(
        f"CAM_PHASE_{PHASE}_MATERIAL_GRAZING",
        (-0.42, -0.56, 0.30),
        (0.0, -0.025, 0.125),
        orthographic=False,
        lens=68.0,
    )
    scene.camera = camera
    output = PATHS.renders / f"phase-{PHASE}-material-grazing.png"
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)

    key.location = saved["key_location"]
    key.rotation_euler = saved["key_rotation"]
    key.data.energy = saved["key_energy"]
    key.data.size = saved["key_size"]
    fill.data.energy = saved["fill_energy"]
    rim.data.energy = saved["rim_energy"]
    background.inputs["Strength"].default_value = saved["world_strength"]
    return [str(output)]


def render_strike_previews() -> list[str]:
    if PHASE < 2:
        return []
    scene = bpy.context.scene
    camera = create_camera(
        "CAM_PHASE_2_STRIKE_PREVIEW",
        (-0.28, -0.46, 0.30),
        (0.0, 0.105, 0.195),
        orthographic=False,
        lens=76.0,
    )
    scene.camera = camera
    outputs: list[str] = []
    ribbon = bpy.data.objects["RIBBON_STRIKE_ZONE_PIVOT"]
    ribbon_rest_z = ribbon.location.z
    for key_id in ("A", "M", "Z"):
        key = bpy.data.objects[f"KEY_{key_id}_PIVOT"]
        linkage = bpy.data.objects[f"LINK_{key_id}_PIVOT"]
        typebar = bpy.data.objects[f"TYPEBAR_{key_id}_PIVOT"]
        key_rest_z = key.location.z
        linkage_rest = linkage.rotation_euler.copy()
        typebar_rest = typebar.rotation_quaternion.copy()

        key.location.z = key_rest_z - float(key["pressDepthMeters"])
        linkage.rotation_euler.x = float(linkage["travelAngleRad"])
        typebar.rotation_quaternion = typebar_rest @ Quaternion(
            (1.0, 0.0, 0.0),
            float(typebar["strikeAngleRad"]),
        )
        ribbon.location.z = ribbon_rest_z + 0.012
        bpy.context.view_layer.update()

        output = PATHS.renders / f"phase-{PHASE}-strike-{key_id.lower()}.png"
        scene.render.filepath = str(output)
        bpy.ops.render.render(write_still=True)
        outputs.append(str(output))

        key.location.z = key_rest_z
        linkage.rotation_euler = linkage_rest
        typebar.rotation_quaternion = typebar_rest
        ribbon.location.z = ribbon_rest_z
        bpy.context.view_layer.update()
    return outputs


def triangle_count() -> int:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    total = 0
    for obj in MODEL_COLLECTION.objects:
        if obj.type != "MESH":
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        total += len(mesh.loop_triangles)
        evaluated.to_mesh_clear()
    return total


def validate_model(keyboard: dict) -> list[str]:
    errors: list[str] = []
    names = [obj.name for obj in MODEL_COLLECTION.objects]
    if len(names) != len(set(names)):
        errors.append("Duplicate object names exist")
    keys = keyboard["keys"]
    printable = [key for key in keys if key["kind"] == "print"]
    for key in keys:
        for expected in (
            f"KEY_{key['id']}_PIVOT",
            f"KEY_{key['id']}_MESH",
            f"HIT_KEY_{key['id']}",
            f"LINK_{key['id']}_PIVOT",
        ):
            if expected not in bpy.data.objects:
                errors.append(f"Missing object {expected}")
        key_pivot = bpy.data.objects.get(f"KEY_{key['id']}_PIVOT")
        if key_pivot and key_pivot.matrix_world.translation.length < 0.04:
            errors.append(f"Key pivot collapsed to origin: {key['id']}")
    for key in printable:
        for expected in (f"TYPEBAR_{key['id']}_PIVOT", f"TYPEBAR_{key['id']}_HEAD"):
            if expected not in bpy.data.objects:
                errors.append(f"Missing object {expected}")
        typebar_pivot = bpy.data.objects.get(f"TYPEBAR_{key['id']}_PIVOT")
        if typebar_pivot and typebar_pivot.matrix_world.translation.length < 0.04:
            errors.append(f"Typebar pivot collapsed to origin: {key['id']}")
    for expected in (
        "TYPEWRITER_ROOT",
        "FRAME_ROOT",
        "CARRIAGE_ROOT",
        "PLATEN_PIVOT",
        "PAPER_MESH",
        "RETURN_LEVER_PIVOT",
        "RIBBON_STRIKE_ZONE_PIVOT",
        "BELL_HAMMER_PIVOT",
    ):
        if expected not in bpy.data.objects:
            errors.append(f"Missing required object {expected}")
    if PHASE >= 3:
        glass_count = len(
            [
                obj
                for obj in MODEL_COLLECTION.objects
                if obj.name.startswith("KEY_") and obj.name.endswith("_GLASS")
            ]
        )
        if glass_count != 51:
            errors.append(f"Expected 51 glass key lenses, found {glass_count}")
        for expected_material in (
            "MAT_BLOCKOUT_BURGUNDY",
            "MAT_BLOCKOUT_IVORY",
            "MAT_BLOCKOUT_CHROME",
            "MAT_BLOCKOUT_BRASS",
            "MAT_BLOCKOUT_BLACK",
            "MAT_BLOCKOUT_PAPER",
            "MAT_KEYBED",
            "MAT_KEY_GLASS",
            "MAT_RIBBON_RED",
        ):
            if expected_material not in MATERIALS:
                errors.append(f"Missing Phase 3 material {expected_material}")
        front_rail = bpy.data.objects.get("FRAME_FRONT_CHROME_RAIL")
        top_row_keys = [
            bpy.data.objects.get(f"KEY_{key['id']}_MESH")
            for key in keys
            if key["row"] == "R0"
        ]
        if front_rail and all(top_row_keys):
            rail_min_y = min(
                (front_rail.matrix_world @ Vector(corner)).y
                for corner in front_rail.bound_box
            )
            keys_max_y = max(
                (key_obj.matrix_world @ Vector(corner)).y
                for key_obj in top_row_keys
                for corner in key_obj.bound_box
            )
            rail_key_clearance = rail_min_y - keys_max_y
            front_rail["topRowClearanceMeters"] = rail_key_clearance
            if rail_key_clearance < 0.006:
                errors.append(
                    "Front chrome rail overlaps top key row: "
                    f"{rail_key_clearance:.6f} m clearance"
                )
        frame_root = bpy.data.objects.get("FRAME_ROOT")
        cutout_gaps = [
            float(bpy.data.objects[f"FRAME_REAR_CHEEK_CUTOUT_{side}"].get("surfaceGapMeters", 0.0))
            for side in ("LEFT", "RIGHT")
        ]
        minimum_cutout_gap = min(cutout_gaps)
        if frame_root:
            frame_root["sideCutoutSurfaceGapMeters"] = minimum_cutout_gap
        if minimum_cutout_gap < 0.0015:
            errors.append(
                "Side cheek inset risks z-fighting: "
                f"{minimum_cutout_gap:.6f} m surface gap"
            )
        feet = [
            bpy.data.objects[f"FOOT_{position}_{side}"]
            for position in ("FRONT", "REAR")
            for side in ("LEFT", "RIGHT")
        ]
        foot_bottoms = [
            min((foot.matrix_world @ Vector(corner)).z for corner in foot.bound_box)
            for foot in feet
        ]
        foot_bottom_spread = max(foot_bottoms) - min(foot_bottoms)
        foot_lowest_z = min(foot_bottoms)
        if frame_root:
            frame_root["footBottomSpreadMeters"] = foot_bottom_spread
            frame_root["footLowestZMeters"] = foot_lowest_z
        if foot_bottom_spread > 0.0005:
            errors.append(f"Feet are not coplanar: {foot_bottom_spread:.6f} m spread")
        if abs(foot_lowest_z) > 0.0005:
            errors.append(f"Feet do not meet ground plane: lowest Z is {foot_lowest_z:.6f} m")
    if PHASE >= 4:
        paper = bpy.data.objects.get("PAPER_MESH")
        if not paper or paper.type != "MESH":
            errors.append("Phase 4 paper must be a mesh")
        else:
            if len(paper.data.vertices) < 1000:
                errors.append(
                    f"Flexible paper needs at least 1000 vertices, found {len(paper.data.vertices)}"
                )
            if not paper.data.uv_layers:
                errors.append("Flexible paper is missing UV coordinates")
            if not bool(paper.get("flexible", False)):
                errors.append("Flexible paper metadata is missing")
    for obj in MODEL_COLLECTION.objects:
        if any(component < 0 for component in obj.scale):
            errors.append(f"Negative scale on {obj.name}")
        if any(not math.isfinite(value) for value in (*obj.location, *obj.rotation_euler, *obj.scale)):
            errors.append(f"Non-finite transform on {obj.name}")
    return errors


def measure_strike_clearances() -> dict[str, float]:
    if PHASE < 2:
        return {}
    print_point = bpy.data.objects["PRINT_POINT"].matrix_world.translation.copy()
    clearances: dict[str, float] = {}
    for key_id in ("A", "M", "Z"):
        pivot = bpy.data.objects[f"TYPEBAR_{key_id}_PIVOT"]
        head = bpy.data.objects[f"TYPEBAR_{key_id}_HEAD"]
        rest_quaternion = pivot.rotation_quaternion.copy()
        pivot.rotation_quaternion = rest_quaternion @ Quaternion(
            (1.0, 0.0, 0.0),
            float(pivot["strikeAngleRad"]),
        )
        bpy.context.view_layer.update()
        clearances[key_id] = round((head.matrix_world.translation - print_point).length, 8)
        pivot.rotation_quaternion = rest_quaternion
        bpy.context.view_layer.update()
    return clearances


def export_model() -> None:
    for obj in bpy.context.selected_objects:
        obj.select_set(False)
    for obj in MODEL_COLLECTION.objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(PATHS.glb),
        export_format="GLB",
        use_selection=True,
        export_extras=True,
        export_cameras=False,
        export_lights=False,
    )


def write_node_manifest() -> None:
    manifest = PATHS.renders.parent / "node-manifest.txt"
    manifest.write_text(
        "\n".join(sorted(obj.name for obj in MODEL_COLLECTION.objects)) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    PATHS.blend.parent.mkdir(parents=True, exist_ok=True)
    PATHS.glb.parent.mkdir(parents=True, exist_ok=True)
    PATHS.report.parent.mkdir(parents=True, exist_ok=True)
    keyboard = json.loads(PATHS.keyboard.read_text(encoding="utf-8"))
    reset_scene()
    create_materials()
    build_model(keyboard)
    setup_review_scene()
    errors = validate_model(keyboard)
    front_rail_key_clearance = float(
        bpy.data.objects["FRAME_FRONT_CHROME_RAIL"].get("topRowClearanceMeters", 0.0)
    )
    frame_root = bpy.data.objects["FRAME_ROOT"]
    strike_clearances = measure_strike_clearances()
    if PHASE >= 2:
        for key_id, clearance in strike_clearances.items():
            if clearance > 0.002:
                errors.append(f"{key_id} misses print point by {clearance} m")
    triangles = triangle_count()
    triangle_budget = 150_000 if PHASE >= 3 else (100_000 if PHASE >= 2 else 60_000)
    if triangles >= triangle_budget:
        errors.append(f"Triangle budget exceeded: {triangles}")
    bpy.ops.wm.save_as_mainfile(filepath=str(PATHS.blend))
    export_model()
    renders = render_reviews()
    renders.extend(render_material_grazing_preview())
    renders.extend(render_strike_previews())
    write_node_manifest()
    report = {
        "status": "passed" if not errors else "failed",
        "phase": (
            "phase-4-interaction"
            if PHASE >= 4
            else "phase-3-materials"
            if PHASE >= 3
            else ("phase-2-mechanism" if PHASE >= 2 else "phase-1-blockout")
        ),
        "keyboardSpec": str(PATHS.keyboard),
        "blend": str(PATHS.blend),
        "glb": str(PATHS.glb),
        "renders": renders,
        "objectCount": len(MODEL_COLLECTION.objects),
        "triangleCount": triangles,
        "keyPivotCount": len([obj for obj in MODEL_COLLECTION.objects if obj.name.startswith("KEY_") and obj.name.endswith("_PIVOT")]),
        "hitProxyCount": len([obj for obj in MODEL_COLLECTION.objects if obj.name.startswith("HIT_KEY_")]),
        "typebarPivotCount": len([obj for obj in MODEL_COLLECTION.objects if obj.name.startswith("TYPEBAR_") and obj.name.endswith("_PIVOT")]),
        "strikeClearanceMeters": strike_clearances,
        "frontRailTopRowClearanceMeters": front_rail_key_clearance,
        "sideCutoutSurfaceGapMeters": float(frame_root.get("sideCutoutSurfaceGapMeters", 0.0)),
        "footBottomSpreadMeters": float(frame_root.get("footBottomSpreadMeters", 0.0)),
        "footLowestZMeters": float(frame_root.get("footLowestZMeters", 0.0)),
        "paperVertexCount": len(bpy.data.objects["PAPER_MESH"].data.vertices),
        "paperHasUV": bool(bpy.data.objects["PAPER_MESH"].data.uv_layers),
        "paperFlexible": bool(bpy.data.objects["PAPER_MESH"].get("flexible", False)),
        "validationErrors": errors,
    }
    PATHS.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if errors:
        raise SystemExit("BLOCKOUT_VALIDATION_FAILED " + "; ".join(errors))
    print(
        "BLENDER_BLOCKOUT_OK "
        f"{PATHS.blend} {PATHS.glb} "
        f"{report['objectCount']} objects {triangles} triangles"
    )


main()
