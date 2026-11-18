"""Silhouette score: how well the Blender renders match the reference sheet, view by view.

    python3 score_silhouette.py REFERENCE.jpg RENDER_DIR [OUT.png]

For each of the reference's seven panels it cuts the object out of the reference and out of the matching
render (yellow + orange pixels against the grey background), scales both to the same height, lines up their
centres, and reports:
  - match %  (intersection over union of the two silhouettes, 100 = identical outline)
  - the width per height band (model minus reference, as a share of the height), so you can see WHERE it differs
It also writes an overlay image: reference only = red, model only = blue, both = grey.
"""
import sys
import numpy as np
from PIL import Image

# panels of duck/reference.jpg (x0, x1, y0, y1) and the render each one is compared with
PANELS = {
    "front": (22, 332, 100, 500), "three_quarter": (362, 631, 100, 500), "side": (655, 950, 100, 500),
    "back_three_quarter": (950, 1215, 100, 500), "back": (1219, 1515, 100, 500),
    "top": (322, 657, 540, 945), "high_three_quarter": (882, 1216, 540, 945),
}
H = 300   # common silhouette height in pixels


def mask(rgb):
    a = rgb.astype(int); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (r - b > 60) & (r > 150)


def normalise(m):
    ys, xs = np.where(m)
    if not len(ys): return np.zeros((H, H), bool)
    m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    w = max(1, round(m.shape[1] * H / m.shape[0]))
    im = Image.fromarray(m.astype(np.uint8) * 255).resize((w, H), Image.NEAREST)
    out = np.zeros((H, 2 * H), bool); x0 = H - w // 2
    out[:, max(0, x0):x0 + w] = np.asarray(im)[:, max(0, -x0):][:, :2 * H - max(0, x0)] > 127
    return out


def score(ref_path, render_dir, out_png=None):
    ref = np.asarray(Image.open(ref_path).convert("RGB"))
    rows, tiles = [], []
    for name, (x0, x1, y0, y1) in PANELS.items():
        try: ren = np.asarray(Image.open(f"{render_dir}/view_{name}.png").convert("RGB"))
        except FileNotFoundError: continue
        a, b = normalise(mask(ref[y0:y1, x0:x1])), normalise(mask(ren))
        iou = (a & b).sum() / max(1, (a | b).sum())
        bands = []
        for k in range(10):                                   # bottom (0) to top (9)
            sl = slice(H - (k + 1) * H // 10, H - k * H // 10)
            wa, wb = a[sl].any(0).sum(), b[sl].any(0).sum()
            bands.append((wb - wa) / H)
        rows.append((name, iou, bands))
        t = np.full((H, 2 * H, 3), 235, np.uint8); t[a & ~b] = (220, 60, 50); t[b & ~a] = (50, 90, 220); t[a & b] = (150, 150, 150)
        tiles.append(t)
    print(f"{'view':20s} match  width difference per band, bottom -> top (+ = model wider)")
    for name, iou, bands in rows:
        print(f"{name:20s} {iou * 100:5.1f}%  " + " ".join(f"{d:+.2f}" for d in bands))
    print(f"{'average':20s} {np.mean([r[1] for r in rows]) * 100:5.1f}%")
    if out_png and tiles:
        Image.fromarray(np.concatenate(tiles, 1)).save(out_png)
    return rows


if __name__ == "__main__":
    score(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
