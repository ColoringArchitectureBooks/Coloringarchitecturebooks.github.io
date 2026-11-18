"""score_parts.py: how well the rendered model matches the reference sheet, view by view and part by part.

    python score_parts.py REFERENCE.png RENDER_DIR [--order front,three_quarter,side,back/top] [--out OUT_DIR]

Runs anywhere with numpy and Pillow (ChatGPT's Code Interpreter included). RENDER_DIR holds the view_*.png
files that render_views.py saved. The reference panels are found automatically: rows of the sheet that hold
the object, then the object runs inside each row. --order names them row by row (rows split by "/"); the
default fits a turnaround with front, three-quarter, side and back on the first row and the top view first
on the second. Rows below the ones named (line drawings, close-ups) are ignored.

For every view it reports:
  outline   overlap of the whole silhouettes (%), plus width difference per height band (+ = model wider)
And for every part it can find by colour (beak = red/orange, eyes = dark, eye rings = white inside the object):
  shape     overlap of the part masks (%), both scaled by the WHOLE object's box so a misplaced part scores low
  position  how far the part's centre is off, as % of the object height (right/left, up/down)
  size      width and height difference, as % of the object height
And for the main colour (the yellow body):
  shading   how alike the light and dark inside the object are (%): highlights dropped, the light's slope
            removed, then compared; the map shows where the model is lighter (not deep enough) or darker
            (too deep or turned away) than the photo
Targets before calling a part done: shape 85%+, position within 2%, size within 3%, shading 80%+.
Small parts (eyes, rings) are judged by position and size only, since one pixel off ruins their overlap.
Overlays go to OUT_DIR (default ./scores): red = reference only, blue = model only, grey = both.
"""
import os, sys
import numpy as np
from PIL import Image

H = 300                                    # common object height in pixels


def load(path):
    im = Image.open(path).convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255)); bg.alpha_composite(im)
    return np.asarray(bg.convert("RGB")).astype(int)


def masks(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    obj = (r - b > 60) & (r > 150)                                   # yellow / orange / red object on white
    dark = (r < 70) & (g < 70) & (b < 70)
    white = (r > 225) & (g > 225) & (b > 225)
    red = obj & (g < 0.55 * r) & (r > 150)                           # beak, lips: by hue, so shaded yellow stays out
    return obj, dark, white, red


def grow(m, k):
    out = m.copy()
    for dy in range(-k, k + 1):
        for dx in range(-k, k + 1): out |= np.roll(np.roll(m, dy, 0), dx, 1)
    return out


def eye_masks(dark, white, red, solid):
    """eyes = dark pixels above the beak's top; eye rings = white pixels hugging the eyes"""
    ys = np.where(red.any(1))[0]
    top = ys.min() if len(ys) else dark.shape[0]
    eyes = dark & solid; eyes[top:] = False
    return eyes, white & solid & grow(eyes, 6) & ~eyes


def runs(v, min_len):
    out, s = [], None
    for i, x in enumerate(list(v) + [False]):
        if x and s is None: s = i
        if not x and s is not None:
            if i - s >= min_len: out.append((s, i))
            s = None
    return out


def find_panels(ref, order):
    obj = masks(ref)[0]
    rows = runs(obj.any(1), 40); names = [r.split(",") for r in order.split("/")]
    panels = {}
    for (y0, y1), row_names in zip(rows, names):
        cols = runs(obj[y0:y1].any(0), 30)
        for (x0, x1), n in zip(cols, row_names):
            if n: panels[n] = (x0, x1, y0, y1)
    return panels


def frame(rgb):
    """crop to the object's box and scale so the object is H tall; returns rgb and the object box size"""
    obj = masks(rgb)[0]
    ys, xs = np.where(obj)
    if not len(ys): return None
    # fill holes (eyes, beak inside) for the box: the box is the object's extent
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    crop = Image.fromarray(rgb[y0:y1, x0:x1].astype(np.uint8))
    w = max(1, round((x1 - x0) * H / (y1 - y0)))
    return np.asarray(crop.resize((w, H), Image.BILINEAR)).astype(int)


def canvas(a, W):
    out = np.full((H, W, 3), 255, int); x0 = (W - a.shape[1]) // 2
    out[:, max(0, x0):max(0, x0) + a.shape[1]] = a[:, :W - max(0, x0)]
    return out


def part_stats(ma, mb):
    if ma.sum() < 15 or mb.sum() < 15: return None
    iou = (ma & mb).sum() / (ma | mb).sum()
    ya, xa = np.where(ma); yb, xb = np.where(mb)
    dx = (xb.mean() - xa.mean()) / H * 100; dy = -(yb.mean() - ya.mean()) / H * 100
    dw = ((xb.max() - xb.min()) - (xa.max() - xa.min())) / H * 100
    dh = ((yb.max() - yb.min()) - (ya.max() - ya.min())) / H * 100
    return iou * 100, dx, dy, dw, dh


def shading(a, b, ma, mb):
    m = ma & mb & ~masks(a)[3] & ~masks(b)[3]                          # yellow body only, both images
    if m.sum() < 200: return None, None
    def clean(rgb):
        L = rgb.mean(2).astype(float)
        hi = np.percentile(L[m], 97); v = np.where(L > hi, np.nan, L)  # drop the glossy highlights
        ys, xs = np.where(m & ~np.isnan(v))
        A = np.c_[xs, ys, np.ones(len(xs))]; coef, *_ = np.linalg.lstsq(A, v[ys, xs], rcond=None)
        yy, xx = np.mgrid[:H, :rgb.shape[1]]
        d = v - (coef[0] * xx + coef[1] * yy + coef[2])                # remove the light's slope
        return (d - np.nanmean(d[m])) / (np.nanstd(d[m]) + 1e-6)
    da, db = clean(a), clean(b); ok = m & ~np.isnan(da) & ~np.isnan(db)
    corr = float(np.corrcoef(da[ok], db[ok])[0, 1])
    diff = np.nan_to_num(db - da); return max(0.0, corr) * 100, diff


def main(ref_path, render_dir, order="front,three_quarter,side,back/top", out_dir="scores"):
    os.makedirs(out_dir, exist_ok=True)
    ref = load(ref_path); panels = find_panels(ref, order)
    print(f"panels found: {panels}\n")
    summary = []
    for name, (x0, x1, y0, y1) in panels.items():
        p = os.path.join(render_dir, f"view_{name}.png")
        if not os.path.exists(p): print(f"{name}: no {p}, skipped"); continue
        fa, fb = frame(ref[y0:y1, x0:x1]), frame(load(p))
        if fa is None or fb is None: print(f"{name}: object not found"); continue
        W = max(fa.shape[1], fb.shape[1]) + 20; a, b = canvas(fa, W), canvas(fb, W)
        oa, da_, wa, ra = masks(a); ob, db_, wb, rb = masks(b)
        fill = lambda o, d, w: o | d | (w & np.cumsum(o, 1).astype(bool) & np.cumsum(o[:, ::-1], 1)[:, ::-1].astype(bool))
        sa, sb = fill(oa, da_, wa), fill(ob, db_, wb)                   # whole silhouette incl. eyes inside
        iou = (sa & sb).sum() / max(1, (sa | sb).sum()) * 100
        bands = [((sb[H - (k + 1) * H // 10:H - k * H // 10].any(0).sum()) - (sa[H - (k + 1) * H // 10:H - k * H // 10].any(0).sum())) / H for k in range(10)]
        print(f"== {name}: outline {iou:.1f}%   width per band, bottom to top: " + " ".join(f"{d:+.2f}" for d in bands))
        tiles = []
        ea, ra_ring = eye_masks(da_, wa, ra, sa); eb, rb_ring = eye_masks(db_, wb, rb, sb)
        for part, ma, mb in (("beak/red", ra, rb), ("eyes/dark", ea, eb), ("eye rings/white", ra_ring, rb_ring)):
            st = part_stats(ma, mb)
            if st is None: continue
            s, dx, dy, dw, dh = st
            small = ma.sum() < 0.02 * H * H                               # eyes and rings: a pixel off ruins the overlap, so
            ok = (small or s >= 85) and abs(dx) <= 2 and abs(dy) <= 2 and abs(dw) <= 3 and abs(dh) <= 3   # judge them by place and size
            print(f"   {part:16s} shape {s:5.1f}%  position {dx:+.1f}% {'right' if dx > 0 else 'left'}, {dy:+.1f}% {'up' if dy > 0 else 'down'}"
                  f"  size {dw:+.1f}% wide, {dh:+.1f}% tall  {'OK' if ok else 'FIX'}")
            summary.append((name, part, s, ok))
            t = np.full((H, W, 3), 235, np.uint8); t[ma & ~mb] = (220, 60, 50); t[mb & ~ma] = (50, 90, 220); t[ma & mb] = (150, 150, 150); tiles.append(t)
        sh, diff = shading(a, b, oa, ob)
        if sh is not None:
            print(f"   {'shading':16s} {sh:5.1f}%  {'OK' if sh >= 80 else 'FIX'}  (map: red = model lighter = not deep enough, blue = model darker)")
            v = np.clip(diff / 2, -1, 1); t = np.full((H, W, 3), 235, np.uint8); m = oa & ob
            t[m & (v > 0.3)] = (220, 60, 50); t[m & (v < -0.3)] = (50, 90, 220); t[m & (abs(v) <= 0.3)] = (200, 200, 200); tiles.append(t)
        t = np.full((H, W, 3), 235, np.uint8); t[sa & ~sb] = (220, 60, 50); t[sb & ~sa] = (50, 90, 220); t[sa & sb] = (150, 150, 150)
        tiles = [a.astype(np.uint8), b.astype(np.uint8), t] + tiles
        Image.fromarray(np.concatenate(tiles, 1)).save(os.path.join(out_dir, f"score_{name}.png"))
        summary.append((name, "outline", iou, iou >= 85))
    fixes = [f"{n} {p} ({s:.0f}%)" for n, p, s, ok in summary if not ok]
    print("\nto fix:", ", ".join(fixes) if fixes else "nothing, every checked part is within target")
    print(f"overlays saved in {out_dir}/ (reference, model, outline, then each part)")


if __name__ == "__main__":
    args = sys.argv[1:]; kw = {}
    if "--order" in args: i = args.index("--order"); kw["order"] = args[i + 1]; del args[i:i + 2]
    if "--out" in args: i = args.index("--out"); kw["out_dir"] = args[i + 1]; del args[i:i + 2]
    main(args[0], args[1], **kw)
