// Low-poly rubber duck, built from Ahmed's "Reconstruction Package 01" (duck/reconstruction/).
// All sizes are in Blender units (BU, the duck is 2.00 BU tall) and shown K times bigger (2.8 units), facing +z.
// Head and body are lofted through the package's 11 measured/proposed sections (not spheres); the beak is two
// custom pieces with a raised centre ridge and a curved mouth split; wings are flat leaf-like wedges; the tail
// grows up and back out of the body. Where two masses meet, a seam line is drawn along their exact intersection.
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

export const DUCK_COLORS = { body: 0xffcc0a, beak: 0xf96b16, beakUnder: 0xe2550e, eye: 0x111111, glint: 0xffffff, seam: 0x5a3d00 };
export const K = 1.4;

// 01_head_sections_11_levels.csv: world Z, width, depth (BU)
const HEAD = [[0.88, 0.917, 0.801], [0.992, 0.944, 0.887], [1.104, 1.142, 0.946], [1.216, 1.223, 1.129], [1.328, 1.265, 1.091],
  [1.44, 1.212, 1.102], [1.552, 1.153, 1.064], [1.664, 1.046, 0.973], [1.776, 0.901, 0.854], [1.888, 0.643, 0.634]];
const HEAD_TOP = 2.0;
// 02_body_sections_11_levels_PROVISIONAL.csv: world Z, width, depth (BU)
const BODY = [[0.094, 0.78, 0.85], [0.188, 1.07, 1.11], [0.282, 1.22, 1.29], [0.376, 1.3, 1.37], [0.47, 1.29, 1.35],
  [0.564, 1.23, 1.28], [0.658, 1.13, 1.16], [0.752, 1.04, 1.02], [0.846, 0.98, 0.92], [0.94, 0.91, 0.81]];
// 03_face_landmarks.csv + 04_geometry_baseline.json
const EYE = { x: 0.33, z: 1.362, w: 0.16, h: 0.21, t: 0.07 };
const BEAK = { top: 1.357, bottom: 0.971, w: 0.66, base: 0.48, proj: 0.34 };
const WING = { x: 0.4, len: 0.75, h: 0.53, z: 0.5, out: 0.18, tilt: 15 };   // centre 0.50: where the reference front view is widest
const TAIL = { h: 0.3, back: 0.24 };
const BODY_FWD = 0.1;                        // the chest sits a little ahead of the head (side view of the reference)

const V = (x, y, z) => new THREE.Vector3(x * K, y * K, z * K);

// faceted mesh through horizontal elliptical rings; every other ring turned half a step, so each band breaks
// into the zig-zag triangles of the reference. levels: [y, width, depth] bottom to top (BU).
function ringMesh(levels, segs, { top, bottom, cz = 0, seed = 1, jitter = 0.012 } = {}) {
  let r = seed * 9301 + 49297; const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280 - 0.5; };
  const rings = levels.map(([y, w, d], i) => {
    const off = (i % 2) * 0.18, row = [];
    for (let j = 0; j < segs; j++) {
      const th = 2 * Math.PI * (j + off) / segs, f = 1 + rnd() * jitter;
      row.push(V(Math.sin(th) * w / 2 * f, y, cz + Math.cos(th) * d / 2 * f));
    }
    return row;
  });
  const pos = [];
  const tri = (a, b, c, out) => {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (n.dot(out) < 0) [b, c] = [c, b];
    for (const p of [a, b, c]) pos.push(p.x, p.y, p.z);
  };
  const radial = (...p) => { const m = p.reduce((s, q) => s.add(q), new THREE.Vector3()).divideScalar(p.length); return new THREE.Vector3(m.x, 0, m.z - cz * K); };
  for (let i = 0; i + 1 < rings.length; i++) {
    const A = rings[i], B = rings[i + 1], n = segs;
    for (let j = 0; j < n; j++) {
      // B[j] sits half a step after A[j] when ring i is unshifted, before it when shifted
      if (i % 2 === 0) { tri(A[j], A[(j + 1) % n], B[j], radial(A[j], A[(j + 1) % n], B[j])); tri(B[j], B[(j + 1) % n], A[(j + 1) % n], radial(B[j], B[(j + 1) % n], A[(j + 1) % n])); }
      else { tri(A[j], A[(j + 1) % n], B[(j + 1) % n], radial(A[j], A[(j + 1) % n], B[(j + 1) % n])); tri(B[j], B[(j + 1) % n], A[j], radial(B[j], B[(j + 1) % n], A[j])); }
    }
  }
  const capTop = V(0, top, cz), capBot = V(0, bottom, cz), T = rings[rings.length - 1], Bt = rings[0];
  for (let j = 0; j < segs; j++) {
    tri(capTop, T[j], T[(j + 1) % segs], new THREE.Vector3(0, 1, 0));
    tri(capBot, Bt[j], Bt[(j + 1) % segs], new THREE.Vector3(0, -1, 0));
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return g;
}

// mesh through rings that stand across the z axis (back to front); used for beak, wings and tail
function loft(rings) {
  const pos = [];
  const tri = (a, b, c, out) => {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (n.dot(out) < 0) [b, c] = [c, b];
    for (const p of [a, b, c]) pos.push(p.x, p.y, p.z);
  };
  const R = rings.map((r) => r.map(([x, y, z]) => V(x, y, z)));
  const mid = R.map((r) => r.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(r.length));
  for (let i = 0; i + 1 < R.length; i++) {
    for (let k = 0; k < R[i].length; k++) {
      const k2 = (k + 1) % R[i].length, a = R[i][k], b = R[i][k2], d = R[i + 1][k], e = R[i + 1][k2];
      const q = a.clone().add(b).add(d).add(e).multiplyScalar(0.25);
      const c = mid[i].clone().lerp(mid[i + 1], 0.5); const out = q.sub(c); out.z = 0;
      tri(a, b, e, out); tri(a, e, d, out);
    }
  }
  for (const [i, dz] of [[0, -1], [R.length - 1, 1]])
    for (let k = 0; k < R[i].length; k++) tri(mid[i], R[i][k], R[i][(k + 1) % R[i].length], new THREE.Vector3(0, 0, dz));
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return g;
}
const ellipse = (n, cx, cy, rx, ry, z, rot = 0) => Array.from({ length: n }, (_, j) => {
  const a = 2 * Math.PI * (j + rot) / n; return [cx + Math.sin(a) * rx, cy + Math.cos(a) * ry, z];
});

export function buildDuck(opts = {}) {
  const C = { ...DUCK_COLORS, ...(opts.colors || {}) };
  const mat = (color, rough) => new THREE.MeshStandardMaterial({
    color, roughness: rough, metalness: 0, flatShading: true, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
  const yellow = mat(C.body, 0.35), orange = mat(C.beak, 0.4), orangeDark = mat(C.beakUnder, 0.45);
  const duck = new THREE.Group(); duck.name = "duck";
  const add = (geo, m, name, pos = [0, 0, 0], rot) => {
    const mesh = new THREE.Mesh(geo, m); mesh.name = name; mesh.position.set(...pos); if (rot) mesh.rotation.set(...rot);
    mesh.castShadow = mesh.receiveShadow = true; duck.add(mesh); return mesh;
  };

  // body: the 11 proposed rings, flat-ish underneath, the chest a little ahead of the head
  const body = add(ringMesh(BODY, 16, { top: 0.98, bottom: 0, cz: BODY_FWD, seed: 2 }), yellow, "body");
  // head: the 11 measured rings, widest 40% up and narrowing to a small crown; it sinks 0.06 into the body
  const head = add(ringMesh([[0.8, 0.82, 0.72], ...HEAD], 14, { top: HEAD_TOP, bottom: 0.78, seed: 3 }), yellow, "head");
  duck.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const hit = (obj, x, y) => { ray.set(V(x, y, 5), new THREE.Vector3(0, 0, -1)); return ray.intersectObject(obj)[0]; };

  // tail: grows out of the upper back and turns up, 0.30 tall, reaching 0.24 past the body
  const back = BODY_FWD - 1.37 / 2;
  const tail = add(loft(Array.from({ length: 6 }, (_, i) => {
    const s = i / 5, z = back + 0.2 - (0.2 + TAIL.back) * s;   // short and thick, turning up at the end
    return ellipse(10, 0, 0.6 + 0.22 * Math.pow(s, 1.4), 0.5 * (1 - s) + 0.1, 0.2 * (1 - 0.55 * s) + 0.03, z);
  })), yellow, "tail");

  // wings: flat leaf-like wedges, 0.40 thick (0.22 inside the body, 0.18 out), 0.75 long, 0.53 tall,
  // pointed at both ends with the back end lifting; the bottom leans out 15 degrees
  const wingGeo = loft(Array.from({ length: 9 }, (_, i) => {
    const s = i / 8, z = 0.375 - 0.75 * s;                 // front to back along the wing
    const hgt = WING.h * (0.3 + 0.7 * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.85)), 0.6));   // half-moon, blunt ends
    const thick = WING.x * (0.45 + 0.55 * Math.sin(Math.PI * (0.1 + 0.8 * s))) * 0.5;
    return ellipse(8, 0, 0.07 * s * s, thick, hgt / 2, z);
  }));
  // the 15 degree lean pushes the outer edge 0.06 further out, so the centre moves in by that much
  const wx = 1.3 / 2 + WING.out - WING.x / 2 - 0.06, tilt = THREE.MathUtils.degToRad(WING.tilt);
  const wingL = add(wingGeo, yellow, "wing_L", [wx * K, WING.z * K, (BODY_FWD - 0.08) * K], [0, 0, tilt]);
  const wingR = add(wingGeo, yellow, "wing_R", [-wx * K, WING.z * K, (BODY_FWD - 0.08) * K], [0, 0, -tilt]);

  // beak: ridge top level with the eye centres (1.357), lowest point 0.971; 0.66 wide, 0.48 at the face,
  // 0.34 out. Upper lip with a raised centre ridge and a roof sloping to the sides, curved mouth split, lower lip.
  const total = BEAK.top - BEAK.bottom, up = total * 0.18 / 0.31, gap = total * 0.02 / 0.31, low = total - up - gap;
  const mouth = BEAK.top - up, face = hit(head, 0, mouth)?.point.z / K ?? 0.5;
  const c = 0.05;                                             // mouth corners this much higher than the centre
  const UP = [[-0.08, 0.23, 1, 0.38], [0, 0.24, 1, 0.38], [0.08, 0.3, 0.95, 0.36], [0.17, 0.33, 0.83, 0.33],
              [0.26, 0.32, 0.67, 0.28], [0.315, 0.29, 0.56, 0.25], [0.34, 0.21, 0.45, 0.22]];   // z, half-width, top, side wall (x up)
  const beakTop = add(loft(UP.map(([z, w, t, e]) => {
    t *= up; e *= up; const r = t - 0.04;
    return [[w, e + c, z], [w * 0.75, e + c * 0.8 + (r - e) * 0.2, z], [w * 0.4, e + c * 0.4 + (r - e) * 0.75, z], [0, t, z],
      [-w * 0.4, e + c * 0.4 + (r - e) * 0.75, z], [-w * 0.75, e + c * 0.8 + (r - e) * 0.2, z], [-w, e + c, z],
      [-w, c, z], [-w * 0.5, c * 0.3, z], [0, 0, z], [w * 0.5, c * 0.3, z], [w, c, z]].map(([x, y, zz]) => [x, y, zz]);
  })), orange, "beak_upper", [0, mouth * K, face * K]);
  const LO = [[-0.08, 0.2, 0.85], [0, 0.21, 1], [0.08, 0.24, 1], [0.16, 0.25, 0.92], [0.23, 0.23, 0.77], [0.28, 0.19, 0.54], [0.3, 0.13, 0.3]];
  const beakBot = add(loft(LO.map(([z, w, b]) => { b *= -(low + gap);
    return [[w, c * 0.9 - gap, z], [w * 0.5, c * 0.3 - gap, z], [0, -gap, z], [-w * 0.5, c * 0.3 - gap, z], [-w, c * 0.9 - gap, z],
      [-w * 0.9, b * 0.4, z], [-w * 0.5, b * 0.9, z], [0, b, z], [w * 0.5, b * 0.9, z], [w * 0.9, b * 0.4, z]]; })),
    orangeDark, "beak_lower", [0, mouth * K, face * K]);       // pivots on the mouth line, so it can open to quack
  beakBot.userData.restX = 0;

  // eyes: 0.16 wide, 0.21 tall, 0.07 thick, centres at x = 0.33 and 1.362 up (the reference's own landmarks)
  const eyeGeo = new THREE.SphereGeometry(1, 10, 7);
  const eyeMat = new THREE.MeshStandardMaterial({ color: C.eye, roughness: 0.15 });
  const glintMat = new THREE.MeshBasicMaterial({ color: C.glint });
  for (const s of [1, -1]) {
    const h = hit(head, s * EYE.x, EYE.z);
    const p = h ? h.point : V(s * EYE.x, EYE.z, 0.5);
    const n = h ? h.face.normal.clone().transformDirection(head.matrixWorld) : new THREE.Vector3(0, 0, 1);
    n.y *= 0.3; n.normalize();                                 // face the eye forward, not up into the sky on a sloped facet
    const e = new THREE.Mesh(eyeGeo, eyeMat); e.name = s > 0 ? "eye_L" : "eye_R";
    e.position.copy(p).addScaledVector(n, -0.005 * K);
    e.scale.set(EYE.w / 2 * K, EYE.h / 2 * K, EYE.t / 2 * K); e.lookAt(e.position.clone().add(n)); duck.add(e);
    const gl = new THREE.Mesh(eyeGeo, glintMat); gl.name = "glint";   // 0.06 white highlight, upper left
    gl.position.set(-0.3, 0.3, 0.8); gl.scale.set(0.38, 0.29, 0.3); e.add(gl);
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
  duck.userData.seamMaterial = lineMat;
  return duck;
}

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
