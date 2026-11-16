// Playground massing model (Ahmed's aerial + photos, layout v1).
// Plan coords in metres: (0, 0) = centre of the round playground, x east (right on the aerial), y north (toward the car park), z up.
// Three.js is y-up, so a plan point (x, y, z) maps to (x, z, -y).
// Coloring-book look: every face white, black outlines on every edge, and a line along every seam where two masses meet.
import * as THREE from "three";

export const V = (x, y, z) => new THREE.Vector3(x, z, -y);
const R = 36;                 // outer edge of the round playground (low wall + green fence)
const deg = Math.PI / 180;
const at = (r, a) => [r * Math.cos(a * deg), r * Math.sin(a * deg)];

// ---------- materials & textures ----------
const M = {};
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
function tufts(n, len, seed) {   // grass tufts in line, for planted beds and the lawn
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.strokeStyle = "#000"; g.lineWidth = 2; g.lineCap = "round";
    let k = seed; const rnd = () => (k = (k * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) { const x = rnd() * w, y = rnd() * h;
      for (const a of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * len, y - Math.cos(a) * len * 1.2); g.stroke(); } }
  });
}
function makeMats() {
  const L = (o) => new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, color: 0xffffff, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...o });
  M.w = L({});
  const plant = tufts(90, 12, 7); plant.repeat.set(0.25, 0.25); M.plant = L({ map: plant });
  const lawn = tufts(25, 8, 3); lawn.repeat.set(0.1, 0.1); M.lawn = L({ map: lawn });
  const deck = canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.strokeStyle = "#000"; g.lineWidth = 2;
    for (let y = 0; y <= h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } });   // boards 0.25 m
  deck.repeat.set(0.5, 0.5); M.deck = L({ map: deck });
  const shingle = canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.strokeStyle = "#000"; g.lineWidth = 2;
    for (let r = 0; r < 8; r++) { const y = r * 32; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
      for (let x = (r % 2) * 24; x < w; x += 48) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); } } });
  shingle.repeat.set(0.5, 0.5); M.shingle = L({ map: shingle });
  const siding = canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.strokeStyle = "#000"; g.lineWidth = 1.5;
    for (let y = 0; y <= h; y += 26) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } });
  siding.repeat.set(0.5, 0.5); M.siding = L({ map: siding });
  M.line = new THREE.LineBasicMaterial({ color: 0x000000 });
}

// ---------- helpers ----------
let ROOT;
const add = (m, o = {}) => { Object.assign(m.userData, o); ROOT.add(m); return m; };
function box(x0, x1, y0, y1, z0, z1, mat = M.w) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, z1 - z0, y1 - y0), mat);
  m.position.copy(V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); return add(m);
}
// a box turned in plan: centre (x, y), length l along angle a (degrees), width d, from z0 to z1
function rbox(x, y, a, l, d, z0, z1, mat = M.w) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(l, z1 - z0, d), mat);
  m.position.copy(V(x, y, (z0 + z1) / 2)); m.rotation.y = a * deg; return add(m);
}
function cyl(x, y, r, z0, z1, mat = M.w, seg = 48, r2 = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, z1 - z0, seg), mat);
  m.position.copy(V(x, y, (z0 + z1) / 2)); return add(m, { hull: true });
}
// flat piece from a plan outline (THREE.Shape in plan x, y), z0..z1
function prism(shape, z0, z1, mat = M.w, curved = false) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false, curveSegments: 64 }); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.position.y = z0; return add(m, { curved });
}
const poly = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
function sector(cx, cy, r0, r1, a0, a1) {   // ring piece between radii r0..r1 and angles a0..a1 (degrees); r0 = 0 gives a pie slice
  const s = new THREE.Shape();
  if (a1 - a0 >= 360) { s.absarc(cx, cy, r1, 0, Math.PI * 2, false); if (r0 > 0) { const h = new THREE.Path(); h.absarc(cx, cy, r0, 0, Math.PI * 2, true); s.holes.push(h); } return s; }
  s.absarc(cx, cy, r1, a0 * deg, a1 * deg, false);
  if (r0 > 0) s.absarc(cx, cy, r0, a1 * deg, a0 * deg, true); else s.lineTo(cx, cy);
  s.closePath(); return s;
}
const disc = (cx, cy, r) => sector(cx, cy, 0, r, 0, 360);
// raised area: surface disc plus a curb ring round it
function pad(shape, z, mat = M.w) { return prism(shape, 0, z, mat, true); }
function lines(pts) { return add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), M.line)); }
function tube(points, r, closed = false) {
  const c = new THREE.CatmullRomCurve3(points, closed);
  const m = new THREE.Mesh(new THREE.TubeGeometry(c, Math.max(24, points.length * 8), r, 10, closed), M.w); return add(m, { hull: true });
}
// shade sail: four corners [x, y, z] in order, a little sag in the middle (a real sail is a saddle pulled tight)
function sail(c, sag = 0.35) {
  const n = 12, pos = [], idx = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const u = i / n, v = j / n, w = [(1 - u) * (1 - v), u * (1 - v), u * v, (1 - u) * v];
    const p = [0, 1, 2].map(k => w[0] * c[0][k] + w[1] * c[1][k] + w[2] * c[2][k] + w[3] * c[3][k]);
    p[2] -= sag * 16 * u * (1 - u) * v * (1 - v);
    // edges pulled in a little (sails are cut with curved edges)
    const e = 0.06 * (Math.sin(Math.PI * u) * (v === 0 ? 1 : v === 1 ? -1 : 0));
    pos.push(...V(p[0], p[1], p[2]).toArray());
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i; idx.push(a, a + 1, a + n + 2, a, a + n + 2, a + n + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return add(new THREE.Mesh(g, M.w), { sail: true });
}
// blue post holding a sail corner: from the ground to a little above the corner
function sailPosts(c, extra = 0.4) { for (const [x, y, z] of c) cyl(x, y, 0.16, 0, z + extra, M.w, 16); }
function bench(x, y, a) {   // park bench: seat, back, two legs
  rbox(x, y, a, 1.8, 0.45, 0.42, 0.48);
  const [dx, dy] = [Math.sin(a * deg) * 0.22, Math.cos(a * deg) * 0.22];
  rbox(x - dx, y - dy, a, 1.8, 0.06, 0.55, 0.9);
  for (const s of [-0.75, 0.75]) rbox(x + Math.cos(a * deg) * s, y - Math.sin(a * deg) * s, a, 0.08, 0.5, 0, 0.42);
}
function lamp(x, y) { cyl(x, y, 0.09, 0, 7, M.w, 12); rbox(x, y, 0, 1.4, 0.25, 6.9, 7.1); }
function planter(x, y, r) { prism(disc(x, y, r), 0, 0.45, M.plant, true); }

// ---------- the parts ----------
function ground() {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(240, 170), M.lawn); g.rotation.x = -Math.PI / 2; g.position.copy(V(0, -5, -0.02));
  g.geometry.attributes.uv.array.forEach((v, i, a) => { a[i] = v * (i % 2 ? 170 : 240); }); add(g, { noEdge: true });
  // the playground floor: one concrete disc
  prism(disc(0, 0, R - 0.3), 0, 0.12, M.w, true);
  // low wall round the edge with the green fence on top; gap for the entrance from the car park (north-west)
  const G0 = 116, G1 = 128;
  prism(sector(0, 0, R - 0.3, R + 0.1, G1, G0 + 360), 0, 0.5, M.w, true);
  const pts = [];
  for (let a = G1; a <= G0 + 360; a += 1.6) {
    const [x, y] = at(R - 0.1, a); pts.push(V(x, y, 0.5), V(x, y, 1.4));
    const [x2, y2] = at(R - 0.1, Math.min(a + 1.6, G0 + 360));
    for (const z of [0.6, 1.3]) pts.push(V(x, y, z), V(x2, y2, z));
  }
  lines(pts);
  for (const a of [G0, G1]) { const [x, y] = at(R - 0.1, a); box(x - 0.3, x + 0.3, y - 0.3, y + 0.3, 0, 1.6); }   // gate pillars
  // entrance walk up to the car park
  const [ax, ay] = at(R, G0), [bx, by] = at(R, G1);
  prism(poly([[bx, by], [ax, ay], [ax + 1, 44], [bx - 1, 44]]), 0, 0.12);
  // car park and street along the north
  prism(poly([[-90, 44], [90, 44], [90, 60], [-90, 60]]), 0, 0.05);
  prism(poly([[-90, 60], [90, 60], [90, 61], [-90, 61]]), 0, 0.18);   // curb
  prism(poly([[-90, 61], [90, 61], [90, 72], [-90, 72]]), 0, 0.03);   // street
  const st = [];
  for (let x = -88; x <= 88; x += 2.7) { if (x > -26 && x < -14) continue; st.push(V(x, 44.2, 0.06), V(x, 49.5, 0.06), V(x, 54.5, 0.06), V(x, 59.8, 0.06)); }
  lines(st);
  prism(poly([[-90, 43.6], [90, 43.6], [90, 44], [-90, 44]]), 0, 0.18);   // curb at the edge of the park
}

function spinZone() {   // the round spinning zone in the middle (rope cone, bowl spinners, disc spinners, merry-go-round)
  const [cx, cy] = [4, 2];
  pad(disc(cx, cy, 10), 0.22);
  prism(sector(cx, cy, 10, 10.4, 0, 360), 0, 0.4, M.w, true);   // curb
  ropeCone(cx - 3, cy + 2);
  bowlSpinner(cx + 4, cy - 3); bowlSpinner(cx + 1, cy - 6);
  for (const [x, y] of [[cx + 5, cy + 3], [cx + 6.5, cy + 0.5], [cx - 6, cy - 3]]) { cyl(x, y, 0.12, 0.22, 0.75, M.w, 16); cyl(x, y, 0.7, 0.75, 0.82); }   // disc spinners
  cyl(cx - 2, cy - 4.5, 2.0, 0.22, 0.34); cyl(cx - 2, cy - 4.5, 0.12, 0.34, 1.0, M.w, 16);   // flush merry-go-round with centre post
  bench(cx + 9.3, cy + 6.6, -55);
}
function ropeCone(x, y) {   // photo: blue rim disc, centre mast, rope net to the top, a blue ring half way up
  const z0 = 0.22, r = 2.4, top = 5.2;
  cyl(x, y, r, z0 + 0.25, z0 + 0.45); cyl(x, y, 0.4, z0, z0 + 0.25, M.w, 24);
  cyl(x, y, 0.13, z0 + 0.45, top, M.w, 16); const cap = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.w); cap.position.copy(V(x, y, top)); add(cap, { hull: true });
  const zr = z0 + 0.45 + (top - z0 - 0.45) * 0.4, rr = r * 0.6;   // the middle ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.06, 8, 48), M.w); ring.rotation.x = Math.PI / 2; ring.position.copy(V(x, y, zr)); add(ring, { hull: true, hw: 0.012 });
  const p = [], n = 18;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; p.push(V(x + Math.cos(a) * r * 0.97, y + Math.sin(a) * r * 0.97, z0 + 0.45), V(x + Math.cos(a) * 0.15, y + Math.sin(a) * 0.15, top)); }
  for (let k = 1; k < 7; k++) { const t = k / 7, z = z0 + 0.45 + t * (top - z0 - 0.45), rk = r * 0.97 * (1 - t) + 0.15 * t;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2; p.push(V(x + Math.cos(a) * rk, y + Math.sin(a) * rk, z), V(x + Math.cos(b) * rk, y + Math.sin(b) * rk, z)); } }
  lines(p);
}
function bowlSpinner(x, y) {   // photo: blue bowl seat on a post, two steel hoops crossing over it
  cyl(x, y, 0.12, 0.22, 0.6, M.w, 16);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.w); b.position.copy(V(x, y, 1.1)); add(b, { hull: true });
  for (const a of [40, -40]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.04, 8, 40), M.w); t.position.copy(V(x, y, 1.15)); t.rotation.set(0, a * deg, 0); t.rotateX(0.35); add(t, { hull: true, hw: 0.01 }); }
}

function musicArea() {   // blue rubber floor between two round planters, the big blue arch with chimes over it, a seat wall behind
  const [cx, cy] = [-17, 6];
  pad(disc(cx, cy, 4.8), 0.18);
  planter(-23.8, 11.8, 3.4); planter(-10.2, 11.8, 3.4);
  prism(sector(cx, cy, 4.8, 5.3, 200, 340), 0, 0.6, M.w, true);   // curved seat wall on the south side (video)
  const pts = []; for (let i = 0; i <= 24; i++) { const a = Math.PI * i / 24; pts.push(V(cx - Math.cos(a) * 5.4, cy + 1.5, Math.sin(a) * 4.4)); }
  tube(pts, 0.22);
  const ch = [];   // chimes hanging under the arch
  for (let i = 3; i <= 21; i++) { const a = Math.PI * i / 24, x = cx - Math.cos(a) * 5.4, z = Math.sin(a) * 4.4 - 0.25; cyl(x, cy + 1.5, 0.08, z - 0.3, z, M.w, 10); }
  const beads = []; for (let i = 0; i <= 8; i++) { const t = i / 8, x = cx - 5.2 + t * 4.2, z = 2.2 + 1.4 * Math.sin(t * Math.PI) - 0.9 * t; beads.push(new THREE.Vector3(x, z, -(cy + 1.5))); }
  for (const b of beads) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 20), M.w); s.position.copy(b); s.rotation.x = Math.PI / 2; add(s, { hull: true }); }
  lines(beads.slice(1).flatMap((b, i) => [beads[i], b]));
}

function shadeCircle() {   // south-west: round rubber area with curved planters, one big sail over it
  const [cx, cy] = [-20, -9];
  pad(disc(cx, cy, 9), 0.18);
  prism(sector(cx, cy, 9, 9.4, 0, 360), 0, 0.4, M.w, true);
  prism(sector(cx, cy, 5.5, 7, 150, 250), 0, 0.5, M.plant, true);
  prism(sector(cx, cy, 2.5, 3.6, -20, 80), 0, 0.5, M.plant, true);
  const c = [[-29, -4, 6.8], [-12, -1.5, 4.6], [-11.5, -17, 6.8], [-27.5, -17.5, 4.6]];
  sailPosts(c); sail(c, 0.3);
  bench(-14, -3.4, 30);
}

function swingArea() {   // south: the ring of swings under four sails
  prism(sector(0, 0, 21, 33, -125, -35), 0, 0.18, M.w, true);
  prism(sector(0, 0, 20.6, 21, -125, -35), 0, 0.4, M.w, true);   // curb on the inner side
  for (let k = 0; k < 4; k++) {
    const a0 = -125 + k * 22.5, a1 = a0 + 22.5, am = (a0 + a1) / 2;
    const c = [[...at(22, a0 + 1), 4.6], [...at(32.3, a0 + 1), 6.8], [...at(32.3, a1 - 1), 4.6], [...at(22, a1 - 1), 6.8]];
    sailPosts(c); sail(c, 0.25);
    swing(...at(27, am), am);
  }
}
function swing(x, y, a) {   // A-frame swing along the ring: legs at both ends, top beam, two seats on chains
  const t = [Math.cos((a + 90) * deg), Math.sin((a + 90) * deg)], n = [Math.cos(a * deg), Math.sin(a * deg)], L = 2.6, H = 2.8;
  const leg = (s, w) => { const b = V(x + t[0] * L * s + n[0] * w, y + t[1] * L * s + n[1] * w, 0.18), top = V(x + t[0] * L * s, y + t[1] * L * s, H);
    const d = top.clone().sub(b), m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, d.length(), 12), M.w);
    m.position.copy(b.clone().add(top).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); add(m, { hull: true }); };
  for (const s of [-1, 1]) for (const w of [-1.1, 1.1]) leg(s, w);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, L * 2 + 0.3, 12), M.w); beam.position.copy(V(x, y, H)); beam.rotation.set(0, 0, 0);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), V(t[0], t[1], 0).normalize()); add(beam, { hull: true });
  const ch = [];
  for (const s of [-1.1, 1.1]) { const sx = x + t[0] * s, sy = y + t[1] * s;
    rbox(sx, sy, -a, 0.45, 0.6, 0.6, 0.66);
    for (const e of [-0.2, 0.2]) ch.push(V(sx + t[0] * e, sy + t[1] * e, 0.66), V(sx + t[0] * e, sy + t[1] * e, H)); }
  lines(ch);
}

const HILL = { x0: 3, x1: 17, yFoot: 14, yTop: 23, y1: 29, h: 3.4 };
const hillZ = (y) => Math.max(0, Math.min(HILL.h, (y - HILL.yFoot) / (HILL.yTop - HILL.yFoot) * HILL.h));
function slideHill() {   // north-east: turf hill with metal slides down its south face, a shade sail over it
  const { x0, x1, yFoot, yTop, y1, h } = HILL;
  // side profile (y, z) extruded along x
  const s = new THREE.Shape([new THREE.Vector2(yFoot, 0), new THREE.Vector2(yTop, h), new THREE.Vector2(y1, h), new THREE.Vector2(y1, 0)]);
  const g = new THREE.ExtrudeGeometry(s, { depth: x1 - x0, bevelEnabled: false });
  const p = g.attributes.position;   // shape (u = plan y, v = z), extruded along w = plan x from x0
  for (let i = 0; i < p.count; i++) { const u = p.getX(i), v = p.getY(i), w = p.getZ(i); p.setXYZ(i, x0 + w, v, -u); }
  g.computeVertexNormals(); add(new THREE.Mesh(g, M.w));
  // slides: chute with raised sides from the top down to a flat run-out
  for (const x of [5.5, 9.5, 13.5]) {
    const L = Math.hypot(yTop - yFoot, h), ang = Math.atan2(h, yTop - yFoot);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, L), M.w);
    m.position.copy(V(x, (yFoot + yTop) / 2, h / 2 + 0.2)); m.rotation.x = ang; add(m);
    for (const s of [-0.45, 0.45]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, L), M.w); r.position.copy(V(x + s, (yFoot + yTop) / 2, h / 2 + 0.35)); r.rotation.x = ang; add(r); }
    box(x - 0.45, x + 0.45, yFoot - 2.2, yFoot - 0.3, 0.45, 0.55); box(x - 0.45, x + 0.45, yFoot - 0.6, yFoot + 0.2, 0.12, 0.6);
    for (const dx of [-0.38, 0.38]) box(x + dx - 0.04, x + dx + 0.04, yFoot - 2.1, yFoot - 2.0, 0, 0.45);
    // green start gate at the top
    const gp = []; for (const dx of [-0.6, 0.6]) gp.push(V(x + dx, yTop + 0.3, h), V(x + dx, yTop + 0.3, h + 1.2)); gp.push(V(x - 0.6, yTop + 0.3, h + 1.1), V(x + 0.6, yTop + 0.3, h + 1.1)); lines(gp);
  }
  // railing along the top edge between the slide gates, and the ramp up the west side
  const rl = [];
  for (const [a, b] of [[x0, 4.9], [6.1, 8.9], [10.1, 12.9], [14.1, x1]]) { rl.push(V(a, yTop + 0.3, h + 1.0), V(b, yTop + 0.3, h + 1.0));
    for (let x = a; x <= b + 0.01; x += 0.5) rl.push(V(x, yTop + 0.3, h), V(x, yTop + 0.3, h + 1.0)); }
  lines(rl);
  // ramp up the west side (green railings in the photos): slope from the plaza to the hill top
  const rp = new THREE.Shape([new THREE.Vector2(12, 0), new THREE.Vector2(26, h), new THREE.Vector2(29, h), new THREE.Vector2(29, 0)]);
  const rg = new THREE.ExtrudeGeometry(rp, { depth: 2, bevelEnabled: false }); const q = rg.attributes.position;
  for (let i = 0; i < q.count; i++) { const u = q.getX(i), v = q.getY(i), w = q.getZ(i); q.setXYZ(i, x0 - 2 + w, v, -u); }
  rg.computeVertexNormals(); add(new THREE.Mesh(rg, M.w));
  const rr = []; for (const x of [x0 - 2, x0]) { rr.push(V(x, 12, 1.0), V(x, 26, h + 1.0)); for (let y = 12; y <= 26; y += 1) rr.push(V(x, y, (y - 12) / 14 * h), V(x, y, (y - 12) / 14 * h + 1.0)); }
  lines(rr);
  const c = [[2, 12.5, 6.8], [18, 12.5, 5.0], [18, 29.5, 8.4], [2, 29.5, 6.6]];
  c[2][2] = 8.4; c[3][2] = 6.6;
  sailPosts(c); sail(c, 0.25);
}

function playhouse() {   // east: two-storey playhouse and stage, log benches on mulch in front (photo)
  const [cx, cy] = [22, 18], W = 8, Dp = 4.5, y0 = cy - Dp / 2, y1 = cy + Dp / 2;
  pad(disc(22, 9.5, 6.2), 0.15);   // mulch
  prism(sector(22, 9.5, 6.2, 6.5, 0, 360), 0, 0.35, M.w, true);
  box(cx - W / 2, cx + W / 2, y0, y1, 0, 0.35);                 // floor
  box(cx - W / 2, cx + W / 2, y0 + 1.2, y1, 0.35, 5.6, M.siding); // body (porch set in under the upper floor)
  box(cx - W / 2, cx + W / 2, y0, y1, 3.0, 3.25);              // upper floor slab
  box(cx - W / 2, cx + W / 2, y0, y0 + 1.2, 3.25, 5.6, M.siding);
  // centre gable (ridge front to back) and side shed roofs
  const gw = 4.6, gs = new THREE.Shape([new THREE.Vector2(-gw / 2 - 0.3, 0), new THREE.Vector2(gw / 2 + 0.3, 0), new THREE.Vector2(0, 2.0)]);
  const gg = new THREE.ExtrudeGeometry(gs, { depth: Dp + 0.6, bevelEnabled: false }); gg.translate(0, 0, -(Dp + 0.6) / 2);
  const gm = new THREE.Mesh(gg, M.shingle); gm.position.copy(V(cx, cy, 5.6)); add(gm);
  for (const s of [-1, 1]) { const x = cx + s * (gw / 2 + (W - gw) / 4); const m = new THREE.Mesh(new THREE.BoxGeometry((W - gw) / 2 + 0.6, 0.15, Dp + 0.6), M.shingle);
    m.position.copy(V(x, cy, 5.55)); m.rotation.z = s * -0.25; add(m); }
  // stage: half round in front of the centre opening
  prism(sector(cx, y0, 0, 2.2, 180, 360), 0, 0.5, M.deck, true);
  // front: opening, windows, awnings, porch rails drawn as lines on the face (photo)
  const f = y0 - 0.02, F = (x, z) => V(cx + x, f, z), L = [];
  const rect = (xa, xb, za, zb, y = f) => L.push(V(cx + xa, y, za), V(cx + xb, y, za), V(cx + xb, y, za), V(cx + xb, y, zb), V(cx + xb, y, zb), V(cx + xa, y, zb), V(cx + xa, y, zb), V(cx + xa, y, za));
  for (const x of [-1.9, -0.55, 0.8]) rect(x, x + 1.1, 3.8, 5.0);
  for (const s of [-1, 1]) rect(s * 3.2 - 0.5, s * 3.2 + 0.5, 3.8, 4.9);
  const fb = y0 + 1.2 - 0.02;
  rect(-1.6, 1.6, 0.35, 2.7, fb); for (const s of [-1, 1]) rect(s * 3 - 0.6, s * 3 + 0.6, 1.0, 2.4, fb);
  for (const s of [-1, 1]) for (let x = 1.9; x <= 3.9; x += 0.25) L.push(V(cx + s * x, f, 0.35), V(cx + s * x, f, 1.3));
  for (const s of [-1, 1]) L.push(V(cx + s * 1.9, f, 1.3), V(cx + s * 3.95, f, 1.3));
  lines(L);
  for (const s of [-1, 1]) box(cx + s * 1.8 - 0.25, cx + s * 1.8 + 0.25, y0, y0 + 0.3, 0.35, 3.0);   // posts either side of the stage
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.7), M.shingle); m.position.copy(V(cx + s * 3.2, y0 - 0.3, 5.15)); m.rotation.x = -0.45; add(m); }
  { const m = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.08, 0.7), M.shingle); m.position.copy(V(cx - 0.2, y0 - 0.3, 5.25)); m.rotation.x = -0.45; add(m); }
  // log benches in an arc
  for (const a of [-130, -100, -70, -40, -10]) { const [x, y] = at(4.6, a); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.8, 16), M.w);
    m.position.copy(V(22 + x, 9.5 + y + 3, 0.6)); m.rotation.set(0, (a + 90) * deg, Math.PI / 2, "YXZ"); add(m, { hull: true });
    for (const s of [-0.6, 0.6]) cyl(22 + x + Math.cos((a + 90) * deg) * s, 9.5 + y + 3 + Math.sin((a + 90) * deg) * s, 0.08, 0.15, 0.4, M.w, 10); }
}

function bridge() {   // the raised wooden bridge from the hill top to the playhouse's upper floor
  const z = HILL.h, t = 0.25;
  const parts = [[HILL.x1, 23.9, 24.6, 26.4], [22.1, 23.9, 20.25, 24.6]];
  for (const [x0, x1, y0, y1] of parts) box(x0, x1, y0, y1, z - t, z, M.deck);
  for (const [x, y] of [[18.5, 24.8], [18.5, 26.2], [21, 24.8], [21, 26.2], [22.3, 22.5], [23.7, 22.5], [23.7, 26.2], [22.3, 20.6], [23.7, 20.6]]) box(x - 0.12, x + 0.12, y - 0.12, y + 0.12, 0, z - t);
  // slatted rails (photo), as lines, with a top rail
  const L = [], rail = (ax, ay, bx, by) => { const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 0.18);
    for (let i = 0; i <= n; i++) { const x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n; L.push(V(x, y, z), V(x, y, z + 1.0)); }
    L.push(V(ax, ay, z + 1.0), V(bx, by, z + 1.0), V(ax, ay, z + 0.15), V(bx, by, z + 0.15)); };
  rail(HILL.x1, 26.4, 23.9, 26.4); rail(23.9, 26.4, 23.9, 20.25); rail(HILL.x1, 24.6, 22.1, 24.6); rail(22.1, 24.6, 22.1, 20.25);
  lines(L);
}

function cocoon(x, y, a) {   // pointed wooden hut, open at the front (photo)
  const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(1.25 * Math.cos(t * Math.PI / 2) ** 0.8, t * 2.7)); }
  const g = new THREE.LatheGeometry(pts, 24, (a + 50) * deg, 260 * deg);
  const m = new THREE.Mesh(g, M.siding); m.position.copy(V(x, y, 0.12)); add(m, { hull: true });
  cyl(x, y, 0.16, 2.7, 3.0, M.w, 8);
}

function outside() {   // things outside the fence: restroom, gazebo with picnic tables, walks, the small and the big sail
  // restroom block west of the playground
  box(-47.5, -40.5, 2.5, 7.5, 0, 3.0); { const m = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.2, 5.8), M.shingle); m.position.copy(V(-44, 5, 3.25)); m.rotation.x = 0.12; add(m); }
  lines([V(-44.5, 2.48, 0), V(-44.5, 2.48, 2.2), V(-44.5, 2.48, 2.2), V(-43.4, 2.48, 2.2), V(-43.4, 2.48, 2.2), V(-43.4, 2.48, 0)]);
  // walk from the playground's west side past the restroom to the gazebo
  const walk = [[-35, 7], [-40, 9.2], [-48, 10.6], [-56, 11.5], [-61, 12]];
  const wl = [], wr = []; walk.forEach(([x, y], i) => { const [nx, ny] = walk[Math.min(i + 1, walk.length - 1)], [px, py] = walk[Math.max(i - 1, 0)];
    const dx = nx - px, dy = ny - py, l = Math.hypot(dx, dy); wl.push([x - dy / l * 1.3, y + dx / l * 1.3]); wr.push([x + dy / l * 1.3, y - dx / l * 1.3]); });
  prism(poly([...wl, ...wr.reverse()]), 0, 0.08);
  // gazebo: octagonal hip roof on eight posts, round pad, picnic tables
  const [gx, gy] = [-68, 13];
  prism(poly([[-62, 4], [-58, 6], [-58, 20], [-74, 22], [-78, 10]]), 0, 0.1);
  for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; cyl(gx + Math.cos(a) * 5.2, gy + Math.sin(a) * 5.2, 0.12, 0.1, 2.8, M.w, 12); }
  const r = new THREE.Mesh(new THREE.ConeGeometry(6.4, 2.6, 8, 1), M.shingle); r.position.copy(V(gx, gy, 2.8 + 1.3)); r.rotation.y = Math.PI / 8; add(r);
  for (const [x, y] of [[-66, 9], [-70, 16], [-61, 8.5], [-60, 15]]) { box(x - 0.9, x + 0.9, y - 0.4, y + 0.4, 0.72, 0.78); for (const s of [-0.75, 0.75]) box(x - 0.9, x + 0.9, y + s - 0.15, y + s + 0.15, 0.42, 0.47);
    for (const s of [-0.7, 0.7]) box(x + s - 0.05, x + s + 0.05, y - 0.9, y + 0.9, 0.1, 0.72); }
  // small white sail over a round seating pad north-west, by the entrance
  prism(disc(-36, 27, 4.2), 0, 0.12); { const c = [[-40, 24, 3.6], [-34.5, 22.5, 2.8], [-32, 29, 3.6], [-37.5, 31, 2.8]]; sailPosts(c); sail(c, 0.12); }
  cocoon(-36, 27.5, 200);
  // big white sail east of the playground, over a picnic pad
  prism(poly([[39, -16], [53, -14], [52, -1], [38, -3]]), 0, 0.12);
  { const c = [[38, -15, 6.5], [53, -14, 4.2], [52, -1.5, 6.5], [38.5, -3, 4.2]]; sailPosts(c); sail(c, 0.25); }
  for (const [x, y] of [[43, -10], [48, -10], [43, -6], [48, -6]]) { box(x - 0.9, x + 0.9, y - 0.4, y + 0.4, 0.72, 0.78); for (const s of [-0.75, 0.75]) box(x - 0.9, x + 0.9, y + s - 0.15, y + s + 0.15, 0.42, 0.47); }
  // walk from the playground's east edge to the picnic pad
  prism(poly([[35.5, -6], [39, -7], [39, -10], [35.3, -9]]), 0, 0.08);
}

function details() {
  planter(-6, -14, 3); planter(14, -8, 2.4); planter(28.5, 0, 2.8); planter(-9.5, 22.5, 2.6); planter(-28, 18, 3);
  cocoon(-3, 27, 250);
  for (const [x, y] of [[-8, 18.5], [-30, 2], [16, -11], [29, 7], [-4, -24], [-22, 26], [10, -30], [-31, -12]]) lamp(x, y);
  bench(-4, -18, 0); bench(15, -13, 20); bench(-28, 5, 80); bench(-7, 12, 0); bench(-2, -14, -10);
}

// ---------- outlines: black edges on every crease, every seam where masses meet, and a silhouette on curved parts ----------
function hullMat(w) {
  const m = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
  m.onBeforeCompile = (s) => { s.vertexShader = s.vertexShader.replace("#include <begin_vertex>", `vec3 transformed = position + normal * ${w.toFixed(3)};`); };
  return m;
}
function outline(root) {
  const add = [], hulls = {};
  root.traverse(o => {
    if (!o.isMesh || o.userData.noEdge) return;
    const thr = o.userData.sail ? 60 : o.userData.hull ? 40 : 20;
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, thr), M.line);
    e.position.copy(o.position); e.rotation.copy(o.rotation); e.quaternion.copy(o.quaternion); e.scale.copy(o.scale); add.push([o.parent, e]);
    if (o.userData.hull || o.userData.sail) { const hw = o.userData.hw || 0.025, h = new THREE.Mesh(o.geometry, hulls[hw] ||= hullMat(hw)); h.position.copy(o.position); h.quaternion.copy(o.quaternion); h.scale.copy(o.scale);
      if (!o.userData.sail) add.push([o.parent, h]); }
  });
  for (const [p, e] of add) p.add(e);
}

export function buildScene(scene) {
  makeMats();
  ROOT = new THREE.Group(); scene.add(ROOT);
  ground(); spinZone(); musicArea(); shadeCircle(); swingArea(); slideHill(); playhouse(); bridge(); outside(); details();
  outline(ROOT);
  scene.background = new THREE.Color(0xffffff);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xeeeeee, 2.4));
  const sun = new THREE.DirectionalLight(0xffffff, 0.6); sun.position.set(-40, 80, 70); scene.add(sun);
  return ROOT;
}
