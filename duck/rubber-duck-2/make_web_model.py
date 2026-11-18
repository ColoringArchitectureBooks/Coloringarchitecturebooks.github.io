"""Turn the saved .blend into rubber_duck_2.gltf.json for the web page (Artifacts don't serve .glb).

    python-with-bpy make_web_model.py -- OUT_DIR

Exports glTF with a separate .bin, then puts the .bin inside the .gltf as a base64 data URI.
"""
import base64, json, os, sys
import bpy

out = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
bpy.ops.wm.open_mainfile(filepath=os.path.join(out, "rubber_duck_2.blend"))
tmp = os.path.join(out, "web_tmp"); os.makedirs(tmp, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(tmp, "duck.gltf"), export_format="GLTF_SEPARATE", export_yup=True)
g = json.load(open(os.path.join(tmp, "duck.gltf")))
for buf in g["buffers"]:
    data = open(os.path.join(tmp, buf["uri"]), "rb").read()
    buf["uri"] = "data:application/octet-stream;base64," + base64.b64encode(data).decode()
json.dump(g, open(os.path.join(out, "rubber_duck_2.gltf.json"), "w"), separators=(",", ":"))
print("wrote", os.path.join(out, "rubber_duck_2.gltf.json"))
