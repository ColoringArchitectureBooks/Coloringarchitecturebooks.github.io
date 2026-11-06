// Train station model (layout v1): long narrow station hall with hipped ends, a canopy along the platform,
// a two-storey tower in the middle, a cross gable on the right, two tracks in front, parking and a street behind.
// Black & white like the coloring page: every face white, black outlines, siding and roof courses drawn as line art.
// Plan coords in metres: x along the tracks (0 = left end of the canopy), y depth (0 = front eave line, negative = tracks), z up (0 = platform top).
// Three.js is y-up, so a plan point (x, y, z) maps to (x, z, -y).
// The page (page.jpg, 1492 x 1054) is a near-orthographic front: x = (px - 10) / 60, z = (905 - py) / 60.
import * as THREE from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

export const V = (x, y, z) => new THREE.Vector3(x, z, -y);
const PX = (px) => (px - 10) / 60, PZ = (py) => (905 - py) / 60;

// ---------- dimensions ----------
export const D = {
  hall: { x0: 1.0, x1: 22.5, y0: 0.3, y1: 6.3, eave: 6.5 },          // ground-floor walls; the main roof's eave sits at 6.5
  roof: { x0: 0.6, y0: 0, y1: 6.7, ridge: 9.33 },                     // hipped main roof (ridge height off the page)
  canopy: { x0: 0, x1: 23.7, y: -3.0, z0: 4.67, z1: 5.17 },          // platform canopy: fascia 4.67..5.17, rises to the wall at 6.5
  posts: [60, 230, 418, 590, 745, 920, 1085, 1240, 1410].map(PX), postY: -2.75,
  tower: { x0: 8.1, x1: 14.9, h: 9.58 },                              // two-storey block with the bracketed cornice
  gable: { x0: 15.33, x1: 22.5, eave: 7.67, pitch: 0.83 },            // cross gable on the right, ridge front to back
  entry: { x0: 10.9, x1: 17.0, eave: 4.5, peak: 7.08, y0: -3.25 },    // TRAIN STATION gable over the canopy
  track: [-7.0, -11.2], gauge: 1.435, rail: -0.72, ground: -1.0,
  platform: { x0: -18, x1: 42, y0: -5.3, y1: 9 },
};
const H = D.hall, C = D.canopy;
const cslope = (D.hall.eave - C.z1) / (0 - C.y);                     // canopy roof rise per metre
const rpitch = (D.roof.ridge - H.eave) / ((D.roof.y1 - D.roof.y0) / 2);

// ---------- textures + materials ----------
const M = {};
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
function mats() {
  const L = (o) => new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, color: 0xffffff, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...o });
  // clapboard siding: a line every 0.25 m (1 m tile); v = height
  const siding = canvasTex(64, 256, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = "#000"; for (let k = 0; k < 4; k++) g.fillRect(0, k * 64 + 31, w, 2.2); });
  // roof courses: a line every 0.3 m along the slope (1.2 m tile)
  const roof = canvasTex(64, 256, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = "#000"; for (let k = 0; k < 4; k++) g.fillRect(0, k * 64 + 31, w, 2.6); });
  // chimney brick (page): rows 0.25 m, bricks 0.5 m
  const brick = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.strokeStyle = "#000"; g.lineWidth = 3;
    for (let r = 0; r < 4; r++) { const y = r * 64; g.beginPath(); g.moveTo(0, y + 1); g.lineTo(w, y + 1); g.stroke();
      for (let x = (r % 2) * 64; x < w; x += 128) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 64); g.stroke(); } }
  });
  // ballast: small pebbles drawn as outlines (page), 4 m tile
  const ballast = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.strokeStyle = "#000"; g.lineWidth = 1.6;
    let k = 7; const rnd = () => (k = (k * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 260; i++) { const x = rnd() * w, y = rnd() * h, r = 3 + rnd() * 4;
      g.beginPath(); g.ellipse(x, y, r * 1.3, r, rnd() * 3, 0, 7); g.stroke(); }
  });
  ballast.repeat.set(0.25, 0.25);
  M.white = L({}); M.ground = L({}); M.siding = L({ map: siding }); M.roof = L({ map: roof }); M.brick = L({ map: brick }); M.ballast = L({ map: ballast });
  M.line = new THREE.LineBasicMaterial({ color: 0x000000 });
  const page = new THREE.TextureLoader().load(new URL("./page.jpg", import.meta.url).href); page.colorSpace = THREE.SRGBColorSpace; page.anisotropy = 8;
  M.page = L({ map: page });
}
// world-metre UVs for siding and brick: u along the wall, v = height (courses line up all round)
function wallUV(root) {
  root.updateMatrixWorld(true);
  const p = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
  root.traverse(o => {
    if (!o.isMesh || (o.material !== M.siding && o.material !== M.brick)) return;
    const s = o.material === M.brick ? 2 : 1;
    const g = o.geometry, pos = g.attributes.position; if (!g.attributes.normal) g.computeVertexNormals();
    const nor = g.attributes.normal, uv = g.attributes.uv || new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
    nm.getNormalMatrix(o.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
      if (Math.abs(n.y) > 0.5) uv.setXY(i, 0.5, 0.0);
      else uv.setXY(i, (Math.abs(n.x) > Math.abs(n.z) ? p.z : p.x) / s, p.y / s);
    }
    g.setAttribute("uv", uv); uv.needsUpdate = true;
  });
}

// ---------- helpers ----------
function box(root, x0, x1, y0, y1, z0, z1, mat = M.white) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0), Math.abs(y1 - y0)), mat);
  m.position.copy(V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); root.add(m); return m;
}
function flat(root, pts, z, mat = M.ground) {
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)))); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.position.y = z; root.add(m); return m;
}
function slab(root, pts, z0, z1, mat = M.white) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: z1 - z0, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, mat); m.position.y = z0; root.add(m); return m;
}
const shapeOf = (pts) => new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
// elevation shape (x, z) extruded in plan y from y0 to y1
function elevShape(root, shape, y0, y1, mat = M.white, seg = 24) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false, curveSegments: seg });
  const m = new THREE.Mesh(g, mat); m.position.z = -y1; root.add(m); return m;
}
const elev = (root, pts, y0, y1, mat) => elevShape(root, shapeOf(pts), y0, y1, mat);
// side shape (y, z) extruded in plan x from x0 to x1
function sideShape(root, shape, x0, x1, mat = M.white) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false, curveSegments: 24 });
  g.rotateY(Math.PI / 2); const m = new THREE.Mesh(g, mat); m.position.x = x0; root.add(m); return m;
}
const side = (root, pts, x0, x1, mat) => sideShape(root, shapeOf(pts), x0, x1, mat);
function lines(root, segs) {
  const pts = []; for (const [a, b] of segs) pts.push(V(...a), V(...b));
  root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), M.line));
}
// cylinder along plan 'z' (up), 'x' or 'y', centred at (x, y, z)
function cyl(root, x, y, z, r, len, axis = "z", seg = 20, mat = M.white, rTop = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, len, seg), mat);
  if (axis === "x") m.rotation.z = -Math.PI / 2; else if (axis === "y") m.rotation.x = -Math.PI / 2;
  m.position.copy(V(x, y, z)); root.add(m); return m;
}
function ball(root, x, y, z, r) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10), M.white); m.position.copy(V(x, y, z)); root.add(m); return m; }
// a flat planar polygon in 3D (plan points), with course lines running along `along` (unit plan vector)
function plane(root, pts, mat = M.roof, along = [1, 0, 0]) {
  const P = pts.map(p => new THREE.Vector3(...p));
  const n = new THREE.Vector3().subVectors(P[1], P[0]).cross(new THREE.Vector3().subVectors(P[2], P[0])).normalize();
  const e = new THREE.Vector3(...along).normalize(), s = new THREE.Vector3().crossVectors(n, e).normalize();
  const c2 = P.map(p => new THREE.Vector2(p.dot(e), p.dot(s)));
  const tris = THREE.ShapeUtils.triangulateShape(c2, []);
  const pos = [], uv = [];
  for (const t of tris) for (const i of t) { const q = V(...pts[i]); pos.push(q.x, q.y, q.z); uv.push(c2[i].x / 1.2, c2[i].y / 1.2); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); root.add(m);
  const ring = P.map((_, i) => [pts[i], pts[(i + 1) % pts.length]]); lines(root, ring); m.userData.noEdge = true;
  return m;
}
// a point on a wall face: '-y' front (plane y = at), '+y' back, '-x' left end, '+x' right end; a = along, z = up
function F(face, at, a, z, out = 0) {
  if (face === "-y") return [a, at - out, z]; if (face === "+y") return [a, at + out, z];
  if (face === "-x") return [at - out, a, z]; return [at + out, a, z];
}
function fbox(root, face, at, a0, a1, z0, z1, o0, o1, mat = M.white) {
  const p = F(face, at, a0, z0, o0), q = F(face, at, a1, z1, o1);
  return box(root, Math.min(p[0], q[0]), Math.max(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[1], q[1]), z0, z1, mat);
}
// rectangular window or door: frame, white glass, muntins as lines, head trim and sill (page)
function opening(root, face, at, a0, a1, z0, z1, cols = 2, rows = 2, sill = true) {
  const fr = 0.1, out = 0.08;
  fbox(root, face, at, a0 + fr, a1 - fr, z0 + fr, z1 - fr, 0, 0.03);
  fbox(root, face, at, a0, a1, z1 - fr, z1, 0, out); fbox(root, face, at, a0, a1, z0, z0 + fr, 0, out);
  fbox(root, face, at, a0, a0 + fr, z0, z1, 0, out); fbox(root, face, at, a1 - fr, a1, z0, z1, 0, out);
  const s = [];
  for (let i = 1; i < cols; i++) { const a = a0 + (a1 - a0) * i / cols; s.push([F(face, at, a, z0 + fr, 0.05), F(face, at, a, z1 - fr, 0.05)]); }
  for (let j = 1; j < rows; j++) { const z = z0 + (z1 - z0) * j / rows; s.push([F(face, at, a0 + fr, z, 0.05), F(face, at, a1 - fr, z, 0.05)]); }
  lines(root, s);
  fbox(root, face, at, a0 - 0.12, a1 + 0.12, z1, z1 + 0.14, 0, 0.14);                 // head trim
  if (sill) fbox(root, face, at, a0 - 0.12, a1 + 0.12, z0 - 0.12, z0, 0, 0.16);
}
// tall arched window (page): segmental head, arched hood moulding, sill, cross muntins
function archWindow(root, face, at, a0, a1, z0, z1) {
  const w = a1 - a0, ac = (a0 + a1) / 2, rise = w * 0.32, zs = z1 - rise;
  const R = (w * w / 4 + rise * rise) / (2 * rise), zc = z1 - R, th0 = Math.asin((w / 2) / R);
  const arc = (r, n = 16) => { const p = []; for (let k = 0; k <= n; k++) { const t = -th0 + 2 * th0 * k / n; p.push([ac + r * Math.sin(t), zc + r * Math.cos(t)]); } return p; };
  const mk = (pts, o0, o1) => {       // shape (a, z) on the face, standing o0..o1 out of the wall
    const flip = !(face === "-y" || face === "+x");
    const g = new THREE.ExtrudeGeometry(shapeOf(pts.map(([a, z]) => [flip ? -a : a, z])), { depth: o1 - o0, bevelEnabled: false });
    const m = new THREE.Mesh(g, M.white);
    if (face === "-y") m.position.set(0, 0, -at + o0);
    else if (face === "+y") { m.rotation.y = Math.PI; m.position.set(0, 0, -at - o0); }
    else if (face === "+x") { m.rotation.y = Math.PI / 2; m.position.set(at + o0, 0, 0); }
    else { m.rotation.y = -Math.PI / 2; m.position.set(at - o0, 0, 0); }
    root.add(m); return m;
  };
  const f = 0.1;
  mk([[a0 + f, z0 + f], [a1 - f, z0 + f], ...arc(R - f).reverse()], 0, 0.03);                                   // glass
  mk([[a0, z0], ...arc(R), [a1, z0], [a1 - f, z0], ...arc(R - f).reverse(), [a0 + f, z0]], 0, 0.08);          // frame
  mk([[a0 - 0.16, zs - 0.05], ...arc(R + 0.16), [a1 + 0.16, zs - 0.05], [a1 + 0.01, zs - 0.05], ...arc(R + 0.01).reverse(), [a0 - 0.01, zs - 0.05]], 0, 0.16);   // hood
  fbox(root, face, at, a0 - 0.15, a1 + 0.15, z0 - 0.14, z0, 0, 0.18);                   // sill
  fbox(root, face, at, a0 - 0.05, a1 + 0.05, z0 - 0.34, z0 - 0.14, 0, 0.08);            // apron under the sill
  lines(root, [[F(face, at, ac, z0 + f, 0.05), F(face, at, ac, z1 - f, 0.05)], [F(face, at, a0 + f, (z0 + zs) / 2 + 0.2, 0.05), F(face, at, a1 - f, (z0 + zs) / 2 + 0.2, 0.05)]]);
}

// ---------- ground-floor hall, main roof, canopy ----------
function hall(root) {
  box(root, H.x0, H.x1, H.y0, H.y1, -0.02, H.eave, M.siding);
  box(root, H.x0 - 0.06, H.x1 + 0.06, H.y0 - 0.06, H.y1 + 0.06, -0.02, 0.35);                         // base board
  // main roof: hipped at the left; on the right it runs into the cross gable (valley line)
  const R = D.roof, e = H.eave, mid = (R.y0 + R.y1) / 2, rr = R.ridge, gx = D.gable.x0, gp = D.gable.pitch;
  const ry = (z) => (z - e) / rpitch;                               // depth where the front slope reaches height z
  const xv = (z) => gx + (z - D.gable.eave) / gp;                    // x where the gable's left slope reaches height z
  const hipIn = mid - R.y0;
  plane(root, [[R.x0, R.y0, e], [gx, R.y0, e], [gx, ry(D.gable.eave), D.gable.eave], [xv(rr), mid, rr], [R.x0 + hipIn, mid, rr]]);
  plane(root, [[R.x0, R.y1, e], [R.x0 + hipIn, mid, rr], [xv(rr), mid, rr], [gx, R.y1 - ry(D.gable.eave), D.gable.eave], [gx, R.y1, e]]);
  plane(root, [[R.x0, R.y0, e], [R.x0 + hipIn, mid, rr], [R.x0, R.y1, e]], M.roof, [0, 1, 0]);
  box(root, R.x0, gx, R.y1 - 0.02, R.y1 + 0.02, e - 0.25, e);                                           // back fascia
  box(root, R.x0 - 0.02, R.x0 + 0.02, R.y0, R.y1, e - 0.25, e);                                         // left fascia
  // canopy roof from the fascia up to the wall line, hipped at both ends (page)
  const a = 0.6, top = H.eave;
  plane(root, [[C.x0, C.y, C.z1], [C.x1, C.y, C.z1], [C.x1 - a, 0, top], [C.x0 + a, 0, top]]);
  plane(root, [[C.x0, C.y, C.z1], [C.x0 + a, 0, top], [C.x0, 0, C.z1]], M.roof, [0, 1, 0]);
  plane(root, [[C.x1, C.y, C.z1], [C.x1, 0, C.z1], [C.x1 - a, 0, top]], M.roof, [0, 1, 0]);
  box(root, C.x0, C.x1, C.y - 0.08, C.y + 0.08, C.z0, C.z1);                                           // fascia
  for (const x of [C.x0, C.x1]) box(root, x - 0.08, x + 0.08, C.y, H.y0, C.z0, C.z1);
  box(root, C.x0, C.x1, C.y, H.y0, C.z0 - 0.04, C.z0);                                                 // soffit
  box(root, D.gable.x0, H.x1, 0, H.y0 + 0.02, top - 0.05, top);                                       // closes the strip between the canopy and the gable wall
  plane(root, [[H.x1, 0, C.z0], [C.x1, 0, C.z0], [C.x1, 0, C.z1], [C.x1 - a, 0, top], [H.x1, 0, top]], M.white);      // canopy end closed against the wall line
  plane(root, [[C.x0, 0, C.z0], [H.x0, 0, C.z0], [H.x0, 0, top], [C.x0 + a, 0, top], [C.x0, 0, C.z1]], M.white);
  lines(root, [[[C.x0, C.y - 0.09, C.z0 + 0.25], [C.x1, C.y - 0.09, C.z0 + 0.25]]]);                    // fascia moulding line
  // posts with base and capital, arched spandrels between them (page)
  const pw = 0.24, py = D.postY;
  for (const x of D.posts) {
    box(root, x - pw / 2, x + pw / 2, py - pw / 2, py + pw / 2, 0, C.z0);
    box(root, x - 0.22, x + 0.22, py - 0.22, py + 0.22, 0, 0.45);
    box(root, x - 0.2, x + 0.2, py - 0.2, py + 0.2, 3.35, 3.5);
    box(root, x - 0.24, x + 0.24, py - 0.24, py + 0.24, 3.5, 3.6);
  }
  const zs = 3.6, crown = 4.45, t = 0.1;
  const spandrel = (a0, a1) => {      // shape between the posts: fascia down to an elliptic arch
    const pts = [[a0, zs]], w = (a1 - a0) / 2, c = (a0 + a1) / 2;
    for (let k = 1; k < 24; k++) { const th = Math.PI - Math.PI * k / 24; pts.push([c + w * Math.cos(th), zs + (crown - zs) * Math.sin(th)]); }
    pts.push([a1, zs], [a1, C.z0], [a0, C.z0]); return pts;
  };
  for (let i = 0; i + 1 < D.posts.length; i++) elev(root, spandrel(D.posts[i] + pw / 2, D.posts[i + 1] - pw / 2), py - t / 2, py + t / 2);
  for (const x of [D.posts[0], D.posts[D.posts.length - 1]]) side(root, spandrel(py + pw / 2, H.y0), x - t / 2, x + t / 2);
  // small brackets at each post head (page)
  for (const x of D.posts) for (const s of [-1, 1]) {
    const b = x + s * pw / 2;
    elev(root, [[b, 4.15], [b, C.z0], [b + s * 0.55, C.z0]].map(p => s < 0 ? p : p), py - 0.05, py + 0.05);
  }
}

// ---------- tower: two storeys, bracketed cornice, low hipped roof with a vent, brick chimney ----------
function tower(root) {
  const T = D.tower, y0 = H.y0, y1 = H.y1, cx = (T.x0 + T.x1) / 2, cy = (y0 + y1) / 2;
  box(root, T.x0, T.x1, y0, y1, H.eave - 0.5, T.h, M.siding);
  box(root, T.x0 - 0.05, T.x1 + 0.05, y0 - 0.05, y1 + 0.05, T.h - 0.3, T.h);                                // frieze board
  for (const [x, y] of [[T.x0, y0], [T.x1, y0], [T.x0, y1], [T.x1, y1]]) box(root, x - 0.12, x + 0.12, y - 0.12, y + 0.12, H.eave - 0.2, T.h - 0.3);   // corner boards
  const o = 0.35, zc = T.h + 0.42;
  box(root, T.x0 - o, T.x1 + o, y0 - o, y1 + o, zc - 0.22, zc);                                             // cornice
  box(root, T.x0 - o + 0.12, T.x1 + o - 0.12, y0 - o + 0.12, y1 + o - 0.12, T.h, zc - 0.22);
  for (let x = T.x0 + 0.35; x < T.x1 - 0.2; x += 0.62) {                                                   // brackets under the cornice
    box(root, x - 0.08, x + 0.08, y0 - 0.3, y0, T.h - 0.3, zc - 0.22); box(root, x - 0.08, x + 0.08, y1, y1 + 0.3, T.h - 0.3, zc - 0.22);
  }
  for (let y = y0 + 0.35; y < y1 - 0.2; y += 0.62) {
    box(root, T.x0 - 0.3, T.x0, y - 0.08, y + 0.08, T.h - 0.3, zc - 0.22); box(root, T.x1, T.x1 + 0.3, y - 0.08, y + 0.08, T.h - 0.3, zc - 0.22);
  }
  // low hipped roof with a flat top (page)
  const a = [T.x0 - o, y0 - o], b = [T.x1 + o, y1 + o], i = 1.0, zt = 11.0;
  const E = [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]], Tp = [[a[0] + i, a[1] + i], [b[0] - i, a[1] + i], [b[0] - i, b[1] - i], [a[0] + i, b[1] - i]];
  const dirs = [[1, 0, 0], [0, 1, 0], [1, 0, 0], [0, 1, 0]];
  for (let k = 0; k < 4; k++) { const n = (k + 1) % 4; plane(root, [[...E[k], zc], [...E[n], zc], [...Tp[n], zt], [...Tp[k], zt]], M.roof, dirs[k]); }
  plane(root, Tp.map(p => [...p, zt]), M.white);
  cyl(root, cx, cy, zt + 0.2, 0.14, 0.4); cyl(root, cx, cy, zt + 0.45, 0.24, 0.1); ball(root, cx, cy, zt + 0.6, 0.12);   // vent with cap (page)
  box(root, 13.05, 14.05, 3.0, 4.0, 9.0, 11.83, M.brick); box(root, 12.95, 14.15, 2.9, 4.1, 11.83, 12.0);   // chimney
  archWindow(root, "-y", y0, PX(572), PX(640), 6.75, PZ(362));
  archWindow(root, "-y", y0, PX(748), PX(815), 6.75, PZ(362));
  archWindow(root, "+y", y1, PX(572), PX(640), 6.75, PZ(362));
  archWindow(root, "+y", y1, PX(748), PX(815), 6.75, PZ(362));
  archWindow(root, "-x", T.x0, cy - 0.56, cy + 0.56, 6.9, PZ(362));
}

// ---------- cross gable on the right (ridge front to back), truss in the front gable ----------
function crossGable(root) {
  const G = D.gable, y0 = H.y0, y1 = H.y1, mid = (G.x0 + G.x1) / 2, r = (G.x1 - G.x0) / 2 * G.pitch, pk = G.eave + r;
  elev(root, [[G.x0, H.eave - 0.5], [G.x1, H.eave - 0.5], [G.x1, G.eave], [mid, pk], [G.x0, G.eave]], y0, y1, M.siding);
  const o = 0.5, e0 = G.eave - o * G.pitch, ov = 0.35;
  for (const s of [-1, 1]) {           // the two roof slopes, with course lines along the ridge
    const xe = s < 0 ? G.x0 - o : G.x1 + o;
    plane(root, [[xe, y0 - ov, e0], [mid, y0 - ov, pk + 0.12], [mid, y1 + ov, pk + 0.12], [xe, y1 + ov, e0]], M.roof, [0, 1, 0]);
  }
  for (const y of [y0 - ov, y1 + ov]) {      // bargeboards
    const t = 0.18, fz = 0.32;
    elev(root, [[G.x0 - o, e0 - fz], [mid, pk + 0.12 - fz], [G.x1 + o, e0 - fz], [G.x1 + o, e0], [mid, pk + 0.12], [G.x0 - o, e0]], y - t / 2, y + t / 2);
  }
  for (const x of [G.x0, G.x1]) for (const y of [y0, y1]) box(root, x - 0.12, x + 0.12, y - 0.12, y + 0.12, H.eave - 0.3, G.eave);   // corner boards (page)
  // truss in the front gable: collar, king post with a drop, X braces (page)
  const yt = y0 - 0.2, zc = 9.6;
  const wAt = (z) => (pk - z) / G.pitch;      // half-width of the gable at height z
  box(root, mid - wAt(zc) + 0.15, mid + wAt(zc) - 0.15, yt - 0.06, yt + 0.06, zc - 0.07, zc + 0.07);
  box(root, mid - 0.07, mid + 0.07, yt - 0.08, yt + 0.08, zc - 0.55, pk - 0.05);
  const drop = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 4), M.white); drop.rotation.x = Math.PI; drop.position.copy(V(mid, yt - 0.02, zc - 0.72)); root.add(drop);
  const strut = (ax, az, bx, bz) => { const A = V(ax, yt, az), B = V(bx, yt, bz), m = new THREE.Mesh(new THREE.BoxGeometry(0.1, A.distanceTo(B), 0.1), M.white);
    m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); root.add(m); };
  for (const s of [-1, 1]) { strut(mid + s * 0.1, zc + 0.08, mid + s * (wAt(pk - 1.0) - 0.05), pk - 1.0); strut(mid + s * 0.1, pk - 0.9, mid + s * (wAt(zc + 0.1) - 0.3), zc + 0.1); }
  archWindow(root, "-y", y0, PX(1110), PX(1185), 6.75, PZ(362));
  archWindow(root, "+y", y1, PX(1110), PX(1185), 6.75, PZ(362));
}

// ---------- dormer on the left of the roof: arched hood roof, arched window ----------
function dormer(root) {
  const x0 = PX(320), x1 = PX(430), yf = 0.15, yb = 3.35, zt = 8.42, crown = 9.0, o = 0.2;
  box(root, x0, x1, yf, yb, 6.5, zt, M.siding);
  const seg = []; const w = (x1 - x0) / 2 + o, c = (x0 + x1) / 2;
  for (let k = 0; k <= 20; k++) { const t = Math.PI - Math.PI * k / 20; seg.push([c + w * Math.cos(t), zt + (crown - zt) * Math.sin(t)]); }
  elev(root, [[c - w, zt - 0.12], ...seg, [c + w, zt - 0.12]], yf - 0.25, yb);
  archWindow(root, "-y", yf, PX(342), PX(410), 6.75, PZ(402));
}

// ---------- TRAIN STATION gable over the canopy, with the sign, truss and finial ----------
function entryGable(root, font) {
  const E = D.entry, mid = (E.x0 + E.x1) / 2, pitch = (E.peak - E.eave) / ((E.x1 - E.x0) / 2), yb = H.y0, yf = E.y0;
  const zIn = (x) => E.peak - Math.abs(x - mid) * pitch;
  const xin0 = E.x0 + 0.3, xin1 = E.x1 - 0.3;
  elev(root, [[xin0, C.z0], [xin1, C.z0], [xin1, zIn(xin1) - 0.25], [mid, E.peak - 0.25], [xin0, zIn(xin0) - 0.25]], yf, yb);
  for (const s of [-1, 1]) {
    const xe = s < 0 ? E.x0 : E.x1;
    plane(root, [[xe, yf - 0.2, E.eave], [mid, yf - 0.2, E.peak], [mid, yb, E.peak], [xe, yb, E.eave]], M.roof, [0, 1, 0]);
  }
  const t = 0.16, fz = 0.3;     // bargeboard
  elev(root, [[E.x0, E.eave - fz], [mid, E.peak - fz], [E.x1, E.eave - fz], [E.x1, E.eave], [mid, E.peak], [E.x0, E.eave]], yf - 0.2 - t, yf - 0.2);
  // truss: king post, two raking braces, short X under the peak (page)
  const yt = yf - 0.08;
  box(root, mid - 0.06, mid + 0.06, yt - 0.06, yt + 0.06, 5.45, E.peak - 0.3);
  const strut = (ax, az, bx, bz) => { const A = V(ax, yt, az), B = V(bx, yt, bz), m = new THREE.Mesh(new THREE.BoxGeometry(0.09, A.distanceTo(B), 0.09), M.white);
    m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); root.add(m); };
  for (const s of [-1, 1]) { strut(mid, 5.55, mid + s * 1.6, zIn(mid + s * 1.6) - 0.3); strut(mid + s * 0.06, E.peak - 0.6, mid + s * 1.1, 5.55); }
  box(root, mid - 1.9, mid + 1.9, yt - 0.05, yt + 0.05, 5.45, 5.55);
  // finial at the peak
  cyl(root, mid, yf - 0.15, E.peak + 0.12, 0.08, 0.25); ball(root, mid, yf - 0.15, E.peak + 0.33, 0.12);
  const sp = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 8), M.white); sp.position.copy(V(mid, yf - 0.15, E.peak + 0.58)); root.add(sp);
  // sign board with raised letters
  const sx0 = PX(735), sx1 = PX(965), sz0 = PZ(625) + 0.03, sz1 = PZ(585);
  box(root, sx0, sx1, yf - 0.14, yf, sz0, sz1);
  lines(root, [[[sx0 + 0.08, yf - 0.15, sz0 + 0.08], [sx1 - 0.08, yf - 0.15, sz0 + 0.08]], [[sx1 - 0.08, yf - 0.15, sz0 + 0.08], [sx1 - 0.08, yf - 0.15, sz1 - 0.08]],
    [[sx1 - 0.08, yf - 0.15, sz1 - 0.08], [sx0 + 0.08, yf - 0.15, sz1 - 0.08]], [[sx0 + 0.08, yf - 0.15, sz1 - 0.08], [sx0 + 0.08, yf - 0.15, sz0 + 0.08]]]);
  if (!font) return;
  const tg = new TextGeometry("TRAIN STATION", { font, size: 0.34, height: 0.05, curveSegments: 6 });
  tg.computeBoundingBox(); const bb = tg.boundingBox;
  const m = new THREE.Mesh(tg, M.white); m.position.copy(V((sx0 + sx1) / 2 - (bb.max.x - bb.min.x) / 2, yf - 0.14, (sz0 + sz1) / 2 - 0.17)); root.add(m);
}

// ---------- the platform front: windows, door, posters, clock, timetable, benches, lamps ----------
function pageCard(root, px0, py0, px1, py1, y, out = 0.04) {      // a board whose face is the page's own drawing
  const x0 = PX(px0), x1 = PX(px1), z0 = PZ(py1), z1 = PZ(py0);
  box(root, x0, x1, y - out, y, z0, z1);
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0), uv = g.attributes.uv, W = 1492, Hh = 1054;
  for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, (px0 + (px1 - px0) * u) / W, 1 - (py1 - (py1 - py0) * v) / Hh); }
  const m = new THREE.Mesh(g, M.page); m.position.copy(V((x0 + x1) / 2, y - out - 0.005, (z0 + z1) / 2)); m.userData.noEdge = true; root.add(m);
}
function bench(root, x0, x1) {
  const yb = H.y0 - 0.15, yf = yb - 0.6;
  box(root, x0, x1, yf, yb - 0.1, 0.72, 0.8);
  for (const z of [0.95, 1.15, 1.35]) box(root, x0, x1, yb - 0.12, yb - 0.06, z, z + 0.12);
  for (const x of [x0 + 0.1, x1 - 0.18]) { box(root, x, x + 0.08, yf + 0.05, yf + 0.13, 0, 0.72); box(root, x, x + 0.08, yb - 0.12, yb - 0.04, 0, 1.47); box(root, x - 0.03, x + 0.11, yf - 0.02, yb - 0.04, 0.8, 0.86); }
}
function hangLamp(root, x, y) {
  cyl(root, x, y, 4.3, 0.025, 0.74, "z", 6);
  cyl(root, x, y, 3.82, 0.32, 0.22, "z", 24, M.white, 0.08); cyl(root, x, y, 4.0, 0.08, 0.14, "z", 12); ball(root, x, y, 3.68, 0.1);
}
function front(root) {
  const y = H.y0;
  opening(root, "-y", y, PX(630), PX(715), PZ(820), PZ(700));
  opening(root, "-y", y, PX(955), PX(1050), PZ(820), PZ(700));
  opening(root, "-y", y, PX(1120), PX(1195), PZ(820), PZ(700));
  opening(root, "-y", y, 1.8, 3.2, PZ(820), PZ(700)); opening(root, "-y", y, 4.6, 6.0, PZ(820), PZ(700));     // behind the train on the page
  opening(root, "-y", y, 7.1, 8.9, 0, 3.0, 2, 1, false); opening(root, "-y", y, 7.1, 8.9, 3.15, PZ(700), 2, 1, false);  // double door with transom
  pageCard(root, 762, 690, 852, 858, y);           // RAILWAY ROUTE poster
  pageCard(root, 858, 758, 910, 848, y);           // timetable
  pageCard(root, 1268, 686, 1372, 858, y);         // TRAIN ROUTES poster
  // round clock on a bracket (page): disc with the page's face
  const cxk = PX(884), czk = PZ(712);
  box(root, cxk - 0.08, cxk + 0.08, y - 0.3, y, czk + 0.55, czk + 0.65);
  cyl(root, cxk, y - 0.22, czk, 0.42, 0.14, "y", 32);
  { const r = 0.36, g = new THREE.CircleGeometry(r, 40), uv = g.attributes.uv, pos = g.attributes.position;
    for (let i = 0; i < uv.count; i++) { const px = 884 + pos.getX(i) * 60, py = 712 - pos.getY(i) * 60; uv.setXY(i, px / 1492, 1 - py / 1054); }
    const m = new THREE.Mesh(g, M.page); m.position.copy(V(cxk, y - 0.30, czk)); m.userData.noEdge = true; root.add(m); }
  bench(root, PX(640), PX(730)); bench(root, PX(940), PX(1065)); bench(root, PX(1100), PX(1225)); bench(root, 2.0, 4.0);
  hangLamp(root, PX(833), -1.4); hangLamp(root, PX(1160), -1.4); hangLamp(root, 5.2, -1.4);
  // back and ends
  const yb = H.y1;
  for (const [a0, a1] of [[1.8, 3.2], [4.6, 6.0], [PX(630), PX(715)], [16.0, 17.4], [19.6, 21.0]]) opening(root, "+y", yb, a0, a1, PZ(820), PZ(700));
  opening(root, "+y", yb, 10.6, 12.4, 0, 3.0, 2, 1, false); opening(root, "+y", yb, 10.6, 12.4, 3.15, PZ(700), 2, 1, false);
  box(root, 10.2, 12.8, yb, yb + 1.3, 3.75, 3.9);                                                      // small canopy over the street door
  opening(root, "-x", H.x0, 2.3, 3.7, PZ(820), PZ(700)); opening(root, "+x", H.x1, 2.3, 3.7, PZ(820), PZ(700));
}

// ---------- street lamp and picket fence on the right (page) ----------
function lampPost(root, x, y) {
  box(root, x - 0.22, x + 0.22, y - 0.22, y + 0.22, 0, 0.35); cyl(root, x, y, 0.55, 0.16, 0.4, "z", 16, M.white, 0.1);
  cyl(root, x, y, 2.6, 0.08, 4.0, "z", 12); cyl(root, x, y, 4.35, 0.15, 0.2, "z", 16);
  cyl(root, x, y, 4.95, 0.28, 1.0, "z", 6, M.white, 0.36);      // lantern glass (six sided, wider at the top)
  cyl(root, x, y, 5.55, 0.45, 0.25, "z", 6, M.white, 0.08); ball(root, x, y, 5.78, 0.08);
}
function fence(root) {
  const y = H.y0 + 0.05, x0 = H.x1 + 0.1, x1 = 31;
  box(root, x0, x1, y - 0.04, y + 0.04, 0.35, 0.45); box(root, x0, x1, y - 0.04, y + 0.04, 0.95, 1.05);
  for (let x = x0; x < x1; x += 0.28) {
    const p = [[x, 0], [x + 0.14, 0], [x + 0.14, 1.15], [x + 0.07, 1.3], [x, 1.15]];
    elev(root, p, y - 0.08, y - 0.04);
  }
  for (const x of [x0, x1 - 0.12]) box(root, x, x + 0.14, y - 0.07, y + 0.07, 0, 1.45);
}

// ---------- the train: steam locomotive and one coach on track 1 (page) ----------
function wheel(root, x, y, zr, r, spokes = 12) {
  const zc = zr + r;
  cyl(root, x, y, zc, r, 0.14, "y", 32); cyl(root, x, y + Math.sign(y + 7) * 0.08, zc, r * 0.18, 0.1, "y", 16);
  const s = []; const yo = y + Math.sign(y + 7) * 0.075;
  for (let k = 0; k < spokes; k++) { const a = 2 * Math.PI * k / spokes; s.push([[x + r * 0.18 * Math.cos(a), yo, zc + r * 0.18 * Math.sin(a)], [x + r * 0.82 * Math.cos(a), yo, zc + r * 0.82 * Math.sin(a)]]); }
  const n = 40; for (let k = 0; k < n; k++) { const a = 2 * Math.PI * k / n, b = 2 * Math.PI * (k + 1) / n; s.push([[x + r * 0.84 * Math.cos(a), yo, zc + r * 0.84 * Math.sin(a)], [x + r * 0.84 * Math.cos(b), yo, zc + r * 0.84 * Math.sin(b)]]); }
  lines(root, s);
}
function train(root) {
  const yc = D.track[0], zr = D.rail, hw = 0.75;
  // locomotive
  const drv = [PX(277), PX(378), PX(482)], rd = 0.85;
  for (const x of drv) for (const s of [-1, 1]) wheel(root, x, yc + s * hw, zr, rd);
  for (const s of [-1, 1]) wheel(root, PX(632), yc + s * hw, zr, 0.48, 8);
  for (const s of [-1, 1]) {
    const yr = yc + s * (hw + 0.14);
    box(root, drv[0] - 0.05, drv[2] + 0.05, yr - 0.04, yr + 0.04, zr + rd - 0.08, zr + rd + 0.08);                    // side rod
    box(root, drv[2], PX(560), yr - 0.04, yr + 0.04, zr + rd + 0.05, zr + rd + 0.17);                                 // main rod to the cylinder
    box(root, PX(535), PX(595), yc + s * 0.95 - 0.2, yc + s * 0.95 + 0.2, 0.05, 1.05);                                // cylinder / steam chest
    cyl(root, (PX(535) + PX(595)) / 2, yc + s * 0.95, 0.55, 0.36, PX(605) - PX(525), "x", 20);
  }
  box(root, PX(190), PX(660), yc - 1.05, yc + 1.05, 0.95, 1.12);                                                       // running board
  box(root, PX(200), PX(655), yc - 0.45, yc + 0.45, 0.2, 0.95);                                                        // frame
  const bx0 = PX(320), bx1 = PX(628), bz = 1.62, br = 0.8;
  cyl(root, (bx0 + bx1) / 2, yc, bz, br, bx1 - bx0, "x", 32);                                                          // boiler
  for (const x of [PX(395), PX(470), PX(530)]) cyl(root, x, yc, bz, br + 0.03, 0.07, "x", 32);                         // boiler bands
  cyl(root, PX(641), yc, bz, br + 0.06, PX(654) - PX(628), "x", 32); cyl(root, PX(657), yc, bz, 0.5, 0.06, "x", 24);   // smokebox front and door
  cyl(root, PX(575), yc, 3.0, 0.3, 1.5, "z", 20); cyl(root, PX(575), yc, 3.95, 0.3, 0.42, "z", 20, M.white, 0.44);     // smokestack, flared top
  cyl(root, PX(575), yc, 4.2, 0.44, 0.08, "z", 20);
  for (const x of [PX(390), PX(470)]) { cyl(root, x, yc, 2.6, 0.34, 0.6, "z", 20); cyl(root, x, yc, 2.95, 0.4, 0.1, "z", 20); ball(root, x, yc, 3.05, 0.3); }
  box(root, PX(605), PX(645), yc - 0.25, yc + 0.25, 2.55, 3.25); cyl(root, PX(648), yc, 2.9, 0.2, 0.08, "x", 20);     // headlight
  cyl(root, PX(340), yc, 2.6, 0.08, 0.5, "z", 10); ball(root, PX(340), yc, 2.9, 0.1);                                  // whistle
  // cab with two side windows and a curved roof
  const c0 = PX(190), c1 = PX(325), cw = 1.15;
  box(root, c0, c1, yc - cw, yc + cw, 1.12, 3.25);
  side(root, [[yc - cw - 0.15, 3.25], ...Array.from({ length: 17 }, (_, k) => { const t = Math.PI * k / 16; return [yc - (cw + 0.15) * Math.cos(t), 3.25 + 0.3 * Math.sin(t)]; }), [yc + cw + 0.15, 3.25]], c0 - 0.15, c1 + 0.1);
  for (const [a0, a1] of [[PX(210), PX(245)], [PX(258), PX(292)]]) for (const s of [-1, 1]) {
    const yy = yc + s * (cw + 0.01), zz0 = PZ(790), zz1 = PZ(735);
    lines(root, [[[a0, yy, zz0], [a1, yy, zz0]], [[a1, yy, zz0], [a1, yy, zz1]], [[a1, yy, zz1], [a0, yy, zz1]], [[a0, yy, zz1], [a0, yy, zz0]]]);
  }
  // cowcatcher (pilot): sloped bars
  side(root, [[yc - 0.85, zr + 0.05], [yc + 0.85, zr + 0.05], [yc + 0.85, 0.75], [yc - 0.85, 0.75]], PX(655), PX(668));
  const pc = [];
  for (let k = 0; k <= 6; k++) { const yy = yc - 0.85 + 1.7 * k / 6; pc.push([[PX(662), yy, 0.75], [PX(745), yy, zr + 0.08]]); }
  pc.push([[PX(745), yc - 0.85, zr + 0.08], [PX(745), yc + 0.85, zr + 0.08]]); lines(root, pc);
  elev(root, [[PX(662), 0.75], [PX(745), zr + 0.08], [PX(662), zr + 0.08]], yc - 0.86, yc - 0.82); elev(root, [[PX(662), 0.75], [PX(745), zr + 0.08], [PX(662), zr + 0.08]], yc + 0.82, yc + 0.86);
  box(root, PX(655), PX(668), yc - 0.9, yc + 0.9, 0.75, 1.0);                                                         // buffer beam
  // coach behind the cab, running off to the left (page)
  const k0 = -15.2, k1 = PX(175), kw = 1.4, kb = 0.35, kt = 3.2;
  box(root, k0, k1, yc - kw, yc + kw, kb, kt);
  side(root, [[yc - kw - 0.08, kt], ...Array.from({ length: 17 }, (_, k) => { const t = Math.PI * k / 16; return [yc - (kw + 0.08) * Math.cos(t), kt + 0.38 * Math.sin(t)]; }), [yc + kw + 0.08, kt]], k0 - 0.1, k1 + 0.1);
  box(root, k0 + 0.5, k1 - 0.5, yc - 0.5, yc + 0.5, -0.1, kb);
  for (const x of [k0 + 1.6, k0 + 2.8, PX(118), PX(183)]) for (const s of [-1, 1]) wheel(root, x, yc + s * hw, zr, 0.42, 8);
  const ww = 1.0, wz0 = PZ(780), wz1 = PZ(715), win = [];
  for (let x = k1 - 0.75 - ww; x > k0 + 0.6; x -= 1.4) for (const s of [-1, 1]) {
    const yy = yc + s * (kw + 0.01);
    win.push([[x, yy, wz0], [x + ww, yy, wz0]], [[x + ww, yy, wz0], [x + ww, yy, wz1]], [[x + ww, yy, wz1], [x, yy, wz1]], [[x, yy, wz1], [x, yy, wz0]]);
  }
  for (const s of [-1, 1]) { const yy = yc + s * (kw + 0.01); win.push([[k0, yy, 1.0], [k1, yy, 1.0]], [[k0, yy, 2.85], [k1, yy, 2.85]]); }
  lines(root, win);
  box(root, k1 - 0.3, k1 + 0.02, yc - 0.45, yc + 0.45, 0.55, 2.9);                                                    // end door
}

// ---------- site: platform, tracks, ballast, parking, street ----------
function site(root) {
  const g = D.ground, P = D.platform;
  flat(root, [[-80, -60], [110, -60], [110, 70], [-80, 70]], g - 0.02);
  slab(root, [[P.x0, P.y0], [P.x1, P.y0], [P.x1, P.y1], [P.x0, P.y1]], g, 0);
  const j = []; for (let x = P.x0 + 3.33; x < P.x1; x += 3.33) j.push([[x, P.y0 - 0.01, g], [x, P.y0 - 0.01, 0]]);
  j.push([[P.x0, P.y0 + 0.5, 0.01], [P.x1, P.y0 + 0.5, 0.01]]); lines(root, j);                                       // slab joints and the edge strip
  flat(root, [[-80, -15], [110, -15], [110, P.y0], [-80, P.y0]], g + 0.005, M.ballast);
  for (const yc of D.track) {
    for (let x = -40; x < 70; x += 0.75) box(root, x, x + 0.26, yc - 1.3, yc + 1.3, g, g + 0.14);                     // sleepers
    for (const s of [-1, 1]) { const yr = yc + s * D.gauge / 2; box(root, -80, 110, yr - 0.04, yr + 0.04, g + 0.14, D.rail); box(root, -80, 110, yr - 0.08, yr + 0.08, g + 0.14, g + 0.17); }
  }
  // parking lot behind the station and the street
  slab(root, [[-6, 12], [32, 12], [32, 26], [-6, 26]], g, g + 0.04);
  const st = []; for (let x = -5; x <= 31; x += 3) st.push([[x, 12.2, g + 0.05], [x, 17, g + 0.05]], [[x, 21, g + 0.05], [x, 25.8, g + 0.05]]);
  lines(root, st);
  slab(root, [[13, 9], [16, 9], [16, 12], [13, 12]], g, g + 0.04);                                                    // drive from the lot to the platform walk
  slab(root, [[-80, 27], [110, 27], [110, 28.5], [-80, 28.5]], g, g + 0.15);                                           // sidewalk
  const d = []; for (let x = -78; x < 108; x += 6) d.push([[x, 33.5, g + 0.01], [x + 3, 33.5, g + 0.01]]);
  d.push([[-80, 39, g + 0.01], [110, 39, g + 0.01]]); lines(root, d);
  slab(root, [[13, 26], [16, 26], [16, 27], [13, 27]], g, g + 0.04);
}

// builds everything; resolves when the 3D letters are in
export function buildScene(scene) {
  mats();
  const root = new THREE.Group();
  hall(root); tower(root); crossGable(root); dormer(root); front(root); lampPost(root, 24.6, -2.2); fence(root); train(root); site(root);
  scene.add(root);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdddddd, 2.3));
  const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(-50, 80, 90); scene.add(sun);
  const signRoot = new THREE.Group(); root.add(signRoot);
  const finish = (font) => { entryGable(signRoot, font); wallUV(root); outline(root); };
  return new Promise((res) => new FontLoader().load(new URL("./helvetiker_bold.typeface.json", import.meta.url).href,
    (font) => { finish(font); res(root); }, undefined, () => { finish(null); res(root); }));
}
// black outlines on every edge where faces meet at an angle (like the page)
function outline(root) {
  const add = [];
  root.traverse(o => {
    if (!o.isMesh || o.userData.noEdge || o.userData.edged) return;
    const t = o.geometry.type, thr = t === "CylinderGeometry" || t === "SphereGeometry" || t === "ConeGeometry" ? 40 : 20;
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, thr), M.line);
    e.position.copy(o.position); e.rotation.copy(o.rotation); e.scale.copy(o.scale); add.push([o.parent, e]); o.userData.edged = true;
  });
  for (const [p, e] of add) p.add(e);
}
