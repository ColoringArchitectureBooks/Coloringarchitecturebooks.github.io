"""Auto-fit: nudge the build numbers until the silhouettes stop getting closer to the reference.

    python3 fit_silhouette.py BLENDER_PYTHON REFERENCE.jpg WORK_DIR [rounds]

Coordinate search: for each number in KNOBS it tries one step up and one step down, rebuilds the duck in
Blender, renders the four side-on views and keeps the change only if the average silhouette match improves.
Steps halve after every round. The best numbers are written to WORK_DIR/best_params.json; run
build_duck.py with --params on that file to make the final model.
"""
import json, os, subprocess, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from score_silhouette import score

HERE = os.path.dirname(os.path.abspath(__file__))
VIEWS = "front,three_quarter,side,back"
# (group, key or None, start, step, low, high)
KNOBS = [("HEAD_SCALE", None, 1.05, 0.03, 0.9, 1.2), ("WING", "x", 0.335, 0.02, 0.28, 0.4),
         ("WING", "z", 0.25, 0.03, 0.15, 0.35), ("WING", "h", 0.15, 0.02, 0.1, 0.2),
         ("WING", "t", 0.09, 0.02, 0.05, 0.14), ("BEAK", "scale", 1.0, 0.08, 0.8, 1.3),
         ("TAIL", "base_w", 0.31, 0.04, 0.2, 0.42), ("TAIL", "tip_z", 0.565, 0.02, 0.5, 0.62)]


def params_of(values):
    p = {}
    for (g, k, *_), v in zip(KNOBS, values):
        if k: p.setdefault(g, {})[k] = round(v, 4)
        else: p[g] = round(v, 4)
    return p


def evaluate(bpy_python, ref, work, values):
    out = os.path.join(work, "try"); os.makedirs(out, exist_ok=True)
    pf = os.path.join(work, "params.json"); json.dump(params_of(values), open(pf, "w"))
    subprocess.run([bpy_python, os.path.join(HERE, "build_duck.py"), "--", out, "--render", "--views", VIEWS, "--params", pf],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    rows = [r for r in score(ref, out) if r[0] in VIEWS.split(",")]
    return float(np.mean([r[1] for r in rows]))


def main(bpy_python, ref, work, rounds=2):
    os.makedirs(work, exist_ok=True)
    vals = [k[2] for k in KNOBS]; steps = [k[3] for k in KNOBS]
    best = evaluate(bpy_python, ref, work, vals); print(f"start {best * 100:.1f}%", flush=True)
    for rnd in range(rounds):
        for i, (g, k, _, _, lo, hi) in enumerate(KNOBS):
            for sgn in (1, -1):
                trial = list(vals); trial[i] = min(hi, max(lo, vals[i] + sgn * steps[i]))
                if trial[i] == vals[i]: continue
                s = evaluate(bpy_python, ref, work, trial)
                if s > best + 0.001:
                    best, vals = s, trial; print(f"  {g}{'.' + k if k else ''} -> {trial[i]:.3f}: {best * 100:.1f}%", flush=True); break
        steps = [s / 2 for s in steps]
    json.dump(params_of(vals), open(os.path.join(work, "best_params.json"), "w"), indent=1)
    print(f"best {best * 100:.1f}%  {params_of(vals)}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 2)
