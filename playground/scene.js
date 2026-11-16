// Playground massing model (Ahmed's aerial + photos + coloring page, layout v2).
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
function planter(x, y, r) { prism(disc(x, y, r), 0, 0.45, M.plant, true); }

// ---------- the parts (layout v2: traced from the ground in the aerial, not the sails) ----------
// The floor is concrete walks; on it sit "islands", each with its own ground: rubber play floors, garden beds,
// sand, turf on the slide hill, mulch at the playhouse. The walks are what is left between them.
const roundRect = (x0, y0, x1, y1, r) => { const s = new THREE.Shape(); s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0);
  s.lineTo(x1, y1 - r); s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2); s.lineTo(x0 + r, y1); s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5); return s; };
const ellipse = (cx, cy, rx, ry) => { const s = new THREE.Shape(); s.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, false, 0); return s; };
function garden(shape, h = 0.45) { return prism(shape, 0, h, M.plant, true); }
// green railing (photos): posts every ~1 m with a top and a middle rail, along a list of plan points at base heights z
function rail(pts, h = 1.0) {
  const L = [];
  for (let i = 0; i < pts.length - 1; i++) { const [ax, ay, az = 0] = pts[i], [bx, by, bz = 0] = pts[i + 1], n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay)));
    for (let k = 0; k <= n; k++) { const t = k / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = az + (bz - az) * t; if (k < n || i === pts.length - 2) L.push(V(x, y, z), V(x, y, z + h)); }
    for (const f of [0.5, 1]) L.push(V(ax, ay, az + h * f), V(bx, by, bz + h * f)); }
  lines(L);
}
const arcPts = (cx, cy, r, a0, a1, z = 0, n = 24) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * deg; return [cx + r * Math.cos(a), cy + r * Math.sin(a), z]; });
// a wedge of ground rising from z 0 at plan y = ya to z = h at y = yb, between x0 and x1 (the bank up to the car park)
function bank(x0, x1, ya, yb, h, mat = M.plant) {
  const s = new THREE.Shape([new THREE.Vector2(ya, 0), new THREE.Vector2(yb, h), new THREE.Vector2(yb, 0)]);
  const g = new THREE.ExtrudeGeometry(s, { depth: x1 - x0, bevelEnabled: false }), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const u = p.getX(i), v = p.getY(i), w = p.getZ(i); p.setXYZ(i, x0 + w, v, -u); }
  g.computeVertexNormals(); return add(new THREE.Mesh(g, mat));
}
// a ramp run along x: from (xa, za) to (xb, zb), between plan y0..y1, solid down to the ground
function rampX(xa, xb, za, zb, y0, y1) {
  const s = new THREE.Shape([new THREE.Vector2(xa, 0), new THREE.Vector2(xb, 0), new THREE.Vector2(xb, zb), new THREE.Vector2(xa, za)]);
  const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false }), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const u = p.getX(i), v = p.getY(i), w = p.getZ(i); p.setXYZ(i, u, v, -(y0 + w)); }
  g.computeVertexNormals(); return add(new THREE.Mesh(g, M.w));
}
const TOP = 3.0;   // the car park sits this much above the playground; a planted bank, stairs and ramps come down

function ground() {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(240, 170), M.lawn); g.rotation.x = -Math.PI / 2; g.position.copy(V(0, -5, -0.02));
  g.geometry.attributes.uv.array.forEach((v, i, a) => { a[i] = v * (i % 2 ? 170 : 240); }); add(g, { noEdge: true });
  prism(disc(0, 0, R), 0, 0.12, M.w, true);                                  // the concrete walks: one floor, the islands sit on it
  garden(sector(0, 0, R, R + 3.5, 140, 232));                                // planting outside the west walk
}

function entrance() {   // north: car park up on the bank, stairs straight down, ramps zig-zag down to the east of them
  box(-90, 90, 41, 60, 0, TOP);                                              // car park
  prism(poly([[-90, 60], [90, 60], [90, 61], [-90, 61]]), TOP, TOP + 0.15);  // curb
  box(-90, 90, 61, 72, 0, TOP - 0.02);                                       // street
  const st = []; for (let x = -88; x <= 88; x += 2.7) { if (x > -25 && x < 5) continue; st.push(V(x, 41.2, TOP + 0.01), V(x, 46.5, TOP + 0.01), V(x, 54.5, TOP + 0.01), V(x, 59.8, TOP + 0.01)); }
  lines(st);
  box(-24, 4, 38, 41, 0, TOP);                                               // entrance landing at the top
  // stairs: 14 steps from y 31 to 38
  for (let i = 0; i < 14; i++) box(-21, -17, 31 + i * 0.5, 38, 0, (i + 1) * TOP / 14);
  rail([[-21, 31, 0.17], [-21, 38, TOP]]); rail([[-17, 31, 0.17], [-17, 38, TOP]]); rail([[-19, 31, 0.17], [-19, 38, TOP]], 0.9);
  bank(-80, -21, 31, 38, TOP); bank(-17, -13, 31, 38, TOP);                  // planted bank either side of the stairs
  bank(-80, -24, 38, 41, TOP); bank(19.5, 80, 35, 41, TOP);   // between x 3.5 and 19.5 the high ground is the top of the slide hill
  // ramps: run A from the landing east, a turn, run B back west down to the walk
  rampX(-13, 1, TOP, 1.2, 36, 38); box(1, 3.5, 32.5, 38, 0, 1.2); rampX(1, -11, 1.2, 0.12, 32.5, 34.5);
  garden(poly([[-13, 34.5], [1, 34.5], [1, 36], [-13, 36]]), 0.6);
  bank(-13, 1, 38, 38.01, TOP);
  rail([[-13, 38, TOP], [1, 38, 1.2], [3.5, 38, 1.2], [3.5, 32.5, 1.2], [1, 32.5, 1.2], [-11, 32.5, 0.12]]);
  rail([[-13, 36, TOP], [1, 36, 1.2], [1, 34.5, 1.2], [-11, 34.5, 0.12]]);
  // half-round planter with a green rail at the foot of the stairs (aerial)
  garden(sector(-19, 25.5, 3, 5, 190, 350), 0.6); rail(arcPts(-19, 25.5, 5, 190, 350, 0.6), 0.9);
  ribbon([[-22.5, 18.6], [-17, 19], [-12.5, 21.5], [-9.8, 25.5]], 2.2, 0, 0.45, M.plant);   // curved garden band below it (Ahmed's mark-up)
}

const SPIN = [4, -1];
function spinZone() {   // the round spinning zone (rubber); its north-east cap is a different floor; a curved garden wraps its south side
  const [cx, cy] = SPIN;
  pad(disc(cx, cy, 10.5), 0.22);
  prism(sector(cx, cy, 10.5, 10.9, 0, 360), 0, 0.4, M.w, true);   // curb
  const cap = new THREE.Shape(); cap.absarc(cx, cy, 10.5, 6 * deg, 107 * deg, false);
  for (const [x, y] of [[3, 6], [6.2, 3.5], [10, 1.8]]) cap.lineTo(x, y); cap.closePath();
  prism(cap, 0, 0.4, M.w, true);
  garden(sector(cx, cy, 10.9, 14.3, 200, 350));
  garden(poly([[-6, 21], [-3, 16], [1, 11], [4, 14], [6, 17.8], [0, 19.3]]));   // garden between the slide hill's foot and the spinning zone
  ribbon([[15, 0.5], [21, 2.6]], 1.2, 0, 0.45, M.plant);                         // narrow garden over to the playhouse fence
  ropeCone(cx - 3, cy + 2);
  bowlSpinner(cx + 4, cy - 3); bowlSpinner(cx + 1, cy - 6);
  for (const [x, y] of [[cx + 5, cy + 1], [cx + 6, cy - 2], [cx - 6, cy - 3]]) { cyl(x, y, 0.12, 0.22, 0.75, M.w, 16); cyl(x, y, 0.7, 0.75, 0.82); }   // disc spinners
  cyl(cx - 2, cy - 4.5, 2.0, 0.22, 0.34); cyl(cx - 2, cy - 4.5, 0.12, 0.34, 1.0, M.w, 16);   // flush merry-go-round
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

function musicArea() {   // oval of blue rubber between two round gardens; the arch's feet stand in the gardens (page)
  const [cx, cy] = [-15.8, 9.5];
  prism(ellipse(cx, cy, 9, 6.6), 0, 0.18, M.w, true);
  garden(disc(-22.5, 10.3, 3.2)); garden(disc(-9.2, 10.3, 3.2));
  const ax0 = -22.2, ax1 = -9.5, am = (ax0 + ax1) / 2, hs = (ax1 - ax0) / 2, ay = 10.5;
  const pts = []; for (let i = 0; i <= 24; i++) { const a = Math.PI * i / 24; pts.push(V(am - Math.cos(a) * hs, ay, 0.45 + Math.sin(a) * 4.4)); }
  tube(pts, 0.24);
  for (const s of [-1, 1]) cyl(am + s * hs, ay, 0.42, 0.45, 1.3, M.w, 24);   // pillar feet in the gardens
  for (let i = 3; i <= 21; i++) { const a = Math.PI * i / 24, x = am - Math.cos(a) * hs, z = 0.45 + Math.sin(a) * 4.4 - 0.27; cyl(x, ay, 0.08, z - 0.3, z, M.w, 10); }
  const beads = []; for (let i = 0; i <= 8; i++) { const t = i / 8, x = am - hs + 0.3 + t * 5, z = 2.6 + 1.5 * Math.sin(t * Math.PI) - 0.9 * t; beads.push(new THREE.Vector3(x, z, -ay)); }
  for (const b of beads) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 20), M.w); m.position.copy(b); m.rotation.x = Math.PI / 2; add(m, { hull: true }); }
  lines(beads.slice(1).flatMap((b, i) => [beads[i], b]));
  // west edge: a lens of different floor along the walk, its top a garden (Ahmed's mark-up)
  const lens = new THREE.Shape(); lens.absarc(0, 0, R - 0.4, 140 * deg, 175 * deg, false);
  for (const [x, y] of [[-31, 8], [-28.5, 14], [-27.5, 19]]) lens.lineTo(x, y); lens.closePath();
  prism(lens, 0, 0.2, M.w, true);
  garden(poly([[-29.5, 23], [-32.5, 18], [-27.3, 16.8]]));
}

function shadeCircle() {   // south-west: round rubber floor in three parts (a raised crescent on the east with a rail, a lower segment at the south), one big sail
  const [cx, cy] = [-23.5, -8.6], r = 10.5;
  pad(disc(cx, cy, r), 0.18);
  prism(sector(cx, cy, r, r + 0.4, 0, 360), 0, 0.4, M.w, true);
  prism(sector(cx, cy, 5.5, 7.8, -70, 40), 0, 0.45, M.w, true); rail(arcPts(cx, cy, 5.5, -70, 40, 0.45), 0.9);
  const seg = new THREE.Shape(); seg.absarc(cx, cy, r, -127 * deg, -53 * deg, false); seg.closePath();
  prism(seg, 0, 0.32, M.w, true);
  const c = [[-33, -1.5, 6.8], [-15, -0.6, 4.6], [-14.5, -17, 6.8], [-31.5, -17.5, 4.6]];
  sailPosts(c); sail(c, 0.3);
}

const SW = [249, 346];   // the swings band: angles round the playground's centre
function swingArea() {   // south: the swings band is sand, all the way out to the paved edge (Ahmed's mark-up), under four sails
  prism(sector(0, 0, 23, 35, SW[0], SW[1]), 0, 0.15, M.sand, true);
  prism(sector(0, 0, 22.6, 23, SW[0], SW[1]), 0, 0.4, M.w, true);                  // curb on the inner side
  prism(sector(0, 0, 35, 36.4, SW[0], SW[1]), 0.12, 0.3, M.pavers, true);         // paved band along the outer edge
  garden(poly([[-23, -22], [-9.5, -21.7], [-12, -33], [-17, -31]]));                // garden triangle at its west end
  const n = 4, step = (SW[1] - SW[0]) / n;
  for (let k = 0; k < n; k++) {
    const a0 = SW[0] + k * step, a1 = a0 + step, am = (a0 + a1) / 2;
    const c = [[...at(23.4, a0 + 1), 4.6], [...at(34, a0 + 1), 6.8], [...at(34, a1 - 1), 4.6], [...at(23.4, a1 - 1), 6.8]];
    sailPosts(c); sail(c, 0.25);
    swing(...at(28.5, am), am);
  }
}

// Slide hill: turf slope from a foot line in the playground up to a crest at the raised north ground (car park level).
// Both lines run west to east; the surface is ruled between them. Slides run down it at their own angles and slopes (Ahmed's mark-up).
const HILL = {
  foot: [[-6.5, 26], [-4, 21], [0, 19.5], [5, 18.5], [8.5, 17], [13, 16], [17.5, 15], [19.5, 14.5]],
  crest: [[3.5, 34], [8, 32.5], [12, 30.5], [16, 29], [19.5, 28]],
  h: TOP,
};
function along(pts, t) {   // point at fraction t of the way along a polyline (by length)
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const d = t * L[L.length - 1]; let i = 1; while (i < L.length - 1 && L[i] < d) i++;
  const f = (d - L[i - 1]) / (L[i] - L[i - 1] || 1); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
}
function slideHill() {
  const { foot, crest, h } = HILL, N = 40, S = 8, pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) { const F = along(foot, i / N), C = along(crest, i / N);
    for (let j = 0; j <= S; j++) { const s = j / S, x = F[0] + (C[0] - F[0]) * s, y = F[1] + (C[1] - F[1]) * s; pos.push(...V(x, y, h * s).toArray()); uv.push(x, y); } }
  for (let i = 0; i < N; i++) for (let j = 0; j < S; j++) { const a = i * (S + 1) + j; idx.push(a, a + S + 1, a + 1, a + 1, a + S + 1, a + S + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  add(new THREE.Mesh(g, M.turf));
  lines(foot.slice(1).flatMap((p, i) => [V(...foot[i], 0.01), V(...p, 0.01)]));   // seam where the hill meets the floor
  lines([V(...foot[0], 0.01), V(...crest[0], h), V(...foot[foot.length - 1], 0.01), V(...crest[crest.length - 1], h)]);
  // the two side faces under the slope's ends, and the raised ground north of the crest up to the car park
  const tri = (pts) => { const t = new THREE.BufferGeometry().setFromPoints(pts.map(([x, y, z]) => V(x, y, z))); t.setIndex([0, 1, 2]); t.computeVertexNormals(); add(new THREE.Mesh(t, M.w)); };
  for (const [F, C] of [[foot[0], crest[0]], [foot[foot.length - 1], crest[crest.length - 1]]]) tri([[...F, 0], [...C, 0], [...C, h]]);
  prism(poly([...crest, [19.5, 41], [3.5, 41]]), 0, h, M.w);
  ribbon(crest.map(([x, y]) => [x, y + 1.2]), 1.6, h, h + 0.4, M.plant);   // planting along the top edge (Ahmed's mark-up)
  // slides: [top on the crest, bottom on the playground], each its own angle and slope
  for (const [[tx, ty], [bx, by]] of [[[6, 33.3], [-0.2, 20.2]], [[13, 30.2], [8.5, 16.4]], [[18.3, 28.5], [17.5, 13.6]]]) slide(tx, ty, h, bx, by);
  rail(crest.map(([x, y]) => [x, y, h]));
}
function slide(tx, ty, tz, bx, by) {   // straight metal chute with raised sides from (tx, ty, tz) down to a flat run-out ending at (bx, by)
  const dx = bx - tx, dy = by - ty, run = Math.hypot(dx, dy), ux = dx / run, uy = dy / run, out = 1.6;
  const ex = bx - ux * out, ey = by - uy * out, z0 = 0.5, L = Math.hypot(run - out, tz + 0.2 - z0);
  const grp = new THREE.Group(); grp.position.copy(V((tx + ex) / 2, (ty + ey) / 2, (tz + 0.2 + z0) / 2)); grp.lookAt(V(ex, ey, z0));   // local +z points down the chute
  const bed = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, L), M.w); grp.add(bed);
  for (const s of [-0.45, 0.45]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, L), M.w); r.position.set(s, 0.12, 0); grp.add(r); }
  ROOT.add(grp);
  const flat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, out), M.w); flat.position.copy(V(ex + ux * out / 2, ey + uy * out / 2, z0)); flat.lookAt(V(bx, by, z0)); add(flat);
  for (const k of [0.3, out - 0.2]) for (const s of [-0.38, 0.38]) { const px = ex + ux * k - uy * s, py = ey + uy * k + ux * s; box(px - 0.04, px + 0.04, py - 0.04, py + 0.04, 0, z0 - 0.05); }
  const gp = []; for (const s of [-0.6, 0.6]) { const px = tx - uy * s, py = ty + ux * s; gp.push(V(px, py, tz), V(px, py, tz + 1.2)); }
  gp.push(gp[1], gp[3]); lines(gp);   // start gate
}

const PH = { cx: 27, cy: 17, W: 8, D: 4.5 };
function playhouse() {   // east: two-storey playhouse and stage on dark mulch with log benches, a garden bed to its east
  const { cx, cy, W, D: Dp } = PH, y0 = cy - Dp / 2, y1 = cy + Dp / 2;
  prism(roundRect(22, -1, 31.4, 14.9, 2.5), 0, 0.15, M.mulch);   // mulch
  garden(poly([[31.8, 21], [34.5, 18], [36.8, 10], [37.6, 0], [37, -6], [33, -4.5], [31.8, 0]]));   // the big garden bed east of it (Ahmed's mark-up)
  rail([[21.6, 20], [21.6, 3], [23, -0.6], [28.8, -2.9], [37, -6.2]]);   // fence round the playhouse yard (Ahmed's mark-up, red)
  box(cx - W / 2, cx + W / 2, y0, y1, 0, 0.35);
  box(cx - W / 2, cx + W / 2, y0 + 1.2, y1, 0.35, 5.6, M.siding);
  box(cx - W / 2, cx + W / 2, y0, y1, 3.0, 3.25);
  box(cx - W / 2, cx + W / 2, y0, y0 + 1.2, 3.25, 5.6, M.siding);
  const gw = 4.6, gs = new THREE.Shape([new THREE.Vector2(-gw / 2 - 0.3, 0), new THREE.Vector2(gw / 2 + 0.3, 0), new THREE.Vector2(0, 2.0)]);
  const gg = new THREE.ExtrudeGeometry(gs, { depth: Dp + 0.6, bevelEnabled: false }); gg.translate(0, 0, -(Dp + 0.6) / 2);
  const gm = new THREE.Mesh(gg, M.shingle); gm.position.copy(V(cx, cy, 5.6)); add(gm);
  for (const s of [-1, 1]) { const x = cx + s * (gw / 2 + (W - gw) / 4); const m = new THREE.Mesh(new THREE.BoxGeometry((W - gw) / 2 + 0.6, 0.15, Dp + 0.6), M.shingle);
    m.position.copy(V(x, cy, 5.55)); m.rotation.z = s * -0.25; add(m); }
  prism(sector(cx, y0, 0, 2.2, 180, 360), 0, 0.5, M.deck, true);   // stage
  const f = y0 - 0.02, L = [];
  const rect = (xa, xb, za, zb, y = f) => L.push(V(cx + xa, y, za), V(cx + xb, y, za), V(cx + xb, y, za), V(cx + xb, y, zb), V(cx + xb, y, zb), V(cx + xa, y, zb), V(cx + xa, y, zb), V(cx + xa, y, za));
  for (const x of [-1.9, -0.55, 0.8]) rect(x, x + 1.1, 3.8, 5.0);
  for (const s of [-1, 1]) rect(s * 3.2 - 0.5, s * 3.2 + 0.5, 3.8, 4.9);
  const fb = y0 + 1.2 - 0.02;
  rect(-1.6, 1.6, 0.35, 2.7, fb); for (const s of [-1, 1]) rect(s * 3 - 0.6, s * 3 + 0.6, 1.0, 2.4, fb);
  for (const s of [-1, 1]) for (let x = 1.9; x <= 3.9; x += 0.25) L.push(V(cx + s * x, f, 0.35), V(cx + s * x, f, 1.3));
  for (const s of [-1, 1]) L.push(V(cx + s * 1.9, f, 1.3), V(cx + s * 3.95, f, 1.3));
  lines(L);
  for (const s of [-1, 1]) box(cx + s * 1.8 - 0.25, cx + s * 1.8 + 0.25, y0, y0 + 0.3, 0.35, 3.0);
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.7), M.shingle); m.position.copy(V(cx + s * 3.2, y0 - 0.3, 5.15)); m.rotation.x = -0.45; add(m); }
  { const m = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.08, 0.7), M.shingle); m.position.copy(V(cx - 0.2, y0 - 0.3, 5.25)); m.rotation.x = -0.45; add(m); }
  // log benches in rows facing the stage (aerial)
  for (const [x, y, a] of [[24, 10, 20], [27, 9.5, 0], [30, 10, -20], [25, 6, 15], [29, 6, -15], [27, 2.5, 0]]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.8, 16), M.w); m.position.copy(V(x, y, 0.6)); m.rotation.set(0, a * deg, Math.PI / 2, "YXZ"); add(m, { hull: true });
    for (const s of [-0.6, 0.6]) cyl(x + Math.cos(a * deg) * s, y - Math.sin(a * deg) * s, 0.08, 0.15, 0.4, M.w, 10); }
}

function bridge() {   // raised wooden bridge from the top of the slide hill east, then south into the playhouse's upper floor
  const z = TOP, t = 0.25, y0 = PH.cy + PH.D / 2, xa = 19.5, xb = 29, ya = 25.5, yb = 27.3, bx0 = PH.cx - 0.9, bx1 = PH.cx + 0.9;
  box(xa, xb, ya, yb, z - t, z, M.deck); box(bx0, bx1, y0, ya, z - t, z, M.deck);
  for (const [x, y] of [[22.5, ya + 0.1], [22.5, yb - 0.1], [25.5, yb - 0.1], [xb - 0.1, ya + 0.1], [xb - 0.1, yb - 0.1], [bx0 + 0.1, 22.5], [bx1 - 0.1, 22.5], [bx0 + 0.1, y0 + 0.5], [bx1 - 0.1, y0 + 0.5]]) box(x - 0.12, x + 0.12, y - 0.12, y + 0.12, 0, z - t);
  const L = [], slats = (ax, ay, cx, cy) => { const n = Math.ceil(Math.hypot(cx - ax, cy - ay) / 0.18);
    for (let i = 0; i <= n; i++) { const x = ax + (cx - ax) * i / n, y = ay + (cy - ay) * i / n; L.push(V(x, y, z), V(x, y, z + 1.0)); }
    L.push(V(ax, ay, z + 1.0), V(cx, cy, z + 1.0), V(ax, ay, z + 0.15), V(cx, cy, z + 0.15)); };
  slats(xa, yb, xb, yb); slats(xb, yb, xb, ya); slats(xb, ya, bx1, ya); slats(bx1, ya, bx1, y0); slats(xa, ya, bx0, ya); slats(bx0, ya, bx0, y0);
  lines(L);
}

function cocoon(x, y, a) {   // pointed wooden hut, open at the front (photo)
  const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(1.25 * Math.cos(t * Math.PI / 2) ** 0.8, t * 2.7)); }
  const g = new THREE.LatheGeometry(pts, 24, (a + 50) * deg, 260 * deg);
  const m = new THREE.Mesh(g, M.siding); m.position.copy(V(x, y, 0.12)); add(m, { hull: true });
  cyl(x, y, 0.16, 2.7, 3.0, M.w, 8);
}

function ribbon(pts, w, z0, z1, mat) {   // a walk or trail of width w along a list of plan points
  const l = [], r = [];
  pts.forEach(([x, y], i) => { const [nx, ny] = pts[Math.min(i + 1, pts.length - 1)], [px, py] = pts[Math.max(i - 1, 0)], dx = nx - px, dy = ny - py, d = Math.hypot(dx, dy);
    l.push([x - dy / d * w / 2, y + dx / d * w / 2]); r.push([x + dy / d * w / 2, y - dx / d * w / 2]); });
  return prism(poly([...l, ...r.reverse()]), z0, z1, mat, true);
}

function outside() {   // outside the walks: restroom, gazebo, the sand trail round the east, the small and the big sail
  box(-42, -37, -8, -1, 0, 3.0); { const m = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.2, 7.8), M.shingle); m.position.copy(V(-39.5, -4.5, 3.25)); m.rotation.z = 0.12; add(m); }
  lines([V(-37.02, -5, 0), V(-37.02, -5, 2.2), V(-37.02, -5, 2.2), V(-37.02, -3.9, 2.2), V(-37.02, -3.9, 2.2), V(-37.02, -3.9, 0)]);
  ribbon([[-35, 4], [-40, 6], [-48, 8.5], [-56, 10.5], [-62, 11.5]], 2.6, 0, 0.08, M.w);   // walk to the gazebo
  const [gx, gy] = [-68, 13];
  prism(poly([[-62, 4], [-58, 6], [-58, 20], [-74, 22], [-78, 10]]), 0, 0.1);
  for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; cyl(gx + Math.cos(a) * 5.2, gy + Math.sin(a) * 5.2, 0.12, 0.1, 2.8, M.w, 12); }
  const r = new THREE.Mesh(new THREE.ConeGeometry(6.4, 2.6, 8, 1), M.shingle); r.position.copy(V(gx, gy, 2.8 + 1.3)); r.rotation.y = Math.PI / 8; add(r);
  const table = (x, y) => { box(x - 0.9, x + 0.9, y - 0.4, y + 0.4, 0.72, 0.78); for (const s of [-0.75, 0.75]) box(x - 0.9, x + 0.9, y + s - 0.15, y + s + 0.15, 0.42, 0.47);
    for (const s of [-0.7, 0.7]) box(x + s - 0.05, x + s + 0.05, y - 0.9, y + 0.9, 0.1, 0.72); };
  for (const [x, y] of [[-66, 9], [-70, 16], [-61, 8.5], [-60, 15]]) table(x, y);
  // small white sail over a round sand pad north-west, on the slope by the entrance
  prism(disc(-34, 24, 3.6), 0, 0.12, M.sand, true); { const c = [[-37.5, 21, 3.6], [-32.5, 20.2, 2.8], [-30.5, 26, 3.6], [-35.5, 27.8, 2.8]]; sailPosts(c); sail(c, 0.12); }
  ribbon([[-34, 20.4], [-33, 16], [-34.2, 12]], 1.8, 0, 0.1, M.w);
  // the sand trail: from the car park's east end, round the east side and on to the south (aerial)
  ribbon([[10, 38], [20, 35.5], [30, 30], [37, 21], [41, 8], [41.5, -6], [38.5, -22], [30, -33], [18, -41], [4, -44]], 2.4, 0, 0.06, M.sand);
  // big white sail east of the trail, over a picnic pad
  prism(poly([[44, -16], [57, -14], [56, -1], [43, -3]]), 0, 0.12);
  { const c = [[43, -15, 6.5], [57, -14, 4.2], [56, -1.5, 6.5], [43.5, -3, 4.2]]; sailPosts(c); sail(c, 0.25); }
  for (const [x, y] of [[47, -10], [52, -10], [47, -6], [52, -6]]) table(x, y);
}

function details() {
  cocoon(-4, 25, 250);
  for (const [x, y] of [[-6, 4], [16.5, 8], [-31, 10], [-8, -20], [16, -14], [-4, 28], [20, -6], [-25, 28]]) lamp(x, y);
  bench(-4, -18, 0); bench(14, -16.5, 25); bench(-4, 9, 0); bench(17.5, 4, 90); bench(-15, 1.5, 0);
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
  ground(); entrance(); spinZone(); musicArea(); shadeCircle(); swingArea(); slideHill(); playhouse(); bridge(); outside(); details();
  outline(ROOT);
  scene.background = new THREE.Color(0xffffff);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xeeeeee, 2.4));
  const sun = new THREE.DirectionalLight(0xffffff, 0.6); sun.position.set(-40, 80, 70); scene.add(sun);
  return ROOT;
}
