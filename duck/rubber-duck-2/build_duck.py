"""Rubber Duck 2: the smooth glossy duck from canonical-turnaround.png, built in Blender.

    blender --background --python build_duck.py -- OUT_DIR [--render] [--views front,side] [--params p.json]
    (or: python-with-bpy build_duck.py -- OUT_DIR --render)

Every shape number is at the top, in shares of the duck's height (1.0 = top of the head), measured from the
turnaround sheet: width per height from the front photo, front and back edge per height from the side photo,
with y = 0 at the middle of the flat base. Z is up and the beak points to -Y. HEIGHT turns them into Blender units.
"""
import json, math, os, sys
import bpy, bmesh
from mathutils import Vector, Matrix

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = ARGS[0] if ARGS else "out"
HEIGHT = 2.0

# body: (z, half width, front edge y, back edge y). Front photo minus the wings; side photo for front/back.
BODY = [(0.0, 0.22, -0.28, 0.28), (0.012, 0.27, -0.33, 0.33), (0.04, 0.315, -0.375, 0.375), (0.08, 0.345, -0.405, 0.405),
        (0.12, 0.362, -0.42, 0.425), (0.18, 0.375, -0.43, 0.441), (0.22, 0.378, -0.433, 0.452), (0.26, 0.375, -0.43, 0.458),
        (0.30, 0.368, -0.42, 0.464), (0.34, 0.357, -0.403, 0.466), (0.38, 0.34, -0.378, 0.464), (0.42, 0.318, -0.345, 0.456),
        (0.46, 0.28, -0.298, 0.43), (0.50, 0.24, -0.268, 0.36), (0.54, 0.19, -0.25, 0.27), (0.57, 0.0, -0.2, 0.2)]
# head: (z, half width, front edge y, back edge y)
HEAD = [(0.46, 0.0, -0.18, 0.18), (0.48, 0.17, -0.25, 0.22), (0.52, 0.212, -0.266, 0.244), (0.58, 0.237, -0.266, 0.242),
        (0.62, 0.257, -0.271, 0.262), (0.66, 0.27, -0.276, 0.278), (0.70, 0.272, -0.281, 0.283), (0.74, 0.27, -0.29, 0.285),
        (0.78, 0.263, -0.278, 0.28), (0.82, 0.25, -0.265, 0.267), (0.86, 0.233, -0.248, 0.25), (0.90, 0.205, -0.22, 0.225),
        (0.94, 0.168, -0.18, 0.185), (0.98, 0.106, -0.112, 0.117), (1.0, 0.0, -0.0, 0.0)]
HEAD_Y = 0.0
HEAD_SCALE = 1.05     # widens and deepens the head table (its height stays)
# tail: a cone that rises out of the back to a rounded point. (z, half width, centre y, half depth)
TAIL = dict(base_z=0.30, tip_z=0.565, base_y=0.24, tip_y=0.43, base_w=0.31, base_d=0.19, lean=1.0)
# wings: teardrops on the sides, round end to the front and low, point to the back and up
WING = dict(x=0.335, y=0.03, z=0.25, length=0.24, h=0.15, t=0.09, tip_lift=0.08, pitch=10, toe=6, grooves=3)
EYE = dict(x=0.135, z=0.78, w=0.04, h=0.055, ring=0.018)
# beak: open mouth, a wide upper bill over a lower bill with the dark mouth between
BEAK = dict(w=0.2, root_y=-0.25, tip_y=-0.426, upper_z=0.712, upper_t=0.06, lower_z=0.55, lower_w=0.165,
            lower_tip_y=-0.398, lower_t=0.045, smile=1.6, flare=0.25, slope=14, scale=1.0)
SOFTEN = 120          # smoothing passes on the neck and tail joins
VOXEL = 0.016          # remesh size that blends head, body and tail into one skin (Blender units)
YELLOW, BEAK_RED, MOUTH = (1.0, 0.76, 0.0), (0.93, 0.25, 0.08), (0.62, 0.09, 0.04)

if "--params" in ARGS:
    for k, v in json.load(open(ARGS[ARGS.index("--params") + 1])).items():
        if isinstance(v, dict): globals()[k].update(v)
        else: globals()[k] = v


def srgb(c):
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (1.0,)


def material(name, color, rough, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]; p.inputs["Base Color"].default_value = srgb(color); p.inputs["Roughness"].default_value = rough
    try: p.inputs["Coat Weight"].default_value = coat
    except KeyError: pass
    m.diffuse_color = srgb(color); return m


def link(name, bm):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob); return ob


def interp(table, z):
    for a, b in zip(table, table[1:]):
        if a[0] <= z <= b[0]:
            t = (z - a[0]) / max(1e-9, b[0] - a[0]); return [x + (y - x) * t for x, y in zip(a[1:], b[1:])]
    return list(table[0][1:] if z < table[0][0] else table[-1][1:])


def rings_mesh(name, rings, segs=72):
    """rings: list of (z, cx, cy, half width, front depth, back depth); the first and last are closed with a cap."""
    bm = bmesh.new(); vs = []
    for z, cx, cy, hw, f, b in rings:
        row = []
        for i in range(segs):
            a = 2 * math.pi * i / segs; s, c = math.sin(a), math.cos(a)
            row.append(bm.verts.new(((cx + c * hw) * HEIGHT, (cy + s * (b if s > 0 else f)) * HEIGHT, z * HEIGHT)))
        vs.append(row)
    for r0, r1 in zip(vs, vs[1:]):
        for i in range(segs): bm.faces.new((r0[i], r0[(i + 1) % segs], r1[(i + 1) % segs], r1[i]))
    for row, (z, cx, cy, *_), flip in ((vs[0], rings[0], True), (vs[-1], rings[-1], False)):
        c = bm.verts.new((cx * HEIGHT, cy * HEIGHT, z * HEIGHT))
        for i in range(segs):
            f = (row[i], row[(i + 1) % segs], c); bm.faces.new(f[::-1] if flip else f)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); return link(name, bm)


def table_rings(table, cy=0.0, n=40, ease=True, scale=1.0):
    z0, z1 = table[0][0], table[-1][0]; out = []
    for k in range(n + 1):
        t = k / n; t = 0.5 - 0.5 * math.cos(math.pi * t) if ease else t          # denser rings near the caps
        z = z0 + (z1 - z0) * t; hw, f, b = interp(table, z)
        out.append((z, 0.0, cy, max(hw * scale, 0.004), max(-f * scale, 0.004), max(b * scale, 0.004)))
    return out


def ellipsoid(name, r, segs=48, rings=28):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * r[0], v.co.y * r[1], v.co.z * r[2])) * HEIGHT
    return link(name, bm)


def modifier(ob, kind, **kw):
    m = ob.modifiers.new(kind, kind)
    for k, v in kw.items(): setattr(m, k, v)
    bpy.context.view_layer.objects.active = ob; bpy.ops.object.modifier_apply(modifier=m.name)


def smooth(ob, mat):
    for p in ob.data.polygons: p.use_smooth = True
    ob.data.materials.clear(); ob.data.materials.append(mat)


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    yellow, red, mouth = material("yellow", YELLOW, 0.28, 0.3), material("beak", BEAK_RED, 0.3, 0.3), material("mouth", MOUTH, 0.45)
    black, white = material("eye", (0.02, 0.02, 0.025), 0.08), material("eye_white", (0.97, 0.97, 0.96), 0.3)

    body = rings_mesh("body", table_rings(BODY))
    head = rings_mesh("head", table_rings(HEAD, HEAD_Y, scale=HEAD_SCALE))
    T = TAIL; tr = []
    for k in range(25):
        t = k / 24; e = t ** T["lean"]
        z = T["base_z"] + (T["tip_z"] - T["base_z"]) * t; cy = T["base_y"] + (T["tip_y"] - T["base_y"]) * (1 - (1 - t) ** 2)
        s = (1 - e) * 0.97 + 0.03
        tr.append((z, 0.0, cy, T["base_w"] * s, T["base_d"] * s, T["base_d"] * s))
    tail = rings_mesh("tail", tr, 48)
    # one skin: join, voxel remesh, relax, so the neck and the tail flow into the body like moulded rubber
    for o in (head, tail): o.select_set(True)
    body.select_set(True); bpy.context.view_layer.objects.active = body; bpy.ops.object.join()
    modifier(body, "REMESH", mode="VOXEL", voxel_size=VOXEL)
    modifier(body, "CORRECTIVE_SMOOTH", factor=0.5, iterations=4)
    bm = bmesh.new(); bm.from_mesh(body.data)                         # soften the neck and tail joins only, keep the base
    skin = [v for v in bm.verts if v.co.z > 0.03 * HEIGHT]             # take out the voxel staircase everywhere but the base
    for _ in range(10): bmesh.ops.smooth_vert(bm, verts=skin, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    band = [v for v in bm.verts if 0.32 * HEIGHT < v.co.z < 0.6 * HEIGHT]
    for _ in range(SOFTEN): bmesh.ops.smooth_vert(bm, verts=band, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.to_mesh(body.data); bm.free()
    body.name = "duck_body"; smooth(body, yellow)

    W = WING
    for s in (1, -1):
        w = ellipsoid(f"wing_{'L' if s > 0 else 'R'}", (W["t"], W["length"], W["h"]))
        for v in w.data.vertices:                                     # teardrop: thin and lifted toward the back
            u = v.co.y / (W["length"] * HEIGHT); k = max(0.0, u)
            v.co.z *= (1 - 0.6 * k * k) * (1 + 0.12 * max(0.0, -u))     # fuller round front lobe
            v.co.x *= 1 - 0.35 * k * k
            v.co.z += W["tip_lift"] * HEIGHT * k * k
            if v.co.x < 0: v.co.x *= 0.4                              # flat inner side sits against the body
        for g in range(W["grooves"]):                                 # shallow feather grooves near the back
            zc = (-0.25 + 0.25 * g) * W["h"] * HEIGHT
            for v in w.data.vertices:
                u = v.co.y / (W["length"] * HEIGHT)
                if v.co.x > 0 and u > -0.1:
                    d = abs(v.co.z - (zc + W["tip_lift"] * HEIGHT * max(0, u) ** 2 * 0.8))
                    v.co.x -= 0.012 * HEIGHT * max(0.0, 1 - d / (0.012 * HEIGHT)) * min(1, (u + 0.1) * 3)
        w.data.update()
        w.matrix_world = Matrix.Translation((s * W["x"] * HEIGHT, W["y"] * HEIGHT, W["z"] * HEIGHT)) @ \
            Matrix.Rotation(math.radians(-s * W["toe"]), 4, "Z") @ Matrix.Rotation(math.radians(W["pitch"]), 4, "X") @ \
            Matrix.Scale(s, 4, (1, 0, 0))
        bpy.context.view_layer.objects.active = w; w.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True); bpy.ops.object.select_all(action="DESELECT")
        modifier(w, "SUBSURF", levels=1); smooth(w, yellow)

    B = BEAK; sc = B["scale"]; L = (B["root_y"] - B["tip_y"]) / 2
    def bill(name, w, depth, t, cy, z, smile, mat, slope=0.0):
        o = ellipsoid(name, (w * sc, depth * sc, t * sc))
        for v in o.data.vertices:
            u = -v.co.y / (depth * sc * HEIGHT)                       # +1 at the tip, -1 at the root
            v.co.x *= 1 + B["flare"] * max(0.0, u)                    # a duck bill widens toward the tip
            x = v.co.x / HEIGHT; v.co.z += smile * x * x * HEIGHT
            if v.co.y > 0: v.co.y *= 1.6                              # the back half goes into the face
        o.data.update()
        o.matrix_world = Matrix.Translation((0, cy * HEIGHT, z * HEIGHT)) @ Matrix.Rotation(math.radians(-slope), 4, "X")
        modifier(o, "SUBSURF", levels=1); smooth(o, mat); return o
    bill("beak_upper", B["w"], L, B["upper_t"], B["tip_y"] + L * sc, B["upper_z"], -B["smile"] * 0.5, red, B["slope"])
    Ll = (B["root_y"] - B["lower_tip_y"]) / 2
    bill("beak_lower", B["lower_w"], Ll, B["lower_t"], B["lower_tip_y"] + Ll * sc, B["lower_z"], B["smile"], red, -6)
    bill("mouth", B["lower_w"] * 0.85, Ll * 0.8, (B["upper_z"] - B["lower_z"]) * 0.5, B["lower_tip_y"] + Ll * sc + 0.02,
         (B["upper_z"] + B["lower_z"]) / 2, 0.3, mouth)

    E = EYE; dg = bpy.context.evaluated_depsgraph_get(); duck = bpy.data.objects["duck_body"]
    for s in (1, -1):
        org = Vector((s * E["x"] * HEIGHT, -3.0, E["z"] * HEIGHT))
        ok, loc, nrm, _ = duck.ray_cast(duck.matrix_world.inverted() @ org, Vector((0, 1, 0)))
        n = Vector((nrm.x, nrm.y, nrm.z * 0.5)).normalized(); q = n.to_track_quat("Z", "Y")
        ring = ellipsoid(f"eye_ring_{s}", (E["w"] + E["ring"], E["h"] + E["ring"], 0.012)); smooth(ring, white)
        ring.matrix_world = Matrix.Translation(loc) @ q.to_matrix().to_4x4()
        eye = ellipsoid(f"eye_{s}", (E["w"], E["h"], 0.022)); smooth(eye, black)
        eye.matrix_world = Matrix.Translation(loc + n * 0.012) @ q.to_matrix().to_4x4()
        gl = ellipsoid(f"glint_{s}", (0.012, 0.014, 0.006)); smooth(gl, white)
        gl.matrix_world = Matrix.Translation(loc + n * 0.055 + q @ Vector((0.012 * HEIGHT, 0.022 * HEIGHT, 0))) @ q.to_matrix().to_4x4()


def render_views(out_dir, only=None):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"; sc.cycles.samples = 48; sc.cycles.device = "CPU"
    try: sc.cycles.use_denoising = True
    except Exception: pass
    sc.render.resolution_x, sc.render.resolution_y = 400, 480; sc.render.film_transparent = True
    sc.view_settings.view_transform = "Standard"
    world = bpy.data.worlds.new("studio"); sc.world = world; world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = srgb((0.97, 0.97, 0.97)); world.node_tree.nodes["Background"].inputs[1].default_value = 0.55
    for name, rot, en in (("key", (math.radians(35), 0, math.radians(-25)), 2.6), ("fill", (math.radians(60), 0, math.radians(150)), 1.0)):
        Lg = bpy.data.lights.new(name, "SUN"); Lg.energy = en; o = bpy.data.objects.new(name, Lg); o.rotation_euler = rot; sc.collection.objects.link(o)
    cam = bpy.data.cameras.new("cam"); cam.lens = 60; co = bpy.data.objects.new("cam", cam); sc.collection.objects.link(co); sc.camera = co
    target = Vector((0, 0, 0.5 * HEIGHT))
    # the turnaround's angles: beak to the left in the three-quarter, side and top views
    views = {"front": (0, -1, 0.07), "three_quarter": (0.85, -0.52, 0.08), "side": (1, 0, 0.06), "back": (0, 1, 0.07), "top": (0, 0, 1)}
    for name, d in views.items():
        if only and name not in only: continue
        dv = Vector(d).normalized(); co.location = target + dv * 5.6
        co.rotation_euler = (target - co.location).to_track_quat("-Z", "X" if name == "top" else "Y").to_euler()
        if name == "top": co.rotation_euler = (0, 0, math.radians(90))
        sc.render.filepath = os.path.join(out_dir, f"view_{name}.png"); bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    build()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.abspath(OUT), "rubber_duck_2.blend"))
    bpy.ops.export_scene.gltf(filepath=os.path.join(os.path.abspath(OUT), "rubber_duck_2.glb"), export_format="GLB", export_yup=True)
    if "--render" in ARGS: render_views(OUT, ARGS[ARGS.index("--views") + 1].split(",") if "--views" in ARGS else None)
    print("faces:", {o.name: len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH"})
