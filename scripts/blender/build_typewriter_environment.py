import bpy
import json
import math
import random
import sys
from pathlib import Path
from mathutils import Vector


args = sys.argv[sys.argv.index("--") + 1 :]
if len(args) != 4:
    raise SystemExit(
        "Usage: build_typewriter_environment.py <blend> <glb> <renders-dir> <report.json>"
    )

BLEND_PATH, GLB_PATH, RENDERS_DIR, REPORT_PATH = map(Path, args)
TEXTURE_DIR = GLB_PATH.parents[2] / "assets" / "textures" / "environment"
COLLECTION = None
MATERIALS = {}


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)
    global COLLECTION
    COLLECTION = bpy.data.collections.new("PHASE_6_ENVIRONMENT_REDRAFT")
    bpy.context.scene.collection.children.link(COLLECTION)


def create_texture(name, color_fn, size=512, non_color=False):
    TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    path = TEXTURE_DIR / f"{name}.png"
    image = bpy.data.images.new(name, width=size, height=size, alpha=True)
    pixels = []
    for y in range(size):
        for x in range(size):
            r, g, b, a = color_fn(x / size, y / size)
            pixels.extend((r, g, b, a))
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    image.colorspace_settings.name = "Non-Color" if non_color else "sRGB"
    return image


def texture_hash(u, v, scale=257):
    x = int(u * scale)
    y = int(v * scale)
    return ((x * 73856093) ^ (y * 19349663)) % 1009 / 1009


def wood_atlas_region(u, v):
    if v >= 0.52:
        plank = min(3, int(u * 4))
        return "top", (u * 4) % 1.0, (v - 0.52) / 0.48, plank
    if v >= 0.28:
        side = 0 if u < 0.5 else 1
        return "drawer", (u % 0.5) * 2.0, (v - 0.28) / 0.24, side
    if u < 0.5:
        return "rail", u * 2.0, v / 0.28, 0
    leg = min(3, int((u - 0.5) * 8))
    return "leg", ((u - 0.5) * 8) % 1.0, v / 0.28, leg


def wood_height(u, v):
    kind, local_u, local_v, seed = wood_atlas_region(u, v)
    grain_u, grain_v = (local_v, local_u) if kind == "leg" else (local_u, local_v)
    drift = math.sin(grain_u * math.tau * 1.7 + seed * 1.7) * 0.060
    drift += math.sin(grain_u * math.tau * 4.1 - seed * 0.8) * 0.018
    ring_phase = (grain_v + drift) * math.tau * (7.0 + seed * 0.45)
    ring_phase += math.sin(grain_u * math.tau * 2.3 + seed) * 0.85
    ring = math.sin(ring_phase)
    broad = math.sin(ring_phase * 0.48 + seed * 0.7) * 0.11
    vein = math.exp(-abs(ring) * 13.0)
    fine = math.sin((grain_v + drift * 0.38) * math.tau * (25.0 + seed * 2)) * 0.025
    knot_center_u = (0.22 + seed * 0.17) % 0.78
    knot_center_v = 0.58 - seed * 0.055
    knot_x = (grain_u - knot_center_u) / 0.13
    knot_y = (grain_v - knot_center_v) / 0.20
    knot_radius = math.sqrt(knot_x * knot_x + knot_y * knot_y)
    knot = math.sin(knot_radius * 14.0 + grain_u * 2.0) * max(0.0, 1.0 - knot_radius)
    pore = -0.55 if texture_hash(local_u + seed, local_v, 389) > 0.982 else 0.0
    return broad - vein * 0.34 + fine + knot * 0.42 + pore


def wood_ao_value(u, v):
    kind, local_u, local_v, _ = wood_atlas_region(u, v)
    height = wood_height(u, v)
    pore = 0.20 if texture_hash(u, v, 389) > 0.982 else 0.0
    grain_axis = local_u if kind == "leg" else local_v
    cross_axis = local_v if kind == "leg" else local_u
    crack = 0.16 if abs(math.sin((grain_axis + math.sin(cross_axis * 9.0) * 0.045) * math.tau * 11.0)) > 0.992 else 0.0
    edge = min(local_u, local_v, 1.0 - local_u, 1.0 - local_v)
    seam = max(0.0, 1.0 - edge / 0.055) * (0.15 if kind != "top" else 0.08)
    return max(0.52, min(1.0, 0.91 + height * 0.055 - pore - crack - seam))


def wood_color(u, v):
    kind, local_u, local_v, seed = wood_atlas_region(u, v)
    height = wood_height(u, v)
    ao = wood_ao_value(u, v)
    hand_wear = 0.0
    stain = 0.0
    if kind == "top":
        hand_wear = math.exp(-(((local_u - 0.52) / 0.30) ** 2 + ((local_v - 0.44) / 0.28) ** 2))
        if seed == 2:
            radius = math.sqrt((local_u - 0.66) ** 2 + ((local_v - 0.62) * 1.35) ** 2)
            stain += math.exp(-((radius - 0.12) / 0.018) ** 2) * 0.34
        stain += math.exp(-(((local_u - 0.20) / 0.035) ** 2 + ((local_v - 0.72) / 0.22) ** 2)) * 0.16
    elif kind == "drawer":
        radius = math.sqrt((local_u - 0.50) ** 2 + ((local_v - 0.50) * 1.5) ** 2)
        hand_wear = math.exp(-(radius / 0.23) ** 2) * 0.9
        stain += max(0.0, 1.0 - min(local_u, 1.0 - local_u) / 0.08) * 0.10
    elif kind == "leg":
        stain += max(0.0, 1.0 - local_v / 0.24) * 0.28
    base = {"top": 0.050, "drawer": 0.043, "rail": 0.036, "leg": 0.033}[kind]
    value = base + height * 0.016 + hand_wear * 0.010
    value *= 1.0 - stain
    warm_shift = 1.0 + math.sin((local_u * 3.1 + local_v * 1.3 + seed) * math.tau) * 0.055
    return (
        max(0.012, value * 1.20 * warm_shift * ao),
        max(0.007, value * 0.61 * ao),
        max(0.004, value * 0.27 / warm_shift * ao),
        1.0,
    )


def wood_roughness(u, v):
    kind, local_u, local_v, seed = wood_atlas_region(u, v)
    grain = wood_height(u, v)
    if kind == "top":
        hand_wear = math.exp(-(((local_u - 0.52) / 0.30) ** 2 + ((local_v - 0.44) / 0.28) ** 2))
    elif kind == "drawer":
        hand_wear = math.exp(-(((local_u - 0.50) / 0.24) ** 2 + ((local_v - 0.50) / 0.28) ** 2))
    else:
        hand_wear = 0.0
    value = min(0.98, max(0.72, 0.91 + grain * 0.06 - hand_wear * 0.085))
    return (value, value, value, 1.0)


def wood_normal(u, v):
    epsilon = 1 / 768
    dx = wood_height((u + epsilon) % 1, v) - wood_height((u - epsilon) % 1, v)
    dy = wood_height(u, (v + epsilon) % 1) - wood_height(u, (v - epsilon) % 1)
    nx, ny, nz = -dx * 1.55, -dy * 1.55, 1.0
    length = math.sqrt(nx * nx + ny * ny + nz * nz)
    return (nx / length * 0.5 + 0.5, ny / length * 0.5 + 0.5, nz / length * 0.5 + 0.5, 1.0)


def wood_ao(u, v):
    value = wood_ao_value(u, v)
    return (value, value, value, 1.0)


def metal_color(u, v):
    speck = texture_hash(u, v, 503)
    cloud = (math.sin(u * 31.0) + math.sin(v * 27.0) + math.sin((u + v) * 19.0)) / 6 + 0.5
    patina = 0.32 if speck < 0.075 else 0.68 + cloud * 0.32
    scratch = 1.18 if abs(math.sin(v * 181.0 + u * 9.0)) > 0.988 else 1.0
    return (0.26 * patina * scratch, 0.15 * patina * scratch, 0.055 * patina, 1.0)


def metal_roughness(u, v):
    cloud = (math.sin(u * 31.0) + math.sin(v * 27.0) + math.sin((u + v) * 19.0)) / 6 + 0.5
    scratch = 0.18 if abs(math.sin(v * 181.0 + u * 9.0)) > 0.988 else 0.0
    value = max(0.46, min(0.92, 0.72 + (0.5 - cloud) * 0.25 - scratch))
    return (value, value, value, 1.0)


def metal_normal(u, v):
    scratch = math.sin(v * 181.0 + u * 9.0)
    nx = math.cos(v * 181.0 + u * 9.0) * 0.08
    ny = math.cos(v * 181.0 + u * 9.0) * 0.22
    pit = -0.28 if texture_hash(u, v, 503) < 0.075 else 0.0
    nz = 1.0 + pit + abs(scratch) * 0.02
    length = math.sqrt(nx * nx + ny * ny + nz * nz)
    return (nx / length * 0.5 + 0.5, ny / length * 0.5 + 0.5, nz / length * 0.5 + 0.5, 1.0)


def material(
    name,
    color,
    roughness=0.55,
    metallic=0.0,
    alpha=1.0,
    emission=None,
    texture=None,
    roughness_texture=None,
    normal_texture=None,
    normal_strength=0.45,
):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, alpha)
    mat.use_nodes = True
    mat.surface_render_method = "DITHERED"
    principled = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    principled.inputs["Base Color"].default_value = (*color, 1)
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Alpha"].default_value = alpha
    if texture:
        image = bpy.data.images[texture]
        node = mat.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = image
        node.interpolation = "Linear"
        mat.node_tree.links.new(node.outputs["Color"], principled.inputs["Base Color"])
    if roughness_texture:
        node = mat.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = bpy.data.images[roughness_texture]
        node.image.colorspace_settings.name = "Non-Color"
        mat.node_tree.links.new(node.outputs["Color"], principled.inputs["Roughness"])
    if normal_texture:
        node = mat.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = bpy.data.images[normal_texture]
        node.image.colorspace_settings.name = "Non-Color"
        normal = mat.node_tree.nodes.new("ShaderNodeNormalMap")
        normal.inputs["Strength"].default_value = normal_strength
        mat.node_tree.links.new(node.outputs["Color"], normal.inputs["Color"])
        mat.node_tree.links.new(normal.outputs["Normal"], principled.inputs["Normal"])
    if emission:
        principled.inputs["Emission Color"].default_value = (*emission, 1)
        principled.inputs["Emission Strength"].default_value = 2.1
    if alpha < 1:
        mat.use_transparency_overlap = False
    MATERIALS[name] = mat
    return mat


def create_materials():
    create_texture("aged-wood-color", wood_color, 768)
    create_texture("aged-wood-roughness", wood_roughness, 768, non_color=True)
    create_texture("aged-wood-normal", wood_normal, 768, non_color=True)
    create_texture("aged-wood-ao", wood_ao, 768, non_color=True)
    create_texture("aged-brass-color", metal_color)
    create_texture("aged-brass-roughness", metal_roughness, non_color=True)
    create_texture("aged-brass-normal", metal_normal, non_color=True)
    material(
        "MAT_DRY_OLD_WOOD",
        (0.19, 0.105, 0.058),
        0.87,
        texture="aged-wood-color",
        roughness_texture="aged-wood-roughness",
        normal_texture="aged-wood-normal",
        normal_strength=0.38,
    )
    material("MAT_DARK_END_GRAIN", (0.085, 0.041, 0.021), 0.92)
    material(
        "MAT_DRAWER_INTERIOR",
        (0.115, 0.063, 0.035),
        0.91,
        texture="aged-wood-color",
        roughness_texture="aged-wood-roughness",
        normal_texture="aged-wood-normal",
        normal_strength=0.34,
    )
    material(
        "MAT_AGED_BRASS",
        (0.24, 0.15, 0.065),
        0.72,
        0.58,
        texture="aged-brass-color",
        roughness_texture="aged-brass-roughness",
        normal_texture="aged-brass-normal",
        normal_strength=0.52,
    )
    material("MAT_BLACKENED_BRASS", (0.052, 0.044, 0.032), 0.79, 0.48)
    material("MAT_LAMP_SOOT", (0.008, 0.006, 0.004), 0.94, 0.08)
    material("MAT_LAMP_GLASS", (0.50, 0.43, 0.30), 0.24, 0.0, 0.28)
    material("MAT_FLAME", (1.0, 0.24, 0.025), 0.45, 0.0, 0.82, (1.0, 0.10, 0.006))
    material("MAT_HIT_PROXY", (0.0, 0.0, 0.0), 1.0, 0.0, 0.0)


def link_object(obj):
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    COLLECTION.objects.link(obj)
    return obj


def parent_keep_world(obj, parent):
    bpy.context.view_layer.update()
    matrix = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = matrix


def empty(name, location=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.045
    obj.location = location
    COLLECTION.objects.link(obj)
    if parent:
        parent_keep_world(obj, parent)
    return obj


def apply_bevel(obj, amount=0.008, segments=2):
    modifier = obj.modifiers.new("Worn softened edges", "BEVEL")
    modifier.width = amount
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)


def box(name, location, scale, mat, bevel=0.005, parent=None, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = link_object(bpy.context.object)
    obj.name = name
    obj.scale = (scale[0] / 2, scale[1] / 2, scale[2] / 2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        apply_bevel(obj, bevel)
    obj.data.materials.append(MATERIALS[mat])
    if parent:
        parent_keep_world(obj, parent)
    return obj


def assign_uv_region(obj, region, rotate=False):
    if obj.type != "MESH":
        return
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.cube_project(cube_size=1.0, correct_aspect=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    uv_layer = obj.data.uv_layers.active
    if not uv_layer:
        obj.select_set(False)
        return
    coordinates = [loop.uv.copy() for loop in uv_layer.data]
    minimum_u = min(uv.x for uv in coordinates)
    maximum_u = max(uv.x for uv in coordinates)
    minimum_v = min(uv.y for uv in coordinates)
    maximum_v = max(uv.y for uv in coordinates)
    width = max(1e-6, maximum_u - minimum_u)
    height = max(1e-6, maximum_v - minimum_v)
    u0, v0, u1, v1 = region
    padding_u = (u1 - u0) * 0.018
    padding_v = (v1 - v0) * 0.018
    for loop in uv_layer.data:
        local_u = (loop.uv.x - minimum_u) / width
        local_v = (loop.uv.y - minimum_v) / height
        if rotate:
            local_u, local_v = local_v, local_u
        loop.uv.x = u0 + padding_u + local_u * (u1 - u0 - padding_u * 2)
        loop.uv.y = v0 + padding_v + local_v * (v1 - v0 - padding_v * 2)
    obj["uvAtlasRegion"] = [round(value, 4) for value in region]
    obj["uvAtlasRotated"] = rotate
    obj.select_set(False)


def assign_desk_atlas_uvs():
    for obj in COLLECTION.objects:
        if obj.type != "MESH" or not obj.data.materials:
            continue
        material_name = obj.data.materials[0].name
        if material_name not in {"MAT_DRY_OLD_WOOD", "MAT_DRAWER_INTERIOR"}:
            continue
        name = obj.name
        if name.startswith("DESK_TOP_PLANK_"):
            plank = max(0, min(3, int(name.rsplit("_", 1)[-1]) - 1))
            assign_uv_region(obj, (plank * 0.25, 0.52, (plank + 1) * 0.25, 1.0))
        elif name.startswith("DESK_TOP_EDGE_"):
            assign_uv_region(obj, (0.0, 0.52, 1.0, 1.0))
        elif name.startswith("DRAWER_LEFT_"):
            assign_uv_region(obj, (0.0, 0.28, 0.5, 0.52))
        elif name.startswith("DRAWER_RIGHT_"):
            assign_uv_region(obj, (0.5, 0.28, 1.0, 0.52))
        elif "_LEG_" in name:
            leg = sum(ord(character) for character in name) % 4
            assign_uv_region(
                obj,
                (0.5 + leg * 0.125, 0.0, 0.5 + (leg + 1) * 0.125, 0.28),
                rotate=True,
            )
        else:
            assign_uv_region(obj, (0.0, 0.0, 0.5, 0.28))


def cylinder(name, location, radius, depth, mat, vertices=32, parent=None, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation
    )
    obj = link_object(bpy.context.object)
    obj.name = name
    obj.data.materials.append(MATERIALS[mat])
    apply_bevel(obj, min(radius * 0.10, 0.004), 2)
    if parent:
        parent_keep_world(obj, parent)
    return obj


def rod_between(name, start, end, radius, mat, parent=None, vertices=16):
    start_point = Vector(start)
    end_point = Vector(end)
    direction = end_point - start_point
    obj = cylinder(
        name,
        (start_point + end_point) * 0.5,
        radius,
        direction.length,
        mat,
        vertices,
        parent,
    )
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.normalized().to_track_quat("Z", "Y")
    return obj


def sphere(name, location, scale, mat, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=36, ring_count=18, location=location)
    obj = link_object(bpy.context.object)
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(MATERIALS[mat])
    if parent:
        parent_keep_world(obj, parent)
    return obj


def torus(name, location, major_radius, minor_radius, mat, rotation=(0, 0, 0), parent=None):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=40,
        minor_segments=8,
        location=location,
        rotation=rotation,
    )
    obj = link_object(bpy.context.object)
    obj.name = name
    obj.data.materials.append(MATERIALS[mat])
    if parent:
        parent_keep_world(obj, parent)
    return obj


def tube_curve(name, points, radius, mat, parent=None):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 1
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new("NURBS")
    spline.points.add(len(points) - 1)
    for point, coordinates in zip(spline.points, points):
        point.co = (*coordinates, 1)
    spline.order_u = min(3, len(points))
    spline.use_endpoint_u = True
    obj = bpy.data.objects.new(name, curve)
    COLLECTION.objects.link(obj)
    obj.data.materials.append(MATERIALS[mat])
    if parent:
        parent_keep_world(obj, parent)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.name = name
    obj.select_set(False)
    return obj


def lathe(name, location, profile, mat, parent=None, segments=48):
    vertices = []
    faces = []
    for index, (z, radius) in enumerate(profile):
        for segment in range(segments):
            angle = segment * math.tau / segments
            vertices.append((radius * math.cos(angle), radius * math.sin(angle), z))
            if index:
                previous = (index - 1) * segments + segment
                current = index * segments + segment
                next_current = index * segments + (segment + 1) % segments
                next_previous = (index - 1) * segments + (segment + 1) % segments
                faces.append((previous, current, next_current, next_previous))
    mesh = bpy.data.meshes.new(f"{name}_MESH")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    COLLECTION.objects.link(obj)
    obj.location = location
    obj.data.materials.append(MATERIALS[mat])
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    if parent:
        parent_keep_world(obj, parent)
    return obj


def build_desk(root):
    desk = empty("DESK_ROOT", parent=root)
    desk["referenceDimensionsMeters"] = "1.60 x 0.80 x 0.76"
    top = empty("DESK_TOP", parent=desk)
    plank_depth = 0.196
    for index in range(4):
        y = -0.30 + index * 0.20
        z = -0.045 + (0.0012 if index in (1, 3) else 0)
        box(
            f"DESK_TOP_PLANK_{index + 1:02d}",
            (0, y, z),
            (1.60, plank_depth, 0.09),
            "MAT_DRY_OLD_WOOD",
            0.010,
            top,
        )
    for edge, y in (("FRONT", -0.402), ("REAR", 0.402)):
        box(f"DESK_TOP_EDGE_{edge}", (0, y, -0.050), (1.62, 0.028, 0.105), "MAT_DRY_OLD_WOOD", 0.009, top)

    box("DESK_FRONT_RAIL", (0, -0.365, -0.205), (1.34, 0.065, 0.25), "MAT_DRY_OLD_WOOD", 0.008, desk)
    box("DESK_REAR_RAIL", (0, 0.365, -0.205), (1.34, 0.065, 0.25), "MAT_DRY_OLD_WOOD", 0.008, desk)
    box("DESK_LEFT_RAIL", (-0.685, 0, -0.205), (0.065, 0.67, 0.25), "MAT_DRY_OLD_WOOD", 0.008, desk)
    box("DESK_RIGHT_RAIL", (0.685, 0, -0.205), (0.065, 0.67, 0.25), "MAT_DRY_OLD_WOOD", 0.008, desk)

    for side, x in (("LEFT", -0.69), ("RIGHT", 0.69)):
        for front, y in (("FRONT", -0.33), ("REAR", 0.33)):
            leg = empty(f"DESK_LEG_{side}_{front}_ROOT", (x, y, -0.12), desk)
            box(f"DESK_LEG_{side}_{front}_POST", (x, y, -0.43), (0.105, 0.105, 0.62), "MAT_DRY_OLD_WOOD", 0.007, leg)
            box(f"DESK_LEG_{side}_{front}_COLLAR", (x, y, -0.68), (0.125, 0.125, 0.045), "MAT_DRY_OLD_WOOD", 0.005, leg)
            box(f"DESK_LEG_{side}_{front}_FOOT", (x, y, -0.735), (0.14, 0.14, 0.065), "MAT_DARK_END_GRAIN", 0.005, leg)

    # Restrained, detachable-looking corner brackets and one shallow center relief.
    for side, x in (("LEFT", -0.61), ("RIGHT", 0.61)):
        box(f"DESK_CORNER_BRACKET_{side}", (x, -0.405, -0.34), (0.12, 0.025, 0.18), "MAT_DRY_OLD_WOOD", 0.004, desk, (0, 0, math.radians(45 if side == "LEFT" else -45)))
    relief = empty("DESK_APRON_RELIEF_CENTER", parent=desk)
    box("DESK_APRON_RELIEF_CENTER_BAR", (0, -0.402, -0.318), (0.20, 0.012, 0.024), "MAT_DARK_END_GRAIN", 0.004, relief)
    box("DESK_APRON_RELIEF_LEFT", (-0.105, -0.402, -0.318), (0.065, 0.012, 0.024), "MAT_DARK_END_GRAIN", 0.004, relief, (0, 0, math.radians(28)))
    box("DESK_APRON_RELIEF_RIGHT", (0.105, -0.402, -0.318), (0.065, 0.012, 0.024), "MAT_DARK_END_GRAIN", 0.004, relief, (0, 0, math.radians(-28)))

    for corner, x, y in (
        ("FL", -0.77, -0.37), ("FR", 0.77, -0.37), ("RL", -0.77, 0.37), ("RR", 0.77, 0.37)
    ):
        guard = box(f"DESK_CORNER_GUARD_{corner}", (x, y, 0.004), (0.105, 0.105, 0.012), "MAT_AGED_BRASS", 0.003, desk)
        guard.rotation_euler.z = math.radians(8 if "L" in corner else -8)
        for offset in (-0.026, 0.026):
            cylinder(f"DESK_GUARD_RIVET_{corner}_{offset:+.3f}", (x + offset, y, 0.013), 0.005, 0.004, "MAT_BLACKENED_BRASS", 16, desk)

    # A few physical cracks and edge scars supplement the generated texture.
    for index in range(10):
        x = -0.63 + index * 0.14
        y = -0.29 + (index % 4) * 0.18
        box(f"DESK_WEAR_SCAR_{index:02d}", (x, y, 0.003), (0.055, 0.0025, 0.0018), "MAT_DARK_END_GRAIN", 0.0005, desk, (0, 0, math.radians(-6 + index % 5 * 3)))
    return desk


def build_drawer(root, side, x):
    pivot = empty(f"DRAWER_{side}_PIVOT", (x, -0.18, -0.205), root)
    pivot["openTravelMeters"] = 0.34
    pivot["archiveCapacity"] = 12
    pivot["drawerSide"] = side.lower()
    body = empty(f"DRAWER_{side}_BODY", parent=pivot)
    box(f"DRAWER_{side}_FLOOR", (x, -0.19, -0.275), (0.55, 0.41, 0.025), "MAT_DRAWER_INTERIOR", 0.004, body)
    for edge, y in (("FRONT", -0.39), ("REAR", 0.01)):
        box(f"DRAWER_{side}_WALL_{edge}", (x, y, -0.205), (0.57, 0.025, 0.15), "MAT_DRAWER_INTERIOR", 0.004, body)
    for edge, dx in (("LEFT", -0.282), ("RIGHT", 0.282)):
        box(f"DRAWER_{side}_WALL_{edge}", (x + dx, -0.19, -0.205), (0.025, 0.41, 0.15), "MAT_DRAWER_INTERIOR", 0.004, body)
    front = box(f"DRAWER_{side}_FRONT", (x, -0.405, -0.195), (0.62, 0.055, 0.205), "MAT_DRY_OLD_WOOD", 0.010, pivot)
    front["interactive"] = f"drawer-{side.lower()}"
    box(f"DRAWER_{side}_FRONT_INSET", (x, -0.438, -0.195), (0.51, 0.012, 0.135), "MAT_DARK_END_GRAIN", 0.006, pivot)
    box(f"DRAWER_{side}_PULL_BACKPLATE", (x, -0.449, -0.19), (0.065, 0.012, 0.075), "MAT_AGED_BRASS", 0.006, pivot)
    cylinder(f"DRAWER_{side}_PULL_STEM", (x, -0.463, -0.177), 0.010, 0.026, "MAT_AGED_BRASS", 20, pivot, (math.pi / 2, 0, 0))
    ring = torus(f"DRAWER_{side}_PULL_RING", (x, -0.479, -0.215), 0.040, 0.007, "MAT_AGED_BRASS", (math.pi / 2, 0, 0), pivot)
    ring["interactive"] = f"drawer-{side.lower()}"
    hit = box(f"HIT_DRAWER_{side}", (x, -0.445, -0.195), (0.65, 0.09, 0.24), "MAT_HIT_PROXY", 0, pivot)
    hit["interactive"] = f"drawer-{side.lower()}"
    slot = empty(f"DRAWER_{side}_ARCHIVE_SLOT", (x, -0.18, -0.255), pivot)
    slot["paperStackWidthMeters"] = 0.47
    slot["paperStackDepthMeters"] = 0.30
    slot["paperStackHeightMeters"] = 0.10
    return pivot


def build_lamp(root):
    # Keep the root at the environment origin: all visual pieces below use world-space
    # construction coordinates, avoiding accumulated offsets in exported nested empties.
    lamp = empty("LAMP_ROOT", parent=root)
    lamp["design"] = "selected-option-A-fictional-unbranded"
    lamp["lightColor"] = "#ffad63"
    cylinder("LAMP_BASE_FOOT", (0.58, 0.22, 0.015), 0.112, 0.03, "MAT_BLACKENED_BRASS", 64, lamp)
    torus("LAMP_BASE_LOWER_RIB", (0.58, 0.22, 0.036), 0.096, 0.009, "MAT_AGED_BRASS", parent=lamp)
    cylinder("LAMP_BASE_RING", (0.58, 0.22, 0.050), 0.098, 0.028, "MAT_AGED_BRASS", 64, lamp)
    lathe(
        "LAMP_FUEL_RESERVOIR",
        (0.58, 0.22, 0),
        [
            (0.060, 0.082),
            (0.075, 0.108),
            (0.105, 0.122),
            (0.150, 0.120),
            (0.182, 0.098),
            (0.202, 0.060),
        ],
        "MAT_AGED_BRASS",
        lamp,
        64,
    )
    torus("LAMP_RESERVOIR_SHOULDER_RIB", (0.58, 0.22, 0.166), 0.102, 0.006, "MAT_BLACKENED_BRASS", parent=lamp)
    cylinder("LAMP_FILLER_NECK", (0.674, 0.22, 0.170), 0.018, 0.028, "MAT_BLACKENED_BRASS", 32, lamp)
    cylinder("LAMP_FILLER_CAP", (0.674, 0.22, 0.192), 0.024, 0.018, "MAT_AGED_BRASS", 32, lamp)
    torus("LAMP_FILLER_CAP_RIB", (0.674, 0.22, 0.202), 0.019, 0.0035, "MAT_BLACKENED_BRASS", parent=lamp)
    cylinder("LAMP_BURNER_COLLAR", (0.58, 0.22, 0.225), 0.058, 0.072, "MAT_AGED_BRASS", 64, lamp)
    torus("LAMP_BURNER_GALLERY", (0.58, 0.22, 0.260), 0.064, 0.008, "MAT_BLACKENED_BRASS", parent=lamp)
    torus("LAMP_BURNER_CROWN", (0.58, 0.22, 0.278), 0.059, 0.006, "MAT_AGED_BRASS", parent=lamp)
    for index in range(16):
        angle = index * math.tau / 16
        cylinder(
            f"LAMP_GALLERY_VENT_{index:02d}",
            (0.58 + math.cos(angle) * 0.057, 0.22 + math.sin(angle) * 0.057, 0.251),
            0.0042,
            0.006,
            "MAT_LAMP_SOOT",
            16,
            lamp,
            (math.pi / 2, 0, angle),
        )
    cylinder("LAMP_WICK_CONTROL_STEM", (0.663, 0.22, 0.220), 0.009, 0.052, "MAT_AGED_BRASS", 20, lamp, (0, math.pi / 2, 0))
    cylinder("LAMP_WICK_CONTROL_WHEEL", (0.692, 0.22, 0.220), 0.025, 0.006, "MAT_AGED_BRASS", 32, lamp, (0, math.pi / 2, 0))
    torus("LAMP_WICK_CONTROL_RIM", (0.696, 0.22, 0.220), 0.020, 0.003, "MAT_BLACKENED_BRASS", (0, math.pi / 2, 0), lamp)

    chimney = empty("LAMP_CHIMNEY_ROOT", parent=lamp)
    lathe(
        "LAMP_GLASS_CHIMNEY",
        (0.58, 0.22, 0),
        [
            (0.268, 0.058), (0.290, 0.076), (0.340, 0.092), (0.405, 0.078),
            (0.465, 0.052), (0.575, 0.047), (0.615, 0.054)
        ],
        "MAT_LAMP_GLASS",
        chimney,
        64,
    )
    torus("LAMP_GLASS_BOTTOM_RIM", (0.58, 0.22, 0.270), 0.060, 0.004, "MAT_AGED_BRASS", parent=lamp)
    torus("LAMP_GLASS_TOP_LIP", (0.58, 0.22, 0.615), 0.054, 0.0035, "MAT_LAMP_GLASS", parent=chimney)
    for index in range(4):
        angle = index * math.tau / 4 + math.pi / 4
        x = 0.58 + math.cos(angle) * 0.055
        y = 0.22 + math.sin(angle) * 0.055
        rod_between(
            f"LAMP_GALLERY_PRONG_{index:02d}",
            (x, y, 0.258),
            (x * 0.92 + 0.58 * 0.08, y * 0.92 + 0.22 * 0.08, 0.292),
            0.0032,
            "MAT_AGED_BRASS",
            lamp,
        )
    flame_anchor = empty("LAMP_FLAME_ANCHOR", (0.58, 0.22, 0.315), lamp)
    flame_anchor["flickerAmplitude"] = 0.055
    sphere("LAMP_FLAME_MESH", (0.58, 0.22, 0.330), (0.017, 0.012, 0.043), "MAT_FLAME", flame_anchor)
    return lamp


def triangle_count():
    depsgraph = bpy.context.evaluated_depsgraph_get()
    count = 0
    for obj in COLLECTION.objects:
        if obj.type != "MESH":
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        count += len(mesh.loop_triangles)
        evaluated.to_mesh_clear()
    return count


def setup_review_scene():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 760
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.world.color = (0.014, 0.011, 0.009)
    bpy.ops.object.camera_add(location=(1.68, -1.78, 1.06))
    camera = bpy.context.object
    camera.name = "REVIEW_CAMERA"
    camera.rotation_euler = (Vector((0, 0, -0.20)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 50
    scene.camera = camera
    bpy.ops.object.light_add(type="AREA", location=(-0.65, -0.65, 1.65))
    fill = bpy.context.object
    fill.data.energy = 360
    fill.data.color = (0.82, 0.86, 1.0)
    fill.data.size = 2.8
    bpy.ops.object.light_add(type="AREA", location=(0.62, 0.08, 1.0))
    lamp = bpy.context.object
    lamp.data.energy = 210
    lamp.data.color = (1.0, 0.53, 0.22)
    lamp.data.size = 1.2
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass


def render_review():
    RENDERS_DIR.mkdir(parents=True, exist_ok=True)
    path = RENDERS_DIR / "phase-6-desk-uv-pass-v1.png"
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    return str(path)


def export_glb():
    for obj in bpy.context.selected_objects:
        obj.select_set(False)
    for obj in COLLECTION.objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        use_selection=True,
        export_extras=True,
        export_cameras=False,
        export_lights=False,
    )


def main():
    for path in (BLEND_PATH.parent, GLB_PATH.parent, REPORT_PATH.parent, RENDERS_DIR, TEXTURE_DIR):
        path.mkdir(parents=True, exist_ok=True)
    reset_scene()
    create_materials()
    root = empty("ENVIRONMENT_ROOT")
    build_desk(root)
    build_drawer(root, "LEFT", -0.335)
    build_drawer(root, "RIGHT", 0.335)
    assign_desk_atlas_uvs()
    triangles = triangle_count()
    setup_review_scene()
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    export_glb()
    render_path = render_review()
    names = {obj.name for obj in COLLECTION.objects}
    required = {
        "ENVIRONMENT_ROOT", "DESK_ROOT", "DESK_TOP",
        "DRAWER_LEFT_PIVOT", "DRAWER_LEFT_BODY", "DRAWER_LEFT_FRONT",
        "DRAWER_LEFT_ARCHIVE_SLOT", "HIT_DRAWER_LEFT",
        "DRAWER_RIGHT_PIVOT", "DRAWER_RIGHT_BODY", "DRAWER_RIGHT_FRONT",
        "DRAWER_RIGHT_ARCHIVE_SLOT", "HIT_DRAWER_RIGHT",
    }
    errors = [f"Missing {name}" for name in sorted(required - names)]
    report = {
        "status": "passed" if not errors else "failed",
        "phase": "phase-6-desk-uv-pass-v1",
        "blend": str(BLEND_PATH),
        "glb": str(GLB_PATH),
        "render": render_path,
        "objectCount": len(COLLECTION.objects),
        "triangleCount": triangles,
        "drawerOpenTravelMeters": {"left": 0.34, "right": 0.34},
        "archiveCapacity": {"left": 12, "right": 12, "total": 24},
        "generatedTextures": [
            str(TEXTURE_DIR / "aged-wood-color.png"),
            str(TEXTURE_DIR / "aged-wood-roughness.png"),
            str(TEXTURE_DIR / "aged-wood-normal.png"),
            str(TEXTURE_DIR / "aged-wood-ao.png"),
            str(TEXTURE_DIR / "aged-brass-color.png"),
            str(TEXTURE_DIR / "aged-brass-roughness.png"),
            str(TEXTURE_DIR / "aged-brass-normal.png"),
        ],
        "validationErrors": errors,
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if errors:
        raise SystemExit("ENVIRONMENT_VALIDATION_FAILED " + "; ".join(errors))
    print(f"BLENDER_ENVIRONMENT_OK {len(COLLECTION.objects)} objects {triangles} triangles")


main()
