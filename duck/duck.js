// Low-poly rubber duck (from Ahmed's reference sheet, duck/reference.jpg).
// buildDuck() returns a THREE.Group 2.8 units tall (2.00 BU x K), sitting on y = 0 and facing +z.
// Where two masses meet (head/body, wings/body, beak/head, upper/lower beak) a seam line is drawn
// along the exact intersection of the meshes (project rule: intersection lines are always visible).
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";

export const DUCK_COLORS = { body: 0xffcc0a, beak: 0xf96b16, beakUnder: 0xe2550e, eye: 0x111111, glint: 0xffffff, seam: 0x5a3d00 };

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


// ---- Ahmed's numbered sheets (V2, "controlled dimensions V5"), all in Blender units (BU) ----
// The duck is 2.00 BU tall. The page shows it K times bigger (2.8 units), so every BU number is multiplied by K.
export const K = 1.4;
export const SPEC = {
  totalH: 2.0,
  body: { h: 0.94, w: 1.43, d: 1.45, z: -0.05 },   // measured off the picture (Ahmed chose the picture): sheet said 1.30 wide, 1.37 deep                 // body top 0.94, width without wings, depth without tail
  head: { base: 0.88, h: 1.12, w: 1.27, d: 1.15, maxAt: 0.50, baseW: 0.84, fwd: 0.12 },
  wing: { x: 0.40, inside: 0.22, out: 0.18, len: 0.75, h: 0.53, y: 0.50, tilt: 15 },   // y 0.50 (sheet said 0.56): in the picture the wings are widest at 0.50 up
  tail: { h: 0.30, back: 0.24, y: 0.66 },   // the picture keeps the back full up to 0.80
  eye: { w: 0.16, h: 0.21, d: 0.07, cc: 0.65, y: 1.51, glint: 0.06 },
  beak: { w: 0.66, proj: 0.34, baseW: 0.48, top: 1.36, bottom: 1.05, upper: 0.18, gap: 0.02, lower: 0.11, ridge: 0.04 },
};

function fitBox(geo, size) {                             // centre the geometry and stretch it to an exact box size
  geo.computeBoundingBox(); const b = geo.boundingBox, c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
  geo.translate(-c.x, -c.y, -c.z); geo.scale(size[0] / s.x, size[1] / s.y, size[2] / s.z); geo.computeVertexNormals();
  return geo;
}

function loft(rings) {                                    // rings: same-length loops of [x, y, z], back to front
  const pos = [];
  const tri = (a, b, c, out) => {                         // wind so the face points along "out"
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (n.dot(out) < 0) [b, c] = [c, b];
    for (const p of [a, b, c]) pos.push(p.x, p.y, p.z);
  };
  const R = rings.map((r) => r.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const mid = R.map((r) => r.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(r.length));
  for (let i = 0; i + 1 < R.length; i++) {
    const c = mid[i].clone().add(mid[i + 1]).multiplyScalar(0.5);
    for (let k = 0; k < R[i].length; k++) {
      const k2 = (k + 1) % R[i].length, a = R[i][k], b = R[i][k2], d = R[i + 1][k], e = R[i + 1][k2];
      const out = a.clone().add(b).add(d).add(e).multiplyScalar(0.25).sub(c); out.z = 0;
      tri(a, b, e, out); tri(a, e, d, out);
    }
  }
  for (const [i, dz] of [[0, -1], [R.length - 1, 1]])
    for (let k = 0; k < R[i].length; k++) tri(mid[i], R[i][k], R[i][(k + 1) % R[i].length], new THREE.Vector3(0, 0, dz));
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return g;
}

export function buildDuck(opts = {}) {
  const C = { ...DUCK_COLORS, ...(opts.colors || {}) };
  const mat = (color, rough) => new THREE.MeshStandardMaterial({
    color, roughness: rough, metalness: 0, flatShading: true,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,   // lets the seam lines sit on top cleanly
  });
  const yellow = mat(C.body, 0.35), orange = mat(C.beak, 0.4), orangeDark = mat(C.beakUnder, 0.45);
  const S = SPEC, k = (v) => v * K;

  const duck = new THREE.Group(); duck.name = "duck";
  const add = (geo, m, pos, scale, rot, name) => {
    const mesh = new THREE.Mesh(geo, m); mesh.name = name;
    mesh.position.set(...pos); if (scale) mesh.scale.set(...scale); if (rot) mesh.rotation.set(...rot);
    mesh.castShadow = true; mesh.receiveShadow = true; duck.add(mesh); return mesh;
  };

  // body: 1.30 wide, 0.94 tall, 1.37 deep, flat underneath, a little narrower at the shoulders
  const body = add(fitBox(lowSphere(18, 10, (v) => {
    v.y = Math.max(v.y, -0.75);                          // measured off the picture: a wide flat base (0.85 across, 0.09 up)
  }, 2), [k(S.body.w), k(S.body.h), k(S.body.d)]), yellow, [0, k(S.body.h / 2), k(S.body.z)], null, null, "body");

  // tail: a small raised bump at the rear, 0.30 tall, sticking out 0.24 behind the body
  const tailGeo = fitBox(lowSphere(12, 6, (v) => { v.x *= 1 - 0.35 * Math.max(0, -v.z); }, 7, 0.02), [k(0.7), k(0.16), k(0.6)]);   // 0.16 thick, tipped 14 degrees: 0.30 tall overall
  const bodyBack = k(S.body.z - S.body.d / 2);
  const tail = add(tailGeo, yellow, [0, k(S.tail.y), bodyBack - k(S.tail.back) + k(0.31)], null, [0.25, 0, 0], "tail");   // tipped up at the back

  // head: 1.27 wide (widest 0.50 above its base), 1.12 tall, 1.15 deep; squarer above the widest line,
  // flat 0.84 wide underneath where it sits 0.06 down into the body
  const H = S.head, up = H.h - H.maxAt;
  const headGeo = lowSphere(16, 9, (v) => {
    const rho = Math.hypot(v.x, v.z), p = v.y > 0 ? 2.3 : 2.5;     // the sheet's own picture is round, so only a touch squarer than a ball
    const s = 1 / Math.pow(Math.pow(rho, p) + Math.pow(Math.abs(v.y), p), 1 / p);
    v.x *= s * H.w / 2; v.z *= s * H.d / 2;
    v.y = v.y > 0 ? v.y * s * up : Math.max(v.y * s * 0.596, -H.maxAt);
    v.multiplyScalar(K);
  }, 3);
  const head = add(headGeo, yellow, [0, k(H.base + H.maxAt), k(S.body.z + H.fwd)], null, null, "head");
  duck.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const onHead = (x, y) => {                               // the head's front surface at world (x, y)
    ray.set(new THREE.Vector3(x, y, 10), new THREE.Vector3(0, 0, -1));
    return ray.intersectObject(head)[0]?.point;
  };

  // wings: 0.40 wide (0.22 inside the body, 0.18 out), 0.75 long, 0.53 tall, centred 0.56 up, tilted 15 degrees
  const W = S.wing, wingGeo = fitBox(lowSphere(12, 7, (v) => { v.z -= 0.25 * v.y * v.y; v.y += 0.2 * Math.max(0, -v.z) * (1 + v.y); }, 5, 0.02), [k(W.x), k(W.h), k(W.len)]);   // flattened paddle, its back end lifting
  // the 15 degree lean pushes the outer edge 0.062 further out, so the centre is moved in by that much
  const wx = k(S.body.w / 2 + W.out - W.x / 2 - 0.062 + 0.04), tilt = THREE.MathUtils.degToRad(W.tilt);
  const wingL = add(wingGeo, yellow, [wx, k(W.y), k(S.body.z)], null, [0, 0, tilt], "wing_L");
  const wingR = add(wingGeo, yellow, [-wx, k(W.y), k(S.body.z)], null, [0, 0, -tilt], "wing_R");

  // beak: 0.66 wide, 0.48 at the face, 0.34 out from the face; upper lip 0.18 (with a 0.04 centre ridge),
  // 0.02 mouth gap, lower lip 0.11; top at 1.36, bottom at 1.05; the mouth line dips at the centre
  const B = S.beak, mouthY = B.top - B.upper, face = onHead(0, k(mouthY));
  const at = [0, k(mouthY), face ? face.z : k(0.6)];
  const e = 0.07, c = 0.03;                                // side wall height, corner lift of the mouth line
  //               z     half-w  top
  const UP = [[-0.10, 0.22, 0.18], [0, 0.24, 0.18], [0.08, 0.31, 0.17], [0.17, 0.33, 0.15], [0.26, 0.31, 0.12], [0.32, 0.27, 0.1], [0.345, 0.18, 0.08]];
  const beakTop = add(loft(UP.map(([z, w, t]) => [
    [w, e + c, z], [w * 0.65, e + c * 0.6 + (t - B.ridge - e) * 0.6, z], [w * 0.3, t - B.ridge * 0.9, z], [0, t, z],
    [-w * 0.3, t - B.ridge * 0.9, z], [-w * 0.65, e + c * 0.6 + (t - B.ridge - e) * 0.6, z], [-w, e + c, z],
    [-w, c, z], [-w * 0.5, c * 0.35, z], [0, 0, z], [w * 0.5, c * 0.35, z], [w, c, z]].map((p) => p.map(k)))),
    orange, at, null, null, "beak_upper");
  //               z     half-w  bottom
  const LO = [[-0.10, 0.2, -0.11], [0, 0.22, -0.13], [0.08, 0.28, -0.13], [0.17, 0.3, -0.12], [0.26, 0.28, -0.1], [0.31, 0.23, -0.07], [0.33, 0.15, -0.04]];
  const g = -B.gap;
  const beakBot = add(loft(LO.map(([z, w, b]) => [
    [w * 0.92, c * 0.9 + g, z], [w * 0.5, c * 0.35 + g, z], [0, g, z], [-w * 0.5, c * 0.35 + g, z], [-w * 0.92, c * 0.9 + g, z],
    [-w * 0.85, b * 0.45, z], [-w * 0.45, b * 0.9, z], [0, b, z], [w * 0.45, b * 0.9, z], [w * 0.85, b * 0.45, z]].map((p) => p.map(k)))),
    orangeDark, at, null, null, "beak_lower");             // pivots on the mouth line, so it can open to quack
  beakBot.userData.restX = 0;

  // eyes: 0.16 wide, 0.21 tall, 0.07 thick, 0.65 apart centre to centre, centres 1.51 up; white glint 0.06 upper left
  const E = S.eye, eyeGeo = new THREE.SphereGeometry(1, 10, 7);
  const eyeMat = new THREE.MeshStandardMaterial({ color: C.eye, roughness: 0.15 });
  const glintMat = new THREE.MeshBasicMaterial({ color: C.glint });
  const hc = head.position;
  for (const s of [1, -1]) {
    const p = onHead(s * k(E.cc / 2), k(E.y)) || new THREE.Vector3(s * k(E.cc / 2), k(E.y), k(0.6));
    const n = new THREE.Vector3((p.x - hc.x) / (H.w * H.w), 0.3 * (p.y - hc.y) / (up * up), (p.z - hc.z) / (H.d * H.d)).normalize();
    const eye = new THREE.Mesh(eyeGeo, eyeMat); eye.name = s > 0 ? "eye_L" : "eye_R";
    eye.position.copy(p).addScaledVector(n, -k(0.005));
    // the eye sits turned on the curved face, so it reads wider than its own width
    eye.scale.set(k(E.w / 2) * 0.84, k(E.h / 2) * 0.95, k(E.d / 2)); eye.lookAt(eye.position.clone().add(n)); duck.add(eye);
    const gl = new THREE.Mesh(eyeGeo, glintMat); gl.name = "glint";
    gl.position.set(-0.34, 0.28, 0.8); gl.scale.set(E.glint / E.w, E.glint / E.h, 0.3); eye.add(gl);
  }

  // seam lines along every place two masses meet
  duck.updateMatrixWorld(true);
  const pairs = [[head, body], [wingL, body], [wingR, body], [tail, body], [beakTop, head], [beakBot, head], [beakTop, beakBot]];
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
