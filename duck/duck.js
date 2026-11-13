// Low-poly rubber duck (from Ahmed's reference sheet, duck/reference.jpg).
// buildDuck() returns a THREE.Group about 2.8 units tall, sitting on y = 0 and facing +z.
// Where two masses meet (head/body, wings/body, beak/head, upper/lower beak) a seam line is drawn
// along the exact intersection of the meshes (project rule: intersection lines are always visible).
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

export const DUCK_COLORS = { body: 0xffd21f, beak: 0xff7a1c, eye: 0x111111, glint: 0xffffff, seam: 0x5a3d00 };

// a faceted sphere, optionally reshaped point by point
function blob(wSeg, hSeg, shape) {
  const g = new THREE.SphereGeometry(1, wSeg, hSeg);
  if (shape) {
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); shape(v); p.setXYZ(i, v.x, v.y, v.z); }
  }
  g.computeVertexNormals();
  return g;
}

export function buildDuck(opts = {}) {
  const C = { ...DUCK_COLORS, ...(opts.colors || {}) };
  const mat = (color, rough = 0.38) => new THREE.MeshStandardMaterial({
    color, roughness: rough, metalness: 0, flatShading: true,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,   // lets the seam lines sit on top cleanly
  });
  const yellow = mat(C.body), orange = mat(C.beak, 0.45);
  const duck = new THREE.Group(); duck.name = "duck";
  const add = (geo, m, pos, scale, rot, name) => {
    const mesh = new THREE.Mesh(geo, m); mesh.name = name;
    mesh.position.set(...pos); if (scale) mesh.scale.set(...scale); if (rot) mesh.rotation.set(...rot);
    mesh.castShadow = true; mesh.receiveShadow = true; duck.add(mesh); return mesh;
  };

  // body: a wide round bath-toy body, flat underneath, with the tail swept up at the back
  const body = add(blob(18, 12, (v) => {
    const t = Math.max(0, -v.z);                       // 0 at the middle, 1 at the very back
    v.y += 1.15 * t * t * t * Math.max(0, v.y + 0.3);     // lift the back of the upper half into a tail
    v.z -= 0.12 * t * t;                               // and draw it out a little
    v.y = Math.max(v.y, -0.78);                        // flat base so it sits on the ground
  }), yellow, [0, 0.8, -0.05], [1.0, 0.82, 1.12], null, "body");
  body.position.y = 0.82 * 0.78;                       // base on y = 0

  // head: a big round ball sitting forward on the body
  const head = add(blob(18, 12), yellow, [0, 2.0, 0.32], [0.8, 0.78, 0.8], null, "head");

  // wings: flat round paddles on the sides, tip pointing down and back
  const wingGeo = blob(12, 8);
  const wingL = add(wingGeo, yellow, [0.93, 0.8, -0.05], [0.2, 0.42, 0.6], [-0.28, 0.12, 0.2], "wingL");
  const wingR = add(wingGeo, yellow, [-0.93, 0.8, -0.05], [0.2, 0.42, 0.6], [-0.28, -0.12, -0.2], "wingR");

  // beak: a flat upper bill over a smaller lower bill, so the mouth line shows
  const beakTop = add(blob(12, 6, (v) => { v.z *= v.z > 0 ? 1 : 1; v.x *= 1 - 0.25 * Math.max(0, v.z); }),
    orange, [0, 1.86, 1.02], [0.42, 0.14, 0.44], [-0.12, 0, 0], "beakTop");
  const beakBot = add(blob(10, 6), orange, [0, 1.74, 0.96], [0.32, 0.1, 0.33], [0.1, 0, 0], "beakBot");

  // eyes: shiny black buttons with a white glint
  const eyeGeo = new THREE.SphereGeometry(1, 12, 8);
  const eyeMat = new THREE.MeshStandardMaterial({ color: C.eye, roughness: 0.15 });
  const glintMat = new THREE.MeshBasicMaterial({ color: C.glint });
  for (const s of [1, -1]) {
    const dir = new THREE.Vector3(0.43 * s, 0.24, 0.87).normalize();
    const e = new THREE.Mesh(eyeGeo, eyeMat); e.name = "eye";
    e.position.copy(head.position).add(dir.clone().multiply(head.scale).multiplyScalar(0.985));
    e.scale.set(0.095, 0.12, 0.06); e.lookAt(e.position.clone().add(dir)); duck.add(e);
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
