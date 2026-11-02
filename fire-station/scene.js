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
  hall: { x0: 0, x1: 25, h: 9.5, open: 12 },                     // 4 bays between the side towers; the bays are open 12 m deep
  tower: { h: 8.6, w: 5, y0: -0.6, y1: 29 },                     // brick side towers with the tall windows
  bays: [0.3, 6.4, 12.5, 18.6].map(x => [x, x + 4.5]),           // door openings, 4.5 m, piers 1.6 m
  door: { h: 4.9, spring: 6.6, top: 7.7 },                       // door head, arch spring, arch crown
  gable: { x0: 4.6, x1: 20.4, z0: 9.7, peak: 13.5, depth: 8 },
  sign: { x0: 7.25, x1: 17.75, z0: 8.05, z1: 9.4 },              // FIRE STATION board, centred on the gable (page)
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
function gableRoof(root, x0, x1, y0, y1, z, r, along) {
  if (along === "x") side(root, [[y0, z], [y1, z], [(y0 + y1) / 2, z + r]], x0, x1, M.roof);
  else elev(root, [[x0, z], [x1, z], [(x0 + x1) / 2, z + r]], y0, y1, M.roof);
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
  bx(a0, a1, z1 - fr, z1, 0, out); bx(a0, a1, z0, z0 + fr, 0, out); bx(a0, a0 + fr, z0, z1, 0, out); bx(a1 - fr, a1, z0, z1, 0, out);
  const s = [];
  for (let i = 1; i < cols; i++) { const a = a0 + (a1 - a0) * i / cols; s.push([P(a, z0 + fr, 0.03), P(a, z1 - fr, 0.03)]); }
  for (let j = 1; j < rows; j++) { const z = z0 + (z1 - z0) * j / rows; s.push([P(a0 + fr, z, 0.03), P(a1 - fr, z, 0.03)]); }
  lines(root, s);
  if (sill) bx(a0 - 0.15, a1 + 0.15, z0 - 0.15, z0, 0, 0.18);
}
// a row of windows along a wall
function windowRow(root, face, at, a0, a1, n, w, z0, z1, cols = 2, rows = 2) {
  const gap = (a1 - a0 - n * w) / (n + 1);
  for (let i = 0; i < n; i++) { const a = a0 + gap + i * (w + gap); opening(root, face, at, a, a + w, z0, z1, cols, rows); }
}

// ---------- emblem (the page's Maltese cross with a flame), real 3D, facing -y; or turned to face +x ----------
function emblem(root, x, y, z, size, faceEast = false) {
  const g = new THREE.Group(), r = size / 2;
  const arm = (k) => { const pts = [[-0.17, 0.2], [-0.47, 0.98], [-0.2, 0.84], [0, 1.0], [0.2, 0.84], [0.47, 0.98], [0.17, 0.2]];
    const c = Math.cos(k * Math.PI / 2), s = Math.sin(k * Math.PI / 2); return pts.map(([u, v]) => [(u * c - v * s) * r, (u * s + v * c) * r]); };
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
  g.rotation.y = faceEast ? Math.PI / 2 : 0;                           // the shapes face +z (three) = -y (plan)
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
  side(root, [[0.4, dr.h], [H.open, dr.h], [H.open, 0], [T.y1, 0], [T.y1, H.h], [0.4, H.h]], H.x0, H.x1, M.brick);
  // arched brick surround with keystone (page), transom glass with its grid, rolled-up door under it
  for (const { a, b, cx, R, zc, t0, A } of arch) {
    const outer = [], R2 = R + 0.45;
    for (let k = 0; k <= 16; k++) { const t = t0 + (Math.PI - 2 * t0) * k / 16; outer.push([cx + R2 * Math.cos(t), zc + R2 * Math.sin(t)]); }
    elev(root, [...A, [b + 0.45, dr.spring], ...outer.slice(1, -1), [a - 0.45, dr.spring]], -0.18, 0.05, M.white);
    elev(root, [[cx - 0.32, dr.top - 0.1], [cx + 0.32, dr.top - 0.1], [cx + 0.42, dr.top + 0.6], [cx - 0.42, dr.top + 0.6]], -0.3, 0.05, M.white);   // keystone
    elev(root, [[a, dr.h], [b, dr.h], ...A.slice().reverse()], 0.2, 0.28, M.white);   // transom glass
    const s = [];
    for (let k = 1; k < 4; k++) { const x = a + (b - a) * k / 4, zt = zc + Math.sqrt(Math.max(R * R - (x - cx) ** 2, 0)); s.push([[x, 0.18, dr.h], [x, 0.18, zt]]); }
    s.push([[a, 0.18, dr.spring], [b, 0.18, dr.spring]]);
    lines(root, s);
    box(root, a, b, 0.25, 0.75, dr.h - 0.35, dr.h);                     // rolled-up door at the head
    box(root, cx - 0.35, cx + 0.35, 2, 2.8, dr.h - 0.12, dr.h);          // ceiling light (page)
  }
  // cornice along the top of the bay section, rake trim on the gable, gable roof behind it
  box(root, H.x0 - 0.1, G.x0, -0.35, 0.4, H.h - 0.4, H.h + 0.1); box(root, G.x1, H.x1 + 0.1, -0.35, 0.4, H.h - 0.4, H.h + 0.1);
  box(root, G.x0 - 0.4, G.x1 + 0.4, -0.3, 0.4, G.z0 - 0.35, G.z0 - 0.1);
  elev(root, [[G.x0 - 0.6, G.z0 - 0.1], [(G.x0 + G.x1) / 2, G.peak - 0.05], [G.x1 + 0.6, G.z0 - 0.1], [G.x1 + 0.6, G.z0 + 0.35], [(G.x0 + G.x1) / 2, G.peak + 0.55], [G.x0 - 0.6, G.z0 + 0.35]], -0.4, 0.5, M.white);
  gableRoof(root, G.x0, G.x1, 0.5, G.depth, H.h, G.peak - H.h, "y");
  emblem(root, (G.x0 + G.x1) / 2, -0.02, 11.25, 2.3);
  // side towers: tall window on the front (page: 3 x 4 panes), cap, windows on the outer sides
  for (const [x0, x1, outer] of [[H.x0 - T.w, H.x0, "-x"], [H.x1, H.x1 + T.w, null]]) {
    box(root, x0, x1, T.y0, T.y1, 0, T.h, M.brick);
    box(root, x0 - 0.25, x1 + 0.25, T.y0 - 0.3, T.y0 + 0.8, T.h - 0.4, T.h + 0.15);
    box(root, x0 - 0.12, x1 + 0.12, T.y0 - 0.15, T.y0 + 0.5, T.h - 0.75, T.h - 0.4);
    opening(root, "-y", T.y0, x0 + 0.85, x1 - 0.85, 1.4, 7.2, 3, 4);
    if (outer) windowRow(root, "-x", x0, 2, T.y1 - 2, 6, 1.6, 1.4, 4.2);
  }
  // back of the hall: 4 doors to the back yard (drive-through), small windows high up
  for (const [a, b] of D.bays) { opening(root, "+y", T.y1, a, b, 0, dr.h, 4, 4, false); }
  // lamps: arm + bell shade between and beside the bays (page)
  for (const x of [-0.3, 5.55, 11.65, 17.75, 23.85].map(v => v + 0.7)) {
    box(root, x - 0.06, x + 0.06, -0.65, 0, 6.3, 6.42);
    box(root, x - 0.2, x + 0.2, -0.05, 0, 6.0, 6.7);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.4, 0.4, 20, 1, true), M.white); shade.position.copy(V(x, -0.65, 6.05)); root.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), M.white); bulb.position.copy(V(x, -0.65, 5.85)); root.add(bulb);
  }
}

// ---------- fire trucks in the bays (page): engine, ladder truck, engine, ambulance ----------
function wheel(root, x, y) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 24), M.white); w.rotation.z = Math.PI / 2; w.position.copy(V(x, y, 0.5)); root.add(w);
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.38, 16), M.white); h.rotation.z = Math.PI / 2; h.position.copy(V(x, y, 0.5)); root.add(h); }
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
  box(root, A.x0, A.x1, 29, A.y1, 0, e, M.brick); box(root, 30, A.x1, A.y0, 29, 0, e, M.brick);
  gableRoof(root, A.x0 - 0.5, A.x1 + 0.5, A.y0, A.y1 + 0.5, e, (A.x1 - A.x0 + 1) / 2 * p, "y");
  box(root, B.x0, B.x1, B.y0, B.y1, 0, e, M.brick);
  gableRoof(root, B.x0, B.x1 + 0.5, B.y0 - 0.5, B.y1 + 0.5, e, (B.y1 - B.y0 + 1) / 2 * p, "x");
  windowRow(root, "-y", B.y0, D.entry.x1 + 0.5, B.x1, 3, 1.6, 1.3, 4.3, 1, 2);       // south face (photo: tall windows)
  windowRow(root, "+x", B.x1, B.y0, B.y1, 3, 1.6, 1.3, 4.3, 1, 2);                   // east end
  windowRow(root, "+y", B.y1, A.x1, B.x1, 5, 1.6, 1.3, 3.9, 2, 2);                   // garden side
  opening(root, "+y", B.y1, 52.5, 54.5, 0, 2.5, 2, 1, false);                        // garden door
  windowRow(root, "+x", A.x1, 29, A.y1, 4, 1.6, 1.3, 3.9, 2, 2);                      // A east (garden)
  windowRow(root, "-x", A.x0, 29, A.y1, 4, 1.6, 1.3, 3.9, 2, 2);                      // A west (back yard)
  opening(root, "+y", A.y1, 31.8, 34.2, 0, 2.5, 2, 1, false); windowRow(root, "+y", A.y1, A.x0, 31.5, 1, 1.6, 1.3, 3.9); windowRow(root, "+y", A.y1, 34.5, A.x1, 1, 1.6, 1.3, 3.9);
  // entrance tower: stone base, arched panel with the emblem on the front and east faces, hip roof, glass door + canopy facing the plaza
  const T = D.entry, cx = (T.x0 + T.x1) / 2, cy = (T.y0 + T.y1) / 2, w = T.x1 - T.x0;
  box(root, T.x0, T.x1, T.y0, T.y1, 0, T.h, M.brick);
  box(root, T.x0 - 0.35, T.x1 + 0.35, T.y0 - 0.35, T.y1 + 0.35, T.h - 0.35, T.h);
  const hip = new THREE.Mesh(new THREE.ConeGeometry((w + 1.2) / Math.SQRT2, T.roof, 4), M.roof); hip.rotation.y = Math.PI / 4; hip.position.copy(V(cx, cy, T.h + T.roof / 2)); root.add(hip);
  const panel = (face) => {      // recessed arched panel, stone arch round it
    const a0 = (face === "-y" ? cx : cy) - 1.7, a1 = a0 + 3.4, z0 = 5.0, zs = 7.6, R = 1.7, ac = a0 + 1.7;
    const sh = []; sh.push([a0, z0], [a1, z0]); for (let k = 0; k <= 16; k++) { const t = Math.PI * k / 16; sh.push([ac + R * Math.cos(t), zs + R * Math.sin(t)]); }
    const P3 = sh.map(([a, z]) => F(face, face === "-y" ? T.y0 : T.x1, a, z, 0.04));
    const s = []; for (let i = 0; i < P3.length; i++) s.push([P3[i], P3[(i + 1) % P3.length]]); lines(root, s);
    const ring = []; for (let k = 0; k <= 16; k++) { const t = Math.PI * k / 16; ring.push(F(face, face === "-y" ? T.y0 : T.x1, ac + (R + 0.35) * Math.cos(t), zs + (R + 0.35) * Math.sin(t), 0.04)); }
    for (let i = 0; i < 16; i++) s.push([ring[i], ring[i + 1]]); lines(root, s);
  };
  panel("-y"); panel("+x");
  emblem(root, cx, T.y0 - 0.02, 7.0, 2.3); emblem(root, T.x1 + 0.02, cy, 7.0, 2.3, true);
  opening(root, "-y", T.y0, cx - 1.6, cx + 1.6, 1.3, 4.3, 3, 2);                       // big window on the front (photo)
  opening(root, "+x", T.x1, cy - 1.4, cy + 1.4, 0, 3.0, 2, 1, false);                  // glass doors
  opening(root, "+x", T.x1, cy - 2.6, cy - 1.55, 0, 3.0, 1, 2, false); opening(root, "+x", T.x1, cy + 1.55, cy + 2.6, 0, 3.0, 1, 2, false);
  box(root, T.x1, T.x1 + 3.0, T.y0 - 0.3, T.y1 + 0.3, 3.4, 3.7);                        // canopy
  for (const y of [T.y0 + 0.2, T.y1 - 0.2]) box(root, T.x1 + 0.3, T.x1 + 0.9, y - 0.06, y + 0.06, 3.7, 4.9);   // canopy hangers
  opening(root, "+y", T.y1, cx - 0.9, cx + 0.9, 1.3, 3.9);
}

function garage(root) {
  const G = D.garage;
  box(root, G.x0, G.x1, G.y0, G.y1, 0, G.h, M.brick);
  gableRoof(root, G.x0 - 0.4, G.x1 + 0.4, G.y0 - 0.4, G.y1 + 0.4, G.h, 2.4, "y");
  for (const y of [68.5, 75, 81.5]) opening(root, "+x", G.x1, y, y + 4.5, 0, 4.0, 1, 5, false);     // 3 garage doors on the yard side
  windowRow(root, "-x", G.x0, G.y0, G.y1, 4, 1.4, 1.6, 3.4, 2, 2);
  opening(root, "-y", G.y0, -5, -3.4, 0, 2.4, 1, 1, false); windowRow(root, "-y", G.y0, G.x0, -5.5, 1, 1.4, 1.6, 3.4);
}

// ---------- site ----------
function site(root) {
  flat(root, [[-60, -70], [170, -70], [170, 140], [-60, 140]], -0.03);
  const kerb = (pts) => slab(root, pts, 0, 0.15);
  kerb([[-60, -30], [170, -30], [170, -27], [-60, -27]]);
  kerb([[112, -27], [115, -27], [115, 140], [112, 140]]);
  const dash = [];
  for (let x = -58; x < 168; x += 8) dash.push([[x, -37.5, 0.01], [x + 4, -37.5, 0.01]]);
  for (let y = -44; y < 138; y += 8) dash.push([[123, y, 0.01], [123, y + 4, 0.01]]);
  lines(root, dash); lines(root, [[[-60, -45, 0.01], [131, -45, 0.01]], [[131, -45, 0.01], [131, 140, 0.01]]]);
  // apron with the diagonal stripes, straight out to Airway Blvd
  slab(root, [[0, -27], [25, -27], [25, 0], [0, 0]], 0, 0.06);
  const st = [], x0 = 0, x1 = 25, y0 = -27, y1 = 0;
  for (let c = -80; c < 80; c += 4) for (const s of [1, -1]) {
    const q = [];
    for (const x of [x0, x1]) { const y = s * x + c; if (y >= y0 && y <= y1) q.push([x, y]); }
    for (const y of [y0, y1]) { const x = (y - c) * s; if (x > x0 && x < x1) q.push([x, y]); }
    if (q.length >= 2) st.push([[q[0][0], q[0][1], 0.07], [q[1][0], q[1][1], 0.07]]);
  }
  lines(root, st);
  // back yard + back drive to the side street, visitor parking with two drives
  slab(root, [[-12, 29], [30, 29], [30, 58], [36, 58], [36, 90], [112, 90], [112, 98], [-12, 98]], 0, 0.04);
  slab(root, [[76, 4], [104, 4], [104, 72], [76, 72]], 0, 0.04);
  slab(root, [[104, 6], [112, 6], [112, 13], [104, 13]], 0, 0.04); slab(root, [[104, 62], [112, 62], [112, 69], [104, 69]], 0, 0.04);
  const stalls = [];
  for (let y = 7; y < 70; y += 3) stalls.push([[76.5, y, 0.05], [82, y, 0.05]], [[98, y, 0.05], [103.5, y, 0.05]]);
  for (let y = 36; y < 62; y += 3) stalls.push([[-11.5, y, 0.05], [-6.5, y, 0.05]]);
  lines(root, stalls);
  // walks, plaza, flagpoles with flags
  slab(root, [[72.5, 4], [75.5, 4], [75.5, 72], [72.5, 72]], 0, 0.12);
  slab(root, [[36, 62], [72.5, 62], [72.5, 65], [36, 65]], 0, 0.12);
  slab(root, [[D.entry.x1, 7], [72.5, 7], [72.5, 10.5], [D.entry.x1, 10.5]], 0, 0.12);
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 0.14, 48), M.white); plaza.position.copy(V(66, 8.75, 0.07)); root.add(plaza);
  const ring = []; for (let k = 0; k < 48; k++) { const a = k / 48 * 6.283, b = (k + 1) / 48 * 6.283; ring.push([[66 + 1.2 * Math.cos(a), 8.75 + 1.2 * Math.sin(a), 0.15], [66 + 1.2 * Math.cos(b), 8.75 + 1.2 * Math.sin(b), 0.15]]); }
  lines(root, ring);
  for (const x of [61, 63.5]) {
    cyl(root, x, 3.5, 0, 12, 0.08, 8); const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), M.white); ball.position.copy(V(x, 3.5, 12.1)); root.add(ball);
    box(root, x + 0.08, x + 2.0, 3.48, 3.52, 10.6, 11.8);
    lines(root, [10.85, 11.1, 11.35, 11.6].map(z => [[x + 0.9, 3.45, z], [x + 2.0, 3.45, z]]).concat([[[x + 0.9, 3.45, 11.1], [x + 0.9, 3.45, 11.8]]]));
  }
  lines(root, [[[-20, -27, 0.01], [-20, 104, 0.01]], [[-15, -27, 0.01], [-15, 104, 0.01]]]);      // ditch along the left edge
}

// builds everything; resolves when the 3D letters are in
export function buildScene(scene) {
  mats();
  const root = new THREE.Group();
  hall(root);
  truck(root, 2.55, 1.2, "engine"); truck(root, 8.65, 1.2, "ladder"); truck(root, 14.75, 1.2, "engine"); truck(root, 20.85, 1.6, "ambulance");
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
