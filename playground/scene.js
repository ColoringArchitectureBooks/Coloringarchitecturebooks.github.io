// Playground massing model, layout v3: every zone comes from the plan Ahmed agreed zone by zone (layout.json, plan metres).
// Plan coords in metres: (0, 0) = centre of the round playground, x east (right on the aerial), y north (toward the car park), z up.
// Three.js is y-up, so a plan point (x, y, z) maps to (x, z, -y).
// Coloring-book look: every face white, black outlines on every edge, and a line along every seam where two masses meet.
import * as THREE from "three";

export const V = (x, y, z) => new THREE.Vector3(x, z, -y);
const R = 36;                 // outer edge of the playground's concrete walks
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
  const dots = (n, r, seed, dash) => canvasTex(512, 512, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = g.strokeStyle = "#000"; g.lineWidth = 2;
    let k = seed; const rnd = () => (k = (k * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) { const x = rnd() * w, y = rnd() * h; if (dash) { const a = rnd() * 6.3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * dash, y + Math.sin(a) * dash); g.stroke(); } else { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } } });
  const sand = dots(700, 1.4, 11); sand.repeat.set(0.25, 0.25); M.sand = L({ map: sand });           // sand: fine dots
  const mulch = dots(500, 0, 5, 9); mulch.repeat.set(0.25, 0.25); M.mulch = L({ map: mulch });       // mulch: little chips
  const turf = canvasTex(512, 512, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.strokeStyle = "#000"; g.lineWidth = 1.5;
    let k = 9; const rnd = () => (k = (k * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 600; i++) { const x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1, y - 7); g.stroke(); } });
  turf.repeat.set(0.25, 0.25); M.turf = L({ map: turf });                                              // turf on the slide hill: short blades
  const pavers = canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.strokeStyle = "#000"; g.lineWidth = 2;
    for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y <= h; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } });
  pavers.repeat.set(0.25, 0.25); M.pavers = L({ map: pavers });
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
const NOSAILS = typeof location !== "undefined" && location.search.includes("nosails");   // ?nosails: hide the sails to see the ground plan
function sail(c, sag = 0.35) {
  if (NOSAILS) return;
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
function sailPosts(c, extra = 0.4) { if (NOSAILS) return; for (const [x, y, z] of c) cyl(x, y, 0.16, 0, z + extra, M.w, 16); }
function bench(x, y, a) {   // park bench: seat, back, two legs
  rbox(x, y, a, 1.8, 0.45, 0.42, 0.48);
  const [dx, dy] = [Math.sin(a * deg) * 0.22, Math.cos(a * deg) * 0.22];
  rbox(x - dx, y - dy, a, 1.8, 0.06, 0.55, 0.9);
  for (const s of [-0.75, 0.75]) rbox(x + Math.cos(a * deg) * s, y - Math.sin(a * deg) * s, a, 0.08, 0.5, 0, 0.42);
}
function lamp(x, y) { cyl(x, y, 0.09, 0, 7, M.w, 12); rbox(x, y, 0, 1.4, 0.25, 6.9, 7.1); }

function ropeCone(x, y) {   // photo: blue rim disc, centre mast, rope net to the top, a blue ring half way up
  const z0 = 0.16, r = 2.4, top = 5.2;
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
  cyl(x, y, 0.12, 0.16, 0.6, M.w, 16);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.w); b.position.copy(V(x, y, 1.1)); add(b, { hull: true });
  for (const a of [40, -40]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.04, 8, 40), M.w); t.position.copy(V(x, y, 1.15)); t.rotation.set(0, a * deg, 0); t.rotateX(0.35); add(t, { hull: true, hw: 0.01 }); }
}

function swing(x, y, a) {   // A-frame swing along the ring: legs at both ends, top beam, two seats on chains
  const t = [Math.cos((a + 90) * deg), Math.sin((a + 90) * deg)], n = [Math.cos(a * deg), Math.sin(a * deg)], L = 2.6, H = 2.8;
  const leg = (s, w) => { const b = V(x + t[0] * L * s + n[0] * w, y + t[1] * L * s + n[1] * w, 0.16), top = V(x + t[0] * L * s, y + t[1] * L * s, H);
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

function rail(pts, h = 1.0) {
  const L = [];
  for (let i = 0; i < pts.length - 1; i++) { const [ax, ay, az = 0] = pts[i], [bx, by, bz = 0] = pts[i + 1], n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay)));
    for (let k = 0; k <= n; k++) { const t = k / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = az + (bz - az) * t; if (k < n || i === pts.length - 2) L.push(V(x, y, z), V(x, y, z + h)); }
    for (const f of [0.5, 1]) L.push(V(ax, ay, az + h * f), V(bx, by, bz + h * f)); }
  lines(L);
}

function ribbon(pts, w, z0, z1, mat) {   // a walk or trail of width w along a list of plan points
  const l = [], r = [];
  pts.forEach(([x, y], i) => { const [nx, ny] = pts[Math.min(i + 1, pts.length - 1)], [px, py] = pts[Math.max(i - 1, 0)], dx = nx - px, dy = ny - py, d = Math.hypot(dx, dy);
    l.push([x - dy / d * w / 2, y + dx / d * w / 2]); r.push([x + dy / d * w / 2, y - dx / d * w / 2]); });
  return prism(poly([...l, ...r.reverse()]), z0, z1, mat, true);
}

// ---------- the plan (layout v3): every outline below is Ahmed's agreed 2D layout, exported from the zone scripts ----------
const J = await (await fetch("./layout.json?v=16")).json();
const TOP = 3.0;   // the high level: car park / park entrance; the playground floor is 0
const shp = (p) => { const s = poly(p.o); for (const h of p.h || []) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y)))); return s; };
const each = (list, f) => list.forEach((p) => f(shp(p), p));
function garden(shape, h = 0.14) { return prism(shape, 0, h, M.plant, true); }   // planting at walk level (Ahmed's photo)
function line3(pts, z = 0.13, closed = false) {   // a drawn line on the ground
  const q = closed ? [...pts, pts[0]] : pts; lines(q.slice(1).flatMap((p, i) => [V(q[i][0], q[i][1], q[i][2] ?? z), V(p[0], p[1], p[2] ?? z)]));
}
const inEdge = (() => { const e = J.edge; return (x, y) => { let c = false; for (let i = 0, j = e.length - 1; i < e.length; j = i++) {
  const [xi, yi] = e[i], [xj, yj] = e[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }; })();
const inPoly = (o, x, y) => { let c = false; for (let i = 0, j = o.length - 1; i < o.length; j = i++) { const [xi, yi] = o[i], [xj, yj] = o[j];
  if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };

function ground() {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(240, 170), M.lawn); g.rotation.x = -Math.PI / 2; g.position.copy(V(0, -5, -0.02));
  g.geometry.attributes.uv.array.forEach((v, i, a) => { a[i] = v * (i % 2 ? 170 : 240); }); add(g, { noEdge: true });
  prism(poly(J.edge), 0, 0.12, M.w, true);                 // the agreed outer edge: one concrete floor, the zones sit on it
  line3(J.walk, 0.125, true);                              // the 2.5 m walk all round, inside the edge
  each(J.plateau, (s) => prism(s, 0, TOP, M.lawn));         // high ground north of the playground (car park / entrance level)
  for (const f of J.edgefence) rail(f.p.map(([x, y]) => [x, y, f.z]));   // the same railing all round the outer edge (Ahmed)
}

function zones() {
  each(J.sand, (s) => prism(s, 0, 0.16, M.sand, true));                    // swings: sand
  each(J.spin, (s) => prism(s, 0, 0.16, M.w, true));                       // spinning zone: rubber
  each(J.grey, (s) => prism(s, 0, 0.16, M.w, true));                       // shade circle: rubber
  each(J.moval, (s) => prism(s, 0, 0.16, M.w, true));                      // music oval: one floor (photo)
  each(J.wlower, (s) => prism(s, 0, 0.15, M.w, true));                     // west leaf, lower part (use still open)
  each(J.gardens, (s) => garden(s));                                       // all the agreed gardens
  each(J.curb_play, (s) => prism(s, 0, 0.57, M.w, true));                 // thick seat-height curb round each play area
  each(J.curb_garden, (s) => prism(s, 0, 0.27, M.w, true));              // thin low curb round each planted bed
  each(J.sail, (s) => garden(s));                                          // old sail garden (still to agree)
  each(J.planter, (s) => garden(s));                                  // the curved planter under the top-left bridges
  // spinning zone equipment round its centre
  const [cx, cy] = [4.1, -3.9]; ropeCone(cx - 2, cy + 3); bowlSpinner(cx + 4, cy - 2); bowlSpinner(cx + 1, cy - 6);
  cyl(cx - 3, cy - 4, 2.0, 0.16, 0.28); cyl(cx - 3, cy - 4, 0.12, 0.28, 1.0, M.w, 16);
  // swings on the sand
  for (const [x, y] of [[-14, -24.5], [-4, -27.5], [7, -27], [17, -21.5]]) swing(x, y, Math.atan2(y, x) / deg);
  musicArch();
  { const { p, low, high } = J.music_panel, dx = high[0] - low[0], dy = high[1] - low[1], d2 = dx * dx + dy * dy;   // the way in: a gap in the seat wall, and a sign block rising and sloping beside it (music instructions)
    for (const q of p) { const m = prism(shp(q), 0, 1.15, M.w), pa = m.geometry.attributes.position;
      for (let i = 0; i < pa.count; i++) if (pa.getY(i) > 0.6) { const x = pa.getX(i), y = -pa.getZ(i), t = Math.max(0, Math.min(1, ((x - low[0]) * dx + (y - low[1]) * dy) / d2)); pa.setY(i, 0.57 + (1.15 - 0.57) * t); }
      pa.needsUpdate = true; m.geometry.computeVertexNormals(); } }
}

function musicArch() {   // the music arch (photo): a flat band, straight legs down into the two gardens, chimes hanging under its top, a string of beads
  const [[x0, y0], [x1, y1]] = J.music, L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L, nx = -uy, ny = ux;
  const leg = 2.1, rise = 0.8, W = 0.45, T = 0.22, n = 40, P = [];   // lower, like the photo: about 2.1 m legs, top near 2.9 m   // centreline in (s along the line, z)
  for (let i = 0; i <= 8; i++) P.push([0, 0.14 + (leg - 0.14) * i / 8]);
  const R = (rise * rise + (L / 2) ** 2) / (2 * rise), zc = leg + rise - R, a0 = Math.asin((L / 2) / R);
  for (let i = 1; i < n; i++) { const a = -a0 + 2 * a0 * i / n; P.push([L / 2 + R * Math.sin(a), zc + R * Math.cos(a)]); }
  for (let i = 8; i >= 0; i--) P.push([L, 0.14 + (leg - 0.14) * i / 8]);
  const pos = [], idx = [];
  P.forEach(([s, z], i) => { const [ps, pz] = P[Math.max(0, i - 1)], [qs, qz] = P[Math.min(P.length - 1, i + 1)], ds = qs - ps, dz = qz - pz, d = Math.hypot(ds, dz), es = -dz / d * T / 2, ez = ds / d * T / 2;
    for (const [w, k] of [[-W / 2, -1], [W / 2, -1], [W / 2, 1], [-W / 2, 1]]) pos.push(...V(x0 + ux * (s + k * es) + nx * w, y0 + uy * (s + k * es) + ny * w, z + k * ez).toArray()); });
  for (let i = 0; i < P.length - 1; i++) for (let k = 0; k < 4; k++) { const a = i * 4 + k, b = i * 4 + (k + 1) % 4; idx.push(a, b, b + 4, a, b + 4, a + 4); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  add(new THREE.Mesh(g, M.w));
  for (let i = 4; i < n - 3; i += 2) { const [s, z] = P[8 + i]; cyl(x0 + ux * s, y0 + uy * s, 0.07, z - T / 2 - 0.3, z - T / 2, M.w, 10); }   // chimes
  const A = P[8 + 6], B = P[8 + 22], bead = []; for (let i = 0; i <= 10; i++) { const t = i / 10, sb = A[0] + (B[0] - A[0]) * t, z = A[1] + (B[1] - A[1]) * t - 0.2 - 1.0 * Math.sin(Math.PI * t); bead.push(V(x0 + ux * sb + nx * 0.3, y0 + uy * sb + ny * 0.3, z)); }   // beads hang in a swag under the band
  for (const b of bead) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), M.w); m.position.copy(b); add(m, { hull: true }); }
  lines(bead.slice(1).flatMap((b, i) => [bead[i], b]));
}

// slide bank: crest = Ahmed's top line at the high level, sloping down to the slides' feet, then flat turf
function slideHill() {
  const { v, f } = J.hill, pos = [], uv = [], idx = [];
  for (const [x, y, z] of v) { pos.push(...V(x, y, z + 0.12).toArray()); uv.push(x, y); }
  for (const t of f) idx.push(...t);
  // skirt: every open edge of the surface drops a wall to the floor
  const cnt = new Map(); const key = (a, b) => (a < b ? a + "," + b : b + "," + a);
  for (const t of f) for (let k = 0; k < 3; k++) { const K = key(t[k], t[(k + 1) % 3]); cnt.set(K, (cnt.get(K) || 0) + 1); }
  let n = v.length;
  for (const [K, c] of cnt) { if (c !== 1) continue; const [a, b] = K.split(",").map(Number);
    if (v[a][2] < 0.05 && v[b][2] < 0.05) continue;
    pos.push(...V(v[a][0], v[a][1], 0).toArray(), ...V(v[b][0], v[b][1], 0).toArray()); uv.push(0, 0, 0, 0);
    idx.push(a, b, n + 1, a, n + 1, n); n += 2; }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  add(new THREE.Mesh(g, M.turf));
  // outline of the zone on the surface
  const o = J.tent[0].o, near = (x, y) => { let best = 0, d = 1e9; for (const [vx, vy, vz] of v) { const e = (vx - x) ** 2 + (vy - y) ** 2; if (e < d) { d = e; best = vz; } } return best; };
  line3(o.map(([x, y]) => [x, y, near(x, y) + 0.14]), 0, true);
  each(J.bank, (s) => prism(s, 0, TOP, M.pavers));                         // the high entrance plaza: behind the slides and the first leg of the house bridge (Ahmed)
  for (const r of J.bankrail) rail(r.map(([x, y]) => [x, y, TOP]));       // railing where the plaza drops to the low level
  for (const pr of J.slideprof) slideOn(pr);
}
const SLW = 0.6;   // slide width (Ahmed: about 60 cm)
function slideOn(pr) {   // chute lying on the bank, following its slope from the crest down to the ground (Ahmed)
  const [tx, ty] = pr[0], [bx, by] = pr[pr.length - 1], d = Math.hypot(bx - tx, by - ty), ux = (bx - tx) / d, uy = (by - ty) / d, nx = -uy, ny = ux, w = SLW / 2;
  const pos = [], idx = [], k = 0.18, lip = 0.22;
  const P = (x, y, z) => { pos.push(...V(x, y, z).toArray()); return pos.length / 3 - 1; };
  for (let i = 0; i < pr.length - 1; i++) { const [ax, ay, az] = pr[i], [cx, cy, cz] = pr[i + 1];
    const q = (o, h) => [P(ax + nx * o, ay + ny * o, az + k + h), P(cx + nx * o, cy + ny * o, cz + k + h)];
    const [l0, l1] = q(-w, 0), [r0, r1] = q(w, 0); idx.push(l0, r0, r1, l0, r1, l1);                 // bed
    for (const o of [-w, w]) { const [a, b] = q(o, 0), [c, e] = q(o, lip); idx.push(a, b, e, a, e, c); } }   // side lips
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  add(new THREE.Mesh(g, M.w));
  const L = []; for (const o of [-w, w]) for (let i = 0; i < pr.length - 1; i++) { const [ax, ay, az] = pr[i], [cx, cy, cz] = pr[i + 1];
    L.push(V(ax + nx * o, ay + ny * o, az + k + lip), V(cx + nx * o, cy + ny * o, cz + k + lip), V(ax + nx * o, ay + ny * o, az + k), V(cx + nx * o, cy + ny * o, cz + k)); }
  lines(L);
}
function slide(tx, ty, tz, bx, by) {   // straight chute with raised sides from (tx, ty, tz) down to a flat run-out ending at (bx, by)
  const dx = bx - tx, dy = by - ty, run = Math.hypot(dx, dy), ux = dx / run, uy = dy / run, out = 1.2;
  const ex = bx - ux * out, ey = by - uy * out, z0 = 0.45, L = Math.hypot(run - out, tz + 0.6 - z0);
  const grp = new THREE.Group(); grp.position.copy(V((tx + ex) / 2, (ty + ey) / 2, (tz + 0.6 + z0) / 2)); grp.lookAt(V(ex, ey, z0));
  const bed = new THREE.Mesh(new THREE.BoxGeometry(SLW, 0.08, L), M.w); grp.add(bed);
  for (const s of [-SLW / 2, SLW / 2]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, L), M.w); r.position.set(s, 0.1, 0); grp.add(r); }
  ROOT.add(grp);
  const flat = new THREE.Mesh(new THREE.BoxGeometry(SLW, 0.08, out), M.w); flat.position.copy(V(ex + ux * out / 2, ey + uy * out / 2, z0)); flat.lookAt(V(bx, by, z0)); add(flat);
  const gp = []; for (const s of [-0.45, 0.45]) { const px = tx - uy * s, py = ty + ux * s; gp.push(V(px, py, tz), V(px, py, tz + 1.1)); }
  gp.push(gp[1], gp[3]); lines(gp);   // start gate
}

// raised walk at the high level: deck, posts down to the playground floor, rails on the sides that are over the low level
function deck(p, z = TOP) {
  prism(shp(p), z - 0.25, z, M.deck);
  const o = p.o, [x0, x1] = [Math.min(...o.map((q) => q[0])), Math.max(...o.map((q) => q[0]))], [y0, y1] = [Math.min(...o.map((q) => q[1])), Math.max(...o.map((q) => q[1]))];
  for (let x = x0 + 0.3; x < x1; x += 2.4) for (let y = y0 + 0.3; y < y1; y += 2.4) if (inPoly(o, x, y) && inEdge(x, y)) box(x - 0.1, x + 0.1, y - 0.1, y + 0.1, 0, z - 0.25);
  const L = [];
  for (let i = 0; i < o.length; i++) { const a = o[i], b = o[(i + 1) % o.length]; if (!inEdge((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)) continue;
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.15));
    for (let k = 0; k <= n; k++) { const x = a[0] + (b[0] - a[0]) * k / n, y = a[1] + (b[1] - a[1]) * k / n; L.push(V(x, y, z), V(x, y, z + 1.0)); }
    L.push(V(a[0], a[1], z + 1.0), V(b[0], b[1], z + 1.0)); }
  lines(L);
}

function topLeft() {   // park entrance building and its bridges, all at the high level; the leaf garden below is low
  each(J.high, (s, p) => deck(p));
  each(J.building, (s) => { prism(s, TOP, TOP + 3.2, M.siding); prism(s, TOP + 3.2, TOP + 3.45, M.w); });
  const [[ax, ay], [bx, by]] = J.entrance;
  line3([[ax, ay - 0.02, TOP], [ax, ay - 0.02, TOP + 2.3], [bx, by - 0.02, TOP + 2.3], [bx, by - 0.02, TOP]], 0);   // the way in
}

function eastRamp() {   // the east walk slopes from the high level (by the plaza and the house bridge) down to the playground (Ahmed)
  const R = J.ramp, pos = [], idx = [], uv = [];
  const P = (x, y, z) => { pos.push(...V(x, y, z).toArray()); uv.push(x, y); return pos.length / 3 - 1; };
  for (let i = 0; i < R.length - 1; i++) { const [ax, ay, bx, by, z] = R[i], [cx, cy, dx, dy, z2] = R[i + 1], t = 0.12;
    const a = P(ax, ay, z + t), b = P(bx, by, z + t), c = P(cx, cy, z2 + t), d = P(dx, dy, z2 + t); idx.push(a, b, d, a, d, c);
    for (const [px, py, qx, qy] of [[ax, ay, cx, cy], [bx, by, dx, dy]]) { const e = P(px, py, z + t), f = P(qx, qy, z2 + t), g = P(qx, qy, 0), h = P(px, py, 0); idx.push(e, f, g, e, g, h); } }
  { const [ax, ay, bx, by, z] = R[0]; const a = P(ax, ay, z + 0.12), b = P(bx, by, z + 0.12), c = P(bx, by, 0), d = P(ax, ay, 0); idx.push(a, b, c, a, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  add(new THREE.Mesh(g, M.w));
  rail(R.filter((_, i) => i % 2 === 0 || i === R.length - 1).map(([x, y, , , z]) => [x, y, z + 0.12]));
  rail(R.filter((_, i) => i % 2 === 0 || i === R.length - 1).map(([, , x, y, z]) => [x, y, z + 0.12]));
}

function houseArea() {   // the playhouse: mulch yard, symmetric house, half-round step, log seats, bridge from the high ground into the 2nd floor
  each(J.h_yard, (s) => prism(s, 0, 0.15, M.mulch, true));
  each(J.h_house, (s) => { prism(s, 0, TOP, M.siding); prism(s, TOP - 0.05, TOP + 0.15, M.w); });
  const o = J.h_main[0].o, X = o.map((q) => q[0]), Y = o.map((q) => q[1]), x0 = Math.min(...X), x1 = Math.max(...X), y0 = Math.min(...Y), y1 = Math.max(...Y);
  box(x0, x1, y0, y1, TOP + 0.15, 5.6, M.siding);
  const w = x1 - x0, gs = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.3, 0), new THREE.Vector2(w / 2 + 0.3, 0), new THREE.Vector2(0, 2.2)]);
  const gg = new THREE.ExtrudeGeometry(gs, { depth: y1 - y0 + 0.6, bevelEnabled: false }); gg.translate(0, 0, -(y1 - y0 + 0.6) / 2);
  const gm = new THREE.Mesh(gg, M.shingle); gm.position.copy(V((x0 + x1) / 2, (y0 + y1) / 2, 5.6)); add(gm);
  // door and windows on the south face
  const f = y0 - 0.02, cx = (x0 + x1) / 2, L = [], rect = (xa, xb, za, zb) => L.push(V(xa, f, za), V(xb, f, za), V(xb, f, za), V(xb, f, zb), V(xb, f, zb), V(xa, f, zb), V(xa, f, zb), V(xa, f, za));
  rect(cx - 0.6, cx + 0.6, 0.3, 2.3); rect(cx - 0.9, cx + 0.9, 3.8, 5.0); lines(L);
  each(J.h_step, (s) => prism(s, 0, 0.3, M.deck, true));
  each(J.logs, (s) => prism(s, 0.15, 0.6, M.w, true));
  each(J.h_bridge, (s, p) => deck(p));
  rail(J.fence.map(([x, y]) => [x, y, 0.15]));
  line3(J.offset, 0.14);
}

function details() {
  // lamps and benches come back once their places are agreed
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
    const thr = o.userData.sail ? 60 : o.userData.hull ? 40 : o.userData.curved ? 50 : 20;   // curved walls: no seam lines down their sides (Ahmed)
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
  ground(); zones(); slideHill(); topLeft(); eastRamp(); houseArea(); details();
  outline(ROOT);
  scene.background = new THREE.Color(0xffffff);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xeeeeee, 2.4));
  const sun = new THREE.DirectionalLight(0xffffff, 0.6); sun.position.set(-40, 80, 70); scene.add(sun);
  return ROOT;
}
