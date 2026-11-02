// Fire station massing model (layout v6: rectangular corner plot, Airway Blvd in front, side street on the right).
// Plan coords in metres: x along the front (0 = left edge of the striped apron), y depth (0 = hall front, negative = street), z up.
// Three.js is y-up, so a plan point (x, y, z) maps to (x, z, -y).
import * as THREE from "three";

export const V = (x, y, z) => new THREE.Vector3(x, z, -y);

// ---------- dimensions ----------
export const D = {
  hall: { x0: 0, x1: 25, y0: 0.4, y1: 29, h: 9.5 },             // 4 bays between the side towers
  tower: { h: 8.6, w: 5, y0: -0.6 },                             // brick side towers with the tall windows
  bays: [0.3, 6.4, 12.5, 18.6].map(x => [x, x + 4.5]),           // door openings, 4.5 m, piers 1.6 m
  door: { h: 4.9, spring: 6.6, top: 7.7 },                       // door head, arch spring, arch crown
  gable: { x0: 4.6, x1: 20.4, z0: 9.7, peak: 13.5, depth: 8 },
  low: { x0: 30, x1: 49, y0: 0.5, y1: 12, h: 5.5 },              // low flat wing in front
  wingA: { x0: 26, x1: 40, y0: 20.5, y1: 48 },                   // gabled L wing, arm running back (ridge along y)
  wingB: { x0: 30, x1: 62, y0: 12, y1: 29 },                     // arm running right (ridge along x)
  eave: 5.5, pitch: 0.45,
  entry: { x0: 49, x1: 55.5, y0: 5.5, y1: 12, h: 9.5, roof: 2.6 },
  garage: { x0: -11, x1: 4, y0: 66, y1: 88, h: 5.2 },
  plot: { x0: -20, x1: 112, y0: -27, y1: 104 },
};

// ---------- materials ----------
const M = {};
function mats() {
  const L = (o) => new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, color: 0xffffff, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...o });
  M.white = L({}); M.roof = L({}); M.ground = L({});
  M.line = new THREE.LineBasicMaterial({ color: 0x000000 });
}

// ---------- helpers ----------
function box(root, x0, x1, y0, y1, z0, z1, mat = M.white) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, z1 - z0, y1 - y0), mat);
  m.position.copy(V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); root.add(m); return m;
}
// flat polygon in plan at height z
function flat(root, pts, z, mat = M.ground) {
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)))); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.position.y = z; root.add(m); return m;
}
// plan polygon extruded from z0 to z1
function slab(root, pts, z0, z1, mat = M.white) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth: z1 - z0, bevelEnabled: false, curveSegments: 32 });
  g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, mat); m.position.y = z0; root.add(m); return m;
}
// elevation polygon (x, z) extruded in plan y from y0 to y1
function elev(root, pts, y0, y1, mat = M.white, holes = []) {
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, z))));
  const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false, curveSegments: 24 });
  const m = new THREE.Mesh(g, mat); m.position.z = -y1; root.add(m); return m;
}
// side polygon (y, z) extruded in plan x from x0 to x1
function side(root, pts, x0, x1, mat = M.white) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([y, z]) => new THREE.Vector2(y, z))), { depth: x1 - x0, bevelEnabled: false });
  g.rotateY(Math.PI / 2); const m = new THREE.Mesh(g, mat); m.position.x = x0; root.add(m); return m;
}
function lines(root, segs) {     // segs: [[x,y,z],[x,y,z]] pairs
  const pts = []; for (const [a, b] of segs) pts.push(V(...a), V(...b));
  root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), M.line));
}
function cyl(root, x, y, z0, h, r, seg = 16, mat = M.white) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); m.position.copy(V(x, y, z0 + h / 2)); root.add(m); return m;
}
// gable roof over a rectangle, ridge along x ('x') or along y ('y'), eave height z, rise r
function gableRoof(root, x0, x1, y0, y1, z, r, along) {
  if (along === "x") side(root, [[y0, z], [y1, z], [(y0 + y1) / 2, z + r]], x0, x1, M.roof);
  else elev(root, [[x0, z], [x1, z], [(x0 + x1) / 2, z + r]], y0, y1, M.roof);
}
// window: frame outline + grid on a wall face. face '-y' (front, at plan y) or '+x' (east, at plan x)
function windowGrid(root, face, at, a0, a1, z0, z1, cols, rows) {
  const s = [], P = (a, z) => face === "-y" ? [a, at - 0.02, z] : [at + 0.02, a, z];
  const d = 0.12;
  for (const [u0, u1, w0, w1] of [[a0, a1, z0, z1], [a0 + d, a1 - d, z0 + d, z1 - d]]) {
    s.push([P(u0, w0), P(u1, w0)], [P(u1, w0), P(u1, w1)], [P(u1, w1), P(u0, w1)], [P(u0, w1), P(u0, w0)]);
  }
  for (let i = 1; i < cols; i++) { const u = a0 + (a1 - a0) * i / cols; s.push([P(u, z0 + d), P(u, z1 - d)]); }
  for (let j = 1; j < rows; j++) { const w = z0 + (z1 - z0) * j / rows; s.push([P(a0 + d, w), P(a1 - d, w)]); }
  lines(root, s);
}

// ---------- the building ----------
function hall(root) {
  const H = D.hall, T = D.tower, dr = D.door;
  // front wall of the bay section: one piece with the 4 arched openings notched in from the ground, and the gable on top
  const pts = [[H.x0, 0]];
  for (const [a, b] of D.bays) {
    const cx = (a + b) / 2, half = (b - a) / 2, rise = dr.top - dr.spring, R = (half * half + rise * rise) / (2 * rise), zc = dr.top - R;
    const t0 = Math.atan2(dr.spring - zc, half);
    pts.push([a, 0], [a, dr.spring]);
    for (let k = 1; k < 16; k++) { const t = Math.PI - t0 - (Math.PI - 2 * t0) * k / 16; pts.push([cx + R * Math.cos(t), zc + R * Math.sin(t)]); }
    pts.push([b, dr.spring], [b, 0]);
  }
  const G = D.gable;
  pts.push([H.x1, 0], [H.x1, H.h], [G.x1, H.h], [G.x1, G.z0], [(G.x0 + G.x1) / 2, G.peak], [G.x0, G.z0], [G.x0, H.h], [H.x0, H.h]);
  elev(root, pts, 0, 0.4);
  // hall body behind, doors closed in the openings (recessed 0.4), flat roof
  box(root, H.x0, H.x1, H.y0, H.y1, 0, H.h);
  for (const [a, b] of D.bays) {
    const s = [];
    for (let k = 1; k < 4; k++) { const x = a + (b - a) * k / 4; s.push([[x, 0.38, 0], [x, 0.38, dr.h]]); }      // door leaves
    s.push([[a, 0.38, dr.h], [b, 0.38, dr.h]]);                                                                 // door head / transom
    for (let k = 1; k < 4; k++) { const x = a + (b - a) * k / 4; s.push([[x, 0.38, dr.h], [x, 0.38, dr.spring + 0.5]]); }
    s.push([[a, 0.38, dr.spring], [b, 0.38, dr.spring]]);
    for (let k = 1; k < 4; k++) s.push([[a + 0.15, 0.38, dr.h * k / 4 * 0.9 + 0.3], [b - 0.15, 0.38, dr.h * k / 4 * 0.9 + 0.3]]);
    lines(root, s);
    box(root, (a + b) / 2 - 0.3, (a + b) / 2 + 0.3, -0.15, 0, dr.top - 0.15, dr.top + 0.45);                  // keystone
  }
  // cornice along the top of the bay section (not across the gable), rake trim on the gable
  box(root, H.x0 - 0.1, G.x0, -0.35, 0.4, H.h - 0.4, H.h + 0.1); box(root, G.x1, H.x1 + 0.1, -0.35, 0.4, H.h - 0.4, H.h + 0.1);
  elev(root, [[G.x0 - 0.5, G.z0 - 0.25], [(G.x0 + G.x1) / 2, G.peak - 0.1], [G.x1 + 0.5, G.z0 - 0.25], [G.x1 + 0.5, G.z0 + 0.3], [(G.x0 + G.x1) / 2, G.peak + 0.5], [G.x0 - 0.5, G.z0 + 0.3]], -0.4, 0.5);
  gableRoof(root, G.x0, G.x1, 0.5, G.depth, H.h, G.peak - H.h, "y");
  // sign and emblem (outlines only at this stage)
  box(root, 7.5, 17.5, -0.12, 0, 8.05, 9.35);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.15, 40), M.white); disc.rotation.x = Math.PI / 2; disc.position.copy(V(12.5, -0.08, 11.3)); root.add(disc);
  // side towers, each with a tall window and a cap
  for (const [x0, x1] of [[H.x0 - T.w, H.x0], [H.x1, H.x1 + T.w]]) {
    box(root, x0, x1, T.y0, H.y1, 0, T.h);
    box(root, x0 - 0.2, x1 + 0.2, T.y0 - 0.25, T.y0 + 0.6, T.h - 0.35, T.h + 0.1);
    windowGrid(root, "-y", T.y0, x0 + 0.9, x1 - 0.9, 1.0, 7.0, 3, 4);
  }
  // lamps between and beside the bays
  for (const x of [H.x0 + 0.15, 6.0, 12.1, 18.2, 24.3 + 0.55].map((v, i) => i === 0 ? v : v + 0.05)) {
    box(root, x - 0.06, x + 0.06, -0.55, 0, 6.25, 6.37);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.38, 0.35, 16, 1, true), M.white); shade.position.copy(V(x, -0.6, 5.95)); root.add(shade);
  }
}

function wings(root) {
  const L = D.low, A = D.wingA, B = D.wingB, e = D.eave, p = D.pitch;
  // low flat wing in front, windows on the street side
  box(root, L.x0, L.x1, L.y0, L.y1, 0, L.h);
  box(root, L.x0, L.x1 + 0.2, L.y0 - 0.2, L.y1, L.h - 0.3, L.h + 0.15);
  for (let x = L.x0 + 1.5; x + 2 <= L.x1 - 0.5; x += 3.4) windowGrid(root, "-y", L.y0, x, x + 2, 1.0, 3.6, 2, 2);
  // gabled L wing: the two arms, ridges running through and meeting
  box(root, A.x0, A.x1, A.y0, A.y1, 0, e); gableRoof(root, A.x0 - 0.4, A.x1 + 0.4, A.y0, A.y1 + 0.4, e, (A.x1 - A.x0) / 2 * p, "y");
  box(root, B.x0, B.x1, B.y0, B.y1, 0, e); gableRoof(root, B.x0, B.x1 + 0.4, B.y0 - 0.4, B.y1 + 0.4, e, (B.y1 - B.y0) / 2 * p, "x");
  for (let x = 42; x < 61; x += 4) windowGrid(root, "-y", B.y0, x, x + 1.8, 1.0, 3.6, 2, 2);
  for (let y = 31; y < 47; y += 4) windowGrid(root, "+x", A.x1, y, y + 1.8, 1.0, 3.6, 2, 2);
  // entrance tower: hip roof, emblem on the front and east faces, door + canopy on the east side (facing the plaza)
  const T = D.entry, cx = (T.x0 + T.x1) / 2, cy = (T.y0 + T.y1) / 2, w = T.x1 - T.x0;
  box(root, T.x0, T.x1, T.y0, T.y1, 0, T.h);
  box(root, T.x0 - 0.3, T.x1 + 0.3, T.y0 - 0.3, T.y1 + 0.3, T.h - 0.3, T.h);
  const hip = new THREE.Mesh(new THREE.ConeGeometry((w + 1) / Math.SQRT2, T.roof, 4), M.roof); hip.rotation.y = Math.PI / 4; hip.position.copy(V(cx, cy, T.h + T.roof / 2)); root.add(hip);
  for (const [nx, ny] of [[0, -1], [1, 0]]) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.15, 40), M.white);
    if (ny) { disc.rotation.x = Math.PI / 2; disc.position.copy(V(cx, T.y0 - 0.08, 6.8)); } else { disc.rotation.z = Math.PI / 2; disc.position.copy(V(T.x1 + 0.08, cy, 6.8)); }
    root.add(disc);
  }
  box(root, T.x1, T.x1 + 2.8, T.y0 + 0.6, T.y1 - 0.6, 3.3, 3.6);                       // canopy
  windowGrid(root, "+x", T.x1, cy - 1.6, cy + 1.6, 0, 3.0, 2, 1);                     // glass doors
}

function garage(root) {
  const G = D.garage;
  box(root, G.x0, G.x1, G.y0, G.y1, 0, G.h);
  gableRoof(root, G.x0 - 0.3, G.x1 + 0.3, G.y0 - 0.3, G.y1 + 0.3, G.h, 2.2, "y");
  for (const y of [70, 76, 82]) lines(root, [[[G.x1 + 0.02, y, 0], [G.x1 + 0.02, y, 4]], [[G.x1 + 0.02, y, 4], [G.x1 + 0.02, y + 4, 4]], [[G.x1 + 0.02, y + 4, 4], [G.x1 + 0.02, y + 4, 0]]]);
}

// ---------- site ----------
function site(root) {
  const P = D.plot;
  flat(root, [[-60, -70], [170, -70], [170, 140], [-60, 140]], -0.03);
  const kerb = (pts) => slab(root, pts, 0, 0.15);
  // streets: Airway Blvd in front, the side street on the right (road surface at 0, sidewalks raised)
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
  slab(root, [[-12, 31], [25, 31], [25, 58], [36, 58], [36, 90], [112, 90], [112, 98], [-12, 98]], 0, 0.04);
  slab(root, [[76, 4], [104, 4], [104, 72], [76, 72]], 0, 0.04);
  slab(root, [[104, 6], [112, 6], [112, 13], [104, 13]], 0, 0.04); slab(root, [[104, 62], [112, 62], [112, 69], [104, 69]], 0, 0.04);
  const stalls = [];
  for (let y = 7; y < 70; y += 3) stalls.push([[76.5, y, 0.05], [82, y, 0.05]], [[98, y, 0.05], [103.5, y, 0.05]]);
  for (let y = 36; y < 62; y += 3) stalls.push([[-11.5, y, 0.05], [-6.5, y, 0.05]]);
  lines(root, stalls);
  // walks, plaza, flagpoles
  slab(root, [[72.5, 4], [75.5, 4], [75.5, 72], [72.5, 72]], 0, 0.12);
  slab(root, [[36, 62], [72.5, 62], [72.5, 65], [36, 65]], 0, 0.12);
  slab(root, [[58.3, 8.4], [72.5, 8.4], [72.5, 11.6], [58.3, 11.6]], 0, 0.12);
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 0.14, 48), M.white); plaza.position.copy(V(66, 10, 0.07)); root.add(plaza);
  const ring = []; for (let k = 0; k < 48; k++) { const a = k / 48 * 6.283, b = (k + 1) / 48 * 6.283; ring.push([[66 + 1.2 * Math.cos(a), 10 + 1.2 * Math.sin(a), 0.15], [66 + 1.2 * Math.cos(b), 10 + 1.2 * Math.sin(b), 0.15]]); }
  lines(root, ring);
  for (const x of [61, 63]) { cyl(root, x, 4.5, 0, 12, 0.08, 8); box(root, x + 0.08, x + 1.9, 4.48, 4.52, 10.6, 11.8); }
  // ditch along the left edge
  lines(root, [[[-20, -27, 0.01], [-20, 104, 0.01]], [[-15, -27, 0.01], [-15, 104, 0.01]]]);
}

export function buildScene(scene) {
  mats();
  const root = new THREE.Group();
  hall(root); wings(root); garage(root); site(root);
  scene.add(root);
  // black outlines on every edge where faces meet at an angle, soft even light
  const add = [];
  root.traverse(o => {
    if (!o.isMesh || o.userData.noEdge) return;
    const thr = o.geometry.type === "CylinderGeometry" ? 40 : 20;
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, thr), M.line);
    e.position.copy(o.position); e.rotation.copy(o.rotation); e.scale.copy(o.scale); add.push([o.parent, e]);
  });
  for (const [p, e] of add) p.add(e);
  scene.background = new THREE.Color(0xffffff);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdddddd, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9); sun.position.set(-50, 80, 90); scene.add(sun);
  return root;
}
