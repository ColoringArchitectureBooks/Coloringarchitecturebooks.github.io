"""render_views.py: save the model in the current Blender scene from fixed reference angles, as PNG files.

Run it in Blender 5.0+ after build_template.py: Scripting tab > Open > render_views.py > Run Script.
It writes view_front.png, view_three_quarter.png, view_side.png, view_back.png and view_top.png into
~/duck_renders (or the folder given after "--"). Upload those PNGs, not screenshots: the cameras are fixed,
so the scores stay comparable from one round to the next.

The angles match a turnaround with the beak (front) to the LEFT in the three-quarter, side and top views.
If your reference faces the other way, change VIEWS below (flip the sign of x).
"""
import math, os, sys
import bpy
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.expanduser(ARGS[0] if ARGS else "~/duck_renders")
HEIGHT = 2.0                      # the model's height in Blender units (build_template.py uses 2.0)
VIEWS = {"front": (0, -1, 0.07), "three_quarter": (0.85, -0.52, 0.08), "side": (1, 0, 0.06),
         "back": (0, 1, 0.07), "top": (0, 0, 1)}
SAMPLES, SIZE = 48, (400, 480)


def main():
    os.makedirs(OUT, exist_ok=True)
    sc = bpy.context.scene
    for o in [o for o in sc.objects if o.name.startswith("_rv_")]: bpy.data.objects.remove(o)
    sc.render.engine = "CYCLES"; sc.cycles.samples = SAMPLES; sc.cycles.device = "CPU"
    sc.render.resolution_x, sc.render.resolution_y = SIZE; sc.render.resolution_percentage = 100
    sc.render.film_transparent = True; sc.view_settings.view_transform = "Standard"
    if sc.world is None: sc.world = bpy.data.worlds.new("_rv_world")
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get("Background")
    if bg: bg.inputs[0].default_value = (0.94, 0.94, 0.94, 1); bg.inputs[1].default_value = 0.55
    for name, rot, en in (("_rv_key", (math.radians(35), 0, math.radians(-25)), 2.6), ("_rv_fill", (math.radians(60), 0, math.radians(150)), 1.0)):
        L = bpy.data.lights.new(name, "SUN"); L.energy = en
        o = bpy.data.objects.new(name, L); o.rotation_euler = rot; sc.collection.objects.link(o)
    cam = bpy.data.cameras.new("_rv_cam"); cam.lens = 60
    co = bpy.data.objects.new("_rv_cam", cam); sc.collection.objects.link(co)
    old_cam = sc.camera; sc.camera = co
    target = Vector((0, 0, 0.5 * HEIGHT))
    for name, d in VIEWS.items():
        co.location = target + Vector(d).normalized() * 2.8 * HEIGHT
        if name == "top": co.rotation_euler = (0, 0, math.radians(90))      # front (-Y) to the left
        else: co.rotation_euler = (target - co.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = os.path.join(OUT, f"view_{name}.png"); bpy.ops.render.render(write_still=True)
    sc.camera = old_cam
    for o in [o for o in sc.objects if o.name.startswith("_rv_")]: bpy.data.objects.remove(o)
    print("saved views to", OUT)


main()
