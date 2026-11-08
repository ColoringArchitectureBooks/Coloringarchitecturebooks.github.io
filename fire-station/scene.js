// Fire station model (layout v6: rectangular corner plot, Airway Blvd in front, side street on the right).
// Black & white like the coloring page: every face white, black outlines, brick drawn as line art.
// Plan coords in metres: x along the front (0 = left edge of the striped apron), y depth (0 = hall front, negative = street), z up.
// Three.js is y-up, so a plan point (x, y, z) maps to (x, z, -y).
import * as THREE from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { parkCars } from "./cars.js?v=2";
import { fireTruck, flashLights, lightsOff } from "./firetruck.js?v=2";

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
function roofTexture() {   // 4 m along the ridge x 2.4 m up the slope: a thin course line every 0.4 m, tile joints staggered every 0.6 m (light, like the brick)
  const pm = 64, w = 4 * pm, h = 2.4 * pm, c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.strokeStyle = "#000"; g.lineWidth = 1.2;
  for (let r = 0; r < 6; r++) { const y = h - r * 0.4 * pm - 0.5;
    g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    g.lineWidth = 0.8; for (let x = (r % 2) * 0.3; x < 4; x += 0.6) { g.beginPath(); g.moveTo(x * pm, y); g.lineTo(x * pm, y - 0.4 * pm); g.stroke(); } g.lineWidth = 1.2; }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8; t.repeat.set(1 / 4, 1 / 2.4); return t;
}
// roof UVs in world metres on every sloped face: u along the ridge, v up the slope (so the courses run parallel to the eave);
// flat, vertical and underside faces get a blank spot between two courses
function roofUV(root) {
  root.updateMatrixWorld(true);
  const up = new THREE.Vector3(0, 1, 0), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), r = new THREE.Vector3(), sl = new THREE.Vector3();
  root.traverse(o => {
    if (!o.isMesh || o.material !== M.roof) return;
    if (o.geometry.index) o.geometry = o.geometry.toNonIndexed();
    const pos = o.geometry.attributes.position, uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); b.fromBufferAttribute(pos, i + 1).applyMatrix4(o.matrixWorld); c.fromBufferAttribute(pos, i + 2).applyMatrix4(o.matrixWorld);
      n.subVectors(b, a).cross(c.clone().sub(a)).normalize();
      const slope = n.y > 0.15 && n.y < 0.97;
      if (slope) { r.crossVectors(up, n).normalize(); sl.copy(up).addScaledVector(n, -n.dot(up)).normalize(); }
      [a, b, c].forEach((p, k) => slope ? uv.setXY(i + k, p.dot(r), p.dot(sl)) : uv.setXY(i + k, 0.31, 0.2));
    }
    o.geometry.setAttribute("uv", uv);
  });
}
function mats() {
  const L = (o) => new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, color: 0xffffff, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...o });
  M.white = L({}); M.roof = L({ map: roofTexture() }); M.ground = L({}); M.brick = L({ map: brickTexture() });
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
// roof courses (the roofing shows, like the train station's roof): a line every 0.4 m up each slope, parallel to the ridge.
// The slope runs from (a0, z0) at the eave to (am, zr) at the ridge and on down to (a1, z0); b0..b1 is its length along the ridge.
// Where a slope runs under another roof the lines are simply hidden by it.
function roofCourses(root, along, a0, am, a1, z0, zr, b0, b1, step = 0.4) {
  const s = [], L = Math.hypot(am - a0, zr - z0), n = Math.floor(L / step);
  for (const ae of [a0, a1]) for (let k = 1; k < n; k++) {
    const t = k / n, a = ae + (am - ae) * t, z = z0 + (zr - z0) * t + 0.015;
    s.push(along === "y" ? [[a, b0, z], [a, b1, z]] : [[b0, a, z], [b1, a, z]]);
  }
  lines(root, s);
}
// a gabled block: walls and gable triangles are one brick extrusion (no seam at the eave), the roof is one folded strip with overhangs
let HOUSE = 1;   // id per gabled block, so its own wall/roof contact is not drawn as a meeting line
function house(root, x0, x1, y0, y1, e, pitch, along, emblems = [], ends = [0.35, 0.35]) {   // ends: roof overhang at each gable end (0 where it dies into a wall)
  const o = 0.5, t = 0.3, [e0, e1] = ends;
  const [a0, a1, b0, b1] = along === "y" ? [x0, x1, y0, y1] : [y0, y1, x0, x1];
  const mid = (a0 + a1) / 2, r = (a1 - a0) / 2 * pitch, k = pitch;
  const body = [[a0, 0], [a1, 0], [a1, e], [mid, e + r], [a0, e]];
  const roof = [[a0 - o, e - o * k], [mid, e + r], [a1 + o, e - o * k], [a1 + o, e - o * k + t], [mid, e + r + t], [a0 - o, e - o * k + t]];
  if (along === "y") { elev(root, body, y0, y1, M.brick).userData.house = HOUSE; elev(root, roof, y0 - e0, y1 + e1, M.roof).userData.house = HOUSE; }
  else { side(root, body, x0, x1, M.brick).userData.house = HOUSE; side(root, roof, x0 - e0, x1 + e1, M.roof).userData.house = HOUSE; }
  HOUSE++;
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

// ---------- fire trucks in the bays (page): engine, ladder truck, engine, water tanker ----------
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
const SITE = {"walk":[{"o":[[0.0,29.0],[-5.0,29.0],[-5.0,-0.6],[0.0,-0.6],[0.0,-1.0],[-5.4,-1.0],[-5.4,29.4],[0.0,29.4]],"h":[]},{"o":[[40.4,48.4],[40.4,29.4],[62.4,29.4],[62.4,11.6],[55.9,11.6],[55.9,10.5],[62.627,10.5],[62.8,10.799],[62.999,11.082],[63.224,11.345],[63.471,11.586],[63.739,11.804],[64.026,11.997],[64.33,12.163],[64.647,12.301],[64.975,12.409],[65.312,12.487],[65.655,12.534],[66.0,12.55],[66.345,12.534],[66.688,12.487],[67.025,12.409],[67.353,12.301],[67.67,12.163],[67.974,11.997],[68.261,11.804],[68.529,11.586],[68.776,11.345],[69.001,11.082],[69.2,10.799],[69.373,10.5],[72.5,10.5],[72.5,62.0],[26.0,62.0],[26.0,65.0],[72.5,65.0],[72.5,90.0],[76.0,90.0],[76.0,10.5],[112.0,10.5],[112.0,7.0],[69.373,7.0],[69.2,6.701],[69.001,6.418],[68.776,6.155],[68.529,5.914],[68.261,5.696],[67.974,5.503],[67.67,5.337],[67.353,5.199],[67.025,5.091],[66.688,5.013],[66.345,4.966],[66.0,4.95],[65.655,4.966],[65.312,5.013],[64.975,5.091],[64.647,5.199],[64.33,5.337],[64.026,5.503],[63.739,5.696],[63.471,5.914],[63.224,6.155],[62.999,6.418],[62.8,6.701],[62.627,7.0],[55.9,7.0],[55.9,5.1],[49.4,5.1],[49.4,0.1],[30.4,0.1],[30.4,-1.0],[25.0,-1.0],[25.0,-0.6],[30.0,-0.6],[30.0,0.5],[49.0,0.5],[49.0,5.5],[55.5,5.5],[55.5,12.0],[62.0,12.0],[62.0,29.0],[40.0,29.0],[40.0,48.0],[26.0,48.0],[26.0,29.0],[25.0,29.0],[25.0,29.4],[25.6,29.4],[25.6,48.4]],"h":[]},{"o":[[4.4,88.4],[4.4,86.5],[4.0,86.5],[4.0,88.0],[-11.0,88.0],[-11.0,66.0],[4.0,66.0],[4.0,68.0],[4.4,68.0],[4.4,65.6],[-11.4,65.6],[-11.4,88.4]],"h":[]}],"trees":[[95.0,-17.46,1.92,5.2,1],[102.31,-13.17,1.55,4.29,2],[99.5,-20.34,2.28,5.4,1],[103.16,-23.97,1.39,4.22,2],[105.54,-16.38,1.64,4.55,2],[106.22,-20.68,1.38,4.71,2],[84.11,-7.26,1.33,4.43,2],[88.37,-10.04,1.82,4.43,0],[90.72,-7.81,1.57,4.32,2],[105.03,-4.17,2.05,4.74,1],[109.21,-2.41,1.54,4.81,2],[-16.62,-18.46,2.01,4.8,0],[-13.77,-20.32,1.46,4.26,2],[-16.83,-21.14,1.31,3.93,2],[-13.88,6.66,2.02,4.68,0],[-17.31,6.69,1.54,4.21,2],[-16.78,10.34,1.37,4.69,2],[-17.07,46.32,1.88,4.68,1],[-17.71,49.52,1.35,4.35,2],[-14.4,46.29,1.36,4.39,2],[-16.3,84.09,1.35,3.95,2],[-15.41,80.19,1.5,4.37,2],[-17.83,79.98,1.38,4.49,2],[48.18,36.66,1.53,4.24,2],[55.09,37.58,1.37,4.45,2],[52.96,42.19,1.78,4.46,0],[47.6,44.24,1.58,4.69,2],[56.18,40.8,1.49,4.24,2],[67.25,53.1,2.29,5.63,0],[62.86,54.12,2.14,5.35,1],[64.83,49.99,2.0,5.03,1],[57.69,35.92,2.13,5.52,0],[62.33,34.34,1.91,4.91,1],[35.4,74.38,1.4,4.22,2],[32.22,84.33,1.51,4.79,2],[38.78,82.73,1.54,4.75,2],[41.48,81.89,1.49,4.22,2],[29.53,80.15,1.68,4.61,2],[32.06,75.66,1.59,4.42,2],[61.47,77.22,2.04,4.97,0],[59.7,81.18,1.6,4.24,2],[60.58,73.45,1.55,4.51,2],[57.78,78.42,1.92,4.73,1],[43.31,69.04,1.63,4.34,2],[47.08,68.34,1.79,4.88,1],[107.61,37.52,1.41,4.2,2],[108.72,40.18,1.78,4.4,1],[106.41,42.18,1.35,4.35,2],[94.55,80.48,1.67,4.59,2],[96.26,77.65,2.18,5.49,1],[98.63,80.74,1.58,4.83,2],[90.57,83.84,1.6,4.99,2],[94.64,83.35,1.61,4.6,1],[108.52,78.41,1.73,4.5,0],[108.23,82.53,1.39,4.14,2],[42.06,100.91,1.32,4.38,2],[37.28,101.34,1.52,4.52,2],[82.11,101.63,1.53,4.56,2],[87.21,101.42,1.68,4.91,1],[84.76,102.14,1.32,4.07,2]]};
function slabH(root, pts, holes, z0, z1, mat = M.white) {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) sh.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const g = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0, bevelEnabled: false, curveSegments: 32 });
  g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, mat); m.position.y = z0; root.add(m); return m;
}
// low-poly trees, mixed: the school's tree (one faceted ball), Ahmed's #3 oak (three balls) and #6 small round tree
function tree(root, x, y, r, h, kind = 0) {
  const T = (r0, r1, th) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, th, 6), M.white); t.position.copy(V(x, y, th / 2)); root.add(t); };
  const ball = (geo, cx, cy, cz, sx, sz, ry) => { const c = new THREE.Mesh(geo, M.white); c.scale.set(sx, sz, sx); c.position.copy(V(cx, cy, cz)); c.rotation.y = ry; root.add(c); };
  const ry = (x * 7 + y * 3) % 6.28;
  if (kind === 1) {            // oak: a cluster of three balls, trunk up into the middle one
    const q = r * 0.75, I = new THREE.IcosahedronGeometry(1, 0); T(0.15, 0.22, h);
    ball(I, x, y, h, q, q, ry); ball(I, x - q * 0.9, y + q * 0.3, h - 0.7, q * 0.8, q * 0.8, ry + 1.1); ball(I, x + q * 0.85, y - q * 0.35, h - 0.6, q * 0.85, q * 0.8, ry + 2.3);
  } else if (kind === 2) {     // small round tree: short trunk, rounded crown low down
    const q = r * 0.85, hz = h * 0.65; T(0.12, 0.16, hz); ball(new THREE.DodecahedronGeometry(1, 0), x, y, hz, q, q * 0.95, ry);
  } else {                     // the school's tree; the trunk runs up into the crown so the two touch
    T(0.12, 0.17, h); ball(new THREE.IcosahedronGeometry(1, 0), x, y, h, r, r * 1.1, ry);
  }
}
// plot fence, between the school's line fence and a solid one: slim posts every 3 m, a slim top rail, a bottom wire, pickets every 0.5 m
function fenceRun(root, a, b, h = 1.6) {
  const [x0, y0] = a, [x1, y1] = b, L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / 3)), s = [], t = 0.025;
  y0 === y1 ? box(root, Math.min(x0, x1), Math.max(x0, x1), y0 - t, y0 + t, h - 0.05, h) : box(root, x0 - t, x0 + t, Math.min(y0, y1), Math.max(y0, y1), h - 0.05, h);
  for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n; box(root, x - 0.035, x + 0.035, y - 0.035, y + 0.035, 0, h + 0.05); }
  s.push([[x0, y0, 0.15], [x1, y1, 0.15]]);
  for (let d = 0.5; d < L - 0.1; d += 0.5) { const x = x0 + (x1 - x0) * d / L, y = y0 + (y1 - y0) * d / L; s.push([[x, y, 0.15], [x, y, h - 0.05]]); }
  lines(root, s);
}
function gate(root, a, b, swing, h = 1.6) {   // two light leaves (lines, like the fence) hung at a and b, swung open into the plot
  const [ax, ay] = a, [bx, by] = b, L = Math.hypot(bx - ax, by - ay) / 2 - 0.05, phi = Math.atan2(by - ay, bx - ax), s = [];
  for (const [x, y, f] of [[ax, ay, phi + swing], [bx, by, phi + Math.PI - swing]]) {
    const ex = x + L * Math.cos(f), ey = y + L * Math.sin(f);
    s.push([[x, y, h], [ex, ey, h]], [[x, y, 0.15], [ex, ey, 0.15]], [[ex, ey, 0.15], [ex, ey, h]]); box(root, x - 0.07, x + 0.07, y - 0.07, y + 0.07, 0, h + 0.15);
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
  // parked cars (the school's models), about 40% of the stalls taken, noses toward the aisle
  { const st = [], has = (y) => !(y > 12 && y < 21) && !(y > 61 && y < 70);
    for (let y = 14; y + 3 <= 68; y += 3) { st.push([76.2, 82, y + 1.5, 1]); if (has(y) && has(y + 3)) st.push([98, 103.8, y + 1.5, -1]); }
    parkCars(root, st, 0.4, 0.04);
    const yard = []; for (let y = 36; y + 3 <= 60; y += 3) yard.push([-11.8, -6.5, y + 1.5, 1]);
    parkCars(root, yard, 0.4, 0.04, 77, 5); }   // the yard by the garage: five cars
  // walks, plaza, flagpoles with flags
  { const pc = [66, 8.75], pr = 3.8, h = Math.atan2(1.75, Math.sqrt(pr * pr - 1.75 * 1.75)), arc = (t0, t1) => { const r = []; for (let k = 0; k <= 24; k++) { const t = t0 + (t1 - t0) * k / 24; r.push([pc[0] + pr * Math.cos(t), pc[1] + pr * Math.sin(t)]); } return r; };
    for (const p of SITE.walk) slabH(root, p.o, p.h, 0, 0.12);   // walks, plaza and the 40 cm sidewalk round every building (not where the trucks drive), one piece (layout-scripts/fire-site.py)
    const bed = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.03, 40), M.white); bed.position.copy(V(pc[0], pc[1], 0.135)); root.add(bed); }   // centre circle of the plaza, flush with the paving
  for (const x of [62.2]) {      // one flagpole with the flag
    cyl(root, x, 3.5, 0, 12, 0.08, 8); const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), M.white); ball.position.copy(V(x, 3.5, 12.1)); root.add(ball);
    box(root, x + 0.08, x + 2.0, 3.48, 3.52, 10.6, 11.8);
    lines(root, [10.85, 11.1, 11.35, 11.6].map(z => [[x + 0.9, 3.45, z], [x + 2.0, 3.45, z]]).concat([[[x + 0.9, 3.45, 11.1], [x + 0.9, 3.45, 11.8]]]));
  }
  plotFence(root);
  for (const [x, y, r, h, kind] of SITE.trees) tree(root, x, y, r, h, kind);   // planted in groups (layout-scripts/fire-site.py)   // the school's trees, on the open ground
}

// ---------- call-out: the engine in bay 1 drives out with its siren on and the light bar flashing ----------
// Its path (centre of the truck): straight out of the bay and across the apron, a right turn into the near lane of
// Airway Blvd, then west along the street; when it reaches the end of the street the call ends (truck back in its bay, sound off).
export const FIRE = { group: null, s: -1, v: 0, t: 0, lights: null, onEnd: null };
function callOut(root, cx) {
  const T = fireTruck("engine"), g = T.group; root.add(g);
  const y0 = 6.6, R = 7.75, y1 = -26, lane = y1 - R, L1 = y0 - y1, L2 = Math.PI * R / 2, END = L1 + L2 + (cx - R + 55);   // ends when its nose reaches the end of the street (x -60)
  const at = (s) => {        // position (plan) and heading at distance s along the path
    if (s <= L1) return [cx, y0 - s, -Math.PI / 2];
    if (s <= L1 + L2) { const th = -(s - L1) / R; return [cx - R + R * Math.cos(th), y1 + R * Math.sin(th), Math.atan2(-Math.cos(th), Math.sin(th))]; }
    return [cx - R - (s - L1 - L2), lane, Math.PI];
  };
  const place = (s) => { const [x, y, h] = at(Math.max(0, s));
    const z = y > -29.5 ? 0 : y < -30.5 ? -0.09 : -0.09 * (-29.5 - y);   // the apron top is 0.06, the street -0.03: tyres stay on the surface
    g.position.copy(V(x, y, z)); g.rotation.y = h + Math.PI / 2; };
  place(0);
  Object.assign(FIRE, { group: g, lights: T.lights, wheels: T.wheels, wr: T.r, END, place, L1, L2 });
}
FIRE.start = () => { if (FIRE.s >= 0) return false; FIRE.s = 0; FIRE.v = 0; FIRE.t = 0; return true; };
// advance by dt seconds; returns the truck's world position while it is out, or null when it is home
FIRE.tick = (dt) => {
  if (!FIRE.group || FIRE.s < 0) return null;
  FIRE.t += dt;
  flashLights(FIRE.lights, FIRE.t);                                  // all the warning lamps double-flash, left and right in turn
  if (FIRE.t > 1.2) {                                                // a moment with the siren on before it pulls out
    const target = FIRE.s < FIRE.L1 - 4 ? 6 : FIRE.s < FIRE.L1 + FIRE.L2 ? 5 : 13;
    FIRE.v += Math.max(-4 * dt, Math.min(2.5 * dt, target - FIRE.v)); FIRE.s += FIRE.v * dt;
    for (const w of FIRE.wheels) w.rotation.x -= FIRE.v * dt / FIRE.wr;   // the wheels roll
  }
  if (FIRE.s >= FIRE.END) {                                          // end of the street: back home in its bay, lights and sound off
    FIRE.s = -1; FIRE.place(0); FIRE.group.visible = true; lightsOff(FIRE.lights); if (FIRE.onEnd) FIRE.onEnd(); return null;
  }
  FIRE.place(FIRE.s);
  return FIRE.group.position;
};

// builds everything; resolves when the 3D letters are in
export function buildScene(scene) {
  mats();
  const root = new THREE.Group();
  hall(root);
  const bc = D.bays.map(([a, b]) => (a + b) / 2);
  callOut(root, bc[0]);
  for (const [x, kind, y] of [[bc[1], "ladder", 7.4], [bc[2], "engine", 6.6], [bc[3], "tanker", 6.6]]) { const t = fireTruck(kind); t.group.position.copy(V(x, y, 0)); root.add(t.group); }   // noses just inside the bays
  wings(root); garage(root); site(root);
  scene.add(root);
  scene.background = new THREE.Color(0xffffff);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdddddd, 2.3));
  const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(-50, 80, 90); scene.add(sun);
  const signRoot = new THREE.Group(); root.add(signRoot);
  const finish = (font) => { sign(signRoot, font); brickUV(root); roofUV(root); outline(root); meetLines(root); };
  return new Promise((res) => new FontLoader().load(new URL("./helvetiker_bold.typeface.json", import.meta.url).href,
    (font) => { finish(font); res(root); }, undefined, () => { finish(null); res(root); }));
}
// lines where a roof meets another roof or a wall of another block (valleys, roofs dying into a taller wall): separate solids
// that pass through each other have no shared edge, so these are found by intersecting their triangles
function meetLines(root) {
  const roofs = [], solids = [];
  root.updateMatrixWorld(true);
  root.traverse(o => { if (!o.isMesh || o.parent !== root) return; if (o.material === M.roof) roofs.push(o); if (o.material === M.roof || o.material === M.brick) solids.push(o); });
  const tris = (m) => { const g = m.geometry, p = g.attributes.position, idx = g.index, out = [], n = idx ? idx.count : p.count;
    for (let i = 0; i < n; i += 3) { const v = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(p, idx ? idx.getX(i + k) : i + k).applyMatrix4(m.matrixWorld)); out.push(v); } return out; };
  const T = new Map(), B = new Map(), get = (m) => { if (!T.has(m)) { T.set(m, tris(m)); B.set(m, new THREE.Box3().setFromObject(m).expandByScalar(0.01)); } return T.get(m); };
  const seg = [], E = 1e-6;
  function cut(a, b) {              // segment where triangle a crosses the plane of b, clipped to b's plane: returns [p, q] or null
    const n = new THREE.Vector3().subVectors(b[1], b[0]).cross(new THREE.Vector3().subVectors(b[2], b[0])); if (n.lengthSq() < E) return null; n.normalize();
    const d = a.map(v => n.dot(v) - n.dot(b[0])); if ((d[0] > E && d[1] > E && d[2] > E) || (d[0] < -E && d[1] < -E && d[2] < -E)) return null;
    const pts = []; for (let i = 0; i < 3; i++) { const j = (i + 1) % 3; if ((d[i] > E) !== (d[j] > E) && Math.abs(d[i] - d[j]) > E) pts.push(a[i].clone().lerp(a[j], d[i] / (d[i] - d[j]))); }
    return pts.length >= 2 ? [pts[0], pts[1]] : null;
  }
  function inTri(p, t) { const [a, b, c] = t, n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    for (const [u, v] of [[a, b], [b, c], [c, a]]) if (new THREE.Vector3().subVectors(v, u).cross(new THREE.Vector3().subVectors(p, u)).dot(n) < -1e-7) return false; return true; }
  for (const r of roofs) for (const o of solids) {
    if (o === r || (r.userData.house && r.userData.house === o.userData.house)) continue;
    get(r); get(o); if (!B.get(r).intersectsBox(B.get(o))) continue;
    if (o.material === M.roof && roofs.indexOf(o) < roofs.indexOf(r)) continue;    // each roof pair once
    for (const a of T.get(r)) for (const b of T.get(o)) {
      const na = new THREE.Vector3().subVectors(a[1], a[0]).cross(new THREE.Vector3().subVectors(a[2], a[0])).normalize();
      const nb = new THREE.Vector3().subVectors(b[1], b[0]).cross(new THREE.Vector3().subVectors(b[2], b[0])).normalize();
      if (Math.abs(na.dot(nb)) > 0.999) continue;                                    // parallel faces: they touch, not cross
      const s1 = cut(a, b), s2 = cut(b, a); if (!s1 || !s2) continue;
      // overlap of the two segments along their common line
      const dir = new THREE.Vector3().crossVectors(na, nb).normalize(), P = [...s1, ...s2].map(p => [p, p.dot(dir)]);
      const [a0, a1] = [P[0][1], P[1][1]].sort((x, y) => x - y), [b0, b1] = [P[2][1], P[3][1]].sort((x, y) => x - y);
      const lo = Math.max(a0, b0), hi = Math.min(a1, b1); if (hi - lo < 0.05) continue;
      const base = P[0][0], t0 = P[0][1], p = base.clone().addScaledVector(dir, lo - t0), q = base.clone().addScaledVector(dir, hi - t0);
      // keep only the part that lies on the outside of the other solid's surface (both ends on real faces)
      if (!inTri(p, b) && !inTri(p, a)) continue;
      seg.push(p, q);
    }
  }
  if (seg.length) root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg), M.line));
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
