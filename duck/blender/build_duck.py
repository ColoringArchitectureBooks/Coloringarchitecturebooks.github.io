"""Rubber Duck 1, rebuilt in Blender.

Run inside Blender (Scripting > Open > Run Script) or headless:
    blender --background --python build_duck.py -- OUT_DIR
It builds the duck from Ahmed's reconstruction package (duck/reconstruction/), all sizes in Blender units
(the duck is 2.00 BU tall, Z up, the beak looks toward -Y):
  1. smooth shapes first: head and body are spheres re-shaped ring by ring to the package's 11 sections,
     the tail is pulled up and back out of the body itself, the wings are flattened half-moons,
     the beak is lofted through the sheet's sections and smoothed;
  2. then each part is decimated to a low triangle count and flat shaded, which gives the irregular
     low-poly facets of the reference picture.
Every number below can be changed and the script run again.
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else os.path.dirname(bpy.data.filepath or __file__)

# ---------------- numbers (BU) ----------------
# 01_head_sections_11_levels.csv (world Z, width X, depth Y), plus a hidden ring inside the body and a round crown
HEAD = [(0.80, 0.82, 0.72), (0.88, 0.917, 0.801), (0.992, 0.944, 0.887), (1.104, 1.142, 0.946), (1.216, 1.223, 1.129),
        (1.328, 1.265, 1.091), (1.44, 1.212, 1.102), (1.552, 1.153, 1.064), (1.664, 1.046, 0.973), (1.776, 0.901, 0.854),
        (1.888, 0.643, 0.634), (1.95, 0.42, 0.41), (1.985, 0.2, 0.2), (2.0, 0.0, 0.0)]
# 02_body_sections_11_levels_PROVISIONAL.csv
BODY = [(0.0, 0.0, 0.0), (0.012, 0.42, 0.5), (0.094, 0.78, 0.85), (0.188, 1.07, 1.11), (0.282, 1.22, 1.29), (0.376, 1.3, 1.37),
        (0.47, 1.29, 1.35), (0.564, 1.23, 1.28), (0.658, 1.13, 1.16), (0.752, 1.04, 1.02), (0.846, 0.98, 0.92),
        (0.94, 0.91, 0.81), (0.99, 0.6, 0.55), (1.0, 0.0, 0.0)]
BODY_SCALE = 1.1            # the picture's body is 1.43 wide, not 1.30 (Ahmed chose the picture over the numbers)
BODY_Y = -0.10                 # the chest sits a little ahead of the head (side view)
TAIL = dict(back=0.24, z=0.8, rise=0.3, spread=0.18)
WING = dict(x=0.42, length=0.76, h=0.62, z=0.56, out=0.18, tilt=12)
EYE = dict(x=0.33, z=1.362, w=0.16, h=0.21, t=0.07)
BEAK = dict(top=1.357, bottom=0.971, w=0.66, proj=0.34)
BEAK_SCALE = 1.0            # grows the beak around the mouth line
FACES = dict(head=260, body=300, wing=46, beak_upper=70, beak_lower=50)   # low-poly budget per part
YELLOW, ORANGE, ORANGE_DARK = (1.0, 0.8, 0.04), (0.976, 0.42, 0.086), (0.886, 0.333, 0.055)


# --params FILE.json overrides any number above, e.g. {"BODY_SCALE": 1.12, "WING": {"h": 0.66}}
if "--params" in sys.argv:
    import json
    for k, v in json.load(open(sys.argv[sys.argv.index("--params") + 1])).items():
        if isinstance(v, dict): globals()[k].update(v)
        else: globals()[k] = v


def lerp_table(t, z):
    if z <= t[0][0]: return t[0][1:]
    for a, b in zip(t, t[1:]):
        if z <= b[0]:
            f = (z - a[0]) / (b[0] - a[0]); return tuple(a[i] + (b[i] - a[i]) * f for i in (1, 2))
    return t[-1][1:]


def srgb(c):
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c) + (1.0,)


def material(name, color, rough):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]; p.inputs["Base Color"].default_value = srgb(color); p.inputs["Roughness"].default_value = rough
    m.diffuse_color = srgb(color); return m


def sphere(name, segs=48, rings=32):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob); return ob


def lathe(ob, table, z0, z1, cy=0.0):
    """re-shape a unit sphere so each height has the table's width and depth"""
    for v in ob.data.vertices:
        p = v.co; z = z0 + (p.z + 1) / 2 * (z1 - z0)
        w, d = lerp_table(table, z); r = math.hypot(p.x, p.y)
        ux, uy = (p.x / r, p.y / r) if r > 1e-9 else (0.0, 0.0)
        v.co = Vector((ux * w / 2, cy + uy * d / 2, z))


def smoothstep(e0, e1, x):
    t = min(1, max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t)


def finish(ob, faces, mat, subdiv=0):
    if subdiv:
        m = ob.modifiers.new("smooth", "SUBSURF"); m.levels = subdiv
    n = len(ob.data.polygons) * (4 ** subdiv)
    dec = ob.modifiers.new("lowpoly", "DECIMATE"); dec.decimate_type = "COLLAPSE"; dec.ratio = min(1.0, faces / max(1, n)); dec.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
    for p in ob.data.polygons: p.use_smooth = False
    ob.data.materials.append(mat)


def loft(name, rings):
    """mesh through rings (same point count) from back to front, capped at both ends"""
    bm = bmesh.new(); R = [[bm.verts.new(p) for p in r] for r in rings]; n = len(rings[0])
    for a, b in zip(R, R[1:]):
        for k in range(n): bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]))
    bm.faces.new(list(reversed(R[0]))); bm.faces.new(R[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob); return ob


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    yellow, orange, dark = material("duck_yellow", YELLOW, 0.35), material("beak_orange", ORANGE, 0.4), material("beak_under", ORANGE_DARK, 0.45)
    black, white = material("eye_black", (0.07, 0.07, 0.07), 0.15), material("eye_glint", (1, 1, 1), 0.2)

    head = sphere("head"); lathe(head, HEAD, 0.80, 2.0)
    body = sphere("body"); lathe(body, [(z, w * BODY_SCALE, d * BODY_SCALE) for z, w, d in BODY], 0.0, 1.0, BODY_Y)
    # tail: the upper back of the body itself is pulled backward and up, so it grows out of the body
    for v in body.data.vertices:
        p = v.co; rear = (p.y - BODY_Y) / (1.37 * BODY_SCALE / 2)                   # 1 at the back
        w = smoothstep(0.35, 1.0, rear) * math.exp(-((p.z - TAIL["z"]) / TAIL["spread"]) ** 2) * (1 - smoothstep(0.25, 0.75, abs(p.x) / (0.65 * BODY_SCALE)))
        p.y += TAIL["back"] * 1.6 * w; p.z += TAIL["rise"] * w; p.x *= 1 - 0.35 * w

    # wings: flattened half-moons, rear end lifting, bottom leaning out 15 degrees
    wings = []
    for s in (1, -1):
        wg = sphere("wing_L" if s > 0 else "wing_R", 24, 16)
        for v in wg.data.vertices:
            p = v.co; y = p.y * WING["length"] / 2
            z = p.z * WING["h"] / 2 * (0.75 + 0.25 * (1 - abs(p.y)))
            if p.z > 0: z *= 0.6                                     # nearly straight top edge, round below: a half-moon
            z += 0.07 * max(0.0, p.y) ** 2                              # the back end lifts
            v.co = Vector((p.x * WING["x"] / 2 * (0.6 + 0.4 * math.cos(p.y * math.pi / 2)), y, z))
        wx = 1.3 * BODY_SCALE / 2 + WING["out"] - WING["x"] / 2 - 0.06
        wg.location = (s * wx, BODY_Y + 0.2, WING["z"])   # set back from the chest, as in the side view; wg.rotation_euler = (0, -s * math.radians(WING["tilt"]), 0)
        wings.append(wg)

    # beak: ridge top level with the eye centres, down to 0.971; 0.66 wide, 0.48 at the face, 0.34 out.
    total = BEAK["top"] - BEAK["bottom"]; up = total * 0.18 / 0.31; gap = total * 0.02 / 0.31; low = total - up - gap
    mouth = BEAK["top"] - up
    face_y = -lerp_table(HEAD, mouth)[1] / 2                          # head front at mouth height
    c = 0.05
    UP = [(-0.08, 0.23, 1, 0.38), (0, 0.24, 1, 0.38), (0.08, 0.3, 0.95, 0.36), (0.17, 0.33, 0.83, 0.33),
          (0.26, 0.32, 0.67, 0.28), (0.315, 0.29, 0.56, 0.25), (0.34, 0.21, 0.45, 0.22)]
    rings = []
    for z, w, t, e in UP:
        t *= up; e *= up; r = t - 0.04; y = face_y - z
        pts = [(w, e + c), (w * .75, e + c * .8 + (r - e) * .2), (w * .4, e + c * .4 + (r - e) * .75), (0, t),
               (-w * .4, e + c * .4 + (r - e) * .75), (-w * .75, e + c * .8 + (r - e) * .2), (-w, e + c),
               (-w, c), (-w * .5, c * .3), (0, 0), (w * .5, c * .3), (w, c)]
        rings.append([(x * BEAK_SCALE, face_y - (face_y - y) * BEAK_SCALE, mouth + h * BEAK_SCALE) for x, h in pts])
    upper = loft("beak_upper", rings)
    LO = [(-0.08, 0.2, 0.85), (0, 0.21, 1), (0.08, 0.24, 1), (0.16, 0.25, 0.92), (0.23, 0.23, 0.77), (0.28, 0.19, 0.54), (0.3, 0.13, 0.3)]
    rings = []
    for z, w, b in LO:
        b *= -(low + gap); y = face_y - z
        pts = [(w, c * .9 - gap), (w * .5, c * .3 - gap), (0, -gap), (-w * .5, c * .3 - gap), (-w, c * .9 - gap),
               (-w * .9, b * .4), (-w * .5, b * .9), (0, b), (w * .5, b * .9), (w * .9, b * .4)]
        rings.append([(x * BEAK_SCALE, face_y - (face_y - y) * BEAK_SCALE, mouth + h * BEAK_SCALE) for x, h in pts])
    lower = loft("beak_lower", rings)

    # low poly: decimate the smooth shapes and flat shade them
    finish(head, FACES["head"], yellow); finish(body, FACES["body"], yellow)
    for wg in wings: finish(wg, FACES["wing"], yellow)
    finish(upper, FACES["beak_upper"], orange, subdiv=2); finish(lower, FACES["beak_lower"], dark, subdiv=2)

    # eyes: on the (faceted) head surface at the picture's own landmarks, with a white glint upper left
    bpy.context.view_layer.update()
    for s in (1, -1):
        hit, loc, nrm, _ = head.ray_cast(Vector((s * EYE["x"], -3, EYE["z"])), Vector((0, 1, 0)))
        loc = loc if hit else Vector((s * EYE["x"], -0.55, EYE["z"])); nrm = Vector((nrm.x, nrm.y, nrm.z * 0.3)).normalized() if hit else Vector((0, -1, 0))
        eye = sphere("eye_L" if s > 0 else "eye_R", 16, 10)
        eye.scale = (EYE["w"] / 2, EYE["t"] / 2, EYE["h"] / 2)
        eye.rotation_euler = Vector((0, -1, 0)).rotation_difference(nrm).to_euler()
        eye.location = loc - nrm * 0.005; eye.data.materials.append(black)
        for p in eye.data.polygons: p.use_smooth = True
        gl = sphere("glint", 10, 6); gl.parent = eye; gl.location = (-0.3, -0.85, 0.3); gl.scale = (0.38, 0.3, 0.29)
        gl.data.materials.append(white)
    return head


def render_views(out_dir, only=None):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"; sc.cycles.samples = 48; sc.cycles.device = "CPU"
    try: sc.cycles.use_denoising = True
    except Exception: pass
    sc.render.resolution_x, sc.render.resolution_y = 400, 480; sc.render.film_transparent = False
    sc.view_settings.view_transform = "Standard"
    world = bpy.data.worlds.new("studio"); sc.world = world; world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = srgb((0.85, 0.86, 0.875)); world.node_tree.nodes["Background"].inputs[1].default_value = 0.9
    for name, rot, en in (("key", (math.radians(40), 0, math.radians(-30)), 3.0), ("fill", (math.radians(60), 0, math.radians(140)), 1.0)):
        L = bpy.data.lights.new(name, "SUN"); L.energy = en; o = bpy.data.objects.new(name, L); o.rotation_euler = rot; sc.collection.objects.link(o)
    cam = bpy.data.cameras.new("cam"); cam.lens = 60; co = bpy.data.objects.new("cam", cam); sc.collection.objects.link(co); sc.camera = co
    target = Vector((0, 0, 0.98))
    views = {"front": (0, -1, 0.12), "three_quarter": (-0.7, -0.75, 0.15), "side": (-1, 0.0, 0.1), "back_three_quarter": (-0.7, 0.75, 0.15),
             "back": (0, 1, 0.12), "top": (0.0, -0.25, 1), "high_three_quarter": (0.75, -0.7, 0.45)}   # the reference sheet's seven angles
    for name, d in views.items():
        if only and name not in only: continue
        dv = Vector(d).normalized(); co.location = target + dv * 5.2
        co.rotation_euler = (target - co.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = os.path.join(out_dir, f"view_{name}.png"); bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    build()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "rubber_duck_1.blend"))
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "rubber_duck_1.glb"), export_format="GLB", export_yup=True)
    if "--render" in sys.argv: render_views(OUT, sys.argv[sys.argv.index("--views") + 1].split(",") if "--views" in sys.argv else None)
    print("faces:", {o.name: len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH"})
