"""Auto-fit ONE part: nudge that part's numbers until its part score (from score_parts.py) stops improving.

    python3 fit_part.py BLENDER_PYTHON REFERENCE.png WORK_DIR [rounds]

Scores the beak (red) in the front, three-quarter and side views: shape match minus position and size errors.
Edit KNOBS / PART to fit another part. The best numbers go to WORK_DIR/best_part_params.json.
"""
import io, json, os, re, subprocess, sys, contextlib
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "chatgpt-pack"))
import numpy as np
import score_parts as sp

PART, VIEWS = "beak/red", "front,three_quarter,side"
KNOBS = [("BEAK", "cz", 0.64, 0.01), ("BEAK", "hw", 0.15, 0.01), ("BEAK", "hh_top", 0.055, 0.01), ("BEAK", "hh_bot", 0.075, 0.01),
         ("BEAK", "r_top", 0.05, 0.006), ("BEAK", "r_bot", 0.036, 0.006), ("BEAK", "lift", 0.025, 0.01),
         ("BEAK", "y_top", -0.41, 0.015), ("BEAK", "y_bot", -0.365, 0.015), ("BEAK", "y_corner", -0.30, 0.015)]


def part_score(ref, out):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf): sp.main(ref, out, out_dir=os.path.join(out, "s"))
    vals = []
    for line in buf.getvalue().splitlines():
        if line.strip().startswith(PART):
            nums = [float(x) for x in re.findall(r"[-+]?\d+\.\d+(?=%)", line)]   # shape, dx, dy, dw, dh
            vals.append(nums[0] - 2 * sum(abs(n) for n in nums[1:5]))     # shape, minus position/size errors
    return float(np.mean(vals)) if len(vals) == 3 else -1e9


def evaluate(py, ref, work, vals):
    out = os.path.join(work, "try"); os.makedirs(out, exist_ok=True); p = {}
    for (g, k, *_), v in zip(KNOBS, vals): p.setdefault(g, {})[k] = round(v, 4)
    pf = os.path.join(work, "params.json"); json.dump(p, open(pf, "w"))
    subprocess.run([py, os.path.join(HERE, "build_duck.py"), "--", out, "--render", "--views", VIEWS, "--params", pf],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return part_score(ref, out), p


def main(py, ref, work, rounds=2):
    os.makedirs(work, exist_ok=True)
    vals = [k[2] for k in KNOBS]; steps = [k[3] for k in KNOBS]
    best, bp = evaluate(py, ref, work, vals); print(f"start {best:.1f}", flush=True)
    for _ in range(rounds):
        for i in range(len(KNOBS)):
            for sgn in (1, -1):
                trial = list(vals); trial[i] += sgn * steps[i]
                s, p = evaluate(py, ref, work, trial)
                if s > best + 0.3:
                    best, vals, bp = s, trial, p; print(f"  {KNOBS[i][1]} -> {trial[i]:.3f}: {best:.1f}", flush=True)
                    json.dump(bp, open(os.path.join(work, "best_part_params.json"), "w"), indent=1); break
        steps = [s / 2 for s in steps]
    json.dump(bp, open(os.path.join(work, "best_part_params.json"), "w"), indent=1); print(f"best {best:.1f} {bp}", flush=True)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 2)
