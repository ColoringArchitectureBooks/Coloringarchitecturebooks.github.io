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
  hall: { x0: 0, x1: 23.9,  y0: 0.3, y1: 6.3, eave: 6.5 },          // ground-floor walls; the main roof's eave sits at 6.5
  roof: { x0: -0.3, hx: 3.35, y0: 0, y1: 6.7, ridge: 9.33 },          // main roof covers the whole hall, hipped at the left end
  canopy: { x0: 0, x1: 23.9, y: -3.0, z0: 4.67, z1: 5.17 },          // platform canopy: fascia 4.67..5.17, rises to the wall at 6.5
  posts: [60, 230, 418, 590, 745, 920, 1085, 1240, 1410].map(PX), postY: -2.75,
  tower: { x0: 8.1, x1: 14.9, h: 9.73 },                              // two-storey block with the bracketed cornice
  gable: { x0: 15.33, x1: 22.5, eave: 7.67, pitch: 0.83 },            // cross gable on the right, ridge front to back
  entry: { x0: 10.9, x1: 17.04, eave: 5.1, peak: 6.8, y0: -3.25 },    // TRAIN STATION gable over the canopy
  track: [-7.0, -11.2], gauge: 1.435, rail: -0.72, ground: -1.0,
  platform: { x0: -18, x1: 39, y0: -5.3, y1: 9 },
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
function archWindow(root, face, at, a0, a1, z0, z1, hood = true) {
  const w = a1 - a0, ac = (a0 + a1) / 2, rise = w * 0.16, zs = z1 - rise;
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
  const seg = (xa, xb, za, zt, n = 18) => {      // circular segment through (xa,za), (xb,za) and the crown (mid, zt)
    const hw = (xb - xa) / 2, h = zt - za, r = (hw * hw + h * h) / (2 * h), cz = zt - r, t0 = Math.asin(hw / r), m = (xa + xb) / 2;
    return Array.from({ length: n + 1 }, (_, k) => { const t = -t0 + 2 * t0 * k / n; return [m + r * Math.sin(t), cz + r * Math.cos(t)]; });
  };
  if (hood) {      // flat segmental hood, thick at the crown, ends dropping straight down a little (page)
    const ho = 0.2, zo = z1 + 0.24, ze = zo - 0.21 * (w + 2 * ho), zi = z1 + 0.06 - 0.2 * (w + 0.04), zb = Math.min(ze - 0.18, zi - 0.04);
    const outer = seg(a0 - ho, a1 + ho, ze, zo), inner = seg(a0 - 0.02, a1 + 0.02, zi, z1 + 0.06);
    mk([[a0 - ho, zb], ...outer, [a1 + ho, zb], [a1 + 0.02, zb], ...inner.reverse(), [a0 - 0.02, zb]], 0, 0.14);
    mk([...seg(a0 - ho, a1 + ho, ze, zo), ...seg(a0 - ho, a1 + ho, ze - 0.07, zo - 0.07).reverse()], 0.14, 0.2);   // raised top band
  }
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
  const hipIn = R.hx;
  plane(root, [[R.x0, R.y0, e], [gx, R.y0, e], [gx, ry(D.gable.eave), D.gable.eave], [xv(rr), mid, rr], [R.x0 + hipIn, mid, rr]]);
  plane(root, [[R.x0, R.y1, e], [R.x0 + hipIn, mid, rr], [xv(rr), mid, rr], [gx, R.y1 - ry(D.gable.eave), D.gable.eave], [gx, R.y1, e]]);
  plane(root, [[R.x0, R.y0, e], [R.x0 + hipIn, mid, rr], [R.x0, R.y1, e]], M.roof, [0, 1, 0]);
  // back eave: one continuous line along the whole back; under the cross gable it carries on as a short skirt roof
  const xs1 = D.gable.x1 + (D.gable.eave - (e + (R.y1 - H.y1) * rpitch)) / gp;      // where the gable's long right slope comes down to the skirt
  box(root, R.x0, xs1, R.y1 - 0.04, R.y1, e - 0.22, e);                                                  // back fascia
  box(root, R.x0, xs1, H.y1, R.y1, e - 0.22, e - 0.18);                                                  // back soffit closes the eave
  plane(root, [[gx, R.y1, e], [xs1, R.y1, e], [xs1, H.y1, e + (R.y1 - H.y1) * rpitch], [gx, H.y1, e + (R.y1 - H.y1) * rpitch]]);
  elev(root, [[xs1 - 0.04, e - 0.22], [xs1, e - 0.22], [xs1, e + (R.y1 - H.y1) * rpitch], [xs1 - 0.04, e + (R.y1 - H.y1) * rpitch]], H.y1, R.y1);   // end board, tucked under the long slope
  box(root, R.x0, R.x0 + 0.04, R.y0, R.y1, e - 0.22, e); box(root, R.x0, H.x0, R.y0, R.y1, e - 0.22, e - 0.18);   // left eave
  // canopy roof from the fascia up to the wall line, hipped at both ends (page)
  const a = 0.6, top = H.eave;
  const yw = H.y0;      // the canopy roof runs right up to the wall face, so its hips land on the wall corners
  plane(root, [[C.x0, C.y, C.z1], [C.x1, C.y, C.z1], [C.x1 - a, yw, top], [C.x0 + a, yw, top]]);
  plane(root, [[C.x0, C.y, C.z1], [C.x0 + a, yw, top], [C.x0, yw, C.z1]], M.roof, [0, 1, 0]);
  plane(root, [[C.x1, C.y, C.z1], [C.x1, yw, C.z1], [C.x1 - a, yw, top]], M.roof, [0, 1, 0]);
  box(root, C.x0, C.x1, C.y - 0.08, C.y + 0.08, C.z0, C.z1 - 0.14);                                    // fascia board
  for (const x of [C.x0, C.x1]) box(root, x - 0.08, x + 0.08, C.y, H.y0, C.z0, C.z1 - 0.14);
  // crown moulding: two stepped caps that run past the fascia and its returns, so the ends kick out like the page
  for (const [o, z0, z1] of [[0.07, C.z1 - 0.14, C.z1 - 0.07], [0.15, C.z1 - 0.07, C.z1]]) {
    box(root, C.x0 - 0.08 - o, C.x1 + 0.08 + o, C.y - 0.08 - o, C.y + 0.08, z0, z1);
    for (const s of [-1, 1]) { const x = s < 0 ? C.x0 : C.x1; box(root, x - 0.08 - (s < 0 ? o : 0), x + 0.08 + (s > 0 ? o : 0), C.y, H.y0, z0, z1); }
  }
  box(root, C.x0, C.x1, C.y, H.y0, C.z0 - 0.04, C.z0);                                                 // soffit
  box(root, D.gable.x0, H.x1, 0, H.y0 + 0.02, top - 0.05, top);                                       // closes the strip between the canopy and the gable wall
  // the hip apexes land on the wall corners, so only a small triangle behind each hip closes the end
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
  for (const x of D.posts) {
    for (const s of [-1, 1]) {      // triangle bracket with a pierced inner triangle (page)
      const b = x + s * pw / 2;
      elev(root, [[b, 4.12], [b, C.z0], [b + s * 0.58, C.z0]], py - 0.05, py + 0.05);
      elev(root, [[b + s * 0.1, 4.3], [b + s * 0.1, C.z0 - 0.07], [b + s * 0.4, C.z0 - 0.07]], py - 0.075, py + 0.075);
    }
    box(root, x - 0.07, x + 0.07, py - pw / 2 - 0.08, py - pw / 2, C.z0 - 0.38, C.z0);                       // drop at the post head
  }
  for (const [x, s, xe] of [[D.posts[0], -1, C.x0], [D.posts[D.posts.length - 1], 1, C.x1]]) {         // curved outer brackets out to the canopy ends (page)
    const b = x + s * pw / 2, W = Math.abs(xe - b) - 0.12, pts = [[b, zs]];
    for (let k = 1; k <= 16; k++) { const th = Math.PI / 2 * k / 16; pts.push([b + s * W * (1 - Math.cos(th)), zs + (C.z0 - zs) * Math.sin(th)]); }
    pts.push([b, C.z0]); elev(root, s < 0 ? pts.reverse() : pts, py - t / 2, py + t / 2);
  }
}

// ---------- tower: two storeys, bracketed cornice, low hipped roof with a vent, brick chimney ----------
function tower(root) {
  const T = D.tower, y0 = H.y0, y1 = H.y1, cx = (T.x0 + T.x1) / 2, cy = (y0 + y1) / 2;
  box(root, T.x0, T.x1, y0, y1, H.eave, T.h, M.siding);
  box(root, T.x0 - 0.05, T.x1 + 0.05, y0 - 0.05, y1 + 0.05, T.h - 0.3, T.h);                                // frieze board
  for (const [x, y] of [[T.x0, y0], [T.x1, y0], [T.x0, y1], [T.x1, y1]]) box(root, x - 0.12, x + 0.12, y - 0.12, y + 0.12, H.eave, T.h - 0.3);   // corner boards
  const o = 0.35, zc = T.h + 0.42;
  box(root, T.x0 - o, T.x1 + o, y0 - o, y1 + o, zc - 0.22, zc);                                             // cornice
  box(root, T.x0 - o + 0.12, T.x1 + o - 0.12, y0 - o + 0.12, y1 + o - 0.12, T.h, zc - 0.22);
  box(root, T.x0 - 0.1, T.x1 + 0.1, y0 - 0.1, y1 + 0.1, T.h - 0.42, T.h - 0.3);                             // frieze bottom band
  const kt = zc - 0.22, kb = T.h - 0.3;
  const corbel = (o, d = 0.3, b = kb) => {          // profile (out, z): deep under the cornice, scrolling back to the wall
    const p = [[0, kt], [o * d, kt], [o * d, kt - 0.07]];
    for (let k = 1; k <= 8; k++) { const th = Math.PI / 2 * k / 8; p.push([o * (0.08 + (d - 0.08) * Math.cos(th)), kt - 0.07 - (kt - 0.07 - b - 0.06) * Math.sin(th)]); }
    p.push([o * 0.08, b], [0, b]); return p;
  };
  for (const y of [y0 + 0.02, y1 - 0.22]) {        // corner corbels: their scroll shows at the cornice ends (page)
    elev(root, corbel(-1, o - 0.03, T.h - 0.42).map(([q, z]) => [T.x0 + q, z]).reverse(), y, y + 0.2);
    elev(root, corbel(1, o - 0.03, T.h - 0.42).map(([q, z]) => [T.x1 + q, z]), y, y + 0.2);
  }
  for (const x of [T.x0 + 0.02, T.x1 - 0.22]) {
    side(root, corbel(-1, o - 0.03, T.h - 0.42).map(([q, z]) => [y0 + q, z]), x, x + 0.2);
    side(root, corbel(1, o - 0.03, T.h - 0.42).map(([q, z]) => [y1 + q, z]), x, x + 0.2);
  }
  for (let x = T.x0 + 0.4; x < T.x1 - 0.2; x += 0.7) {
    side(root, corbel(-1).map(([o, z]) => [y0 + o, z]), x - 0.1, x + 0.1); side(root, corbel(1).map(([o, z]) => [y1 + o, z]), x - 0.1, x + 0.1);
  }
  for (let y = y0 + 0.4; y < y1 - 0.2; y += 0.7) {
    elev(root, corbel(-1).map(([o, z]) => [T.x0 + o, z]).reverse(), y - 0.1, y + 0.1); elev(root, corbel(1).map(([o, z]) => [T.x1 + o, z]), y - 0.1, y + 0.1);
  }
  // low hipped roof with a flat top (page)
  const a = [T.x0 - o, y0 - o], b = [T.x1 + o, y1 + o], i = 1.0, zt = 11.0;
  const E = [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]], Tp = [[a[0] + i, a[1] + i], [b[0] - i, a[1] + i], [b[0] - i, b[1] - i], [a[0] + i, b[1] - i]];
  const dirs = [[1, 0, 0], [0, 1, 0], [1, 0, 0], [0, 1, 0]];
  for (let k = 0; k < 4; k++) { const n = (k + 1) % 4; plane(root, [[...E[k], zc], [...E[n], zc], [...Tp[n], zt], [...Tp[k], zt]], M.roof, dirs[k]); }
  plane(root, Tp.map(p => [...p, zt]), M.white);
  cyl(root, cx, cy, zt + 0.2, 0.14, 0.4); cyl(root, cx, cy, zt + 0.45, 0.24, 0.1); ball(root, cx, cy, zt + 0.6, 0.12);   // vent with cap (page)
  box(root, 13.05, 14.05, 3.0, 4.0, 9.0, 11.83, M.brick); box(root, 12.95, 14.15, 2.9, 4.1, 11.83, 12.0);   // chimney
  archWindow(root, "-y", y0, PX(572), PX(640), 6.75, PZ(362));      // page size
  archWindow(root, "-y", y0, PX(748), PX(815), 6.75, PZ(362));
  archWindow(root, "+y", y1, PX(572), PX(640), 6.75, PZ(362));      // page size
  archWindow(root, "+y", y1, PX(748), PX(815), 6.75, PZ(362));
}

// ---------- cross gable on the right (ridge front to back), truss in the front gable ----------
function crossGable(root) {
  const G = D.gable, y0 = H.y0, y1 = H.y1, mid = (G.x0 + G.x1) / 2, r = (G.x1 - G.x0) / 2 * G.pitch, pk = G.eave + r;
  elev(root, [[G.x0, H.eave], [G.x1, H.eave], [G.x1, G.eave], [mid, pk], [G.x0, G.eave]], y0, y1, M.siding);
  const o = 0.5, e0 = G.eave - o * G.pitch, ov = 0.35;
  const xr = H.x1 + 0.35, er = G.eave - (xr - G.x1) * G.pitch;      // the right slope carries on down to cover the hall's right end
  for (const s of [-1, 1]) {           // the two roof slopes, with course lines along the ridge
    const xe = s < 0 ? G.x0 - o : xr, ze = s < 0 ? e0 : er;
    plane(root, [[xe, y0 - ov, ze], [mid, y0 - ov, pk + 0.12], [mid, y1 + ov, pk + 0.12], [xe, y1 + ov, ze]], M.roof, [0, 1, 0]);
  }
  box(root, xr - 0.04, xr, y0 - ov, y1 + ov, er - 0.25, er);                                                  // fascia on the long right eave
  for (const y of [y0, y1]) elev(root, [[G.x1, H.eave - 0.02], [H.x1, H.eave - 0.02], [G.x1 + (G.eave - H.eave) / G.pitch, H.eave], [G.x1, G.eave]], y - 0.01, y + 0.01, M.siding);   // gable wall carried out under it
  for (const y of [y0 - ov, y1 + ov]) {      // wide bargeboards with an inner band (page: double line)
    const t = 0.22, fz = 0.32, sgn = y < y0 ? -1 : 1;
    elev(root, [[G.x0 - o, e0 - fz], [mid, pk + 0.12 - fz], [xr, er - fz], [xr, er], [mid, pk + 0.12], [G.x0 - o, e0]], y - t / 2, y + t / 2);
    const f2 = 0.14;
    elev(root, [[G.x0 - o + 0.25, e0 - fz + 0.25 * G.pitch - 0.02], [mid, pk + 0.12 - fz], [xr - 0.25, er - fz + 0.25 * G.pitch - 0.02], [xr - 0.25, er - fz + 0.25 * G.pitch + f2 - 0.02], [mid, pk + 0.12 - fz + f2], [G.x0 - o + 0.25, e0 - fz + 0.25 * G.pitch + f2 - 0.02]].map(([a, z]) => [a, z - f2]), y + sgn * t / 2, y + sgn * (t / 2 + 0.06));
  }
  for (const y of [y0, y1]) box(root, G.x0 - 0.12, G.x0 + 0.12, y - 0.12, y + 0.12, H.eave, G.eave);   // corner boards (page); the right ones sit under the long slope now
  box(root, D.tower.x1, G.x0, (y0 + y1) / 2, y1, H.eave, e0 - 0.03, M.siding);   // fills the slot between the tower and the gable at the back
  // truss in the front gable: collar, king post with a drop, X braces (page)
  const yt = y0 - 0.12, zc = 9.32;           // collar just above the window hood (page)
  const wAt = (z) => (pk + 0.12 - 0.46 - z) / G.pitch - 0.05;      // half-width inside the bargeboards at height z
  box(root, mid - wAt(zc), mid + wAt(zc), yt - 0.08, yt + 0.08, zc - 0.08, zc + 0.08);                                       // collar
  box(root, mid - 0.1, mid + 0.1, yt - 0.12, yt + 0.12, zc - 0.12, pk - 0.3);                                                // king post
  box(root, mid - 0.1, mid + 0.1, yt - 0.1, yt + 0.1, zc - 0.26, zc - 0.12);
  const drop = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.12, 4), M.white); drop.rotation.x = Math.PI; drop.position.copy(V(mid, yt, zc - 0.32)); root.add(drop);
  box(root, mid - 0.13, mid + 0.13, yt - 0.14, yt + 0.12, pk - 0.62, pk - 0.4);                                              // bolt cap at the king-post head
  const strut = (ax, az, bx, bz) => { const A = V(ax, yt, az), B = V(bx, yt, bz), m = new THREE.Mesh(new THREE.BoxGeometry(0.12, A.distanceTo(B), 0.12), M.white);
    m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); root.add(m); };
  for (const s of [-1, 1]) {      // X braces between the collar, the king post and the rafters (page)
    let zu = zc + 0.5; for (let k = 0; k < 20; k++) zu = zc + 0.1 + 0.55 * (wAt(zu) - 0.1);    // brace rises 0.55 per metre out to the rafter
    strut(mid + s * 0.1, zc + 0.1, mid + s * (wAt(zu) + 0.04), zu);
  }
  archWindow(root, "-y", y0, PX(1110), PX(1185), 6.95, PZ(380));
  archWindow(root, "+y", y1, PX(1110), PX(1185), 6.95, PZ(380));
}

// ---------- dormer on the left of the roof (page): flat front with corner pilasters, sloped cheeks,
// a curved roof with a thick double-line eave that overhangs front and sides, arched window
function dormer(root) {
  const x0 = PX(322), x1 = PX(428), yf = 0.15, yb = 3.0, zt = 8.38, crown = 8.92, o = 0.32, c = (x0 + x1) / 2;
  box(root, x0, x1, yf, yb, 6.5, zt, M.siding);
  for (const x of [x0, x1]) box(root, x - 0.13, x + 0.13, yf - 0.1, yf + 0.05, 6.55, zt);                         // corner pilasters
  box(root, x0 - 0.1, x1 + 0.1, yf - 0.12, yf + 0.05, 6.5, 6.7);                                                    // base board
  const arc = (w, h, z0, n = 24) => { const p = []; for (let k = 0; k <= n; k++) { const t = Math.PI - Math.PI * k / n; p.push([c + w * Math.cos(t), z0 + h * Math.sin(t)]); } return p; };
  const w = (x1 - x0) / 2 + o, th = 0.3;
  const seg = (hw, za, zc, n = 24) => { const r = (hw * hw + (zc - za) ** 2) / (2 * (zc - za)), t0 = Math.asin(hw / r);
    return Array.from({ length: n + 1 }, (_, k) => { const t = -t0 + 2 * t0 * k / n; return [c + r * Math.sin(t), zc - r + r * Math.cos(t)]; }); };
  elev(root, [...seg(w, zt, crown), [c + w, zt - 0.02], [c - w, zt - 0.02]].reverse(), yf - o + 0.1, yb);         // curved roof body
  // one thick curved eave band whose ends run out past the walls (page)
  elev(root, [...seg(w + 0.06, zt - 0.02, crown + 0.03), ...seg(w - 0.1, zt - th, crown - th).reverse()], yf - o - 0.04, yf - o + 0.14);
  archWindow(root, "-y", yf - 0.05, PX(342), PX(410), 6.85, PZ(404), false);
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
  const t = 0.24, fz = 0.3;      // bargeboard (page: thick double line), outer band + inner band
  const k = 0.25;   // the eave ends kick out level for a short return (page)
  elev(root, [[E.x0 - k, E.eave - fz], [E.x0, E.eave - fz], [mid, E.peak - fz], [E.x1, E.eave - fz], [E.x1 + k, E.eave - fz], [E.x1 + k, E.eave], [E.x1, E.eave], [mid, E.peak], [E.x0, E.eave], [E.x0 - k, E.eave]], yf - 0.2 - t, yf - 0.2);
  const f2 = 0.12, d2 = 0.3;
  elev(root, [[E.x0 + d2, E.eave - fz - f2 + d2 * pitch], [mid, E.peak - fz - f2], [E.x1 - d2, E.eave - fz - f2 + d2 * pitch], [E.x1 - d2, E.eave - fz + d2 * pitch], [mid, E.peak - fz], [E.x0 + d2, E.eave - fz + d2 * pitch]], yf - 0.2 - t + 0.06, yf - 0.2);
  // truss: king post, two raking braces, short X under the peak (page)
  const yt = yf - 0.08;
  const zk = 5.42, under = (d) => E.peak - d * pitch - fz - f2 + 0.02;      // collar height; rafter underside d metres from the middle
  box(root, mid - 0.08, mid + 0.08, yt - 0.06, yt + 0.06, zk - 0.12, E.peak - 0.3);                          // king post
  const kd = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 4), M.white); kd.rotation.x = Math.PI; kd.position.copy(V(mid, yt, zk - 0.2)); root.add(kd);
  const strut = (ax, az, bx, bz) => { const A = V(ax, yt, az), B = V(bx, yt, bz), m = new THREE.Mesh(new THREE.BoxGeometry(0.09, A.distanceTo(B), 0.09), M.white);
    m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); root.add(m); };
  for (const s of [-1, 1]) { strut(mid + s * 0.1, zk + 0.05, mid + s * 0.8, under(0.8) - 0.04); strut(mid + s * 0.1, under(0.1) - 0.1, mid + s * 0.8, zk + 0.05); }
  const cw = (E.peak - fz - f2 - zk - 0.05) / pitch;
  box(root, mid - cw, mid + cw, yt - 0.05, yt + 0.05, zk - 0.05, zk + 0.05);                                // collar
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
function bench(root, x0, x1) {      // park bench: seat at 0.45, slatted back up to 0.9, cast-iron ends (page)
  const yb = H.y0 - 0.12, yf = yb - 0.5, zs = 0.45;
  for (const y of [yf, yf + 0.17, yf + 0.34]) box(root, x0, x1, y, y + 0.13, zs - 0.05, zs);               // seat slats
  for (const z of [0.56, 0.7]) box(root, x0, x1, yb - 0.1, yb - 0.05, z, z + 0.1);                          // back slats
  box(root, x0, x1, yb - 0.1, yb - 0.05, 0.84, 0.92);                                                       // top rail
  for (const x of [x0 + 0.08, x1 - 0.14]) {
    box(root, x, x + 0.06, yf + 0.04, yf + 0.1, 0, zs - 0.05);                                              // front leg
    box(root, x, x + 0.06, yb - 0.11, yb - 0.04, 0, 0.92);                                                  // back leg + back post
    box(root, x, x + 0.06, yf + 0.04, yb - 0.04, 0.1, 0.15);                                                // foot stretcher
    box(root, x - 0.02, x + 0.08, yf - 0.02, yb - 0.04, 0.62, 0.67);                                        // arm
    box(root, x, x + 0.06, yf + 0.02, yf + 0.08, zs, 0.62);                                                 // arm post
  }
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
  // every bench the same 2 m long, centred under the window above it
  for (const [a0, a1] of [[1.8, 3.2], [PX(630), PX(715)], [PX(955), PX(1050)], [PX(1120), PX(1195)]]) { const c = (a0 + a1) / 2; bench(root, c - 1.0, c + 1.0); }
  hangLamp(root, PX(833), -1.4); hangLamp(root, PX(1160), -1.4); hangLamp(root, 5.2, -1.4);
  // back and ends
  const yb = H.y1;
  for (const [a0, a1] of [[1.8, 3.2], [4.6, 6.0], [7.6, 9.0], [16.0, 17.4], [19.6, 21.0]]) opening(root, "+y", yb, a0, a1, PZ(820), PZ(700));
  // street door under the entrance porch (plan v13): 5.6 x 2.5 m, as wide as the steps, gable to the court,
  // on two posts with curved brackets like the platform canopy, a small king-post truss in the gable
  opening(root, "+y", yb, 10.8, 12.2, 0.02, 2.7, 2, 1, false);
  { const x0 = 8.7, x1 = 14.3, xm = (x0 + x1) / 2, ye = yb + 2.5, ez = 3.65, pz = 4.95, o = 0.25;
    const zAt = (x) => ez + (pz - ez) * (1 - Math.abs(x - xm) / (xm - x0));
    for (const xe of [x0 - o, x1 + o]) { const ze = ez - (pz - ez) * o / (xm - x0);
      plane(root, [[xe, yb, ze], [xm, yb, pz], [xm, ye + o, pz], [xe, ye + o, ze]], M.roof, [0, 1, 0]); }
    elev(root, [[x0 - o, ez - 0.2], [x1 + o, ez - 0.2], [x1 + o, ez - (pz - ez) * o / (xm - x0)], [xm, pz], [x0 - o, ez - (pz - ez) * o / (xm - x0)]].map(([x, z], i) => [x, z]), ye + o - 0.08, ye + o);   // gable fascia
    elev(root, [[x0, ez - 0.2], [x1, ez - 0.2], [xm, pz - 0.12]], ye - 0.04, ye, M.siding);                    // gable infill
    box(root, x0, x1, ye - 0.12, ye, ez - 0.4, ez - 0.2);                                                         // tie beam
    box(root, xm - 0.08, xm + 0.08, ye - 0.14, ye + 0.02, ez - 0.2, pz - 0.2);                                   // king post
    for (const x of [x0 + 0.12, x1 - 0.12]) {
      box(root, x - 0.1, x + 0.1, ye - 0.22, ye - 0.02, 0, ez - 0.4);                                            // post
      box(root, x - 0.16, x + 0.16, ye - 0.28, ye + 0.04, 0, 0.3); box(root, x - 0.14, x + 0.14, ye - 0.26, ye + 0.02, ez - 0.55, ez - 0.4);
      box(root, x - 0.07, x + 0.07, yb, ye - 0.12, ez - 0.4, ez - 0.2);                                          // side beam back to the wall
      side(root, [[ye - 0.22, ez - 0.4], [ye - 1.0, ez - 0.4], [ye - 0.22, ez - 1.2]], x - 0.05, x + 0.05);     // knee brace
      const sx = x < xm ? 1 : -1;
      elev(root, [[x, ez - 0.4], [x + sx * 0.9, ez - 0.4], [x, ez - 1.3]].map(p => p), ye - 0.16, ye - 0.08);   // corner bracket under the tie beam
    }
  }
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

// ---------- the train (page + photo of a 2-8-0 steam engine): locomotive and two coaches on track 1 ----------
// wheel with spokes on the outer face; out = +1 / -1 is the side the outer face looks to (plan y)
function wheel(root, x, y, zr, r, out, spokes = 12) {
  const zc = zr + r;
  cyl(root, x, y, zc, r, 0.14, "y", 32); cyl(root, x, y + out * 0.08, zc, r * 0.18, 0.1, "y", 16);
  const s = [], yo = y + out * 0.075;
  for (let k = 0; k < spokes; k++) { const a = 2 * Math.PI * k / spokes; s.push([[x + r * 0.18 * Math.cos(a), yo, zc + r * 0.18 * Math.sin(a)], [x + r * 0.8 * Math.cos(a), yo, zc + r * 0.8 * Math.sin(a)]]); }
  const n = 40; for (let k = 0; k < n; k++) { const a = 2 * Math.PI * k / n, b = 2 * Math.PI * (k + 1) / n; s.push([[x + r * 0.84 * Math.cos(a), yo, zc + r * 0.84 * Math.sin(a)], [x + r * 0.84 * Math.cos(b), yo, zc + r * 0.84 * Math.sin(b)]]); }
  lines(root, s);
}
function rod(root, a, b, r = 0.05, seg = 8) {      // a thin round bar between two plan points
  const A = V(...a), B = V(...b), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, A.distanceTo(B), seg), M.white);
  m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); root.add(m); return m;
}
function truck(root, x, yc, zr, hw) {             // a 2-axle bogie: side frames, springs, small spoked wheels
  for (const dx of [-0.85, 0.85]) for (const s of [-1, 1]) wheel(root, x + dx, yc + s * hw, zr, 0.42, s, 8);
  for (const s of [-1, 1]) { box(root, x - 1.35, x + 1.35, yc + s * (hw + 0.2) - 0.05, yc + s * (hw + 0.2) + 0.05, zr + 0.3, zr + 0.62); box(root, x - 0.25, x + 0.25, yc + s * (hw + 0.2) - 0.07, yc + s * (hw + 0.2) + 0.07, zr + 0.62, zr + 0.85); }
  box(root, x - 0.3, x + 0.3, yc - hw, yc + hw, zr + 0.62, zr + 0.85);
}
function locomotive(root, yc, zr, hw) {
  const drv = [PX(277), PX(378), PX(482)], rd = 0.85;            // three big driving wheels (page)
  for (const x of drv) for (const s of [-1, 1]) wheel(root, x, yc + s * hw, zr, rd, s, 14);
  for (const s of [-1, 1]) wheel(root, PX(632), yc + s * hw, zr, 0.48, s, 8);
  for (const s of [-1, 1]) {
    const yr = yc + s * (hw + 0.16);
    box(root, drv[0] - 0.05, drv[2] + 0.05, yr - 0.04, yr + 0.04, zr + rd - 0.08, zr + rd + 0.08);                     // side rod
    for (const x of drv) cyl(root, x, yr + s * 0.04, zr + rd, 0.09, 0.08, "y", 12);                                    // crank pins
    rod(root, [drv[1], yr + s * 0.1, zr + rd + 0.2], [PX(560), yr + s * 0.1, 0.55], 0.06);                            // main rod to the crosshead
    box(root, PX(545), PX(600), yr - 0.03, yr + 0.03, 0.45, 0.65);                                                     // crosshead guide
    cyl(root, PX(580), yc + s * 0.98, 0.55, 0.38, 1.25, "x", 20);                                                      // cylinder
    cyl(root, PX(580), yc + s * 0.98, 1.05, 0.22, 0.95, "x", 16);                                                      // steam chest
    for (const xx of [PX(580) - 0.66, PX(580) + 0.66]) cyl(root, xx, yc + s * 0.98, 0.55, 0.42, 0.08, "x", 20);        // cylinder covers
    rod(root, [PX(300), yc + s * 0.95, 2.15], [PX(625), yc + s * 0.95, 2.15], 0.03);                                   // boiler handrail (photo)
    for (const x of [PX(330), PX(430), PX(530), PX(615)]) rod(root, [x, yc + s * 0.8, 2.0], [x, yc + s * 0.95, 2.15], 0.025);
    box(root, PX(190), PX(660), yc + s * 1.1 - 0.03, yc + s * 1.1 + 0.03, 1.0, 1.14);                                  // running board edge band (photo: white edge)
  }
  box(root, PX(190), PX(660), yc - 1.1, yc + 1.1, 1.0, 1.12);                                                          // running board
  box(root, PX(200), PX(655), yc - 0.45, yc + 0.45, 0.2, 1.0);                                                         // frame
  const bx0 = PX(320), bx1 = PX(628), bz = 1.7, br = 0.78;
  cyl(root, (bx0 + bx1) / 2, yc, bz, br, bx1 - bx0, "x", 32);                                                          // boiler
  for (const x of [PX(395), PX(470), PX(530)]) cyl(root, x, yc, bz, br + 0.03, 0.07, "x", 32);                         // boiler bands
  cyl(root, PX(641), yc, bz, br + 0.1, PX(654) - PX(628), "x", 32);                                                    // smokebox
  cyl(root, PX(656), yc, bz, br + 0.02, 0.06, "x", 32); cyl(root, PX(660), yc, bz, 0.55, 0.06, "x", 28);              // front ring and door (photo)
  box(root, PX(661), PX(664), yc - 0.24, yc + 0.24, bz - 0.12, bz + 0.18);                                             // number plate
  for (const z of [bz + 0.32, bz - 0.28]) box(root, PX(661), PX(664), yc - 0.5, yc + 0.02, z - 0.03, z + 0.03);        // door hinge straps
  cyl(root, PX(663), yc, bz, 0.06, 0.12, "x", 10);                                                                     // door handle
  cyl(root, PX(575), yc, 3.0, 0.3, 1.5, "z", 20); cyl(root, PX(575), yc, 3.95, 0.3, 0.42, "z", 20, M.white, 0.44);     // smokestack with the flared top (page)
  cyl(root, PX(575), yc, 4.2, 0.44, 0.08, "z", 20);
  for (const x of [PX(390), PX(470)]) { cyl(root, x, yc, 2.6, 0.34, 0.6, "z", 20); cyl(root, x, yc, 2.95, 0.4, 0.1, "z", 20); ball(root, x, yc, 3.05, 0.3); }   // sand + steam domes
  { const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 0.32, 16), M.white); bell.position.copy(V(PX(520), yc, 2.68)); root.add(bell);   // bell (photo)
    box(root, PX(520) - 0.04, PX(520) + 0.04, yc - 0.22, yc + 0.22, 2.45, 2.95); ball(root, PX(520), yc, 2.88, 0.06); }
  box(root, PX(605), PX(645), yc - 0.25, yc + 0.25, 2.55, 3.25); cyl(root, PX(648), yc, 2.9, 0.2, 0.08, "x", 20);     // headlight
  box(root, PX(615), PX(640), yc - 0.08, yc + 0.08, 3.25, 3.4);
  cyl(root, PX(340), yc, 2.6, 0.08, 0.5, "z", 10); ball(root, PX(340), yc, 2.9, 0.1);                                  // whistle
  cyl(root, PX(470), yc + 1.0, 1.65, 0.2, 0.9, "z", 14); cyl(root, PX(470), yc + 1.0, 2.15, 0.24, 0.1, "z", 14);        // air pump on the fireman's side (photo)
  for (const s of [-1, 1]) {                                                                                           // front steps / ladder by the smokebox (photo)
    const ys = yc + s * 1.05;
    rod(root, [PX(650), ys, 1.12], [PX(668), ys, -0.1], 0.03); rod(root, [PX(620), ys, 1.12], [PX(640), ys, -0.1], 0.03);
    for (const z of [0.15, 0.55]) box(root, PX(628) + (1.12 - z) * 0.25, PX(660) + (1.12 - z) * 0.25, ys - 0.12, ys + 0.12, z - 0.03, z + 0.03);
  }
  // cab: two side windows, a front window either side of the boiler, a curved roof with an overhang
  const c0 = PX(190), c1 = PX(325), cw = 1.15;
  box(root, c0, c1, yc - cw, yc + cw, 1.12, 3.25);
  side(root, [[yc - cw - 0.18, 3.25], ...Array.from({ length: 17 }, (_, k) => { const t = Math.PI * k / 16; return [yc - (cw + 0.18) * Math.cos(t), 3.25 + 0.32 * Math.sin(t)]; }), [yc + cw + 0.18, 3.25]], c0 - 0.25, c1 + 0.2);
  for (const [a0, a1] of [[PX(210), PX(245)], [PX(258), PX(292)]]) for (const s of [-1, 1]) {
    const yy = yc + s * cw, zz0 = PZ(790), zz1 = PZ(735);
    fbox(root, s < 0 ? "-y" : "+y", yy, a0, a1, zz0, zz0 + 0.08, 0, 0.05); fbox(root, s < 0 ? "-y" : "+y", yy, a0, a1, zz1 - 0.08, zz1, 0, 0.05);
    fbox(root, s < 0 ? "-y" : "+y", yy, a0, a0 + 0.08, zz0, zz1, 0, 0.05); fbox(root, s < 0 ? "-y" : "+y", yy, a1 - 0.08, a1, zz0, zz1, 0, 0.05);
  }
  for (const s of [-1, 1]) { const ys = yc + s * 0.7; lines(root, [[[c1 + 0.01, ys - 0.25, 2.5], [c1 + 0.01, ys + 0.25, 2.5]], [[c1 + 0.01, ys + 0.25, 2.5], [c1 + 0.01, ys + 0.25, 3.05]], [[c1 + 0.01, ys + 0.25, 3.05], [c1 + 0.01, ys - 0.25, 3.05]], [[c1 + 0.01, ys - 0.25, 3.05], [c1 + 0.01, ys - 0.25, 2.5]]]); }
  for (const s of [-1, 1]) rod(root, [c0 + 0.1, yc + s * (cw + 0.08), 1.2], [c0 + 0.1, yc + s * (cw + 0.08), 2.9], 0.03);   // grab irons
  // pilot (cowcatcher): a V in plan, bars running down and forward from the buffer beam to the rail (page + photo)
  const pb = PX(665), pt = PX(745), pz = 0.78, pzr = zr + 0.06, pw = 0.9;
  box(root, PX(655), pb, yc - 1.0, yc + 1.0, 0.72, 1.0);                                                              // buffer beam
  box(root, pb, pb + 0.25, yc - 0.12, yc + 0.12, 0.78, 0.95);                                                          // coupler
  for (const s of [-1, 1]) for (let k = 0; k <= 4; k++) {
    const t = k / 4, yy = yc + s * pw * (1 - t);
    rod(root, [pb + 0.25 * t, yy, pz], [pb + (pt - pb) * t + 0.1, yy * 1 + 0, pzr], 0.045, 6);
  }
  rod(root, [pb, yc - pw, pzr], [pt, yc, pzr], 0.05, 6); rod(root, [pb, yc + pw, pzr], [pt, yc, pzr], 0.05, 6);       // bottom edge of the V
  rod(root, [pb, yc, pz], [pt, yc, pzr], 0.05, 6);                                                                     // nose bar
}
function tender(root, yc, zr, hw, x0, x1) {        // coal + water tender behind the cab (photo)
  const w = 1.25, zb = 0.55, zt = 2.45;
  truck(root, x0 + 1.6, yc, zr, hw); truck(root, x1 - 1.6, yc, zr, hw);
  box(root, x0, x1, yc - 0.55, yc + 0.55, zr + 0.85, zb);                                                              // frame
  box(root, x0, x1, yc - w, yc + w, zb, zt);                                                                           // tank
  box(root, x0 - 0.04, x1 + 0.04, yc - w - 0.04, yc + w + 0.04, zt - 0.12, zt);                                       // top flare
  side(root, [[yc - w + 0.1, zt], [yc + w - 0.1, zt], [yc + w - 0.1, zt + 0.35], [yc - w + 0.1, zt + 0.35]], x1 - 2.6, x1 - 0.05);   // coal bunker
  { const g = []; let k = 3; const rnd = () => (k = (k * 16807) % 2147483647) / 2147483647;                           // coal lumps drawn as lines
    for (let i = 0; i < 26; i++) { const x = x1 - 2.5 + rnd() * 2.3, y = yc - w + 0.2 + rnd() * (2 * w - 0.4); g.push([[x, y, zt + 0.36], [x + 0.18, y + 0.08, zt + 0.36]]); } lines(root, g); }
  cyl(root, x0 + 1.4, yc, zt + 0.08, 0.32, 0.16, "z", 20);                                                            // water hatch
  for (const s of [-1, 1]) lines(root, [[[x0 + 0.1, yc + s * (w + 0.01), 0.75], [x1 - 0.1, yc + s * (w + 0.01), 0.75]]]);
  for (const z of [0.8, 1.3, 1.8]) box(root, x0 - 0.12, x0 - 0.02, yc + 0.55, yc + 0.95, z - 0.03, z + 0.03);           // rear ladder
  box(root, x0 - 0.25, x0, yc - 0.12, yc + 0.12, 0.78, 0.95);
}
function coach(root, yc, zr, hw, x0, x1) {          // passenger coach: clerestory roof, window row, vestibule doors, two bogies
  const w = 1.4, zb = 0.45, zt = 3.1;
  truck(root, x0 + 2.2, yc, zr, hw); truck(root, x1 - 2.2, yc, zr, hw);
  box(root, x0 + 0.6, x1 - 0.6, yc - 0.6, yc + 0.6, zr + 0.85, zb);
  box(root, x0, x1, yc - w, yc + w, zb, zt);
  const arcRoof = (r, h, z) => [[yc - r, z], ...Array.from({ length: 17 }, (_, k) => { const t = Math.PI * k / 16; return [yc - r * Math.cos(t), z + h * Math.sin(t)]; }), [yc + r, z]];
  side(root, arcRoof(w + 0.1, 0.3, zt), x0 - 0.15, x1 + 0.15);                                                         // lower roof
  side(root, [[yc - 0.55, zt + 0.22], [yc + 0.55, zt + 0.22], [yc + 0.55, zt + 0.62], [yc - 0.55, zt + 0.62]], x0 + 1.0, x1 - 1.0);   // clerestory
  side(root, arcRoof(0.68, 0.12, zt + 0.62), x0 + 0.9, x1 - 0.9);
  const g = [];
  for (const s of [-1, 1]) {
    const yy = yc + s * (w + 0.01);
    for (let x = x0 + 1.5; x + 0.9 < x1 - 1.3; x += 1.25) {
      g.push([[x, yy, 1.85], [x + 0.9, yy, 1.85]], [[x + 0.9, yy, 1.85], [x + 0.9, yy, 2.75]], [[x + 0.9, yy, 2.75], [x, yy, 2.75]], [[x, yy, 2.75], [x, yy, 1.85]]);
      g.push([[x, yy, 2.45], [x + 0.9, yy, 2.45]]);
    }
    for (const xd of [x0 + 0.35, x1 - 1.15]) g.push([[xd, yy, zb + 0.1], [xd, yy, 2.85]], [[xd + 0.8, yy, zb + 0.1], [xd + 0.8, yy, 2.85]], [[xd, yy, 2.85], [xd + 0.8, yy, 2.85]], [[xd + 0.15, yy, 2.1], [xd + 0.65, yy, 2.1]], [[xd + 0.15, yy, 2.7], [xd + 0.65, yy, 2.7]], [[xd + 0.15, yy, 2.1], [xd + 0.15, yy, 2.7]], [[xd + 0.65, yy, 2.1], [xd + 0.65, yy, 2.7]]);
    g.push([[x0, yy, 1.6], [x1, yy, 1.6]], [[x0, yy, 2.95], [x1, yy, 2.95]]);                                          // belt rail and letter board
    for (let x = x0 + 1.5; x < x1 - 1.3; x += 1.25) g.push([[x, yc + s * 0.56, zt + 0.32], [x, yc + s * 0.56, zt + 0.55]]);   // clerestory window mullions
    for (const xd of [x0 + 0.35, x1 - 1.15]) box(root, xd, xd + 0.8, yy - s * 0.0 - 0.1, yy + 0.1, zb - 0.28, zb - 0.22);   // step
  }
  lines(root, g);
  for (const x of [x0, x1]) box(root, x - 0.06, x + 0.06, yc - 0.6, yc + 0.6, zb + 0.1, 2.85);                         // end doors
  for (const x of [x0 - 0.25, x1]) box(root, x, x + 0.25, yc - 0.12, yc + 0.12, 0.6, 0.78);                            // couplers
}
function train(root) {
  const yc = D.track[0], zr = D.rail, hw = 0.75;
  locomotive(root, yc, zr, hw);
  const t0 = PX(190) + 0.25;                    // first coach right behind the cab, as on the page
  const L = 14.0, gap = 0.6;                    // two coaches (14 m) running off to the left
  coach(root, yc, zr, hw, t0 - gap - L, t0 - gap);
  coach(root, yc, zr, hw, t0 - 2 * gap - 2 * L, t0 - 2 * gap - L);
}

// ---------- site (plan v13): platforms, tracks, foot crossing, entrance court, ramps, car park, street ----------
const LG = -0.6;                                   // landside grade: court, lawn, car park and street sit 0.6 m below the floor
function lvl(root, z) { const g = new THREE.Group(); g.position.y = z; root.add(g); return g; }   // items standing at another level
function textTex(lines, w = 512, h = 256, bg = "#fff") {
  return canvasTex(w, h, (g) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = "#000"; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = "#000"; g.textAlign = "center"; g.textBaseline = "middle"; const fs = Math.min(90, h / (lines.length + 0.6));
    g.font = `bold ${fs}px Helvetica, Arial, sans-serif`; lines.forEach((t, i) => g.fillText(t, w / 2, h / 2 + (i - (lines.length - 1) / 2) * fs * 1.1)); });
}
function sign(root, x, y, z, w, h, tex, face = "-y") {   // flat board with printed text; face = side it reads from
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
  m.position.copy(V(x, y, z)); if (face === "+y") m.rotation.y = Math.PI; else if (face === "-x") m.rotation.y = -Math.PI / 2; else if (face === "+x") m.rotation.y = Math.PI / 2;
  m.userData.noEdge = true; root.add(m); return m;
}
function tree(root, x, y, r = 1.0) {               // trunk + round crown, standing on the lawn
  const g = lvl(root, LG); cyl(g, x, y, 0.9, 0.13, 1.8, "z", 10, M.white, 0.1);
  ball(g, x, y, 2.6, r * 1.15); ball(g, x - r * 0.55, y + r * 0.2, 2.2, r * 0.75); ball(g, x + r * 0.5, y - r * 0.25, 2.25, r * 0.7);
}
function rail(root, pts, h = 0.9, step = 1.5) {     // handrail: posts and a top bar following the walking surface
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / step));
    rod(root, [a[0], a[1], a[2] + h], [b[0], b[1], b[2] + h], 0.035);
    for (let k = 0; k <= n; k++) { const t = k / n, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; rod(root, p, [p[0], p[1], p[2] + h], 0.03); }
  }
}
function ramp(root, x0, x1, y0, y1, z0, z1) {      // a solid ramp running along x from z0 (at x0) to z1 (at x1)
  const g = D.ground;
  elev(root, [[x0, g], [x1, g], [x1, z1], [x0, z0]], y0, y1);
  const L = []; for (let k = 1; k * 0.6 < Math.abs(x1 - x0); k++) { const x = x0 + Math.sign(x1 - x0) * k * 0.6, z = z0 + (z1 - z0) * (x - x0) / (x1 - x0); L.push([[x, y0, z + 0.005], [x, y1, z + 0.005]]); }
  lines(root, L);                                                                                                  // anti-slip grooves
}
function picket(root, x0, x1, y, z = 0) {           // the page's picket fence, between two x
  const G = lvl(root, z);
  box(G, x0, x1, y - 0.04, y + 0.04, 0.35, 0.45); box(G, x0, x1, y - 0.04, y + 0.04, 0.95, 1.05);
  for (let x = x0; x < x1 - 0.1; x += 0.28) elev(G, [[x, 0], [x + 0.14, 0], [x + 0.14, 1.15], [x + 0.07, 1.3], [x, 1.15]], y - 0.08, y - 0.04);
  for (const x of [x0, x1 - 0.14]) box(G, x, x + 0.14, y - 0.07, y + 0.07, 0, 1.45);
}
function railFence(root, pts, z = 0) {              // simple post-and-two-rail fence along a polyline
  const G = lvl(root, z);
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 2));
    for (const h of [0.5, 1.0]) rod(G, [a[0], a[1], h], [b[0], b[1], h], 0.04);
    for (let k = 0; k <= n; k++) { const t = k / n; box(G, a[0] + (b[0] - a[0]) * t - 0.06, a[0] + (b[0] - a[0]) * t + 0.06, a[1] + (b[1] - a[1]) * t - 0.06, a[1] + (b[1] - a[1]) * t + 0.06, 0, 1.15); }
  }
}
function railing(root, pts, z = 0, h = 1.0) {      // thin see-through metal railing: slim posts every 2 m, three round bars
  const G = lvl(root, z);
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b] = [pts[i], pts[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 2));
    for (const hh of [0.35, 0.68, h]) rod(G, [a[0], a[1], hh], [b[0], b[1], hh], 0.022, 6);
    for (let k = 0; k <= n; k++) { const t = k / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t; box(G, x - 0.025, x + 0.025, y - 0.025, y + 0.025, 0, h + 0.03); }
  }
}
function shelter(root, x0, x1, y0, y1, z, faceSt = true) {   // small open shelter: four posts, flat roof, back screen, bench facing the street (+y)
  const G = lvl(root, z), h = 2.5;
  for (const x of [x0 + 0.08, x1 - 0.08]) for (const y of [y0 + 0.08, y1 - 0.08]) box(G, x - 0.06, x + 0.06, y - 0.06, y + 0.06, 0, h);
  box(G, x0 - 0.15, x1 + 0.15, y0 - 0.15, y1 + 0.15, h, h + 0.15); box(G, x0 - 0.05, x1 + 0.05, y0 - 0.05, y1 + 0.05, h + 0.15, h + 0.22);
  const yb = faceSt ? y0 : y1, d = faceSt ? 1 : -1;                 // screen on the back, bench in front of it
  box(G, x0 + 0.15, x1 - 0.15, yb + d * 0.06, yb + d * 0.1, 0.4, 2.1, M.siding);
  box(G, x0 + 0.3, x1 - 0.3, yb + d * 0.12, yb + d * 0.55, 0.42, 0.47); for (const x of [x0 + 0.4, x1 - 0.46]) box(G, x, x + 0.06, yb + d * 0.15, yb + d * 0.5, 0, 0.42);
}
function site(root) {
  const g = D.ground, P = D.platform, T1 = D.track[0], T2 = D.track[1];
  // the model ends at the site boundary (x -18..42, out to the far kerb of the street); only the track bed runs on
  const SX0 = -18, SX1 = 42, SY1 = 44.5, EX0 = -58, EX1 = 82;   // track and street run 40 m past the site each way (where marked)
  flat(root, [[EX0, -13.4], [EX1, -13.4], [EX1, -4.8], [EX0, -4.8]], g - 0.02);   // track bed beyond the site
  flat(root, [[SX0, -17.9], [SX1, -17.9], [SX1, SY1], [SX0, SY1]], g - 0.02);
  slab(root, [[SX0, 0.3], [SX1, 0.3], [SX1, 33.5], [EX1, 33.5], [EX1, SY1], [EX0, SY1], [EX0, 33.5], [SX0, 33.5]], g, LG);   // site + the street running on, one piece
  // platform 1 (the station floor runs on to y 9) with a notch at the far end for the crossing ramp
  const P2y0 = -16.9, P2y1 = -12.9, rx0 = 30.4, rx1 = P.x1;            // crossing ramps run 8.6 m (0.72 m drop at 1:12)
  { const pp = [[P.x0, P.y0], [rx0, P.y0], [rx0, P.y0 + 2], [P.x1, P.y0 + 2], [P.x1, P.y1], [P.x0, P.y1]];
    slab(root, pp, g, 0).userData.noEdge = true;                       // own outline: the back edge stays open where the two walks leave it
    const E = [];
    for (let i = 0; i < pp.length; i++) { const a = pp[i], b = pp[(i + 1) % pp.length];
      if (a[1] === P.y1 && b[1] === P.y1) { for (const [u, v] of [[P.x1, 35], [33, -10], [-12, P.x0]]) E.push([[u, P.y1, 0], [v, P.y1, 0]], [[u, P.y1, LG], [v, P.y1, LG]]); }
      else E.push([[...a, 0], [...b, 0]], [[...a, g], [...b, g]]);
      E.push([[...a, g], [...a, 0]]); }
    lines(root, E); }
  slab(root, [[P.x0, P2y0], [P.x1, P2y0], [P.x1, P2y1 - 2], [rx0, P2y1 - 2], [rx0, P2y1], [P.x0, P2y1]], g, 0);   // platform 2
  const j = [];
  for (let x = P.x0 + 3.33; x < rx0; x += 3.33) j.push([[x, P.y0 - 0.01, g], [x, P.y0 - 0.01, 0]], [[x, P2y1 + 0.01, g], [x, P2y1 + 0.01, 0]]);
  j.push([[P.x0, P.y0 + 0.5, 0.01], [rx0, P.y0 + 0.5, 0.01]], [[P.x0, P2y1 - 0.5, 0.01], [rx0, P2y1 - 0.5, 0.01]]); lines(root, j);   // slab joints, edge strips
  flat(root, [[EX0, P2y1], [EX1, P2y1], [EX1, P.y0], [EX0, P.y0]], g + 0.005, M.ballast);
  for (const yc of D.track) {
    for (let x = EX0 + 0.2; x < EX1 - 0.3; x += 0.75) box(root, x, x + 0.26, yc - 1.3, yc + 1.3, g, g + 0.14);                     // sleepers
    for (const s of [-1, 1]) { const yr = yc + s * D.gauge / 2; box(root, EX0, EX1, yr - 0.04, yr + 0.04, g + 0.14, D.rail); box(root, EX0, EX1, yr - 0.08, yr + 0.08, g + 0.14, g + 0.17); }
  }
  // ---- foot crossing at the end of both platforms ----
  const zr = D.rail;
  ramp(root, rx0, rx1, P.y0, P.y0 + 2, 0, zr); ramp(root, rx0, rx1, P2y1 - 2, P2y1, 0, zr);
  for (const [ya, yb] of [[P.y0 + 0.1, P.y0 + 1.9], [P2y1 - 0.1, P2y1 - 1.9]]) for (const y of [ya, yb]) rail(root, [[rx0, y, 0], [rx1, y, zr]]);
  box(root, rx1 - 0.4, rx1, P.y0, P.y0 + 2, zr, zr + 0.02); box(root, rx1 - 0.4, rx1, P2y1 - 2, P2y1, zr, zr + 0.02);   // tactile strips at the foot
  const cx0 = rx1, cx1 = rx1 + 3;
  box(root, cx0, cx1, P2y1 - 2, P.y0 + 2, g, zr - 0.005);                                                          // 3 m walkway, flush with the rails
  { const L = []; for (let y = P2y1 - 2 + 0.5; y < P.y0 + 2; y += 0.5) L.push([[cx0, y, zr], [cx1, y, zr]]); lines(root, L); }
  for (const yg of [P.y0 - 0.3, P2y1 + 0.3]) {                                                                     // gate across the walkway on each side
    for (const x of [cx0 + 0.05, cx1 - 0.17]) box(root, x, x + 0.12, yg - 0.06, yg + 0.06, zr, zr + 1.3);
    for (const h of [0.35, 1.05]) box(root, cx0 + 0.17, cx1 - 0.17, yg - 0.03, yg + 0.03, zr + h, zr + h + 0.06);
    for (let x = cx0 + 0.4; x < cx1 - 0.3; x += 0.3) box(root, x, x + 0.04, yg - 0.025, yg + 0.025, zr + 0.35, zr + 1.11);
    const lx = cx1 + 0.5, ly = yg + (yg > -9 ? 0.6 : -0.6);                                                         // lights + bell on a post
    cyl(root, lx, ly, (g + zr + 3.0) / 2, 0.07, zr + 3.0 - g, "z", 12); box(root, lx - 0.6, lx + 0.6, ly - 0.05, ly + 0.05, zr + 2.3, zr + 2.42);
    for (const dx of [-0.45, 0.45]) { cyl(root, lx + dx, ly, zr + 2.0, 0.18, 0.08, "y", 20); cyl(root, lx + dx, ly + (yg > -9 ? -0.06 : 0.06), zr + 2.0, 0.21, 0.04, "y", 20); }
    cyl(root, lx, ly, zr + 2.75, 0.16, 0.2, "z", 16, M.white, 0.06);                                              // bell
    sign(root, lx, ly + (yg > -9 ? -0.07 : 0.07), zr + 1.4, 0.9, 0.45, textTex(["STOP", "LOOK LISTEN"], 384, 192), yg > -9 ? "-y" : "+y");
  }
  for (const [yc, yb] of [[T1, T1 - 1.6], [T2, T2 + 1.6]]) {                                                       // STOP boards 6 m before the crossing
    const xs = rx1 - 6; cyl(root, xs, yb, g + 1.0, 0.05, 2.0, "z", 10);
    const b = box(root, xs - 0.35, xs + 0.35, yb - 0.03, yb + 0.03, g + 1.6, g + 2.3);
    sign(root, xs, yb - 0.04, g + 1.95, 0.6, 0.6, textTex(["STOP"], 256, 256)); sign(root, xs, yb + 0.04, g + 1.95, 0.6, 0.6, textTex(["STOP"], 256, 256), "+y");
  }
  railFence(root, [[26, P.y0 + 0.15], [rx0, P.y0 + 0.15]]); railFence(root, [[26, P2y1 - 0.15], [rx0, P2y1 - 0.15]]);   // edge fences near the end
  railing(root, [[P.x0 + 0.1, P2y1 - 0.4], [P.x0 + 0.1, P2y0 + 0.1], [P.x1 - 0.1, P2y0 + 0.1], [P.x1 - 0.1, P2y1 - 2.1]]);   // closes the back and both ends of platform 2
  for (const x of [0, 6, 12, 18, 24]) { box(root, x + 0.8, x + 2.8, P2y0 + 0.6, P2y0 + 1.1, 0.42, 0.47); for (const xl of [x + 0.9, x + 2.64]) box(root, xl, xl + 0.06, P2y0 + 0.6, P2y0 + 1.1, 0, 0.42); }   // benches on platform 2
  // ---- platform fence (page picket) with the two walk gates ----
  for (const [a, b] of [[P.x0, -12], [-10, H.x0 - 0.1], [H.x1 + 0.1, 33], [35, P.x1]]) picket(root, a, b, H.y0 + 0.05);
  // ---- entrance: 4 steps down to the court, folded ramps either side ----
  const sx0 = 8.7, sx1 = 14.3;
  for (let k = 1; k <= 3; k++) box(root, sx0, sx1, 9 + (k - 1) * 0.6, 9 + k * 0.6, g, -0.15 * k);
  slab(root, [[1.5, 10.8], [21.5, 10.8], [21.5, 15.8], [1.5, 15.8]], LG, LG + 0.03);                                // court paving
  { const L = []; for (let x = 2.5; x < 21.5; x += 1) L.push([[x, 10.8, LG + 0.035], [x, 15.8, LG + 0.035]]); for (let y = 11.8; y < 15.8; y += 1) L.push([[1.5, y, LG + 0.035], [21.5, y, LG + 0.035]]); lines(root, L); }
  for (const sd of [1, -1]) {
    const X = (x) => sd > 0 ? x : 2 * 11.5 - x, Bx = (a, b) => [Math.min(X(a), X(b)), Math.max(X(a), X(b))];
    const [a1, b1] = Bx(3.6, 7.2), [ta, tb] = Bx(2.1, 3.6), [la, lb] = Bx(7.2, 8.7);
    ramp(root, X(7.2), X(3.6), 11.1, 12.6, LG + 0.03, -0.3);                                                       // run 1: outward
    box(root, ta, tb, 9.0, 12.6, g, -0.3);                                                                          // turning landing
    ramp(root, X(3.6), X(7.2), 9.0, 10.5, -0.3, 0);                                                                 // run 2: back toward the steps
    box(root, la, lb, 9.0, 10.5, g, 0);                                                                             // level landing beside the top step
    rail(root, [[X(7.2), 11.15, LG], [X(3.6), 11.15, -0.3]]); rail(root, [[X(3.6), 10.45, -0.3], [X(7.2), 10.45, 0], [X(8.65), 10.45, 0], [X(8.65), 9.05, 0]]);   // on round the top landing, down its side by the steps
    rail(root, [[X(7.2), 12.55, LG], [X(3.6), 12.55, -0.3], [X(2.15), 12.55, -0.3], [X(2.15), 9.05, -0.3], [X(3.6), 9.05, -0.3], [X(7.2), 9.05, 0]]);
  }
  // ---- front walk, side walks to the street, pick-up shelter ----
  // walks, front walk and sidewalk read as one paved surface: no outline where two of them meet, only their outer kerbs
  const W = LG + 0.15, K = [];
  slab(root, [[-10, 15.8], [33, 15.8], [33, 18], [-10, 18]], LG, W).userData.noEdge = true;
  for (const y of [15.8, 18]) K.push([[-10, y, W], [33, y, W]], [[-10, y, LG], [33, y, LG]]);
  for (const xw of [-12, 33]) {
    side(root, [[8.95, g], [33.5, g], [33.5, W], [15.8, W], [9, 0], [8.95, 0]], xw, xw + 2).userData.noEdge = true;   // level by the station, gentle slope, then flat
    for (const xs of [xw, xw + 2]) {
      const inner = (xw < 0) === (xs === xw + 2);
      const top = [[xs, 9, 0], [xs, 15.8, W]]; if (!inner) top.push([xs, 18, W]);
      for (let i = 0; i < top.length - 1; i++) K.push([top[i], top[i + 1]]);
      K.push([[xs, 18, W], [xs, 33.5, W]], [[xs, 9, LG], [xs, inner ? 15.8 : 18, LG]], [[xs, 18, LG], [xs, 33.5, LG]]);
    }
  }
  // ---- car park: one rectangle, one-way aisle; drop-off and accessible bays opposite the steps ----
  slab(root, [[-10, 18], [33, 18], [33, 35.5], [28, 35.5], [28, 33], [-5, 33], [-5, 35.5], [-10, 35.5]], LG, LG + 0.004).userData.noEdge = true;   // flush with the street   // lot and its two lanes in one piece
  { const z = LG + 0.008, L = [];
    for (let x = -10; x <= 33.01; x += 2.5) { L.push([[x, 18, z], [x, 22.5, z]]); if (!(x > -10 && x < -5) && !(x > 28 && x < 33)) L.push([[x, 28.5, z], [x, 33, z]]); }
    L.push([[-10, 22.5, z], [33, 22.5, z]], [[-10, 28.5, z], [-5, 28.5, z]], [[-5, 28.5, z], [28, 28.5, z]], [[28, 28.5, z], [33, 28.5, z]]);
    lines(root, L); }
  // ---- hedge, sidewalk, street with the bus + taxi lay-by and its shelter ----
  for (const [a, b] of [[-18, -12], [-5, 28], [35, 42]]) box(root, a, b, 32.9, 33.5, LG, LG + 1.0);
  for (const [a, b] of [[EX0, -10], [-5, 28], [33, EX1]]) {
    slab(root, [[a, 33.5], [b, 33.5], [b, 35.5], [a, 35.5]], LG, W).userData.noEdge = true;
    K.push([[a, 35.5, W], [b, 35.5, W]], [[a, 35.5, LG], [b, 35.5, LG]]);
    const ia = a === EX0 ? EX0 : a === 33 ? 35 : a, ib = b === -10 ? -12 : b;            // inner edge, open where a walk joins
    K.push([[ia, 33.5, W], [ib, 33.5, W]]);
    for (const e of [a, b]) K.push([[e, 33.5, W], [e, 35.5, W]], [[e, 33.5, LG], [e, 35.5, LG]], [[e, 35.5, LG], [e, 35.5, W]], [[e, 33.5, LG], [e, 33.5, W]]);
  }
  lines(root, K);
  { const z = LG + 0.005, L = []; for (let x = EX0 + 1; x < EX1 - 1; x += 6) L.push([[x, 40, z], [x + 3, 40, z]]);
    lines(root, L); }
  shelter(root, 15.5, 19.5, 33.9, 35.3, LG + 0.15);
  sign(root, 22, 35.3, LG + 2.6, 0.9, 0.45, textTex(["BUS"], 256, 128), "+y"); cyl(root, 22, 35.35, LG + 1.2, 0.04, 2.4, "z", 8);
  sign(root, 25, 35.3, LG + 2.6, 0.9, 0.45, textTex(["TAXI"], 256, 128), "+y"); cyl(root, 25, 35.35, LG + 1.2, 0.04, 2.4, "z", 8);
  // ---- trees: an orchard either side, two by the court ----
  for (const x of [-17.0, -15.1, -13.2, 36.5, 38.6, 40.7]) for (const y of [11.0, 16.6, 22.2, 27.8]) tree(root, x, y, 0.95);
  for (const x of [27.0, -4.0]) tree(root, x, 14.3, 1.0);
}

// builds everything; resolves when the 3D letters are in
export function buildScene(scene) {
  mats();
  const root = new THREE.Group();
  hall(root); tower(root); crossGable(root); dormer(root); front(root); train(root); site(root);
  scene.add(root);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdddddd, 2.3));
  const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(-50, 80, 90); scene.add(sun);
  const signRoot = new THREE.Group(); root.add(signRoot);
  const finish = (font) => { entryGable(signRoot, font); wallUV(root); outline(root); seams(root); };
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

// ---------- seam lines: wherever two masses run into each other, draw the line where they meet ----------
// For every pair of meshes whose boxes overlap, intersect their triangles and keep the segments where one
// surface really passes through the other (faces that only touch or lie flat on each other are skipped).
function seams(root) {
  root.updateMatrixWorld(true);
  const meshes = [];
  root.traverse(o => {
    if (!o.isMesh || o.material === M.page) return;      // roof planes count too (they carry their own outline, not EdgesGeometry)
    const g = o.geometry, pos = g.attributes.position, idx = g.index, n = idx ? idx.count : pos.count;
    const t = new Float32Array(n * 3), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(o.matrixWorld); t[i * 3] = v.x; t[i * 3 + 1] = v.y; t[i * 3 + 2] = v.z; }
    const bb = new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(t, 3));
    meshes.push({ t, bb, n: n / 3 });
  });
  const out = [], E = 1e-4;
  const P = (t, i, k) => [t[i * 9 + k * 3], t[i * 9 + k * 3 + 1], t[i * 9 + k * 3 + 2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const tri = (t, i) => { const a = P(t, i, 0), b = P(t, i, 1), c = P(t, i, 2), nn = cross(sub(b, a), sub(c, a)), l = Math.hypot(...nn);
    return l < 1e-9 ? null : { p: [a, b, c], n: [nn[0] / l, nn[1] / l, nn[2] / l], d: dot(nn, a) / l,
      lo: [Math.min(a[0], b[0], c[0]), Math.min(a[1], b[1], c[1]), Math.min(a[2], b[2], c[2])], hi: [Math.max(a[0], b[0], c[0]), Math.max(a[1], b[1], c[1]), Math.max(a[2], b[2], c[2])] }; };
  const cut = (T, N, D) => {        // where triangle T crosses plane (N, D); null unless it strictly passes through
    const ds = T.p.map(q => dot(N, q) - D);
    if (!(ds.some(x => x > E) && ds.some(x => x < -E))) return null;
    const pts = [];
    for (let k = 0; k < 3; k++) { const a = T.p[k], b = T.p[(k + 1) % 3], da = ds[k], db = ds[(k + 1) % 3];
      if (Math.abs(da) <= E) pts.push(a); else if ((da > E && db < -E) || (da < -E && db > E)) { const f = da / (da - db); pts.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]); } }
    return pts.length >= 2 ? [pts[0], pts[1]] : null;
  };
  const cache = new Map();
  const tris = (m) => { if (!cache.has(m)) { const a = []; for (let i = 0; i < m.n; i++) { const T = tri(m.t, i); if (T) a.push(T); } cache.set(m, a); } return cache.get(m); };
  for (let i = 0; i < meshes.length; i++) for (let j = i + 1; j < meshes.length; j++) {
    const A = meshes[i], B = meshes[j];
    if (!A.bb.intersectsBox(B.bb)) continue;
    const ov = A.bb.clone().intersect(B.bb).expandByScalar(E);
    const inBox = (T) => T.hi[0] >= ov.min.x && T.lo[0] <= ov.max.x && T.hi[1] >= ov.min.y && T.lo[1] <= ov.max.y && T.hi[2] >= ov.min.z && T.lo[2] <= ov.max.z;
    const ta = tris(A).filter(inBox), tb = tris(B).filter(inBox);
    for (const S of ta) for (const T of tb) {
      if (S.hi[0] < T.lo[0] || S.lo[0] > T.hi[0] || S.hi[1] < T.lo[1] || S.lo[1] > T.hi[1] || S.hi[2] < T.lo[2] || S.lo[2] > T.hi[2]) continue;
      const s1 = cut(S, T.n, T.d); if (!s1) continue;
      const s2 = cut(T, S.n, S.d); if (!s2) continue;
      const dir = cross(S.n, T.n), dl = Math.hypot(...dir); if (dl < 1e-6) continue;
      const pr = (q) => dot(q, dir);
      const a0 = Math.min(pr(s1[0]), pr(s1[1])), a1 = Math.max(pr(s1[0]), pr(s1[1])), b0 = Math.min(pr(s2[0]), pr(s2[1])), b1 = Math.max(pr(s2[0]), pr(s2[1]));
      const lo = Math.max(a0, b0), hi = Math.min(a1, b1); if (hi - lo < 1e-3 * dl) continue;
      const at = (x) => { const [p0, p1] = s1, q0 = pr(p0), q1 = pr(p1), f = (x - q0) / (q1 - q0 || 1); return [p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f, p0[2] + (p1[2] - p0[2]) * f]; };
      out.push(...at(lo), ...at(hi));
    }
  }
  if (!out.length) return;
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
  const L = new THREE.LineSegments(g, M.line); L.matrixAutoUpdate = false; L.matrix.copy(root.matrixWorld).invert(); root.add(L);
}
