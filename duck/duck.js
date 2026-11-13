// Low-poly rubber duck (from Ahmed's reference sheet, duck/reference.jpg).
// buildDuck() returns a THREE.Group about 2.8 units tall, sitting on y = 0 and facing +z.
// Where two masses meet (head/body, wings/body, beak/head, upper/lower beak) a seam line is drawn
// along the exact intersection of the meshes (project rule: intersection lines are always visible).
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";

export const DUCK_COLORS = { body: 0xffcc0a, beak: 0xf96b16, eye: 0x111111, glint: 0xffffff, seam: 0x5a3d00 };

// The reference's facets: horizontal rings round each mass (about 14 facets round, 8 rings top to bottom),
// every other ring turned half a facet so each band breaks into zig-zag triangles, with corners pushed in or
// out a touch so it does not look machine-made.
function lowSphere(segs, rings, shape, seed = 1, jitter = 0.03) {
  let r = seed * 9301 + 49297;
  const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280 - 0.5; };
  const P = [], ringIdx = [];
  P.push(new THREE.Vector3(0, 1, 0));
  for (let i = 1; i < rings; i++) {
    const phi = Math.PI * i / rings, off = (i % 2) * 0.12, row = [];   // a small shift per band, so each quad breaks on a slanted edge
    for (let j = 0; j < segs; j++) {
      const th = 2 * Math.PI * (j + off + rnd() * 0.22) / segs, ph = phi + rnd() * 0.12 / rings;
      const f = 1 + rnd() * jitter;
      row.push(P.length); P.push(new THREE.Vector3(Math.sin(ph) * Math.sin(th) * f, Math.cos(ph) * f, Math.sin(ph) * Math.cos(th) * f));
    }
    ringIdx.push(row);
  }
  P.push(new THREE.Vector3(0, -1, 0));
  if (shape) for (const v of P) shape(v);
  const T = [], top = 0, bot = P.length - 1, n = segs;
  const first = ringIdx[0], last = ringIdx[ringIdx.length - 1];
  for (let j = 0; j < n; j++) { T.push([top, first[j], first[(j + 1) % n]]); T.push([bot, last[j], last[(j + 1) % n]]); }
  for (let i = 0; i < ringIdx.length - 1; i++) {
    const A = ringIdx[i], B = ringIdx[i + 1], aOff = (i + 1) % 2;       // ring i+1 (A) offset when (i+1) odd
    for (let j = 0; j < n; j++) {
      if (aOff) { T.push([A[j], B[(j + 1) % n], B[j]]); T.push([A[j], A[(j + 1) % n], B[(j + 1) % n]]); }
      else { T.push([A[j], A[(j + 1) % n], B[j]]); T.push([A[(j + 1) % n], B[(j + 1) % n], B[j]]); }
    }
  }
  return trisToGeometry(P, T);
}
function trisToGeometry(P, T) {                       // non-indexed, every triangle wound to face outward
  const c = new THREE.Vector3(); for (const v of P) c.add(v); c.divideScalar(P.length);
  const pos = [], e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nrm = new THREE.Vector3(), m = new THREE.Vector3();
  for (let [a, b, d] of T) {
    e1.subVectors(P[b], P[a]); e2.subVectors(P[d], P[a]); nrm.crossVectors(e1, e2);
    m.copy(P[a]).add(P[b]).add(P[d]).divideScalar(3).sub(c);
    if (nrm.dot(m) < 0) [b, d] = [d, b];
    for (const k of [a, b, d]) pos.push(P[k].x, P[k].y, P[k].z);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return g;
}

// shape settings, tuned view by view against the reference sheet
const WING = { pos: [0.88, 0.92, 0.02], scale: [0.32, 0.5, 0.62], rot: [0.05, 0.1, 0.55] };
const BEAK = { s: 0.92, top: [0, 1.88, 0.72], bot: [0, 1.73, 0.74], tilt: 0.26 };

export function buildDuck(opts = {}) {
  const C = { ...DUCK_COLORS, ...(opts.colors || {}) };
  const mat = (color, rough) => new THREE.MeshStandardMaterial({
    color, roughness: rough, metalness: 0, flatShading: true,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,   // lets the seam lines sit on top cleanly
  });
  const yellow = mat(C.body, 0.42), orange = mat(C.beak, 0.5);
  const duck = new THREE.Group(); duck.name = "duck";
  const add = (geo, m, pos, scale, rot, name) => {
    const mesh = new THREE.Mesh(geo, m); mesh.name = name;
    mesh.position.set(...pos); if (scale) mesh.scale.set(...scale); if (rot) mesh.rotation.set(...rot);
    mesh.castShadow = true; mesh.receiveShadow = true; duck.add(mesh); return mesh;
  };
  // sizes read off the reference sheet: duck 2.8 tall, head about 55% of it and as wide as the body

  // body: round, a little longer than wide, its back rising into a short upturned tail
  const body = add(lowSphere(18, 10, (v) => {
    const t = Math.max(0, -v.z - 0.5) / 0.5;          // 0 from the middle forward, 1 at the very back
    const up = Math.max(0, v.y + 0.25);
    const pear = 1 - 0.2 * Math.max(0, v.y) + 0.06 * Math.max(0, -v.y);   // narrower shoulders, fuller bottom
    v.x *= pear; v.z *= pear;
    v.x *= 1 - 0.4 * t;                             // seen from above the back narrows to the tail
    v.y += 0.95 * t * t * up;                        // and its top rises into a short point
    v.z -= 0.38 * t * t * up;
    v.y = Math.max(v.y, -0.93);                          // small flat spot underneath to sit on
  }, 2), yellow, [0, 0.8, -0.06], [1.06, 0.88, 1.02], null, "body");

  // head: a big round ball, slightly wider than deep, sitting straight on top
  const head = add(lowSphere(16, 9, null, 3), yellow, [0, 2.0, 0.1], [0.93, 0.88, 0.86], null, "head");

  // wings: thick half-moon paddles with a flat top face, hung from the shoulders and leaning out at the bottom
  const wingGeo = lowSphere(12, 7, (v) => { v.y = Math.min(v.y, 0.4); }, 5, 0.02);
  const wingL = add(wingGeo, yellow, WING.pos, WING.scale, WING.rot, "wingL");
  const wingR = add(wingGeo, yellow, [-WING.pos[0], WING.pos[1], WING.pos[2]], WING.scale, [WING.rot[0], -WING.rot[1], -WING.rot[2]], "wingR");

  // beak: a wide thick bill, narrow at the face and spreading to a squared tip, with a ridge on top and a
  // slight droop; under it a smaller lower lip so the mouth line shows. Both are hulls of a few points.
  const hull = (pts) => new ConvexGeometry(pts.map(([x, y, z]) => new THREE.Vector3(x * BEAK.s, y * BEAK.s, z * BEAK.s)));
  const bill = [];
  for (const [z, w, yb, yt, ridge] of [[0, 0.3, -0.12, 0.15, 0.16], [0.24, 0.42, -0.11, 0.14, 0.13], [0.42, 0.5, -0.1, 0.08, 0.04], [0.52, 0.44, -0.09, 0.03, 0.01]]) {
    bill.push([-w, yb, z], [w, yb, z], [-w * 0.92, yt, z], [w * 0.92, yt, z], [0, yt + ridge, z]);
  }
  const beakTop = add(hull(bill), orange, BEAK.top, null, [BEAK.tilt, 0, 0], "beakTop");
  const lip = [];
  for (const [z, w, yb, yt] of [[0, 0.26, -0.08, 0.05], [0.22, 0.34, -0.09, 0.04], [0.36, 0.26, -0.07, 0.03]]) {
    lip.push([-w, yb, z], [w, yb, z], [-w * 0.8, yt, z], [w * 0.8, yt, z], [0, yb - 0.03, z]);
  }
  const beakBot = add(hull(lip), orange, BEAK.bot, null, [0.08, 0, 0], "beakBot");

  // eyes: shiny black buttons with a white glint
  const eyeGeo = new THREE.SphereGeometry(1, 14, 10);
  const eyeMat = new THREE.MeshStandardMaterial({ color: C.eye, roughness: 0.15 });
  const glintMat = new THREE.MeshBasicMaterial({ color: C.glint });
  for (const s of [1, -1]) {
    const dir = new THREE.Vector3(0.5 * s, 0.1, 0.86).normalize();
    const e = new THREE.Mesh(eyeGeo, eyeMat); e.name = "eye";
    e.position.copy(head.position).add(dir.clone().multiply(head.scale).multiplyScalar(0.985));
    e.scale.set(0.12, 0.16, 0.06); e.lookAt(e.position.clone().add(dir)); duck.add(e);
    const gl = new THREE.Mesh(eyeGeo, glintMat); gl.name = "glint";
    gl.position.set(0.35, 0.4, 0.75); gl.scale.setScalar(0.28); e.add(gl);
  }

  // seam lines along every place two masses meet
  duck.updateMatrixWorld(true);
  const pairs = [[head, body], [wingL, body], [wingR, body], [beakTop, head], [beakBot, head], [beakTop, beakBot]];
  const pts = [];
  for (const [a, b] of pairs) pts.push(...meshIntersection(a, b));
  const lineGeo = new LineSegmentsGeometry().setPositions(pts);
  const lineMat = new LineMaterial({ color: C.seam, linewidth: opts.seamWidth ?? 2.2, worldUnits: false });
  const seams = new LineSegments2(lineGeo, lineMat); seams.name = "seams"; seams.raycast = () => {};
  duck.add(seams);
  duck.userData.seamMaterial = lineMat;                  // set .resolution on resize
  return duck;
}

// --- exact mesh/mesh intersection: the seam where two closed meshes cross ---------------------------
function worldTris(mesh) {
  const g = mesh.geometry, p = g.attributes.position, idx = g.index, m = mesh.matrixWorld, tris = [];
  const n = idx ? idx.count : p.count, get = (i) => new THREE.Vector3().fromBufferAttribute(p, idx ? idx.getX(i) : i).applyMatrix4(m);
  for (let i = 0; i < n; i += 3) {
    const t = [get(i), get(i + 1), get(i + 2)];
    if (t[0].distanceToSquared(t[1]) < 1e-12 || t[1].distanceToSquared(t[2]) < 1e-12 || t[0].distanceToSquared(t[2]) < 1e-12) continue;
    const box = new THREE.Box3().setFromPoints(t); tris.push({ t, box });
  }
  return tris;
}
const E1 = new THREE.Vector3(), E2 = new THREE.Vector3(), PV = new THREE.Vector3(), TV = new THREE.Vector3(), QV = new THREE.Vector3(), DIR = new THREE.Vector3();
function segTri(p0, p1, [a, b, c]) {                     // where segment p0-p1 pierces triangle abc (Möller–Trumbore)
  DIR.subVectors(p1, p0); E1.subVectors(b, a); E2.subVectors(c, a); PV.crossVectors(DIR, E2);
  const det = E1.dot(PV); if (Math.abs(det) < 1e-12) return null;
  const inv = 1 / det; TV.subVectors(p0, a); const u = TV.dot(PV) * inv; if (u < 0 || u > 1) return null;
  QV.crossVectors(TV, E1); const v = DIR.dot(QV) * inv; if (v < 0 || u + v > 1) return null;
  const t = E2.dot(QV) * inv; if (t < 0 || t > 1) return null;
  return p0.clone().addScaledVector(DIR, t);
}
export function meshIntersection(ma, mb) {
  const A = worldTris(ma), B = worldTris(mb), out = [];
  for (const ta of A) for (const tb of B) {
    if (!ta.box.intersectsBox(tb.box)) continue;
    const hits = [];
    for (const [x, y] of [[0, 1], [1, 2], [2, 0]]) {
      const h1 = segTri(ta.t[x], ta.t[y], tb.t); if (h1) hits.push(h1);
      const h2 = segTri(tb.t[x], tb.t[y], ta.t); if (h2) hits.push(h2);
    }
    if (hits.length < 2) continue;
    let best = [hits[0], hits[1]], bd = -1;               // the two points farthest apart make the segment
    for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++) {
      const d = hits[i].distanceToSquared(hits[j]); if (d > bd) { bd = d; best = [hits[i], hits[j]]; }
    }
    if (bd > 1e-10) out.push(best[0].x, best[0].y, best[0].z, best[1].x, best[1].y, best[1].z);
  }
  return out;
}
