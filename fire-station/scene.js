// Fire station model (layout v6: rectangular corner plot, Airway Blvd in front, side street on the right).
// Black & white like the coloring page: every face white, black outlines, brick drawn as line art.
// Plan coords in metres: x along the front (0 = left edge of the striped apron), y depth (0 = hall front, negative = street), z up.
// Three.js is y-up, so a plan point (x, y, z) maps to (x, z, -y).
import * as THREE from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

export const V = (x, y, z) => new THREE.Vector3(x, z, -y);

// ---------- dimensions ----------
export const D = {
  hall: { x0: 0, x1: 25, h: 10.0, open: 12 },                     // 4 bays between the side towers; the bays are open 12 m deep
  tower: { h: 8.6, w: 5, y0: -0.6, y1: 29 },                     // brick side towers with the tall windows
  bays: [1.4, 7.3, 13.2, 19.1].map(x => [x, x + 4.5]),   // 5 equal piers of 1.4 m (page), the outer two included           // door openings, 4.5 m, piers 1.6 m
  door: { h: 5.5, glass: 6.1, spring: 6.5, top: 7.8 },                       // door head, arch spring, arch crown
  gable: { x0: 4.6, x1: 20.4, z0: 10.9, peak: 14.6, depth: 29 },   // centre raised above the shoulders (page)
  sign: { x0: 7.25, x1: 17.75, z0: 9.05, z1: 10.3 },              // FIRE STATION board, centred on the gable (page)
  low: { x0: 30, x1: 49, y0: 0.5, y1: 12, h: 5.5 },              // low flat wing in front
  wingA: { x0: 26, x1: 40, y0: 20.5, y1: 48 },                   // gabled L wing, arm running back (ridge along y)
  wingB: { x0: 30, x1: 62, y0: 12, y1: 29 },                     // arm running right (ridge along x)
  eave: 5.5, pitch: 0.45,
  entry: { x0: 49, x1: 55.5, y0: 5.5, y1: 12, h: 9.5, roof: 2.6 },
  garage: { x0: -11, x1: 4, y0: 66, y1: 88, h: 5.2 },
  plot: { x0: -20, x1: 112, y0: -27, y1: 104 },
};
const BASE = 1.0;   // stone base under the brick (photos)

// ---------- textures + materials ----------
const M = {};
function brickTexture() {   // 4 m wide x 16 m high tile: stone base 0..1 m, brick above (rows 0.3 m, bricks 0.9 m)
  const pm = 64, w = 4 * pm, h = 16 * pm, c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.strokeStyle = "#000"; g.lineWidth = 1.2;
  const Y = z => h - z * pm, row = 0.3, len = 0.9;
  for (let r = 0, z = BASE; z < 15; r++, z += row) {
    g.beginPath(); g.moveTo(0, Y(z)); g.lineTo(w, Y(z)); g.stroke();
    for (let x = (r % 2) * len / 2; x < 4; x += len) { g.beginPath(); g.moveTo(x * pm, Y(z)); g.lineTo(x * pm, Y(z + row)); g.stroke(); }
  }
  g.lineWidth = 2; g.beginPath(); g.moveTo(0, Y(BASE)); g.lineTo(w, Y(BASE)); g.stroke();         // top of the stone base
  g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, Y(0.5)); g.lineTo(w, Y(0.5)); g.stroke();
  for (const [z, o] of [[0, 0], [0.5, 0.6]]) for (let x = o; x < 4; x += 1.2) { g.beginPath(); g.moveTo(x * pm, Y(z)); g.lineTo(x * pm, Y(z + 0.5)); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 8; t.repeat.set(1 / 4, 1 / 16); return t;
}
function mats() {
  const L = (o) => new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, color: 0xffffff, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...o });
  M.white = L({}); M.roof = L({}); M.ground = L({}); M.brick = L({ map: brickTexture() });
  M.line = new THREE.LineBasicMaterial({ color: 0x000000 });
}
// brick UVs in world metres: u along the wall, v = height (so courses line up all round the building)
function brickUV(root) {
  root.updateMatrixWorld(true);
  const p = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
  root.traverse(o => {
    if (!o.isMesh || o.material !== M.brick) return;
    const g = o.geometry, pos = g.attributes.position; if (!g.attributes.normal) g.computeVertexNormals();
    const nor = g.attributes.normal, uv = g.attributes.uv || new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
    nm.getNormalMatrix(o.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      if (Math.abs(n.y) > 0.5) uv.setXY(i, 0.5, 15.7);                       // tops/bottoms: plain
      else uv.setXY(i, Math.abs(n.x) > Math.abs(n.z) ? p.z : p.x, p.y);
    }
    g.setAttribute("uv", uv); uv.needsUpdate = true;
  });
}

// ---------- helpers ----------
function box(root, x0, x1, y0, y1, z0, z1, mat = M.white) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, z1 - z0, y1 - y0), mat);
  m.position.copy(V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); root.add(m); return m;
}
function flat(root, pts, z, mat = M.ground) {
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)))); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.position.y = z; root.add(m); return m;
}
function slab(root, pts, z0, z1, mat = M.white) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: z1 - z0, bevelEnabled: false, curveSegments: 32 });
  g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, mat); m.position.y = z0; root.add(m); return m;
}
// elevation shape (x, z) extruded in plan y from y0 to y1 (front face at y0)
function elevShape(root, shape, y0, y1, mat = M.white, seg = 24) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false, curveSegments: seg });
  const m = new THREE.Mesh(g, mat); m.position.z = -y1; root.add(m); return m;
}
const shapeOf = (pts) => new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
const elev = (root, pts, y0, y1, mat) => elevShape(root, shapeOf(pts), y0, y1, mat);
// side shape (y, z) extruded in plan x from x0 to x1
function side(root, pts, x0, x1, mat = M.white) {
  const g = new THREE.ExtrudeGeometry(shapeOf(pts), { depth: x1 - x0, bevelEnabled: false });
  g.rotateY(Math.PI / 2); const m = new THREE.Mesh(g, mat); m.position.x = x0; root.add(m); return m;
}
function lines(root, segs) {     // segs: [[x,y,z],[x,y,z]] pairs
  const pts = []; for (const [a, b] of segs) pts.push(V(...a), V(...b));
  root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), M.line));
}
function cyl(root, x, y, z0, h, r, seg = 16, mat = M.white) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); m.position.copy(V(x, y, z0 + h / 2)); root.add(m); return m;
}
function gableRoof(root, x0, x1, y0, y1, z, r, along, mat = M.roof) {
  if (along === "x") side(root, [[y0, z], [y1, z], [(y0 + y1) / 2, z + r]], x0, x1, mat);
  else elev(root, [[x0, z], [x1, z], [(x0 + x1) / 2, z + r]], y0, y1, mat);
}
// a gabled block: walls and gable triangles are one brick extrusion (no seam at the eave), the roof is one folded strip with overhangs
function house(root, x0, x1, y0, y1, e, pitch, along, emblems = [], ends = [0.35, 0.35]) {   // ends: roof overhang at each gable end (0 where it dies into a wall)
  const o = 0.5, t = 0.3, [e0, e1] = ends;
  const [a0, a1, b0, b1] = along === "y" ? [x0, x1, y0, y1] : [y0, y1, x0, x1];
  const mid = (a0 + a1) / 2, r = (a1 - a0) / 2 * pitch, k = pitch;
  const body = [[a0, 0], [a1, 0], [a1, e], [mid, e + r], [a0, e]];
  const roof = [[a0 - o, e - o * k], [mid, e + r], [a1 + o, e - o * k], [a1 + o, e - o * k + t], [mid, e + r + t], [a0 - o, e - o * k + t]];
  if (along === "y") { elev(root, body, y0, y1, M.brick); elev(root, roof, y0 - e0, y1 + e1, M.roof); }
  else { side(root, body, x0, x1, M.brick); side(root, roof, x0 - e0, x1 + e1, M.roof); }
  const size = Math.min(r * 0.8, 2.0), ez = e + r * 0.38;
  for (const f of emblems) {
    if (f === "+x" || f === "-x") emblem(root, f === "+x" ? x1 + 0.05 : x0 - 0.05, mid, ez, size, f);
    else emblem(root, mid, f === "+y" ? y1 + 0.05 : y0 - 0.05, ez, size, f);
  }
}
// a point on a wall face: face '-y' (front, wall plane y = at), '+y' (back), '-x' (west, plane x = at), '+x' (east); a = along, z = up
function F(face, at, a, z, out = 0) {
  if (face === "-y") return [a, at - out, z]; if (face === "+y") return [a, at + out, z];
  if (face === "-x") return [at - out, a, z]; return [at + out, a, z];
}
// window/door: a real frame (thin boxes standing proud of the wall), white glass behind, mullions as lines, a sill
function opening(root, face, at, a0, a1, z0, z1, cols = 2, rows = 2, sill = true) {
  const fr = 0.1, out = 0.08, P = (a, z, o = out) => F(face, at, a, z, o);
  const bx = (a, b, za, zb, o0, o1) => { const p = P(a, za, o0), q = P(b, zb, o1);
    box(root, Math.min(p[0], q[0]), Math.max(p[0], q[0]) + (p[0] === q[0] ? 0.001 : 0), Math.min(p[1], q[1]), Math.max(p[1], q[1]) + (p[1] === q[1] ? 0.001 : 0), za, zb); };
  bx(a0 + fr, a1 - fr, z0 + fr, z1 - fr, 0, 0.05);   // glass: a plain pane over the wall, so no brick shows through
  bx(a0, a1, z1 - fr, z1, 0, out); bx(a0, a1, z0, z0 + fr, 0, out); bx(a0, a0 + fr, z0, z1, 0, out); bx(a1 - fr, a1, z0, z1, 0, out);
  const s = [];
  for (let i = 1; i < cols; i++) { const a = a0 + (a1 - a0) * i / cols; s.push([P(a, z0 + fr, 0.07), P(a, z1 - fr, 0.07)]); }
  for (let j = 1; j < rows; j++) { const z = z0 + (z1 - z0) * j / rows; s.push([P(a0 + fr, z, 0.07), P(a1 - fr, z, 0.07)]); }
  lines(root, s);
  if (sill) bx(a0 - 0.15, a1 + 0.15, z0 - 0.15, z0, 0, 0.18);
}
// a row of windows along a wall
function windowRow(root, face, at, a0, a1, n, w, z0, z1, cols = 2, rows = 2) {
  const gap = (a1 - a0 - n * w) / (n + 1);
  for (let i = 0; i < n; i++) { const a = a0 + gap + i * (w + gap); opening(root, face, at, a, a + w, z0, z1, cols, rows); }
}

// ---------- emblem (the page's Maltese cross with a flame), real 3D, facing -y; or turned to face +x ----------
function emblem(root, x, y, z, size, face = "-y") {
  const g = new THREE.Group(), r = size / 2;
  const arm = (k) => { const pts = [[-0.11, 0.13], [-0.52, 0.97], [0, 0.74], [0.52, 0.97], [0.11, 0.13]]   // Maltese cross arm: narrow at the centre, flared, V-notch at the tip;
    const c = Math.cos(-k * Math.PI / 2), s = Math.sin(-k * Math.PI / 2); return pts.map(([u, v]) => [(u * c - v * s) * r, (u * s + v * c) * r]); };
  const cross = new THREE.Shape(); const all = [];
  for (let k = 0; k < 4; k++) all.push(...arm(k));
  cross.moveTo(...all[0]); for (const p of all.slice(1)) cross.lineTo(...p);
  const ext = (shape, d, z0) => { const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 32 }), M.white); m.position.z = z0; g.add(m); };
  ext(cross, 0.12, 0);
  const disc = new THREE.Shape(); disc.absarc(0, 0, 0.42 * r, 0, Math.PI * 2); ext(disc, 0.08, 0.12);
  const ring = new THREE.Shape(); ring.absarc(0, 0, 0.32 * r, 0, Math.PI * 2); ext(ring, 0.03, 0.2);
  const fl = new THREE.Shape(), q = 0.26 * r;                         // flame
  fl.moveTo(0, -0.75 * q); fl.bezierCurveTo(0.75 * q, -0.75 * q, 0.7 * q, 0.1 * q, 0.15 * q, 0.95 * q);
  fl.bezierCurveTo(0.2 * q, 0.35 * q, -0.15 * q, 0.2 * q, -0.2 * q, 0.5 * q); fl.bezierCurveTo(-0.6 * q, 0.1 * q, -0.7 * q, -0.75 * q, 0, -0.75 * q);
  ext(fl, 0.05, 0.23);
  g.rotation.y = { "-y": 0, "+x": Math.PI / 2, "+y": Math.PI, "-x": -Math.PI / 2 }[face === true ? "+x" : face];                           // the shapes face +z (three) = -y (plan)
  g.position.copy(V(x, y, z)); root.add(g); return g;
}

// ---------- FIRE STATION sign: board with border and dots, raised 3D letters (font loads async) ----------
function sign(root, font) {
  const S = D.sign, cx = (S.x0 + S.x1) / 2, cz = (S.z0 + S.z1) / 2, w = S.x1 - S.x0, h = S.z1 - S.z0;
  const rr = (w2, h2, r) => { const s = new THREE.Shape(); s.moveTo(-w2 + r, -h2); s.lineTo(w2 - r, -h2); s.quadraticCurveTo(w2, -h2, w2, -h2 + r); s.lineTo(w2, h2 - r);
    s.quadraticCurveTo(w2, h2, w2 - r, h2); s.lineTo(-w2 + r, h2); s.quadraticCurveTo(-w2, h2, -w2, h2 - r); s.lineTo(-w2, -h2 + r); s.quadraticCurveTo(-w2, -h2, -w2 + r, -h2); return s; };
  const g = new THREE.Group(); g.position.copy(V(cx, 0, cz)); root.add(g);
  const add = (geo, z) => { const m = new THREE.Mesh(geo, M.white); m.position.z = z; g.add(m); return m; };
  add(new THREE.ExtrudeGeometry(rr(w / 2, h / 2, 0.25), { depth: 0.14, bevelEnabled: false, curveSegments: 8 }), 0);
  add(new THREE.ExtrudeGeometry(rr(w / 2 - 0.16, h / 2 - 0.16, 0.16), { depth: 0.04, bevelEnabled: false, curveSegments: 8 }), 0.14);
  for (const s of [-1, 1]) { const d = add(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 20), 0.22); d.rotation.x = Math.PI / 2; d.position.x = s * (w / 2 - 0.55); }
  if (!font) return;
  const tg = new TextGeometry("FIRE STATION", { font, size: 0.72, height: 0.08, curveSegments: 6 });
  tg.computeBoundingBox(); const bb = tg.boundingBox; tg.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, 0);
  add(tg, 0.18);
}

// ---------- the truck hall ----------
function hall(root) {
  const H = D.hall, T = D.tower, dr = D.door, G = D.gable;
  // front wall of the bay section: one piece, the 4 arched openings notched in from the ground, the gable on top
  const pts = [[H.x0, 0]], arch = [];
  for (const [a, b] of D.bays) {
    const cx = (a + b) / 2, half = (b - a) / 2, rise = dr.top - dr.spring, R = (half * half + rise * rise) / (2 * rise), zc = dr.top - R;
    const t0 = Math.atan2(dr.spring - zc, half), A = [];
    for (let k = 0; k <= 16; k++) { const t = Math.PI - t0 - (Math.PI - 2 * t0) * k / 16; A.push([cx + R * Math.cos(t), zc + R * Math.sin(t)]); }
    pts.push([a, 0], ...A, [b, 0]); arch.push({ a, b, cx, R, zc, t0, A });
  }
  pts.push([H.x1, 0], [H.x1, H.h], [G.x1, H.h], [G.x1, G.z0], [(G.x0 + G.x1) / 2, G.peak], [G.x0, G.z0], [G.x0, H.h], [H.x0, H.h]);
  elev(root, pts, 0, 0.4, M.brick);
  // hall body: open bays in front (ceiling at the door head), solid behind; one L-shaped profile so no seams outside
  side(root, [[0.4, dr.h], [H.open, dr.h], [H.open, 0], [T.y1 - 0.4, 0], [T.y1 - 0.4, H.h], [0.4, H.h]], H.x0, H.x1, M.brick);
  // arched brick surround with keystone (page), transom glass with its grid, rolled-up door under it
  for (const { a, b, cx, R, zc, t0, A } of arch) {
    const outer = [], R2 = R + 0.7;
    for (let k = 0; k <= 16; k++) { const t = t0 + (Math.PI - 2 * t0) * k / 16; outer.push([cx + R2 * Math.cos(t), zc + R2 * Math.sin(t)]); }
    elev(root, [...A, ...outer], -0.22, 0.05, M.white);   // archivolt: both ends cut on a line through the arch's centre (radial)
    elev(root, [[cx - 0.32, dr.top - 0.1], [cx + 0.32, dr.top - 0.1], [cx + 0.4, dr.top + 0.4], [cx - 0.4, dr.top + 0.4]], -0.3, 0.05, M.white);   // keystone
    // like the page: a short arched glass band (4 x 2 panes) on top, a plain header panel under it, the open bay below
    elev(root, [[a, dr.glass], [b, dr.glass], ...A.slice().reverse()], 0.2, 0.28, M.white);                  // glass
    elev(root, [[a, dr.h], [b, dr.h], [b, dr.glass], [a, dr.glass]], 0.08, 0.3, M.white);                   // header panel
    for (let k = 1; k < 4; k++) { const x = a + (b - a) * k / 4, zt = zc + Math.sqrt(Math.max(R * R - (x - cx) ** 2, 0)); box(root, x - 0.07, x + 0.07, 0.08, 0.2, dr.glass, zt); }
    box(root, a, b, 0.06, 0.2, dr.glass, dr.glass + 0.14);   // glass sill bar
    { const z = (dr.glass + dr.top) / 2, hw = Math.sqrt(R * R - (z - zc) ** 2); box(root, cx - hw, cx + hw, 0.08, 0.2, z - 0.07, z + 0.07); }
    box(root, a, b, 0.25, 0.75, dr.h - 0.35, dr.h);                     // rolled-up door at the head
    box(root, cx - 0.35, cx + 0.35, 2, 2.8, dr.h - 0.12, dr.h);          // ceiling light (page)
  }
  // one cornice right across the top of the wall; the gable wall, its rake trim and the roof all share one slope, so nothing floats
  // like the page: the centre under the pediment is raised; the shoulders either side get their own cornice a step lower
  for (const [a, b] of [[H.x0, G.x0], [G.x1, H.x1]]) {     // shoulder cornice like the page: deep fascia + a thin cap slab that projects further
    box(root, a - 0.15, b, -0.3, 0.4, H.h - 0.6, H.h - 0.12);
    box(root, a - 0.35, b, -0.5, 0.4, H.h - 0.12, H.h + 0.1);
  }
  { const k = (G.peak - G.z0) / ((G.x1 - G.x0) / 2), o = 0.35, t = 0.4, mid = (G.x0 + G.x1) / 2, zl = G.z0 - o * k;
    elev(root, [[G.x0 - o, zl], [mid, G.peak], [G.x1 + o, zl], [G.x1 + o, zl + t], [mid, G.peak + t], [G.x0 - o, zl + t]], -0.4, G.depth + 0.3, M.roof);   // roof + rake in one piece
    elev(root, [[G.x0, H.h], [G.x1, H.h], [G.x1, G.z0], [mid, G.peak], [G.x0, G.z0]], 0.4, G.depth - 0.4, M.brick);
    // the whole back (towers + hall + gable) is one wall, so there are no seams across it
    const tw = D.tower.w, th = D.tower.h;
    elev(root, [[H.x0 - tw, 0], [H.x1 + tw, 0], [H.x1 + tw, th], [H.x1, th], [H.x1, H.h], [G.x1, H.h], [G.x1, G.z0], [mid, G.peak], [G.x0, G.z0], [G.x0, H.h], [H.x0, H.h], [H.x0, th], [H.x0 - tw, th]], G.depth - 0.4, G.depth, M.brick); }
  emblem(root, (G.x0 + G.x1) / 2, -0.02, 12.3, 2.3);
  // side towers: tall window on the front (page: 3 x 4 panes), cap, windows on the outer sides
  for (const [x0, x1, outer] of [[H.x0 - T.w, H.x0, "-x"], [H.x1, H.x1 + T.w, null]]) {
    box(root, x0, x1, T.y0, T.y1 - 0.4, 0, T.h, M.brick);
    box(root, x0 - 0.25, x1 + 0.25, T.y0 - 0.3, T.y0 + 0.8, T.h - 0.4, T.h + 0.15);
    box(root, x0 - 0.12, x1 + 0.12, T.y0 - 0.15, T.y0 + 0.5, T.h - 0.75, T.h - 0.4);
    opening(root, "-y", T.y0, x0 + 0.95, x1 - 0.95, 1.5, 7.0, 3, 5); box(root, x0 + 0.6, x1 - 0.6, T.y0 - 0.3, T.y0, 7.1, 7.65);   // page: 3 x 5 panes with a head above
    if (outer) windowRow(root, "-x", x0, 2, T.y1 - 2, 6, 1.6, 1.4, 4.2);
  }
  // back of the hall: 4 doors to the back yard (drive-through), small windows high up
  for (const [a, b] of D.bays) { opening(root, "+y", T.y1, a, b, 0, dr.h, 4, 4, false); }
  // lamps: arm + bell shade between and beside the bays (page)
  const piers = [D.bays[0][0] / 2, ...D.bays.slice(1).map((b, i) => (D.bays[i][1] + b[0]) / 2), (D.bays[3][1] + D.hall.x1) / 2];
  for (const x of piers) {                             // a lamp in the middle of every pier, the outer ones too (page)
    box(root, x - 0.06, x + 0.06, -0.65, 0, 5.9, 6.02);
    box(root, x - 0.2, x + 0.2, -0.05, 0, 5.6, 6.3);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.4, 0.4, 20, 1, true), M.white); shade.position.copy(V(x, -0.65, 5.65)); root.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), M.white); bulb.position.copy(V(x, -0.65, 5.45)); root.add(bulb);
  }
}

// ---------- fire trucks in the bays (page): engine, ladder truck, engine, ambulance ----------
function wheel(root, x, y) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 24), M.white); w.rotation.z = Math.PI / 2; w.position.copy(V(x, y, 0.56)); root.add(w);   // tyres touch the hall floor (top 0.06)
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.38, 16), M.white); h.rotation.z = Math.PI / 2; h.position.copy(V(x, y, 0.56)); root.add(h); }
function truck(root, cx, y0, kind) {
  const amb = kind === "ambulance", hw = amb ? 1.12 : 1.22, top = amb ? 3.2 : 3.0;
  if (amb) {
    box(root, cx - hw, cx + hw, y0 + 0.9, y0 + 2.4, 0.45, 2.6);                  // cab
    box(root, cx - hw, cx + hw, y0, y0 + 0.9, 0.45, 1.4);                        // bonnet
    box(root, cx - hw - 0.05, cx + hw + 0.05, y0 + 2.4, y0 + 7.2, 0.45, top);    // box body
    opening(root, "-y", y0 + 0.9, cx - hw + 0.15, cx + hw - 0.15, 1.6, 2.45, 2, 1, false);
    box(root, cx - 0.9, cx + 0.9, y0 + 2.3, y0 + 2.4, 2.65, 2.85);               // light bar
    for (const s of [-1, 1]) lines(root, [[[cx + s * (hw + 0.06), y0 + 3, 1.2], [cx + s * (hw + 0.06), y0 + 6.6, 1.2]], [[cx + s * (hw + 0.06), y0 + 3, 2.6], [cx + s * (hw + 0.06), y0 + 6.6, 2.6]]]);
    box(root, cx - 0.5, cx + 0.5, y0 + 2.39, y0 + 2.41, 2.75, 3.1);              // cross panel above the cab
  } else {
    box(root, cx - hw, cx + hw, y0, y0 + 2.6, 0.45, top);                        // cab
    box(root, cx - hw, cx + hw, y0 + 2.6, y0 + 9, 0.45, top - 0.1);              // body
    opening(root, "-y", y0, cx - hw + 0.15, cx + hw - 0.15, 1.75, 2.75, 2, 1, false);   // windscreen
    box(root, cx - 0.6, cx + 0.6, y0 - 0.06, y0, 0.75, 1.55);                     // grille
    lines(root, [0.95, 1.15, 1.35].map(z => [[cx - 0.5, y0 - 0.07, z], [cx + 0.5, y0 - 0.07, z]]));
    box(root, cx - 0.9, cx + 0.9, y0 + 0.3, y0 + 1.2, top, top + 0.22);          // light bar
    for (const s of [-1, 1]) {
      lines(root, [2.6, 4.3, 6.0, 7.7].map(y => [[cx + s * (hw + 0.01), y0 + y, 0.9], [cx + s * (hw + 0.01), y0 + y, 2.6]]));   // locker doors
      lines(root, [[[cx + s * (hw + 0.01), y0 + 2.6, 2.6], [cx + s * (hw + 0.01), y0 + 9, 2.6]], [[cx + s * (hw + 0.01), y0 + 2.6, 0.9], [cx + s * (hw + 0.01), y0 + 9, 0.9]]]);
      opening(root, s < 0 ? "-x" : "+x", cx + s * hw, y0 + 0.5, y0 + 2.1, 1.75, 2.7, 1, 1, false);   // cab side window
    }
    if (kind === "ladder") {
      for (const s of [-1, 1]) box(root, cx + s * 0.55 - 0.06, cx + s * 0.55 + 0.06, y0 - 0.6, y0 + 8.6, top + 0.15, top + 0.4);
      const r = []; for (let y = y0 - 0.4; y < y0 + 8.6; y += 0.5) r.push([[cx - 0.55, y, top + 0.3], [cx + 0.55, y, top + 0.3]]); lines(root, r);
      box(root, cx - 0.3, cx + 0.3, y0 + 7.6, y0 + 8.4, top - 0.1, top + 0.15);
    }
  }
  box(root, cx - hw - 0.08, cx + hw + 0.08, y0 - 0.3, y0 + 0.02, 0.45, 0.8);   // bumper
  for (const s of [-1, 1]) { box(root, cx + s * 0.85 - 0.18, cx + s * 0.85 + 0.18, y0 - 0.05, y0, 1.0, 1.3); }   // headlights
  const axles = amb ? [y0 + 1.4, y0 + 5.8] : [y0 + 1.5, y0 + 6.4, y0 + 7.6];
  for (const y of axles) for (const s of [-1, 1]) wheel(root, cx + s * (hw - 0.15), y);
}

// ---------- wings ----------
function wings(root) {
  const L = D.low, A = D.wingA, B = D.wingB, e = D.eave, p = D.pitch;
  // low flat wing in front: windows on the street side (photo: a long row), cap
  box(root, L.x0, L.x1, L.y0, L.y1, 0, L.h, M.brick);
  box(root, L.x0, L.x1 + 0.2, L.y0 - 0.25, L.y1, L.h - 0.35, L.h + 0.15);
  windowRow(root, "-y", L.y0, L.x0, L.x1, 6, 1.8, 1.3, 3.9, 2, 2);
  // gabled L wing: brick walls, eaves, ridges running through and meeting
  house(root, A.x0, A.x1, A.y0, A.y1, e, p, "y", ["+y"]);
  house(root, B.x0, B.x1, B.y0, B.y1, e, p, "x", ["+x"], [0, 0.35]);   // west gable closed flush against the side tower
  windowRow(root, "-y", B.y0, D.entry.x1 + 0.5, B.x1, 3, 1.6, 1.3, 4.3, 1, 2);       // south face (photo: tall windows)
  windowRow(root, "+x", B.x1, B.y0, B.y1, 3, 1.6, 1.3, 4.3, 1, 2);                   // east end
  windowRow(root, "+y", B.y1, A.x1, 49.5, 2, 1.6, 1.3, 3.9, 2, 2); windowRow(root, "+y", B.y1, 52.5, B.x1, 3, 1.6, 1.3, 3.9, 2, 2);   // garden side
  opening(root, "+y", B.y1, 50.0, 52.0, 0, 2.9, 2, 2, false); box(root, 49.4, 52.6, B.y1, B.y1 + 1.4, 3.2, 3.45);   // garden door with transom + canopy, between the windows
  windowRow(root, "+x", A.x1, 29, A.y1, 4, 1.6, 1.3, 3.9, 2, 2);                      // A east (garden)
  windowRow(root, "-x", A.x0, 29, A.y1, 4, 1.6, 1.3, 3.9, 2, 2);                      // A west (back yard)
  opening(root, "+y", A.y1, 31.8, 34.2, 0, 2.9, 2, 2, false); box(root, 31.2, 34.8, A.y1, A.y1 + 1.4, 3.2, 3.45);   // door with transom + small canopy
  windowRow(root, "+y", A.y1, A.x0, 31.5, 1, 1.6, 1.3, 3.9); windowRow(root, "+y", A.y1, 34.5, A.x1, 1, 1.6, 1.3, 3.9);
  // entrance tower: stone base, arched panel with the emblem on the front and east faces, hip roof, glass door + canopy facing the plaza
  const T = D.entry, cx = (T.x0 + T.x1) / 2, cy = (T.y0 + T.y1) / 2, w = T.x1 - T.x0;
  box(root, T.x0, T.x1, T.y0, T.y1, 0, T.h, M.brick);
  box(root, T.x0 - 0.35, T.x1 + 0.35, T.y0 - 0.35, T.y1 + 0.35, T.h - 0.35, T.h);
  const hip = new THREE.Mesh(new THREE.ConeGeometry((w + 1.2) / Math.SQRT2, T.roof, 4), M.roof); hip.rotation.y = Math.PI / 4; hip.position.copy(V(cx, cy, T.h + T.roof / 2)); root.add(hip);
  const panel = (face) => {      // recessed arched panel, stone arch round it
    const a0 = (face === "-y" ? cx : cy) - 1.5, a1 = a0 + 3.0, z0 = 4.7, zs = 6.9, R = 1.5, ac = a0 + 1.5;
    const sh = []; sh.push([a0, z0], [a1, z0]); for (let k = 0; k <= 16; k++) { const t = Math.PI * k / 16; sh.push([ac + R * Math.cos(t), zs + R * Math.sin(t)]); }
    if (face === "-y") elev(root, sh, T.y0 - 0.05, T.y0); else side(root, sh, T.x1, T.x1 + 0.05);   // plain stone panel
    const band = [[a0 - 0.4, z0]]; for (let k = 0; k <= 16; k++) { const t = Math.PI * k / 16; band.push([ac - (R + 0.4) * Math.cos(t), zs + (R + 0.4) * Math.sin(t)]); }
    band.push([a1 + 0.4, z0], [a1, z0]); for (let k = 0; k <= 16; k++) { const t = Math.PI * k / 16; band.push([ac + R * Math.cos(t), zs + R * Math.sin(t)]); }
    if (face === "-y") elev(root, band, T.y0 - 0.18, T.y0); else side(root, band, T.x1, T.x1 + 0.18);   // raised stone archivolt framing the panel, standing proud of the wall
  };
  panel("-y"); panel("+x");
  emblem(root, cx, T.y0 - 0.06, 6.55, 2.1); emblem(root, T.x1 + 0.06, cy, 6.55, 2.1, true);
  opening(root, "-y", T.y0, cx - 1.6, cx + 1.6, 1.3, 4.3, 3, 2);                       // big window on the front (photo)
  opening(root, "+x", T.x1, cy - 1.4, cy + 1.4, 0, 3.0, 2, 1, false);                  // glass doors
  opening(root, "+x", T.x1, cy - 2.6, cy - 1.55, 0, 3.0, 1, 2, false); opening(root, "+x", T.x1, cy + 1.55, cy + 2.6, 0, 3.0, 1, 2, false);
  box(root, T.x1, T.x1 + 3.0, T.y0 - 0.3, T.y1 + 0.3, 3.4, 3.7);                        // canopy
  for (const y of [T.y0 + 0.4, T.y1 - 0.4]) {      // tie rods from the wall down to the canopy's outer edge, with wall plates
    box(root, T.x1, T.x1 + 0.06, y - 0.15, y + 0.15, 5.0, 5.4);
    const a = V(T.x1 + 0.06, y, 5.2), b = V(T.x1 + 2.8, y, 3.7), rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, a.distanceTo(b), 8), M.white);
    rod.position.copy(a).add(b).multiplyScalar(0.5); rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); root.add(rod);
  }
  opening(root, "+y", T.y1, cx - 0.9, cx + 0.9, 1.3, 3.9);
}

function garage(root) {
  const G = D.garage, mid = (G.x0 + G.x1) / 2, r = 2.4;
  house(root, G.x0, G.x1, G.y0, G.y1, G.h, r / ((G.x1 - G.x0) / 2), "y", ["-y", "+y"]);
  for (const y of [68.5, 75, 81.5]) opening(root, "+x", G.x1, y, y + 4.5, 0, 4.0, 1, 5, false);     // 3 garage doors on the yard side
  windowRow(root, "-x", G.x0, G.y0, G.y1, 4, 1.4, 1.4, 4.0, 1, 2);
  // front end (faces the hall): centred door with transom and canopy, a tall window either side
  opening(root, "-y", G.y0, mid - 0.8, mid + 0.8, 0, 2.9, 2, 2, false); box(root, mid - 1.3, mid + 1.3, G.y0 - 1.2, G.y0, 3.15, 3.4);
  for (const a of [G.x0 + 1.6, G.x1 - 4.8, G.x1 - 3.0]) opening(root, "-y", G.y0, a, a + 1.4, 1.4, 4.0, 1, 2);
  for (const a of [G.x0 + 1.6, mid - 0.7, G.x1 - 3.0]) opening(root, "+y", G.y1, a, a + 1.4, 1.4, 4.0, 1, 2);
}

// ---------- site ----------
const SITE = {"walk":[{"o":[[0.0,29.0],[-5.0,29.0],[-5.0,-0.6],[0.0,-0.6],[0.0,-1.6],[-6.0,-1.6],[-6.0,30.0],[0.0,30.0]],"h":[]},{"o":[[41.0,49.0],[41.0,30.0],[63.0,30.0],[63.0,11.082],[63.224,11.345],[63.471,11.586],[63.739,11.804],[64.026,11.997],[64.33,12.163],[64.647,12.301],[64.975,12.409],[65.312,12.487],[65.655,12.534],[66.0,12.55],[66.345,12.534],[66.688,12.487],[67.025,12.409],[67.353,12.301],[67.67,12.163],[67.974,11.997],[68.261,11.804],[68.529,11.586],[68.776,11.345],[69.001,11.082],[69.2,10.799],[69.373,10.5],[72.5,10.5],[72.5,62.0],[26.0,62.0],[26.0,65.0],[72.5,65.0],[72.5,90.0],[76.0,90.0],[76.0,10.5],[112.0,10.5],[112.0,7.0],[69.373,7.0],[69.2,6.701],[69.001,6.418],[68.776,6.155],[68.529,5.914],[68.261,5.696],[67.974,5.503],[67.67,5.337],[67.353,5.199],[67.025,5.091],[66.688,5.013],[66.345,4.966],[66.0,4.95],[65.655,4.966],[65.312,5.013],[64.975,5.091],[64.647,5.199],[64.33,5.337],[64.026,5.503],[63.739,5.696],[63.471,5.914],[63.224,6.155],[62.999,6.418],[62.8,6.701],[62.627,7.0],[56.5,7.0],[56.5,4.5],[50.0,4.5],[50.0,-0.5],[31.0,-0.5],[31.0,-1.6],[25.0,-1.6],[25.0,-0.6],[30.0,-0.6],[30.0,0.5],[49.0,0.5],[49.0,5.5],[55.5,5.5],[55.5,12.0],[62.0,12.0],[62.0,29.0],[40.0,29.0],[40.0,48.0],[26.0,48.0],[26.0,29.0],[25.0,29.0],[25.0,49.0]],"h":[[[56.5,11.0],[56.5,10.5],[62.627,10.5],[62.8,10.799],[62.942,11.0]]]},{"o":[[5.0,89.0],[5.0,86.5],[4.0,86.5],[4.0,88.0],[-11.0,88.0],[-11.0,66.0],[4.0,66.0],[4.0,68.0],[5.0,68.0],[5.0,65.0],[-12.0,65.0],[-12.0,89.0]],"h":[]}],"trees":[[-16.8,-18.6,1.96,4.56],[-5.97,-18.49,1.79,5.04],[-12.05,-9.43,2.2,4.93],[-3.35,-8.54,1.92,4.84],[-15.98,-3.23,1.76,4.99],[-10.16,6.24,2.0,4.94],[-14.13,14.96,1.85,5.1],[-10.15,21.24,1.76,4.48],[68.54,22.84,1.86,4.92],[-14.92,29.8,1.77,5.0],[52.64,38.47,1.65,4.79],[59.77,36.87,1.96,4.75],[107.42,38.5,2.09,4.8],[-15.13,45.56,1.74,4.61],[48.67,45.94,2.06,4.66],[56.41,47.17,1.97,4.91],[65.4,44.8,1.69,4.42],[33.35,54.7,2.03,4.76],[42.22,54.52,2.16,5.28],[51.79,55.43,1.6,4.25],[61.84,53.73,1.63,4.67],[-16.08,60.65,1.62,5.0],[33.65,68.89,1.64,4.38],[42.29,70.53,1.77,4.42],[52.79,70.17,1.62,4.26],[59.89,69.57,2.12,5.48],[38.73,77.95,2.13,5.04],[46.65,77.33,1.72,4.77],[56.07,78.75,1.74,4.63],[64.74,79.45,2.1,5.38],[84.5,77.97,1.62,4.36],[91.3,78.65,2.14,4.9],[102.39,77.47,2.01,5.3],[34.9,85.59,1.96,5.1],[43.07,85.35,1.65,4.32],[51.57,86.24,2.06,5.23],[97.33,85.13,1.91,5.23],[-15.82,92.51,1.83,4.58],[8.28,101.19,2.02,5.29],[15.93,100.8,1.72,4.44],[62.4,100.81,1.66,4.31],[69.12,101.62,1.88,5.02],[88.13,101.63,1.67,4.75]]};
function slabH(root, pts, holes, z0, z1, mat = M.white) {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) sh.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const g = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0, bevelEnabled: false, curveSegments: 32 });
  g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, mat); m.position.y = z0; root.add(m); return m;
}
// low-poly tree like the school's: trunk + faceted crown (street-tree size: crown about 3.5-4.5 m wide, 5-6 m tall)
function tree(root, x, y, r, h) {
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, h, 6), M.white); t.position.copy(V(x, y, h / 2)); root.add(t);   // trunk runs up into the crown, so the crown sits on it
  const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), M.white); c.scale.set(r, r * 1.1, r); c.position.copy(V(x, y, h)); c.rotation.y = (x * 7 + y * 3) % 6.28; root.add(c);
}
// plot fence like the school's: light, lines only (top rail at 1.8 m, bottom rail at 0.15 m, posts every 4 m)
function fenceRun(root, a, b, h = 1.8) {
  const [x0, y0] = a, [x1, y1] = b, L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / 4)), s = [];
  s.push([[x0, y0, h], [x1, y1, h]], [[x0, y0, 0.15], [x1, y1, 0.15]]);
  for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n; s.push([[x, y, 0], [x, y, h]]); }
  lines(root, s);
}
function gate(root, a, b, swing, h = 1.8) {   // two light leaves (lines, like the fence) hung at a and b, swung open into the plot
  const [ax, ay] = a, [bx, by] = b, L = Math.hypot(bx - ax, by - ay) / 2 - 0.05, phi = Math.atan2(by - ay, bx - ax), s = [];
  for (const [x, y, f] of [[ax, ay, phi + swing], [bx, by, phi + Math.PI - swing]]) {
    const ex = x + L * Math.cos(f), ey = y + L * Math.sin(f);
    s.push([[x, y, h], [ex, ey, h]], [[x, y, 0.15], [ex, ey, 0.15]], [[ex, ey, 0.15], [ex, ey, h]], [[x, y, 0], [x, y, h + 0.1]]);
    const n = Math.max(2, Math.round(L / 0.5));
    for (let k = 1; k < n; k++) { const t = k / n; s.push([[x + (ex - x) * t, y + (ey - y) * t, 0.15], [x + (ex - x) * t, y + (ey - y) * t, h]]); }
  }
  lines(root, s);
}
function plotFence(root) {
  const P = D.plot, E = P.x1;
  // gaps: the apron (the trucks drive straight out), the entrance walk, the two parking drives and the yard drive
  for (const [a, b] of [[[P.x0, P.y0], [0, P.y0]], [[25, P.y0], [E, P.y0]], [[E, P.y0], [E, 7]], [[E, 10.5], [E, 13]], [[E, 20], [E, 62]], [[E, 69], [E, 90]], [[E, 98], [E, P.y1]],
    [[E, P.y1], [P.x0, P.y1]], [[P.x0, P.y1], [P.x0, P.y0]]]) fenceRun(root, a, b);
  // gates open inward (toward -x: the leaves swing past the fence line into the plot)
  gate(root, [E, 7], [E, 10.5], 1.2); gate(root, [E, 13], [E, 20], 1.3); gate(root, [E, 62], [E, 69], 1.3); gate(root, [E, 90], [E, 98], 1.3);
}
function site(root) {
  // only the plot shows; the two streets run on past it with their sidewalks
  const P = D.plot;
  flat(root, [[P.x0, P.y0], [P.x1, P.y0], [P.x1, P.y1], [P.x0, P.y1]], -0.03);
  flat(root, [[-60, -48], [170, -48], [170, -27], [-60, -27]], -0.03);           // Airway Blvd with both sidewalks
  flat(root, [[112, -70], [134, -70], [134, 140], [112, 140]], -0.03);           // side street with both sidewalks
  const kerb = (pts) => slab(root, pts, 0, 0.15);
  // Airway Blvd (y -45..-30) and the side street (x 115..131) run straight through and cross; a sidewalk on all four corners
  // near-side sidewalks, cut where the apron and the drives cross them so those stay level with the street
  for (const [y0, y1] of [[-30, 13], [20, 62], [69, 90], [98, 140]]) kerb([[112, y0], [115, y0], [115, y1], [112, y1]]);
  kerb([[-60, -30], [0, -30], [0, -27], [-60, -27]]); kerb([[25, -30], [112, -30], [112, -27], [25, -27]]);   // plot-side sidewalk of Airway Blvd, cut where the apron crosses it
  kerb([[-60, -48], [112, -48], [112, -70], [115, -70], [115, -45], [-60, -45]]);
  kerb([[131, -30], [170, -30], [170, -27], [134, -27], [134, 140], [131, 140]]);
  kerb([[131, -45], [170, -45], [170, -48], [134, -48], [134, -70], [131, -70]]);
  const dash = [];
  for (let x = -58; x < 168; x += 8) if (x + 4 < 113 || x > 133) dash.push([[x, -37.5, 0.01], [x + 4, -37.5, 0.01]]);
  for (let y = -68; y < 138; y += 8) if (y + 4 < -47 || y > -28) dash.push([[123, y, 0.01], [123, y + 4, 0.01]]);
  for (let k = 0; k < 6; k++) {          // zebra crossings on the four sides of the junction
    const a = -44 + k * 2.5; dash.push([[109.5, a, 0.01], [114, a, 0.01]], [[132, a, 0.01], [136.5, a, 0.01]]);
    const b = 116 + k * 2.5; dash.push([[b, -27.5, 0.01], [b, -24, 0.01]], [[b, -51, 0.01], [b, -47.5, 0.01]]);
  }
  lines(root, dash);
  // apron with the diagonal stripes, straight out to Airway Blvd
  slab(root, [[0, -30], [25, -30], [25, 28.6], [0, 28.6]], 0, 0.06);   // apron continues inside as the hall floor, so the trucks stand on the same level
  const st = [], x0 = 0, x1 = 25, y0 = -30, y1 = 0;
  for (let c = -80; c < 80; c += 4) for (const s of [1, -1]) {
    const q = [];
    for (const x of [x0, x1]) { const y = s * x + c; if (y >= y0 && y <= y1) q.push([x, y]); }
    for (const y of [y0, y1]) { const x = (y - c) * s; if (x > x0 && x < x1) q.push([x, y]); }
    if (q.length >= 2) st.push([[q[0][0], q[0][1], 0.07], [q[1][0], q[1][1], 0.07]]);
  }
  lines(root, st);
  // back yard + back drive to the side street, visitor parking with two drives
  slab(root, [[-12, 29], [26, 29], [26, 90], [115, 90], [115, 98], [-12, 98]], 0, 0.04);
  slab(root, [[76, 11], [104, 11], [104, 13], [115, 13], [115, 20], [104, 20], [104, 62], [115, 62], [115, 69], [104, 69], [104, 72], [76, 72]], 0, 0.04);   // parking + its two drives as one surface (no line across the drive mouths)
  const stalls = [];
  for (let y = 14; y < 70; y += 3) {
    stalls.push([[76.5, y, 0.05], [82, y, 0.05]]);
    if (!(y > 12 && y < 21) && !(y > 61 && y < 70)) stalls.push([[98, y, 0.05], [103.5, y, 0.05]]);   // no parking lines where the two drives come in
  }
  for (let y = 36; y < 62; y += 3) stalls.push([[-11.5, y, 0.05], [-6.5, y, 0.05]]);
  lines(root, stalls);
  // walks, plaza, flagpoles with flags
  { const pc = [66, 8.75], pr = 3.8, h = Math.atan2(1.75, Math.sqrt(pr * pr - 1.75 * 1.75)), arc = (t0, t1) => { const r = []; for (let k = 0; k <= 24; k++) { const t = t0 + (t1 - t0) * k / 24; r.push([pc[0] + pr * Math.cos(t), pc[1] + pr * Math.sin(t)]); } return r; };
    for (const p of SITE.walk) slabH(root, p.o, p.h, 0, 0.12);   // walks, plaza and the 1 m sidewalk round every building (not where the trucks drive), one piece (layout-scripts/fire-site.py)
    const bed = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.03, 40), M.white); bed.position.copy(V(pc[0], pc[1], 0.135)); root.add(bed); }   // centre circle of the plaza, flush with the paving
  for (const x of [62.2]) {      // one flagpole with the flag
    cyl(root, x, 3.5, 0, 12, 0.08, 8); const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), M.white); ball.position.copy(V(x, 3.5, 12.1)); root.add(ball);
    box(root, x + 0.08, x + 2.0, 3.48, 3.52, 10.6, 11.8);
    lines(root, [10.85, 11.1, 11.35, 11.6].map(z => [[x + 0.9, 3.45, z], [x + 2.0, 3.45, z]]).concat([[[x + 0.9, 3.45, 11.1], [x + 0.9, 3.45, 11.8]]]));
  }
  plotFence(root);
  for (const [x, y, r, h] of SITE.trees) tree(root, x, y, r, h);   // the school's trees, on the open ground
}

// builds everything; resolves when the 3D letters are in
export function buildScene(scene) {
  mats();
  const root = new THREE.Group();
  hall(root);
  const bc = D.bays.map(([a, b]) => (a + b) / 2);
  truck(root, bc[0], 1.2, "engine"); truck(root, bc[1], 1.2, "ladder"); truck(root, bc[2], 1.2, "engine"); truck(root, bc[3], 1.6, "ambulance");
  wings(root); garage(root); site(root);
  scene.add(root);
  scene.background = new THREE.Color(0xffffff);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdddddd, 2.3));
  const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(-50, 80, 90); scene.add(sun);
  const signRoot = new THREE.Group(); root.add(signRoot);
  const finish = (font) => { sign(signRoot, font); brickUV(root); outline(root); };
  return new Promise((res) => new FontLoader().load(new URL("./helvetiker_bold.typeface.json", import.meta.url).href,
    (font) => { finish(font); res(root); }, undefined, () => { finish(null); res(root); }));
}
// black outlines on every edge where faces meet at an angle (like the page)
function outline(root) {
  const add = [];
  root.traverse(o => {
    if (!o.isMesh || o.userData.noEdge || o.userData.edged) return;
    const thr = o.geometry.type === "CylinderGeometry" || o.geometry.type === "SphereGeometry" ? 40 : 20;
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, thr), M.line);
    e.position.copy(o.position); e.rotation.copy(o.rotation); e.scale.copy(o.scale); add.push([o.parent, e]); o.userData.edged = true;
  });
  for (const [p, e] of add) p.add(e);
}
