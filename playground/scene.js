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
  M.glass = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.59, side: THREE.DoubleSide, depthWrite: false });   // clear glass (Ahmed)
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
  const g = new THREE.BoxGeometry(x1 - x0, z1 - z0, y1 - y0);
  if (mat.map) { const uv = g.attributes.uv, dx = x1 - x0, dz = z1 - z0, dy = y1 - y0, sz = [[dy, dz], [dy, dz], [dx, dy], [dx, dy], [dx, dz], [dx, dz]];   // textures in metres, like the extruded shapes
    for (let i = 0; i < uv.count; i++) { const [su, sv] = sz[Math.floor(i / 4)]; uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); } }
  const m = new THREE.Mesh(g, mat);
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
const WALK = 0.12;   // top of the concrete walk floor
function prism(shape, z0, z1, mat = M.w, curved = false) {
  if (z0 === 0 && z1 > WALK && z1 <= 1.2) z0 = WALK;   // things sitting on the walk start on its top, so the line where they meet the ground is drawn right there (Ahmed)
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
  const z0 = FL, r = 2.4, top = 5.2;
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
  cyl(x, y, 0.12, FL, 0.6, M.w, 16);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.w); b.position.copy(V(x, y, 1.1)); add(b, { hull: true });
  for (const a of [40, -40]) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.04, 8, 40), M.w); t.position.copy(V(x, y, 1.15)); t.rotation.set(0, a * deg, 0); t.rotateX(0.35); add(t, { hull: true, hw: 0.01 }); }
}

function swing(x, y, a) {   // A-frame swing along the ring, a real playground size (Ahmed: smaller, thinner posts): 3.4 m beam, 2.3 m high, two seats on chains
  const t = [Math.cos((a + 90) * deg), Math.sin((a + 90) * deg)], n = [Math.cos(a * deg), Math.sin(a * deg)], L = 1.7, H = 2.3, rb = 0.045, rl = 0.035;
  const leg = (s, w) => { const b = V(x + t[0] * L * s + n[0] * w, y + t[1] * L * s + n[1] * w, FL), top = V(x + t[0] * L * s, y + t[1] * L * s, H - rb);   // legs stop under the beam
    const d = top.clone().sub(b), m = new THREE.Mesh(new THREE.CylinderGeometry(rl, rl, d.length(), 12), M.w);
    m.position.copy(b.clone().add(top).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); add(m, { hull: true, hw: 0.012 }); };
  for (const s of [-1, 1]) for (const w of [-0.8, 0.8]) leg(s, w);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(rb, rb, L * 2 + 0.2, 12), M.w); beam.position.copy(V(x, y, H));
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), V(t[0], t[1], 0).normalize()); add(beam, { hull: true, hw: 0.012 });
  const ch = [];
  for (const s of [-0.75, 0.75]) { const sx = x + t[0] * s, sy = y + t[1] * s;
    rbox(sx, sy, -a, 0.4, 0.2, 0.45, 0.5);
    for (const e of [-0.17, 0.17]) ch.push(V(sx + t[0] * e, sy + t[1] * e, 0.5), V(sx + t[0] * e, sy + t[1] * e, H - rb)); }
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
const J = await (await fetch("./layout.json?v=24d")).json();
const TOP = 3.0;   // the high level: car park / park entrance; the playground floor is 0
const shp = (p) => { const s = poly(p.o); for (const h of p.h || []) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y)))); return s; };
const each = (list, f) => list.forEach((p) => f(shp(p), p));
function garden(shape, h = 0.13) { const m = prism(shape, 0, h, M.plant, true); m.userData.noEdge = true; return m; }   // planting flush with the walk; its curb draws the edge, so no extra line along the curbs (Ahmed)
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
  J.walkline.forEach((l) => line3(l, 0.125));                              // the 2.5 m walk all round, inside the edge
  each(J.plateau, (s) => prism(s, 0, TOP, M.lawn));         // high ground north of the playground (car park / entrance level)
  for (const f of J.edgefence) rail(f.p.map(([x, y]) => [x, y, f.z]));   // the same railing all round the outer edge (Ahmed)
}

const FL = 0.13;   // play floors: flush with the walk (Ahmed), only the material changes
function flat(shape, mat) { const m = prism(shape, 0, FL, mat, true); m.userData.noEdge = true; return m; }
function zones() {
  each(J.sand, (s) => flat(s, M.sand));                    // swings: sand
  each(J.spin, (s) => flat(s, M.w));                       // spinning zone: rubber
  each(J.grey, (s) => flat(s, M.w));                       // shade circle: rubber
  each(J.moval, (s) => flat(s, M.w));                      // music oval: one floor (photo)
  each(J.wlower, (s) => prism(s, 0, 0.15, M.w, true));                     // west leaf, lower part (use still open)
  each(J.gardens, (s) => garden(s));                                       // all the agreed gardens
  each(J.curb_play, (s) => prism(s, 0, 0.57, M.w, true));                 // thick seat-height curb round each play area
  each(J.curb_garden, (s) => prism(s, 0, 0.27, M.w, true));              // thin low curb round each planted bed
  each(J.sail, (s) => garden(s));                                          // old sail garden (still to agree)
  each(J.planter, (s) => garden(s));                                  // the curved planter under the top-left bridges
  // spinning zone equipment round its centre
  const [cx, cy] = [4.1, -3.9]; ropeCone(cx - 2, cy + 3); bowlSpinner(cx + 4, cy - 2); bowlSpinner(cx + 1, cy - 6);
  cyl(cx - 3, cy - 4, 2.0, FL, 0.28); cyl(cx - 3, cy - 4, 0.12, 0.28, 1.0, M.w, 16);
  // swings on the sand
  for (const [x, y] of [[-14, -24.5], [-4, -27.5], [7, -27], [17, -21.5]]) swing(x, y, Math.atan2(y, x) / deg);
  musicArch();
  { const [cx, cy] = J.music_panel.c, d = (x, y) => Math.hypot(x - cx, y - cy);   // the sign post: its top slopes down toward the people coming in, a lectern for the instructions (Ahmed)
    for (const q of J.music_panel.p) { const ds = q.o.map(([x, y]) => d(x, y)), d0 = Math.min(...ds), d1 = Math.max(...ds);
      const m = prism(shp(q), 0, 1.2, M.w, true), pa = m.geometry.attributes.position;
      for (let i = 0; i < pa.count; i++) if (pa.getY(i) > 0.6) { const t = (d(pa.getX(i), -pa.getZ(i)) - d0) / (d1 - d0); pa.setY(i, 1.2 - 0.3 * t - m.position.y); }
      pa.needsUpdate = true; m.geometry.computeVertexNormals(); } }   // the way in: a gap in the seat wall in the middle, an upright sign post on one side for the music instructions (Ahmed's sketch)
}

function musicArch() {   // the music arch (photo): a flat band, straight legs down into the two gardens, chimes hanging under its top, a string of beads
  const [[x0, y0], [x1, y1]] = J.music, L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L, nx = -uy, ny = ux;
  const leg = 2.1, rise = 0.8, W = 0.32, T = 0.15, n = 40, P = [];   // lower, like the photo: about 2.1 m legs, top near 2.9 m   // centreline in (s along the line, z)
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

  // Ahmed's photo: the beads are flat coloured discs fixed on the front face, and four round sound discs (two on the top, one high on each leg)
  const f = ny > 0 ? -1 : 1, off = f * (W / 2 + 0.015);                       // front face = the side facing the way in (south)
  const N3 = new THREE.Vector3(nx * f, 0, -ny * f).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), N3);
  const sw = ux > 0 ? (sv) => sv : (sv) => L - sv;                               // measure from the left leg as seen from the way in
  const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const at = (u) => { const d = u * cum[cum.length - 1]; let i = 1; while (i < cum.length - 1 && cum[i] < d) i++;   // point on the band centreline, u = 0..1 from the left foot
    const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), sv = P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t, z = P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t; return [sw(sv), z]; };
  const onFace = (sv, z, r, depth, o = 0) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, depth, 28), M.w); m.quaternion.copy(q);
    m.position.copy(V(x0 + ux * sv + nx * (off + f * (depth / 2 + o)), y0 + uy * sv + ny * (off + f * (depth / 2 + o)), z)); return add(m, { curved: true }); };
  for (let k = 0; k < 24; k++) { const sv = sw(L * (0.12 + 0.8 * k / 23)), z = zc + Math.sqrt(R * R - (sv - L / 2) ** 2);   // 24 short chimes under the band, counted on Ahmed's photo, from just past the beads to near the right leg
    cyl(x0 + ux * sv, y0 + uy * sv, 0.065, z - T / 2 - 0.13, z - T / 2, M.w, 12); }
  // four sound discs built into the arch (Ahmed): two flush on the front of the top band, one flush on the inner side of each leg
  const disc = (c, a, b, R0 = 0.1) => { const L2 = [], ring = (r) => { for (let k = 0; k < 32; k++) { const t0 = k / 32 * 2 * Math.PI, t1 = (k + 1) / 32 * 2 * Math.PI;
      L2.push(c.clone().addScaledVector(a, r * Math.cos(t0)).addScaledVector(b, r * Math.sin(t0)), c.clone().addScaledVector(a, r * Math.cos(t1)).addScaledVector(b, r * Math.sin(t1))); } };
    ring(R0); ring(R0 * 0.35); for (let k = 0; k < 6; k++) { const t = k * Math.PI / 3, d = a.clone().multiplyScalar(Math.cos(t)).addScaledVector(b, Math.sin(t)); L2.push(c.clone().addScaledVector(d, R0 * 0.35), c.clone().addScaledVector(d, R0)); }
    lines(L2); };
  const S3 = new THREE.Vector3(ux, 0, -uy), N3n = new THREE.Vector3(nx, 0, -ny), UP = new THREE.Vector3(0, 1, 0), P3 = (sv, w, z) => new THREE.Vector3(x0 + ux * sv + nx * w, z, -(y0 + uy * sv + ny * w));
  for (const u of []) {   // Ahmed: no sound discs on the top band
 const [sv, z] = at(u); const k = Math.min(P.length - 2, Math.max(1, Math.round(u * (P.length - 1)))), tg = new THREE.Vector3().subVectors(P3(P[k + 1][0], 0, P[k + 1][1]), P3(P[k - 1][0], 0, P[k - 1][1])).normalize();
    const nrm = new THREE.Vector3().crossVectors(tg, N3n).normalize(); disc(P3(sv, f * (W / 2 + 0.005), z), tg, nrm.y < 0 ? nrm.negate() : nrm, T / 2 - 0.012); }   // fits inside the band's height
  for (const [sv, dir] of [[T / 2 + 0.005, 1], [L - T / 2 - 0.005, -1]]) disc(P3(sv, 0, leg - 0.45), N3n, UP);   // inner faces of the legs, centred, not on the edge
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
const RB = { x0: 22.541, x1: 26.836, y0: 14.143, y1: 15.893 };   // the rope bridge on the house bridge (Ahmed's aerial photo)
const ropeGap = (x, y) => x > RB.x0 - 0.01 && x < RB.x1 + 0.01 && y > RB.y0 + 0.01 && y < RB.y1 - 0.01;
function ropeBridge(z = TOP) {   // wooden slats with gaps hung on ropes, sagging in the middle; rope nets on both sides; a post at each corner
  const { x0, x1, y0, y1 } = RB, sag = 0.18, zd = (x) => z - sag * Math.sin(Math.PI * (x - x0) / (x1 - x0)), zr = (x) => z + 1.0 - 0.06 * Math.sin(Math.PI * (x - x0) / (x1 - x0)), L = [];
  for (let x = x0 + 0.1; x + 0.12 < x1 - 0.06; x += 0.18) box(x, x + 0.12, y0 + 0.12, y1 - 0.12, zd(x + 0.06) - 0.04, zd(x + 0.06), M.w);   // slats, 6 cm gaps, plain (no texture, Ahmed)
  for (const y of [y0 + 0.2, y1 - 0.2]) { const P = []; for (let i = 0; i <= 24; i++) { const x = x0 + (x1 - x0) * i / 24; P.push(V(x, y, zd(x) - 0.065)); } tube(P, 0.025); }   // ropes under the slats
  for (const y of [y0 + 0.06, y1 - 0.06]) {
    box(x0, x0 + 0.12, y - 0.06, y + 0.06, 0, z + 1.15); box(x1 - 0.12, x1, y - 0.06, y + 0.06, 0, z + 1.15);   // corner posts
    const T = [], B = []; for (let i = 0; i <= 24; i++) { const x = x0 + 0.12 + (x1 - x0 - 0.24) * i / 24; T.push(V(x, y, zr(x))); B.push(V(x, y, zd(x) + 0.03)); } tube(T, 0.03); tube(B, 0.02);   // hand rope, foot rope
    const g = 0.2, xa = x0 + 0.12, xb = x1 - 0.12;   // diamond rope net between them
    for (let k = -6; xa + k * g < xb; k++) for (const d of [1, -1]) { const u0 = xa + k * g, u1 = u0 + d * 0.9, ta = (xa - u0) / (u1 - u0), tb = (xb - u0) / (u1 - u0);
      const t0 = Math.max(0, Math.min(ta, tb)), t1 = Math.min(1, Math.max(ta, tb)); if (t1 - t0 < 0.02) continue;
      const at = (t) => { const x = u0 + (u1 - u0) * t; return V(x, y, zd(x) + 0.03 + (zr(x) - zd(x) - 0.03) * t); }; L.push(at(t0), at(t1)); } }
  lines(L);
}
function deck(p, z = TOP) {
  prism(shp(p), z - 0.25, z, M.deck);
  const o = p.o, [x0, x1] = [Math.min(...o.map((q) => q[0])), Math.max(...o.map((q) => q[0]))], [y0, y1] = [Math.min(...o.map((q) => q[1])), Math.max(...o.map((q) => q[1]))];
  for (let x = x0 + 0.3; x < x1; x += 2.4) for (let y = y0 + 0.3; y < y1; y += 2.4) if (inPoly(o, x, y) && inEdge(x, y)) box(x - 0.1, x + 0.1, y - 0.1, y + 0.1, 0, z - 0.25);
  const L = [];
  for (let i = 0; i < o.length; i++) { const a = o[i], b = o[(i + 1) % o.length]; if (!inEdge((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)) continue;
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.15)), atHouse = (x, y) => x > 20.85 && x < 28.6 && y > 5.5 && y < 10.45;   // no fence where the bridge meets the playhouse (Ahmed)
    let prev = null;   // fence posts and top rail, broken where the bridge meets the playhouse or the rope bridge
    for (let k = 0; k <= n; k++) { const x = a[0] + (b[0] - a[0]) * k / n, y = a[1] + (b[1] - a[1]) * k / n;
      if (atHouse(x, y) || ropeGap(x, y)) { prev = null; continue; } L.push(V(x, y, z), V(x, y, z + 1.0)); if (prev) L.push(V(prev[0], prev[1], z + 1.0), V(x, y, z + 1.0)); prev = [x, y]; } }
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
  playhouse();
  { const cx = 24.6275, y0 = 5.857, rx = 2.0925, ry = 2.3, o = [];   // half-round step, wider: pillar to pillar and deeper (Ahmed's sketch)
    for (let i = 0; i <= 96; i++) { const a = Math.PI * i / 96; o.push([cx - rx * Math.cos(a), y0 - ry * Math.sin(a)]); }
    each([{ o, h: [] }], (s) => prism(s, 0, 0.3, M.deck, true)); }
  for (const p of J.logs) {   // log benches (photo): a half log, flat seat on top, round underneath, on two short posts; cracked rings on the cut ends
    const o = p.o, n = o.length, A = o[0], B = o[Math.floor(n / 2) - 1], c0x = o.reduce((s, q) => s + q[0], 0) / n, c0y = o.reduce((s, q) => s + q[1], 0) / n;
    const away = 1.0, rx = c0x - 24.63, ry = c0y - 5.0, rd = Math.hypot(rx, ry), cx = c0x + rx / rd * away, cy = c0y + ry / rd * away;   // 1 m further from the stage (Ahmed)
    const dx = B[0] - A[0], dy = B[1] - A[1], dl = Math.hypot(dx, dy), len = dl * 0.92, ux = dx / dl, uy = dy / dl, px = -uy, py = ux, r = 0.21, zt = 0.15 + 0.5;   // seat 0.5 m above the mulch
    const sh = new THREE.Shape(); sh.moveTo(-r, 0); sh.absarc(0, 0, r, Math.PI, 2 * Math.PI, false); sh.lineTo(-r, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false, curveSegments: 24 }); g.translate(0, 0, -len / 2);
    const m = new THREE.Mesh(g, M.w);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(px, 0, -py), new THREE.Vector3(0, 1, 0), new THREE.Vector3(ux, 0, -uy))); m.position.copy(V(cx, cy, zt)); add(m, { curved: true });
    for (const k of [-0.3, 0.3]) cyl(cx + ux * len * k, cy + uy * len * k, 0.07, 0.15, zt - r, M.w, 16);
    const L = [], P = (e, a, rr) => V(cx + ux * len * e + px * rr * Math.cos(a), cy + uy * len * e + py * rr * Math.cos(a), zt + rr * Math.sin(a));
    for (const e of [-0.501, 0.501]) { for (const rr of [0.07, 0.14]) for (let i = 0; i < 12; i++) { const a0 = Math.PI + i / 12 * Math.PI, a1 = Math.PI + (i + 1) / 12 * Math.PI; L.push(P(e, a0, rr), P(e, a1, rr)); }
      for (const a of [3.6, 4.7, 5.8]) L.push(P(e, a, 0.02), P(e, a + 0.2, 0.19)); }
    for (const k of [-0.4, -0.1, 0.2]) for (const w of [-0.08, 0.06]) L.push(V(cx + ux * len * k + px * w, cy + uy * len * k + py * w, zt + 0.003), V(cx + ux * len * (k + 0.2) + px * w, cy + uy * len * (k + 0.2) + py * w, zt + 0.003));   // grain on the seat
    lines(L);
  }
  { const o = J.h_bridge[0].o, A = [o[0], o[1], [RB.x0, RB.y0], [RB.x0, RB.y1], ...o.slice(9)], B = [[RB.x1, RB.y0], ...o.slice(4, 8), [RB.x1, RB.y1]];   // the house bridge in two decks, the rope bridge between them
    for (const q of [A, B]) each([{ o: q, h: [] }], (s, p) => deck(p)); ropeBridge(); }
  { const o = J.h_yard[0].o, i0 = o.findIndex((p) => p[0] === 20.791 && p[1] === 14.576), i1 = o.findIndex((p) => p[0] === 26.72 && p[1] === 10.228), P = [];   // no fence round the yard (Ahmed): a small curb like the garden beds', 15 cm wide, along its open edge
    for (let i = i0; ; i = (i + 1) % o.length) { P.push(o[i]); if (i === i1) break; }
    const w = 0.15, nrm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [dy / l, -dx / l]; };
    let sg = 1; { const n = nrm(P[0], P[1]), m = [(P[0][0] + P[1][0]) / 2 + n[0] * 0.05, (P[0][1] + P[1][1]) / 2 + n[1] * 0.05]; if (inPoly(o, m[0], m[1])) sg = -1; }   // offset outward, onto the walk
    const Q = P.map((p, i) => { const a = nrm(P[Math.max(i - 1, 0)], P[Math.max(i, 1)]), b = nrm(P[Math.min(i, P.length - 2)], P[Math.min(i + 1, P.length - 1)]);
      let nx = a[0] + b[0], ny = a[1] + b[1]; const l = Math.hypot(nx, ny); nx /= l; ny /= l; const k = w / Math.max(0.5, nx * a[0] + ny * a[1]); return [p[0] + sg * nx * k, p[1] + sg * ny * k]; });
    prism(poly([...P, ...Q.reverse()]), 0, 0.27, M.w, true); }
  line3(J.offset, 0.14);
}

// the playhouse, built from Ahmed's photo: a two-storey front, a tall middle bay with a gable (open lattice in the triangle),
// lower side wings with lean-to roofs, an open stage with carved curtains below, porches with railings in the wings,
// three gridded windows under a shingle awning upstairs, a small window with its own awning in each wing, an oval sign on the beam
function shingleUV(m) {   // shingles laid in metres on the top face of every roof, all the same size (Ahmed); the slab's edges and underside stay plain
  m.updateMatrix(); let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry; m.geometry = g;
  const P = g.attributes.position, uv = g.attributes.uv, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < P.count; i += 3) {
    a.fromBufferAttribute(P, i).applyMatrix4(m.matrix); b.fromBufferAttribute(P, i + 1).applyMatrix4(m.matrix); c.fromBufferAttribute(P, i + 2).applyMatrix4(m.matrix);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    if (n.y < 0.3) { for (let j = 0; j < 3; j++) uv.setXY(i + j, 12 / 128, 16 / 128); continue; }   // edges, underside: a blank spot of the texture
    const e1 = new THREE.Vector3().crossVectors(up, n); if (e1.lengthSq() < 1e-6) e1.set(1, 0, 0); e1.normalize(); const e2 = new THREE.Vector3().crossVectors(n, e1);
    [a, b, c].forEach((p, j) => uv.setXY(i + j, p.dot(e1), p.dot(e2)));
  }
  uv.needsUpdate = true;
}
function xzPrism(pts, yA, yB, mat = M.w, o = {}) {   // profile in (x, z), pushed back from plan y = yA to yB (yA < yB)
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z))), { depth: yB - yA, bevelEnabled: false, curveSegments: 24 });
  const m = new THREE.Mesh(g, mat); m.position.set(0, 0, -yB); if (mat === M.shingle) shingleUV(m); return add(m, o);
}
function awning(xa, xb, yw, proj, zt, drop, mat = M.shingle) {   // a sloped slab off the wall at yw, its low edge out front
  const len = Math.hypot(proj, drop), m = new THREE.Mesh(new THREE.BoxGeometry(xb - xa, 0.08, len), mat);
  m.rotation.x = Math.atan2(drop, proj); m.position.copy(V((xa + xb) / 2, yw - proj / 2, zt - drop / 2)); if (mat === M.shingle) shingleUV(m); add(m);
  const L = []; for (const x of [xa + 0.12, xb - 0.12]) L.push(V(x, yw - 0.01, zt - drop - 0.25), V(x, yw - proj * 0.7, zt - drop * 0.7 - 0.02));   // brackets
  lines(L);
}
function frontRect(L, y, xa, xb, za, zb) { L.push(V(xa, y, za), V(xb, y, za), V(xb, y, za), V(xb, y, zb), V(xb, y, zb), V(xa, y, zb), V(xa, y, zb), V(xa, y, za)); }
function gridWindow(L, y, xa, xb, za, zb, nx = 5, nz = 6) {   // window with its wire grid, and a sill
  frontRect(L, y, xa, xb, za, zb); frontRect(L, y, xa + 0.06, xb - 0.06, za + 0.06, zb - 0.06);
  { const g = new THREE.Mesh(new THREE.PlaneGeometry(xb - xa, zb - za), M.glass); g.position.copy(V((xa + xb) / 2, y + 0.06, (za + zb) / 2)); add(g, { noEdge: true }); }   // clear glass pane in the opening
  for (let i = 1; i < nx; i++) { const x = xa + 0.06 + (xb - xa - 0.12) * i / nx; L.push(V(x, y, za + 0.06), V(x, y, zb - 0.06)); }
  for (let i = 1; i < nz; i++) { const z = za + 0.06 + (zb - za - 0.12) * i / nz; L.push(V(xa + 0.06, y, z), V(xb - 0.06, y, z)); }
  box(xa - 0.05, xb + 0.05, y - 0.08, y + 0.01, za - 0.08, za, M.w);
}
function wallY(y, xa, xb, za, zb, holes = [], t = 0.12, mat = M.siding, top = null) {   // wall in the plane y (its face), thickness going back (+y); holes [xa, xb, za, zb] are open
  const sh = new THREE.Shape((top || [[xa, za], [xb, za], [xb, zb], [xa, zb]]).map(([x, z]) => new THREE.Vector2(x, z)));
  for (const hd of holes) sh.holes.push(Array.isArray(hd[0]) ? new THREE.Path(hd.map(([x, z]) => new THREE.Vector2(x, z)))   // a hole can be any outline [[x, z], ...]
    : new THREE.Path([new THREE.Vector2(hd[0], hd[2]), new THREE.Vector2(hd[1], hd[2]), new THREE.Vector2(hd[1], hd[3]), new THREE.Vector2(hd[0], hd[3])]));
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false }), mat); m.position.set(0, 0, -(y + t)); return add(m);
}
function wallX(x, ya, yb, za, zb, holes = [], t = 0.12, mat = M.siding) {   // wall in the plane x, thickness toward +x (negative t: toward -x)
  const sh = new THREE.Shape([[ya, za], [yb, za], [yb, zb], [ya, zb]].map(([y, z]) => new THREE.Vector2(y, z)));
  for (const [a, b, c, d] of holes) sh.holes.push(new THREE.Path([new THREE.Vector2(a, c), new THREE.Vector2(b, c), new THREE.Vector2(b, d), new THREE.Vector2(a, d)]));
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: Math.abs(t), bevelEnabled: false }), mat);
  m.rotation.y = Math.PI / 2; m.position.set(t > 0 ? x : x + t, 0, 0); return add(m);
}
// ----- flat pieces on a wall face. plane "y": shape in (x, z), from plan y = pos to pos + d. plane "x": shape in (y, z), from x = pos to pos + d
function faceMesh(sh, plane, pos, d, o = {}) {
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false, curveSegments: 24 }), M.w);
  if (plane === "y") m.position.set(0, 0, -(pos + d)); else { m.rotation.y = Math.PI / 2; m.position.x = pos; }
  return add(m, o);
}
const faceV = (plane, u, p, z) => plane === "y" ? V(u, p, z) : V(p, u, z);   // a point on a face: u along it, p the depth
function fbox(plane, u0, u1, p0, p1, z0, z1) { return plane === "y" ? box(u0, u1, p0, p1, z0, z1) : box(p0, p1, u0, u1, z0, z1); }
const shapeOf = (pts) => new THREE.Shape(pts.map(([u, z]) => new THREE.Vector2(u, z)));
function pentPts(uc, w, z0, zs, zt) { return [[uc - w / 2, z0], [uc + w / 2, z0], [uc + w / 2, zs], [uc, zt], [uc - w / 2, zs]]; }   // a little house shape: square body, pointed top
function gothicPts(uc, w, z0, zs, m = 1.0, n = 10) {   // pointed (gothic) arch opening: two arcs that meet in a point
  const R = w / 2 * (1 + m), cx = uc + w / 2 - R, th = Math.acos((uc - cx) / R), P = [[uc - w / 2, z0], [uc + w / 2, z0]];
  for (let i = 0; i <= n; i++) { const a = th * i / n; P.push([cx + R * Math.cos(a), zs + R * Math.sin(a)]); }
  for (let i = n - 1; i >= 0; i--) { const a = th * i / n; P.push([2 * uc - (cx + R * Math.cos(a)), zs + R * Math.sin(a)]); }
  return P;
}
function wavyRun(P, a, b, nrm, bumps, amp) {   // add points from a to b, scalloped outward along nrm
  const N = bumps * 6; for (let i = 1; i <= N; i++) { const t = i / N, w = amp * Math.abs(Math.sin(Math.PI * bumps * t));
    P.push([a[0] + (b[0] - a[0]) * t + nrm[0] * w, a[1] + (b[1] - a[1]) * t + nrm[1] * w]); }
}
function scallopBand(plane, pos, u0, u1, ztop, h, r, d = 0.03) {   // a board with a row of half-round scallops hanging from its lower edge
  const n = Math.max(1, Math.round((u1 - u0) / (2 * r))), rr = (u1 - u0) / (2 * n), sh = new THREE.Shape();
  sh.moveTo(u0, ztop); sh.lineTo(u1, ztop); sh.lineTo(u1, ztop - h);
  for (let i = n - 1; i >= 0; i--) { const um = u0 + rr * (2 * i + 1); sh.absarc(um, ztop - h, rr, 0, Math.PI, true); }
  sh.closePath(); return faceMesh(sh, plane, pos, d, { curved: true });
}
function heartShape(u, z, s) {
  const h = new THREE.Shape(); h.moveTo(u, z - 0.5 * s);
  h.bezierCurveTo(u - 0.1 * s, z - 0.3 * s, u - 0.5 * s, z - 0.05 * s, u - 0.5 * s, z + 0.2 * s);
  h.bezierCurveTo(u - 0.5 * s, z + 0.5 * s, u - 0.05 * s, z + 0.55 * s, u, z + 0.3 * s);
  h.bezierCurveTo(u + 0.05 * s, z + 0.55 * s, u + 0.5 * s, z + 0.5 * s, u + 0.5 * s, z + 0.2 * s);
  h.bezierCurveTo(u + 0.5 * s, z - 0.05 * s, u + 0.1 * s, z - 0.3 * s, u, z - 0.5 * s); return h;
}
function starPts(u, z, R, k = 0.42) { const P = []; for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * k : R; P.push([u + r * Math.cos(a), z + r * Math.sin(a)]); } return P; }
function loopLines(L, plane, p, pts) { for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; L.push(faceV(plane, a[0], p, a[1]), faceV(plane, b[0], p, b[1])); } }
function ornament(L, plane, pos, kind, u, z, s) {   // flat cut-out on the wall (photo): heart, star, diamond, moon, keyhole; a smaller one drawn inside
  const d = 0.03, pf = plane === "y" ? pos + d + 0.002 : pos + d + 0.002;
  if (kind === "heart") { faceMesh(heartShape(u, z, s), plane, pos, d, { curved: true }); loopLines(L, plane, pf, heartShape(u, z + 0.02 * s, s * 0.45).getPoints(8).map((v) => [v.x, v.y])); }
  if (kind === "star") { faceMesh(shapeOf(starPts(u, z, s)), plane, pos, d); loopLines(L, plane, pf, starPts(u, z, s * 0.38)); }
  if (kind === "diamond") { const D = (k) => [[u, z - s * k], [u + s * 0.7 * k, z], [u, z + s * k], [u - s * 0.7 * k, z]]; faceMesh(shapeOf(D(1)), plane, pos, d); loopLines(L, plane, pf, D(0.45)); }
  if (kind === "moon") { const P = []; for (let i = 0; i <= 16; i++) { const a = Math.PI * (0.3 + 1.4 * i / 16); P.push([u + s * Math.cos(a), z + s * Math.sin(a)]); }
    for (let i = 16; i >= 0; i--) { const a = Math.PI * (0.38 + 1.24 * i / 16); P.push([u - 0.35 * s + 0.8 * s * Math.cos(a) + 0.35 * s, z + 0.8 * s * Math.sin(a)]); }
    faceMesh(shapeOf(P.map(([x, y]) => [2 * u - x, y])), plane, pos, d, { curved: true }); }
  if (kind === "keyhole") { const P = []; for (let i = 0; i <= 14; i++) { const a = -Math.PI / 3 + (Math.PI * 5 / 3) * i / 14; P.push([u + s * 0.5 * Math.cos(a), z + s * 0.25 + s * 0.5 * Math.sin(a)]); }
    P.push([u - s * 0.4, z - s * 0.7], [u + s * 0.4, z - s * 0.7]); faceMesh(shapeOf(P), plane, pos, d, { curved: true }); }
}
function archBay(L, plane, p0, p1, u0, u1, zs, zt, w = 0.12) {   // a round arch between two posts (photo): springs out of the posts, crown under the beam; little posts fill the corners above it
  const c = (u1 - u0) / 2, uc = (u0 + u1) / 2, h = zt - zs, R = (c * c + h * h) / (2 * h), zc = zt - R, Ri = R - w;
  const zIn = zc + Math.sqrt(Math.max(Ri * Ri - c * c, 0)), top = (u) => zc + Math.sqrt(R * R - (u - uc) ** 2), sh = new THREE.Shape();
  const N = 40; sh.moveTo(u0, zs); for (let i = 1; i <= N; i++) { const u = u0 + 2 * c * i / N; sh.lineTo(u, top(u)); }
  sh.lineTo(u1, zIn); for (let i = N - 1; i >= 1; i--) { const u = u0 + 2 * c * i / N; sh.lineTo(u, zc + Math.sqrt(Math.max(Ri * Ri - (u - uc) ** 2, 0))); }
  sh.lineTo(u0, zIn); sh.closePath(); faceMesh(sh, plane, p0, p1 - p0, { curved: true });
  const pm = (p0 + p1) / 2, sw = 0.03;
  for (const side of [-1, 1]) for (let k = 1; k < 12; k++) {   // spandrel spindles, from the arch up to the beam
    const uu = side < 0 ? u0 + k * 0.14 : u1 - k * 0.14, hi = side < 0 ? uu + sw / 2 : uu - sw / 2, zb = top(Math.min(Math.max(hi, u0), u1));
    if (zt - zb < 0.08) break; fbox(plane, uu - sw / 2, uu + sw / 2, pm - 0.015, pm + 0.015, zb, zt); }
}
function netRail(L, plane, p0, p1, u0, u1, z0, posts) {   // balcony rail (photo): posts, a thick top rail with lashings, a bottom rail, diamond rope net between
  const zt0 = z0 + 0.9, zt1 = z0 + 1.0, zb0 = z0 + 0.06, zb1 = z0 + 0.14, cuts = [u0, ...posts.flatMap((q) => [q - 0.05, q + 0.05]), u1];
  for (const q of posts) fbox(plane, q - 0.05, q + 0.05, p0 - 0.01, p1 + 0.01, z0, zt1 + 0.02);
  for (let i = 0; i < cuts.length; i += 2) { const a = cuts[i], b = cuts[i + 1];
    fbox(plane, a, b, p0, p1, zt0, zt1); fbox(plane, a, b, p0, p1, zb0, zb1);
    const po = plane === "y" ? p1 + 0.002 : p1 + 0.002; for (let u = a + 0.08; u < b - 0.02; u += 0.09) L.push(faceV(plane, u, po, zt0), faceV(plane, u, po, zt1));   // lashings
    const pm = (p0 + p1) / 2, g = 0.13, H = zt0 - zb1;   // diamond net
    for (let k = -Math.ceil(H / g); k * g < b - a; k++) for (const dir of [1, -1]) {
      let ua = a + k * g, za = zb1, ub = ua + H, zb = zt0; if (dir < 0) { ua = b - k * g; ub = ua - H; }
      const clip = (t) => [ua + (ub - ua) * t, za + (zb - za) * t]; let t0 = 0, t1 = 1;
      const lo = (v) => (v - ua) / (ub - ua); const ta = lo(a), tb = lo(b); t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
      if (t1 - t0 > 0.01) { const A = clip(t0), B = clip(t1); L.push(faceV(plane, A[0], pm, A[1]), faceV(plane, B[0], pm, B[1])); } } }
}
function playhouse() {   // an open building (Ahmed): real walls with open windows and doorways, floors and roofs, so the inside shows
  const cx0 = 22.535, cx1 = 26.72, wx0 = 20.791, wx1 = 28.464, yf = 5.857, ywf = 6.555, yb = 10.391, ywb = 9.81, cm = (cx0 + cx1) / 2, t = 0.12;
  const F2 = 2.35, B2 = 2.6, WE = 4.15, WR = 4.6, CW = 5.1,   // WR: wing roof meets the middle wall here, under the main eave (Ahmed's side photo)
        AP = 6.2, L = [];   // ridge lowered to 6.2: flatter main roof whose eaves come down onto the wings (Ahmed's sketch)
          // beam/floor 2.35-2.6, wing eaves 4.55, middle walls 5.1, ridge 6.6 (photo, 1 m = 126 px)
  // ----- middle bay, ground floor: the stage
  const pw = 0.42, sd = 1.4;
  box(cx0, cx0 + pw, yf, yf + 0.35, 0, F2, M.w); box(cx1 - pw, cx1, yf, yf + 0.35, 0, F2, M.w);   // the two light pillars
  wallX(cx0, yf + 0.35, ywf, 0, F2); wallX(cx1, yf + 0.35, ywf, 0, F2, [], -t);                   // stage sides up to the porches
  const doorH = [cm - 0.45, cm + 0.45, 0.3, 1.85], winL = [cm - 1.0, cm - 0.55, 1.15, 1.8], winR = [cm + 0.55, cm + 1.0, 1.15, 1.8];
  wallY(yf + sd, cx0, cx1, 0, F2, [doorH, winL, winR]);                // back of the stage: an open doorway and two open windows into the room behind
  { const y = yf + sd - 0.01; gridWindow(L, y, ...winL, 2, 4); gridWindow(L, y, ...winR, 2, 4); frontRect(L, y, ...doorH); }
  box(cx0 + pw, cx1 - pw, yf, yf + sd, 0, 0.3, M.deck);                 // stage floor, level with the half-round step
  { const fw = 0.24, yA = yf - 0.18, yB = yf + 0.06;               // the dark wooden portal round the stage, in front of the curtains (photo): two posts, a header with ends past the posts, corner braces
    box(cx0 + pw, cx0 + pw + fw, yA, yB, 0.3, 2.02, M.w); box(cx1 - pw - fw, cx1 - pw, yA, yB, 0.3, 2.02, M.w);
    box(cx0 + pw, cx1 - pw, yA - 0.04, yf + 0.3, 2.02, F2, M.w);   // header right up under the beam
    box(cx0 + pw - 0.14, cx0 + pw, yA - 0.04, yf, 2.02, F2, M.w); box(cx1 - pw, cx1 - pw + 0.14, yA - 0.04, yf, 2.02, F2, M.w);   // its ends, in front of the pillars (no overlap)
    for (const sgn of [1, -1]) { const p = sgn > 0 ? cx0 + pw + fw : cx1 - pw - fw, X = (d) => p + sgn * d;
      xzPrism(sgn > 0 ? [[X(0), 1.35], [X(0.62), 2.02], [X(0.46), 2.02], [X(0), 1.52]] : [[X(0.62), 2.02], [X(0), 1.35], [X(0), 1.52], [X(0.46), 2.02]], yA + 0.04, yB - 0.04, M.w); } }
  for (const sgn of [1, -1]) {                                          // carved wooden curtains (photo): wide at the top, a board slanting in, gathered low near the post, flaring at the foot
    const xo = sgn > 0 ? cx0 + pw + 0.24 : cx1 - pw - 0.24, X = (d) => xo + sgn * d, sh = new THREE.Shape();
    sh.moveTo(X(0), 2.02); sh.lineTo(X(0.72), 2.02); sh.quadraticCurveTo(X(0.6), 1.35, X(0.24), 0.95);   // up to the underside of the header = the ground-floor ceiling at the front (Ahmed)
    sh.quadraticCurveTo(X(0.18), 0.6, X(0.46), 0.3); sh.lineTo(X(0), 0.3); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false, curveSegments: 16 }), m = new THREE.Mesh(g, M.w);
    m.position.set(0, 0, -(yf + 0.18)); add(m, { curved: true });   // right behind the wooden posts, at the front (Ahmed), touching the header above
    const y = yf + 0.055;
    for (const tt of [0.35, 0.6]) L.push(V(X(tt * 0.72), y, 2.02), V(X(0.1 + tt * 0.2), y, 1.0), V(X(0.1 + tt * 0.2), y, 0.85), V(X(0.12 + tt * 0.4), y, 0.32));   // carved folds
  }
  // back, ground floor (back photo): a narrow siding panel at each end with a diamond, posts, and one wide open arch between them
  wallY(yb - t, cx0, cx0 + 0.48, 0, F2); wallY(yb - t, cx1 - 0.48, cx1, 0, F2);
  box(cx0 + 0.48, cx0 + 0.6, yb - 0.14, yb, 0, F2); box(cx1 - 0.6, cx1 - 0.48, yb - 0.14, yb, 0, F2);
  archBay(L, "y", yb - 0.11, yb - 0.02, cx0 + 0.6, cx1 - 0.6, 1.45, F2);
  ornament(L, "y", yb, "diamond", cx0 + 0.24, 1.85, 0.15); ornament(L, "y", yb, "diamond", cx1 - 0.24, 1.85, 0.15);
  // ----- upstairs floor (its edge is the beam in the photo)
  box(cx0 - 0.05, cx1 + 0.05, yf - 0.12, yb, F2, B2, M.w);
  box(wx0 - 0.05, cx0 - 0.05, ywf - 0.12, ywb, F2, B2, M.w); box(cx1 + 0.05, wx1 + 0.05, ywf - 0.12, yb, F2, B2, M.w);   // east wing floor runs to the back: the open balcony (back photo)
  // ----- middle bay upstairs: front wall with three open windows, sides, back; open lattice gable; roof
  const xs = [cm - 1.65, cm - 0.5, cm + 0.65], W3 = xs.map((xa) => [xa, xa + 1.0, 3.05, 4.2]);   // three windows, 1.0 x 1.15 m, almost the full bay (photo)
  wallY(yf, cx0, cx1, B2, CW, W3); for (const w of W3) gridWindow(L, yf - 0.01, ...w);
  wallX(cx0, yf + t, ywf, B2, CW); wallX(cx1, yf + t, ywf, B2, CW, [], -t);   // walls butt, never overlap
  { // back, upstairs (back photo): two little house-shaped windows in wavy frames, a heart near each corner, a star between, corner boards, a scalloped board under the gable
    const BW = [cm - 0.78, cm + 0.78].map((uc) => pentPts(uc, 0.66, 3.22, 3.98, 4.24));
    wallY(yb - t, cx0, cx1, B2, CW, BW);
    for (const P of BW) { const uc = (P[0][0] + P[1][0]) / 2, f = 0.1, xa = P[0][0] - f, xb = P[1][0] + f, z0 = 3.22 - f, O = [[xa, z0]];
      wavyRun(O, [xa, z0], [xb, z0], [0, -1], 5, 0.03); wavyRun(O, [xb, z0], [xb, 3.98], [1, 0], 5, 0.03); O.push([uc, 4.24 + f * 1.35], [xa, 3.98]); wavyRun(O, [xa, 3.98], [xa, z0], [-1, 0], 5, 0.03); O.pop();
      const fs = shapeOf(O); fs.holes.push(new THREE.Path(P.map(([x, z]) => new THREE.Vector2(x, z)))); faceMesh(fs, "y", yb, 0.04, { curved: true });
      const g = new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(P)), M.glass); g.position.z = -(yb - t / 2); add(g, { noEdge: true });   // clear glass
      const yl = yb - t / 2; L.push(V(uc, yl, 3.22), V(uc, yl, 4.24)); for (const z of [3.47, 3.72, 3.98]) L.push(V(P[0][0], yl, z), V(P[1][0], yl, z)); }   // window bars
    ornament(L, "y", yb, "heart", cm - 1.71, 4.32, 0.31); ornament(L, "y", yb, "heart", cm + 1.71, 4.32, 0.31); ornament(L, "y", yb, "star", cm, 4.47, 0.21);
    box(cx0 - 0.03, cx0 + 0.14, yb, yb + 0.03, B2, CW - 0.22); box(cx1 - 0.14, cx1 + 0.03, yb, yb + 0.03, B2, CW - 0.22);   // corner boards
    box(cx0 - 0.03, cx0, yb - 0.14, yb, B2, CW - 0.22); box(cx1, cx1 + 0.03, yb - 0.14, yb, B2, CW - 0.22);
    scallopBand("y", yb, cx0 - 0.03, cx1 + 0.03, CW, 0.16, 0.06);
    scallopBand("y", yb, cx0 - 0.05, wx1 + 0.05, F2, 0.1, 0.06, 0.025); scallopBand("x", wx1 + 0.05, ywf - 0.12, yb + 0.025, F2, 0.1, 0.06, 0.025);   // scalloped board under the upstairs floor
  }
  box(cx0 - 0.1, cx1 + 0.1, yf - 0.12, yf + 0.05, CW - 0.12, CW, M.w);   // band under the front gable
  const gable = (outer, dir) => {   // gable (photos): wooden rake boards just under the roof at its slope, a king post, a fine open grid; dir -1 front, +1 back
    const hw = (cx1 - cx0) / 2, b = 0.04, k = (AP - CW) / hw, bt = 0.22, ri = (bt - 0.05) / k;
    const R0 = dir < 0 ? outer : outer - 0.08, v0 = dir < 0 ? outer : outer - b, h0 = dir < 0 ? outer - b : outer;   // verticals inside, horizontals one layer out
    xzPrism([[cx0, CW], [cx0, CW + 0.05], [cm, AP + 0.05], [cm, AP + 0.05 - bt], [cx0 + ri, CW]], R0, R0 + 0.08, M.w);
    xzPrism([[cx1 - ri, CW], [cm, AP + 0.05 - bt], [cm, AP + 0.05], [cx1, CW + 0.05], [cx1, CW]], R0, R0 + 0.08, M.w);
    const hi = hw - ri, top = AP + 0.05 - bt - CW, inner = (z) => hi * (1 - (z - CW) / top);
    box(cm - 0.06, cm + 0.06, R0, R0 + 0.08, CW, AP + 0.05 - bt, M.w);                       // king post
    for (let x = cm + 0.33; x < cm + hi; x += 0.33) for (const xx of [x, 2 * cm - x]) { const zt = CW + top * (1 - Math.abs(xx - cm) / hi); if (zt > CW + 0.08) box(xx - b / 2, xx + b / 2, v0, v0 + b, CW, zt, M.w); }
    for (let z = CW + 0.27; z < CW + top - 0.1; z += 0.27) { const h = inner(z); box(cm - h, cm + h, h0, h0 + b, z - b / 2, z + b / 2, M.w); }
    return { zApex: AP + 0.05 - bt, face: dir < 0 ? h0 : h0 + b };
  };
  gable(yf - 0.02, -1);
  { const g = gable(yb + 0.02, 1), zc = g.zApex - 0.1, r = 0.17, sh = new THREE.Shape();   // back: a half-round sunburst under the peak (back photo)
    sh.moveTo(cm - r, zc); sh.absarc(cm, zc, r, Math.PI, 0, true); sh.closePath(); faceMesh(sh, "y", g.face, 0.03, { curved: true });
    for (let i = 1; i < 6; i++) { const a = Math.PI * i / 6; L.push(V(cm, g.face + 0.032, zc), V(cm + r * 0.85 * Math.cos(a), g.face + 0.032, zc + r * 0.85 * Math.sin(a))); } }
  for (const sgn of [-1, 1]) {                                          // roof slabs with an overhang
    const xe = sgn < 0 ? cx0 - 0.5 : cx1 + 0.5, ze = CW + 0.06 - 0.5 * (AP - CW) / ((cx1 - cx0) / 2), AR = AP + 0.06;   // underside parallel to the gable, 6 cm above the walls
    xzPrism(sgn < 0 ? [[xe, ze], [cm, AR], [cm, AR + 0.14], [xe, ze + 0.14]] : [[cm, AR], [xe, ze], [xe, ze + 0.14], [cm, AR + 0.14]], yf - 0.35, yb + 0.35, M.shingle);
  }
  awning(cx0 + 0.05, cx1 - 0.05, yf, 0.7, 4.78, 0.45);
  { const sg = new THREE.Shape(); sg.absellipse(cm, 2.75, 0.4, 0.2, 0, Math.PI * 2, false); const g = new THREE.ExtrudeGeometry(sg, { depth: 0.04, bevelEnabled: false, curveSegments: 32 });
    const m = new THREE.Mesh(g, M.w); m.position.set(0, 0, -(yf - 0.04)); add(m, { curved: true });   // the oval sign
    const e = new THREE.EllipseCurve(cm, 2.75, 0.33, 0.14).getPoints(32); for (let i = 0; i < 32; i++) L.push(V(e[i].x, yf - 0.05, e[i].y), V(e[i + 1].x, yf - 0.05, e[i + 1].y)); }
  // ----- side wings: porch below, room with a lean-to roof above, open to the middle bay inside
  for (const [xo, xi] of [[wx0, cx0], [wx1, cx1]]) {
    const a = Math.min(xo, xi), b = Math.max(xo, xi), s = Math.sign(xo - xi), pd = 1.0, wc = (a + b) / 2;
    const E = xo === wx1, yR = E ? yb - 1.2 : ywb;   // east wing: its rooms stop 1.2 m short of the back, an open balcony behind (back photo); west: the bridge lands at its back
    const pwin = [wc - 0.4, wc + 0.4, 0.9, 1.9];
    wallY(ywf + pd, a, b, 0, F2, [pwin]); gridWindow(L, ywf + pd - 0.01, ...pwin, 3, 5);   // back of the porch, an open window
    wallX(xo, ywf + pd + t, yR - t, 0, F2, [], -s * t); wallY(yR - t, a, b, 0, F2);              // ground-floor room: outer side and back
    box(a, b, ywf, ywf + pd, 0, 0.2, M.deck);                           // porch floor
    { const x = xo - s * 0.08; box(x - 0.08, x + 0.08, ywf, ywf + 0.16, 0, F2, M.w); box(x - 0.08, x + 0.08, ywf + pd - 0.16, ywf + pd, 0, F2, M.w); }   // corner posts
    const ra = s < 0 ? xo + 0.16 : a, rb = s < 0 ? b : xo - 0.16; box(ra, rb, ywf, ywf + 0.06, 0.95, 1.03, M.w); box(ra, rb, ywf, ywf + 0.06, 0.2, 0.26, M.w);   // front rail, post to wall
    for (let x = ra + 0.08; x < rb - 0.05; x += 0.11) box(x - 0.02, x + 0.02, ywf + 0.01, ywf + 0.05, 0.26, 0.95, M.w);   // balusters
    { const x = xo - s * 0.03; box(x - 0.03, x + 0.03, ywf + 0.16, ywf + pd - 0.16, 0.95, 1.03, M.w); box(x - 0.03, x + 0.03, ywf + 0.16, ywf + pd - 0.16, 0.2, 0.26, M.w);
      for (let y = ywf + 0.14; y < ywf + pd - 0.1; y += 0.11) box(x - 0.02, x + 0.02, y - 0.02, y + 0.02, 0.26, 0.95, M.w); }
    for (const [p, d] of [[xo - s * 0.16, -s], [xi, s]]) xzPrism([[p, F2], [p + d * 0.55, F2], [p, F2 - 0.55]], ywf, ywf + 0.07, M.w);   // wooden corner brackets in the porch opening (photo)
    const prof = s < 0 ? [[xo, B2], [xi, B2], [xi, WR], [xo, WE]] : [[xi, B2], [xo, B2], [xo, WE], [xi, WR]];
    const uw = [wc - 0.34, wc + 0.34, 3.0, 3.7];                         // 0.68 x 0.8 m
    wallY(ywf, a, b, B2, CW, [uw], t, M.siding, prof); gridWindow(L, ywf - 0.01, ...uw, 4, 5);
    const ow = E ? [(ywf + yR) / 2 - 0.4, (ywf + yR) / 2 + 0.4] : [ywf + 1.2, ywb - 1.2];
    wallX(xo, ywf + t, yR - t, B2, WE, [[ow[0], ow[1], 3.25, 3.97]], -s * t);   // outer side, an open window, as high as the wall lets it (Ahmed)
    { const g = new THREE.Mesh(new THREE.PlaneGeometry(ow[1] - ow[0], 0.72), M.glass); g.rotation.y = Math.PI / 2; g.position.copy(V(xo - s * t / 2, (ow[0] + ow[1]) / 2, 3.61)); add(g, { noEdge: true }); }
    const door = xo === wx0 ? [[xi - 0.9, xi - 0.1, B2 + 0.4, 4.3]] : [];   // bridge door: 0.8 m wide, 10 cm from the middle bay's wall (Ahmed), under the lean-to   // the bridge from the high ground comes in at the back of the west wing
    if (!E) wallY(ywb - t, a, b, B2, CW, door, t, M.siding, prof);
    else {   // east room's back wall, onto the balcony (back photo): a little house-shaped window near the outside, a pointed-arch doorway by the middle bay
      const win = pentPts(xo - 0.45, 0.46, 3.3, 3.8, 4.02), dr = gothicPts(xi + 0.38, 0.6, B2 + 0.02, 3.85);
      wallY(yR - t, a, b, B2, CW, [win, dr], t, M.siding, prof);
      { const f = 0.08, O = pentPts(xo - 0.45, 0.46 + 2 * f, 3.3 - f, 3.8, 4.02 + f * 1.3), fs = shapeOf(O); fs.holes.push(new THREE.Path(win.map(([x, z]) => new THREE.Vector2(x, z)))); faceMesh(fs, "y", yR, 0.04); }
      { const f = 0.09, O = gothicPts(xi + 0.38, 0.6 + 2 * f, B2 + 0.02, 3.85), I = dr.slice(1).concat([dr[0]]);   // frame: up the outside, back down the inside
        faceMesh(shapeOf([...O.slice(1), O[0], ...dr.slice().reverse()].filter((p, i, A) => i === 0 || p[0] !== A[i - 1][0] || p[1] !== A[i - 1][1])), "y", yR, 0.04); }
      // the balcony: rope-net rail on the back and the outer side, a capped corner post; open arches below
      netRail(L, "y", yb - 0.1, yb - 0.02, xi, xo - 0.12, B2, [(xi + xo - 0.12) / 2]);
      netRail(L, "x", xo - 0.1, xo - 0.02, yR, yb - 0.12, B2, []);
      box(xo - 0.12, xo, yb - 0.12, yb, B2, B2 + 1.08); box(xo - 0.14, xo + 0.02, yb - 0.14, yb + 0.02, B2 + 1.08, B2 + 1.12); cyl(xo - 0.06, yb - 0.06, 0.035, B2 + 1.12, B2 + 1.2);
      box(xo - 0.14, xo, yb - 0.14, yb, 0, F2);
      archBay(L, "y", yb - 0.11, yb - 0.02, xi, xo - 0.14, 1.45, F2); archBay(L, "x", xo - 0.11, xo - 0.02, yR, yb - 0.14, 1.45, F2);
      ornament(L, "x", xi, "moon", yb - 0.5, 4.55, 0.12); ornament(L, "x", xi, "star", yb - 0.5, 4.15, 0.09); ornament(L, "x", xi, "keyhole", yb - 0.5, 3.78, 0.12);   // cut-outs on the middle bay's side (photo)
      scallopBand("x", xi, yR, yb, CW, 0.16, 0.06);
    }
    { const xe = xo + s * 0.4, zAt = (x) => WE + (WR - WE) * (x - xo) / (xi - xo), ze = zAt(xe);
      xzPrism(s < 0 ? [[xe, ze], [xi, WR], [xi, WR + 0.12], [xe, ze + 0.12]] : [[xi, WR], [xe, ze], [xe, ze + 0.12], [xi, WR + 0.12]], ywf - 0.3, yR + 0.3, M.shingle); }   // lean-to stops at the middle wall, under the main eave, no clash
    wallX(xi, ywf, yR, WR, CW, [], -s * t);                                  // middle wall above the lean-to
    wallX(xi, yR, yb - t, 0, F2, [], -s * t); wallX(xi, yR, yb - t, B2, CW, [], -s * t);   // middle bay's side walls behind the wing
    awning(wc - 0.6, wc + 0.6, ywf, 0.4, 4.05, 0.3);
  }
  lines(L);
}

function details() {
  // lamps and benches come back once their places are agreed
}

// ---------- outlines: black edges on every crease, every seam where masses meet, and a silhouette on curved parts ----------
function hullMat(w) {
  const m = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
  const k = (w / 0.025 * 0.0034).toFixed(5);   // outline kept the same thin width on screen, near or far (Ahmed: legs looked thick up close)
  m.onBeforeCompile = (s) => { s.vertexShader = s.vertexShader.replace("#include <project_vertex>", `#include <project_vertex>
    { vec2 cn = (projectionMatrix * vec4(normalMatrix * normal, 0.0)).xy; if (dot(cn, cn) > 1e-8) { cn = normalize(cn); cn.x *= projectionMatrix[0][0] / projectionMatrix[1][1]; gl_Position.xy += cn * ${k} * gl_Position.w; } }`); };
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
