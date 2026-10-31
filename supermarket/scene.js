// Supermarket massing model (layout v3 + heights from the coloring page).
// Plan coords in metres: x along the front (0 = left corner), y depth (0 = main front wall, negative = street), z up.
// Three.js is y-up, so a plan point (x, y, z) maps to (x, z, -y).
import * as THREE from "three";

// ---------- dimensions ----------
export const D = {
  roof: 8.8,            // main body parapet (page: brick left of the block)
  rsTop: 8.8,           // right section: level with the main roof (Ahmed), not raised as on the page
  rsY: -5, rsX0: 73, rsX1: 114, rsBack: 10,
  blk: { x0: 73, x1: 89.8, y0: -5.5, y1: 7, h: 10.8 },
  canopy: { x0: 85.6, x1: 105.6, y0: -8.5, y1: -5, z0: 7.2, z1: 8.0, cols: [88.1, 92.3, 97.5, 102.6] },
  glass: { x0: 89.8, x1: 103.5 },
  panel: { x0: 104.3, x1: 109.6, h: 6.75 },
  low: { x0: 112, h: 7.8 },
  smallCanopy: { x0: 74.4, x1: 82.4, y0: -7.5, z0: 3.55, z1: 3.8 },
  annex: { x0: 6.1, x1: 18.6, y0: -3, y1: 3, h: 4.5 },
  band: 11 / 3,         // 11 brick rows, so the band top falls on a mortar line            // brick band with light stripes at the bottom of the side/back walls
};
const FOOT = [[0, 3], [18.6, 3], [18.6, 0], [73, 0], [73, -5], [114, -5], [114, 90.5], [93, 90.5], [93, 95.5], [82.7, 95.5], [82.7, 105], [0, 105]];

// ---------- black & white (coloring-book) mode ----------
// BW: every face white, outlines black, line-art textures; faces the page shows head-on take the page's own pixels.
let BW = false;
// page.png is the coloring page (1491 x 1055). Its front is near-orthographic: x = 73 m at page px 45, 36 px per metre, ground at py 770.
const PAGE = { W: 1491, H: 1055, x0: 45, mx: 73, s: 36, gy: 770 };
const pageUV = (x, z) => [(PAGE.x0 + PAGE.s * (x - PAGE.mx)) / PAGE.W, 1 - (PAGE.gy - PAGE.s * z) / PAGE.H];

// ---------- textures ----------
function canvasTex(w, h, draw, rep = true) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 8; return t;
}
function brickRows(g, w, h, rows, base, mortar, jitter = 18) {
  const rh = h / rows, bw = rh * 3;
  g.fillStyle = mortar; g.fillRect(0, 0, w, h);
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * bw / 2;
    for (let x = -bw; x < w + bw; x += bw) {
      const k = (Math.sin(r * 12.9 + x * 0.37) * 0.5 + 0.5) * jitter;
      g.fillStyle = `rgb(${base[0] - k},${base[1] - k * 0.6},${base[2] - k * 0.5})`;
      g.fillRect(x + off + 1, r * rh + 1, bw - 2, rh - 2);
    }
  }
}
// 4 m wide tiles; striped band covers exactly 0..band metres
const TEX = {};
function lineBrick(g, w, h, rowM, lenM, pxPerM, lw) {   // black mortar lines on white, stretcher bond
  g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.strokeStyle = "#000"; g.lineWidth = lw;
  const rh = rowM * pxPerM, bl = lenM * pxPerM, rows = Math.round(h / rh);
  for (let r = 0; r <= rows; r++) { const y = h - r * rh; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    if (r === rows) break;
    for (let x = (r % 2) * bl / 2; x <= w; x += bl) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - rh); g.stroke(); } }
}
function makeTexturesBW() {
  // brick like the page: rows 0.35 m, bricks 1.05 m (4 x 4.2 m tile)
  TEX.brick = canvasTex(512, 538, (g, w, h) => lineBrick(g, w, h, 0.35, 1.0, 128, 2));
  TEX.brickBand = canvasTex(512, 461, (g, w, h) => {                 // 4 x 3.6 m: brick + the light stripes from the photos (double lines)
    lineBrick(g, w, h, 0.3, 1.0, 128, 2);
    for (const z of [0.6, 1.5, 2.4, 3.3]) { const y = h - z * 128; g.fillStyle = "#fff"; g.fillRect(0, y - 9, w, 18); g.fillStyle = "#000"; g.fillRect(0, y - 10, w, 3); g.fillRect(0, y + 8, w, 3); }
  });
  TEX.beige = canvasTex(512, 512, (g, w, h) => lineBrick(g, w, h, 0.4, 0.8, 128, 1.3));   // split-face block on the side/back walls (photos)
  TEX.plant = canvasTex(512, 512, (g, w, h) => {                   // 4 x 4 m: grass tufts in line, for the planted beds
    g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.strokeStyle = "#000"; g.lineWidth = 2; g.lineCap = "round";
    let k = 1; const rnd = () => (k = (k * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 90; i++) { const x = rnd() * w, y = rnd() * h;
      for (const a of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * 12, y - Math.cos(a) * 14); g.stroke(); } }
  });
  TEX.plant.repeat.set(0.25, 0.25);
  TEX.white = TEX.asphalt = null;
  TEX.page = new THREE.TextureLoader().load(new URL("./page.png", import.meta.url).href); TEX.page.colorSpace = THREE.SRGBColorSpace; TEX.page.anisotropy = 8;
  TEX.logo = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h); const c = w / 2, r = c - 4;
    g.fillStyle = "#fff"; g.beginPath(); g.arc(c, c, r, 0, 7); g.fill();
    g.strokeStyle = "#000"; g.lineWidth = 3;
    for (let y = c - r + 14; y < c + r; y += 18) { const dx = Math.sqrt(Math.max(r * r - (y - c) ** 2, 0)); g.beginPath(); g.moveTo(c - dx, y); g.lineTo(c + dx, y); g.stroke(); }
    g.lineWidth = 6; g.beginPath(); g.arc(c, c, r, 0, 7); g.stroke();
  }, false);
}
function makeTextures() {
  TEX.brick = canvasTex(512, 512, (g, w, h) => brickRows(g, w, h, 48, [168, 72, 58], "#b9a89a"));               // 4 x 4 m
  TEX.brickBand = canvasTex(512, 461, (g, w, h) => {                                                            // 4 x 3.6 m, light stripes
    brickRows(g, w, h, 44, [160, 66, 55], "#b9a89a");
    g.fillStyle = "#e6dccb";
    for (const z of [0.55, 1.45, 2.35, 3.25]) g.fillRect(0, h - (z / 3.6) * h - 6, w, 11);
    g.fillStyle = "#ddd3c3"; g.fillRect(0, 0, w, 10);
  });
  TEX.beige = canvasTex(512, 512, (g, w, h) => brickRows(g, w, h, 20, [214, 196, 160], "#cbb894", 10));
  TEX.white = canvasTex(64, 64, (g, w, h) => { g.fillStyle = "#ecebe6"; g.fillRect(0, 0, w, h); });
  TEX.asphalt = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#8d8d8f"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { const v = 120 + Math.random() * 40; g.fillStyle = `rgb(${v},${v},${v + 2})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  });
  TEX.block = canvasTex(1024, 640, (g, w, h) => {      // SUPERMARKET block front, 16.8 x 10.5 m above the small canopy line
    g.fillStyle = "#d42e2a"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(90,10,10,0.55)"; g.lineWidth = 3;
    const cols = [0, 165 / 605, 355 / 605, 525 / 605, 1].map(f => f * w);
    cols.forEach(x => { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); });
    [0.06, 0.38, 0.62].forEach(f => { g.beginPath(); g.moveTo(0, f * h); g.lineTo(w, f * h); g.stroke(); });
    // SUPERMARKET: page x 0.8..12.1 m from the block's left, z 7.0..8.5 (texture covers z 4.1..11)
    const zt = v => h - ((v - 4.1) / 6.9) * h, xm = m => (m / 16.8) * w;
    g.font = `900 ${Math.round(zt(7.0) - zt(8.5))}px "DejaVu Sans", sans-serif`;
    g.textBaseline = "bottom"; g.lineJoin = "round";
    const tw = g.measureText("SUPERMARKET").width, sx = (xm(12.1) - xm(0.8)) / tw;
    g.save(); g.translate(xm(0.8), zt(7.0) + 4); g.scale(sx, 1);
    g.lineWidth = 12; g.strokeStyle = "#222"; g.strokeText("SUPERMARKET", 0, 0);
    g.fillStyle = "#ffffff"; g.fillText("SUPERMARKET", 0, 0); g.restore();
  }, false);
  TEX.panel = canvasTex(256, 330, (g, w, h) => {       // circle panel 5.3 x 6.75 m
    g.fillStyle = "#d42e2a"; g.fillRect(0, 0, w, h);
    const cx = w * 0.5, cy = h * (1 - 2.6 / 6.75), r = w * 0.27;
    g.fillStyle = "#a9483a"; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    g.strokeStyle = "#7d2b20"; g.lineWidth = 3;
    for (let y = cy - r; y < cy + r; y += 9) { const dx = Math.sqrt(Math.max(r * r - (y - cy) ** 2, 0)); g.beginPath(); g.moveTo(cx - dx, y); g.lineTo(cx + dx, y); g.stroke(); }
    g.strokeStyle = "#222"; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
  }, false);
  TEX.logo = canvasTex(256, 256, (g, w, h) => {        // round sign like the circle on the page (striped disc), no brand mark
    g.clearRect(0, 0, w, h); const c = w / 2, r = c - 4;
    g.fillStyle = "#d42e2a"; g.beginPath(); g.arc(c, c, r, 0, 7); g.fill();
    g.strokeStyle = "#8f1d1a"; g.lineWidth = 5;
    for (let y = c - r + 14; y < c + r; y += 18) { const dx = Math.sqrt(Math.max(r * r - (y - c) ** 2, 0)); g.beginPath(); g.moveTo(c - dx, y); g.lineTo(c + dx, y); g.stroke(); }
    g.strokeStyle = "#5a1210"; g.lineWidth = 6; g.beginPath(); g.arc(c, c, r, 0, 7); g.stroke();
  }, false);
}

// ---------- geometry helpers ----------
const V = (x, y, z) => new THREE.Vector3(x, z, -y);
function quad(a, b, c, d, mat, uv) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...d.toArray()], 3));
  const [u0, v0, u1, v1] = uv || [0, 0, 1, 1];
  g.setAttribute("uv", new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; return m;
}
// vertical wall from plan point A to B (outside is on the right when walking A->B), z0..z1, texture tile tw x th metres
function wall(root, A, B, z0, z1, mat, tw = 4, th = 4, vfix = false) {
  const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const uv = vfix ? [0, 0, len / tw, 1] : [0, z0 / th, len / tw, z1 / th];
  root.add(quad(V(A[0], A[1], z0), V(B[0], B[1], z0), V(B[0], B[1], z1), V(A[0], A[1], z1), mat, uv));
}
// side face (in the plane x) as one polygon in (y, z)
function sideFace(root, x, pts, mat) {
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([y, z]) => new THREE.Vector2(y, z))));
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const y = p.getX(i), z = p.getY(i); p.setXYZ(i, x, z, -y); uv.setXY(i, y / 4, z / 4); }
  g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); root.add(m); return m;
}
const M = {};
// front faces: in BW the UVs point at the page (page pixels), otherwise 0..1 over the face
function setUV(mesh, x0, x1, z0, z1) {
  let u0 = 0, v0 = 0, u1 = 1, v1 = 1;
  if (BW) { [u0, v0] = pageUV(x0, z0); [u1, v1] = pageUV(x1, z1); }
  mesh.geometry.attributes.uv.array.set([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1]);
}
function matsBW() {
  const L = (o) => new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, color: 0xffffff, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...o });
  const W = L({});
  M.brick = L({ map: TEX.brick }); M.band = L({ map: TEX.brickBand }); M.beige = L({ map: TEX.beige });
  M.page = L({ map: TEX.page });
  for (const k of ["white", "roof", "cap", "red", "glass", "frame", "dark", "metal", "asphalt", "walk", "grass", "mulch", "tree", "trunk", "trailer", "concrete", "ballRed"]) M[k] = W;
  M.block = M.panel = M.page;
  M.plant = L({ map: TEX.plant });
  M.line = new THREE.MeshBasicMaterial({ color: 0x000000 });
  M.logo = L({ map: TEX.logo, transparent: true, alphaTest: 0.5 });
}
function mats() {
  const L = (o) => new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, ...o });
  M.brick = L({ map: TEX.brick }); M.band = L({ map: TEX.brickBand }); M.beige = L({ map: TEX.beige });
  M.white = L({ color: 0xecebe6 }); M.roof = L({ color: 0xdedcd6 }); M.cap = L({ color: 0xe8e2d6 });
  M.block = L({ map: TEX.block }); M.red = L({ color: 0xd42e2a }); M.panel = L({ map: TEX.panel });
  M.glass = new THREE.MeshPhongMaterial({ color: 0x8fb3c9, specular: 0xffffff, shininess: 80 });
  M.frame = L({ color: 0xc9cdd1 }); M.dark = L({ color: 0x2b2f33 }); M.metal = L({ color: 0xb8bcbf });
  M.asphalt = L({ map: TEX.asphalt }); M.walk = L({ color: 0xd8d2c4 }); M.grass = M.plant = L({ color: 0x7fae5a });
  M.mulch = L({ color: 0x8a6a4a }); M.line = L({ color: 0xffffff }); M.tree = L({ color: 0x6d9e4f }); M.trunk = L({ color: 0x6b4f37 });
  M.trailer = L({ color: 0xf4f4f2 }); M.concrete = L({ color: 0xc8c6c0 }); M.logo = L({ map: TEX.logo, transparent: true, alphaTest: 0.5 });
  M.ballRed = new THREE.MeshPhongMaterial({ color: 0xd42e2a, shininess: 60 });
}
function box(root, x0, x1, y0, y1, z0, z1, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, z1 - z0, y1 - y0), mat);
  m.position.copy(V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); m.castShadow = m.receiveShadow = true; root.add(m); return m;
}
// parapet cap along an open path of the footprint (CCW order), d outside and inside the wall line, mitred corners, one piece
function capStrip(root, path, z, d, h) {
  const n = path.length, nrm = (i) => { const [ax, ay] = path[i], [bx, by] = path[i + 1], l = Math.hypot(bx - ax, by - ay); return [(by - ay) / l, -(bx - ax) / l]; };
  const off = path.map((P, i) => { const a = i > 0 ? nrm(i - 1) : nrm(0), b = i < n - 1 ? nrm(i) : nrm(n - 2);
    return [a[0] + b[0] - (a[0] * b[0] + a[1] * b[1]) * (i > 0 && i < n - 1 ? 0 : a[0]), a[1] + b[1] - (a[0] * b[0] + a[1] * b[1]) * (i > 0 && i < n - 1 ? 0 : a[1])]; });
  const pts = [...path.map((P, i) => [P[0] + off[i][0] * d, P[1] + off[i][1] * d]), ...path.map((P, i) => [P[0] - off[i][0] * d, P[1] - off[i][1] * d]).reverse()];
  slab(root, pts, z, z + h, M.cap);
}
function flat(root, pts, z, mat, tile = 4) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / tile, -p.getZ(i) / tile);
  const m = new THREE.Mesh(g, mat); m.position.y = z; m.receiveShadow = true; root.add(m); return m;
}
function slab(root, pts, z0, z1, mat) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: z1 - z0, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.position.y = z0; m.castShadow = m.receiveShadow = true; root.add(m); return m;
}
const TREES = [];   // (x, y, height): in BW each becomes the page's tree cut-out
function tree(root, x, y, h = 7, r = 2.4) {
  TREES.push([x, y, h]);
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, h * 0.5, 8), M.trunk); t.position.copy(V(x, y, h * 0.25)); t.castShadow = true; t.userData.tree = true; root.add(t);
  const c = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), M.tree); c.position.copy(V(x, y, h * 0.62)); c.scale.y = 1.15; c.castShadow = true; c.userData.tree = true; root.add(c);
}
function decal(root, x, y, z, size, normal, mat) {   // square image on a wall, facing `normal` ('-y' front, '+x', '-x', ...)
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.position.copy(V(x, y, z)); m.userData.noEdge = true;
  m.rotation.y = { "-y": 0, "+y": Math.PI, "+x": Math.PI / 2, "-x": -Math.PI / 2 }[normal];
  root.add(m);
}

// ---------- the building ----------
// brick band at the foot of the walls with recessed light grooves (photos 03, 09, 17): real 3D reveals, mitred at the corners.
// A->C walks with the outside on the left; nA / nC are the inward normals of the neighbouring walls (null = open end).
const GROOVES = [2 / 3, 5 / 3, 8 / 3, 10 / 3], GH = 0.12, GD = 0.06;   // centred on brick mortar lines, so no mortar line runs next to a groove edge
function bandWall(root, A, C, nA, nC, top = D.band) {
  const l = Math.hypot(C[0] - A[0], C[1] - A[1]), ni = [(C[1] - A[1]) / l, -(C[0] - A[0]) / l];
  const inset = (P, nb) => [P[0] + (ni[0] + (nb ? nb[0] : 0)) * GD, P[1] + (ni[1] + (nb ? nb[1] : 0)) * GD];
  const A2 = inset(A, nA), C2 = inset(C, nC);
  let z = 0;
  for (const g of GROOVES) {
    const g0 = g - GH / 2, g1 = g + GH / 2;
    wall(root, A, C, z, g0, M.brick);
    wall(root, A2, C2, g0, g1, M.white); root.children.at(-1).userData.noEdge = true;      // only the groove's two edges on the face are drawn
    for (const z of [g0, g1]) { root.add(quad(V(A[0], A[1], z), V(C[0], C[1], z), V(C2[0], C2[1], z), V(A2[0], A2[1], z), M.white)); root.children.at(-1).userData.noEdge = true; }
    z = g1;
  }
  wall(root, A, C, z, top, M.brick);
}
function building(root) {
  const B = D.band, R = D.roof;
  // walls of the main footprint, walking clockwise in plan (outside on the right)
  const pts = FOOT.slice().reverse();          // FOOT is CCW in plan -> reverse for outside-right
  const n = pts.length, nin = (k) => { const P = pts[(k + n) % n], Q = pts[(k + 1) % n], l = Math.hypot(Q[0] - P[0], Q[1] - P[1]); return [(Q[1] - P[1]) / l, -(Q[0] - P[0]) / l]; };   // inward normal of segment k
  for (let i = 0; i < pts.length; i++) {
    const A = pts[i], C = pts[(i + 1) % pts.length];
    const front = (A[1] <= 0 && C[1] <= 0 && A[1] === C[1]);   // front faces (y <= 0, parallel to x)
    if (A[0] === 73 && C[0] === 73) continue;                   // hidden behind the block's left side
    if (front && Math.min(A[0], C[0]) >= 73) {                  // right section front: one brick face up to its parapet, none behind the block
      const sx0 = D.canopy.cols[3] + 0.22, sx1 = D.panel.x0, sz = D.canopy.z0;   // recessed strip between the glass and the panel
      bandWall(root, [114, A[1]], [sx1, A[1]], nin(i - 1), null, R); wall(root, [sx1, A[1]], [sx0, A[1]], sz, R, M.brick); wall(root, [sx0, A[1]], [D.blk.x1, A[1]], 0, R, M.brick);
      continue;   // level with the roof (Ahmed: nothing raised above it)
    }
    if (front && A[0] >= 18.6) bandWall(root, A, C, nin(i - 1), nin(i + 1), R);          // brick all the way up: no seam at the band top
    else { bandWall(root, A, C, nin(i - 1), nin(i + 1)); wall(root, A, C, B, R, M.beige); }
  }
  flat(root, FOOT, R, M.roof, 6);
  // parapet cap
  capStrip(root, [[D.blk.x1, -5], [114, -5], [114, 90.5], [93, 90.5], [93, 95.5], [82.7, 95.5], [82.7, 105], [0, 105], [0, 3], [18.6, 3], [18.6, 0], [73, 0]], R, 0.15, 0.2);
  // light lower sections on the two sides (photos: plain white/cream panel along the side walls)
  if (!BW) { wall(root, [0, 62], [0, 30], 0.02, 3.8, M.white); root.children.at(-1).position.x -= 0.03;
    wall(root, [114, 8], [114, 40], 0.02, 3.8, M.white); root.children.at(-1).position.x += 0.03; }

  // right section: raised brick front (x 73..112 at 9.5, 112..114 at 7.8 as on the page)
  const y0 = D.rsY;
  // raised parapet over the entrance part (x blk.x1..112); the last 2 m stay at the main roof height, lower, as on the page

  // (2) SUPERMARKET block
  const b = D.blk;
  wall(root, [b.x0, b.y0], [b.x1, b.y0], 4.1, b.h, M.block, 1, 1, true);
  setUV(root.children.at(-1), b.x0, b.x1, 4.1, b.h);
  wall(root, [b.x0, b.y0], [b.x1, b.y0], 0, 4.1, M.white);
  sideFace(root, b.x0 - 0.02, [[b.y0, 0], [0, 0], [0, R], [b.y1, R], [b.y1, b.h], [b.y0, b.h]], M.red);   // one face each side: no seam line
  sideFace(root, b.x1, [[b.y0, 0], [y0, 0], [y0, R], [b.y1, R], [b.y1, b.h], [b.y0, b.h]], M.red);
  wall(root, [b.x1, b.y1], [b.x0, b.y1], R, b.h, M.red);
  flat(root, [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]], b.h, M.roof);
  if (!BW) box(root, b.x0, b.x1, b.y0 - 0.2, b.y0 + 0.1, b.h, b.h + 0.15, M.cap);
  // windows under the small canopy (white base, page: 4 bays)
  const sc = D.smallCanopy;
  for (let i = 0; i < 4; i++) { const x0 = sc.x0 + 0.5 + i * (sc.x1 - sc.x0 - 1) / 4, x1 = x0 + (sc.x1 - sc.x0 - 1) / 4 - 0.25; box(root, x0, x1, b.y0 - 0.05, b.y0, 0.6, 3.1, M.glass); }
  box(root, sc.x0, sc.x1, sc.y0, b.y0, sc.z0, sc.z1, M.white);    // (5) small canopy
  box(root, sc.x0, sc.x1, sc.y0 - 0.05, sc.y0, sc.z0, sc.z1, M.frame);

  // (3) entrance (Ahmed): the glass is at the front, under the canopy edge. The 4 "columns" are wide white metal
  // mullions in the glass plane, and a wide white band across the middle splits the ground floor (doors) from the upper glass.
  const c = D.canopy, cols = c.cols, yf = c.y0 + 0.6;
  const BAND = [2.8, 3.4], TOP = 6.9, PW = 0.22, ex0 = cols[0] - PW, ex1 = cols[3] + PW;          // band 0.6 m, piers 0.45 m (page)
  const glass = (A, B) => { wall(root, A, B, 0.3, TOP, M.glass); if (BW) root.children.at(-1).userData.noEdge = true; };   // the parts around it draw its outline
  glass([ex0, yf], [ex1, yf]);
  for (const [xs, back, dx] of [[ex0, D.blk.y0, 1], [ex1, y0, -1]]) {                       // side returns: glass, band and head flush with the corner pier
    glass([xs, back], [xs, yf + 0.2]);
    const xa = Math.min(xs, xs + dx * 0.3), xb = Math.max(xs, xs + dx * 0.3);
    box(root, xa, xb, yf + 0.2, back, BAND[0], BAND[1], M.white);
    box(root, xa, xb, yf + 0.2, back, TOP, c.z0, M.white);
    box(root, xa, xb, yf + 0.2, back, 0.15, 0.3, M.white);
    const xo = dx > 0 ? [xs - 0.08, xs] : [xs, xs + 0.08], ym = (yf + 0.2 + back) / 2;           // mullion, door head and door split as on the front
    box(root, xo[0], xo[1], ym - 0.06, ym + 0.06, BAND[1], TOP, M.white);
    box(root, xo[0], xo[1], yf + 0.2, back, 2.2, 2.35, M.white);
    box(root, xo[0], xo[1], ym - 0.07, ym + 0.07, 0.3, 2.2, M.white);
  }
  for (const x of cols) box(root, x - PW, x + PW, yf - 0.2, yf + 0.2, 0.15, c.z0, M.white);   // white metal piers
  for (const [z0, z1] of [BAND, [TOP, c.z0], [0.15, 0.3]]) for (let i = 0; i < 3; i++) box(root, cols[i] + PW, cols[i + 1] - PW, yf - 0.15, yf + 0.15, z0, z1, M.white);   // band, head, sill between the piers
  for (let i = 0; i < 3; i++) {
    const a = cols[i] + PW, b = cols[i + 1] - PW, up = i === 0 ? 2 : 3;                         // upper panes per bay, as on the page
    for (let k = 1; k < up; k++) { const x = a + (b - a) * k / up; box(root, x - 0.06, x + 0.06, yf - 0.08, yf, BAND[1], TOP, M.white); }
    box(root, a, b, yf - 0.08, yf, 2.2, 2.35, M.white);                                         // door head
    for (let k = 1; k < 4; k++) { const x = a + (b - a) * k / 4; box(root, x - 0.07, x + 0.07, yf - 0.08, yf, 0.3, 2.2, M.white); }   // door leaves
  }
  box(root, c.x0, c.x1, c.y0, c.y1, c.z0, c.z1, M.white);
  box(root, c.x0 - 0.05, c.x1 + 0.05, c.y0 - 0.05, c.y0, c.z0, c.z1, M.frame);
  if (!BW) for (let x = c.x0 + 1; x < c.x1; x += 1.7) box(root, x - 0.15, x + 0.15, c.y0 + 0.2, c.y0 + 0.5, c.z0 - 0.02, c.z0, M.dark);   // canopy lights
  // (6) panel with the circle
  const p = D.panel;
  box(root, p.x0, p.x1, y0 - 0.3, y0, 0.15, c.z0, M.red);                                    // top level with the canopy underside (photo)
  const lines = [], seg = (P, Q) => lines.push(V(...P), V(...Q));
  if (BW) {   // panel joints as in the photo (Ahmed's sketch) + the striped circle; the page's own panel lines are left out
    const pf = y0 - 0.31, xv = p.x0 + 0.39 * (p.x1 - p.x0), zf = (f) => c.z0 - f * (c.z0 - 0.15);
    seg([xv, pf, 0.15], [xv, pf, c.z0]);
    for (const f of [0.146, 0.4, 0.86]) seg([p.x0, pf, zf(f)], [p.x1, pf, zf(f)]);
    seg([p.x0, pf, zf(0.65)], [xv, pf, zf(0.65)]);
    decal(root, p.x0 + 0.7 * (p.x1 - p.x0), pf - 0.01, zf(0.66), 2.5, "-y", M.logo);
  } else {
    wall(root, [p.x0, y0 - 0.31], [p.x1, y0 - 0.31], 0.15, p.h, M.panel, 1, 1, true);
    setUV(root.children.at(-1), p.x0, p.x1, 0.15, p.h);
  }
  // recessed strip between the glass and the panel (photo): a slot in the wall, grooves running from the face to the back and across
  const sd = 0.5, sx0 = ex1, sx1 = p.x0, yk = y0 + sd;                                       // brick, with the band grooves carried through (Ahmed)
  const nB = [0, 1], nL = [-1, 0], nR = [1, 0];                                               // inward normals of back, left and right faces
  bandWall(root, [sx1, yk], [sx0, yk], nR, nL, c.z0); bandWall(root, [sx0, yk], [sx0, y0], nB, null, c.z0); bandWall(root, [sx1, y0], [sx1, yk], null, nB, c.z0);
  flat(root, [[sx0, y0], [sx1, y0], [sx1, yk], [sx0, yk]], c.z0, M.white);
  root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), new THREE.LineBasicMaterial({ color: 0x000000 })));
  // bollards + red balls on the sidewalk
  for (let x = 89; x <= 104; x += 2.5) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1, 12), M.metal); m.position.copy(V(x, -9.6, 0.65)); m.castShadow = true; root.add(m); }
  for (const x of (BW ? [] : [84, 110, 6, 25])) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.65, 20, 14), M.ballRed); m.position.copy(V(x, x < 50 ? -6.5 : -12.8, 0.8)); m.castShadow = true; root.add(m); }

  // (4) low box at the left corner, windows on its front
  const a = D.annex;
  for (const [A, C] of [[[a.x0, a.y0], [a.x1, a.y0]], [[a.x0, a.y1], [a.x0, a.y0]], [[a.x1, a.y0], [a.x1, 0]]]) wall(root, A, C, 0, a.h, M.beige);
  flat(root, [[a.x0, a.y0], [a.x1, a.y0], [a.x1, a.y1], [a.x0, a.y1]], a.h, M.roof);
  capStrip(root, [[a.x0, a.y1], [a.x0, a.y0], [a.x1, a.y0], [a.x1, 0]], a.h, 0.1, 0.2);   // parapet on the three free sides only, stopping at the main walls
  box(root, 9.5, 17.5, a.y0 - 0.05, a.y0, 0.5, 2.9, M.glass);
  for (const x of [9.5, 11.5, 13.5, 15.5, 17.5]) box(root, x - 0.08, x + 0.08, a.y0 - 0.1, a.y0, 0.5, 2.9, M.frame);
  box(root, 9.2, 17.8, a.y0 - 0.9, a.y0, 2.95, 3.15, M.frame);  // small overhang

  // round sign on the left side wall near the front corner + on the right side near the back
  decal(root, -0.06, 11, 6.2, 4.4, "-x", M.logo);

  // (7) dock: 2 doors on the east-facing wall of the notch, trailers, compactor, brick screen wall
  for (const yy of [98.2, 102.2]) { box(root, 82.62, 82.7, yy - 1.5, yy + 1.5, 1.2, 4.0, M.dark); box(root, 83.8, 99.8, yy - 1.3, yy + 1.3, 1.2, 4.1, M.trailer); }
  box(root, 95, 100, 90.6, 94.4, 0, 2.6, M.beige);
  wall(root, [116, 105.4], [82.7, 105.4], 0, 4.0, M.brick); wall(root, [82.7, 105.0], [116, 105.0], 0, 4.0, M.brick);
  box(root, 82.7, 116, 105.0, 105.4, 4.0, 4.15, M.cap); box(root, 115.6, 116, 105, 105.4, 0, 4.0, M.brick);

}

// ---------- site ----------
function site(root) {
  flat(root, [[-45, -175], [200, -175], [200, 150], [-45, 150]], -0.02, M.grass, 4);
  flat(root, [[-14, -156], [178, -156], [178, 120], [-14, 120]], 0.0, M.asphalt, 6);
  flat(root, [[182, -175], [200, -175], [200, 150], [182, 150]], 0.0, M.asphalt, 6);
  flat(root, [[-45, -175], [182, -175], [182, -160], [-45, -160]], 0.0, M.asphalt, 6);
  flat(root, [[-24, -156], [-20, -156], [-20, 150], [-24, 150]], 0.01, BW ? M.grass : new THREE.MeshLambertMaterial({ color: 0x6f9fcf }), 4);
  slab(root, [[82.7, 95.5], [93, 95.5], [93, 90.5], [114, 90.5], [114, 85], [134, 85], [134, 110], [82.7, 110]], 0, 0.03, M.concrete);
  // sidewalk following the stepped front, with the entrance bulge
  slab(root, [[-4, 105], [-4, -12], [86, -12], [86, -15], [110, -15], [110, -12], [118, -12], [118, 90.5], [114, 90.5], [114, 3], [0, 3], [0, 105]], 0, 0.15, M.walk);   // one piece, no seam lines on the walk
  // where the sidewalk meets the building: a thin line (same weight as the other edges), so walk and wall read apart in black and white (Ahmed)
  const foot = [[0, 105], [0, 3], [6.1, 3], [6.1, -3], [18.6, -3], [18.6, 0], [72.98, 0], [72.98, -5.5], [87.88, -5.5], [87.88, -8.1], [102.82, -8.1], [102.82, -5], [104.3, -5], [104.3, -5.3], [109.6, -5.3], [109.6, -5], [114, -5], [114, 90.5]];   // entrance piers and the circle panel included
  const n = foot.length, nrm = (i) => { const [ax, ay] = foot[i], [bx, by] = foot[i + 1], l = Math.hypot(bx - ax, by - ay); return [(by - ay) / l, -(bx - ax) / l]; };
  const off = foot.map((P, i) => { const a = nrm(Math.max(i - 1, 0)), b = nrm(Math.min(i, n - 2)); return i > 0 && i < n - 1 ? [a[0] + b[0], a[1] + b[1]] : a; });
  const fo = foot.map((P, i) => [P[0] + off[i][0] * 0.06, P[1] + off[i][1] * 0.06]);
  for (let i = 0; i < n - 1; i++) flat(root, [foot[i], foot[i + 1], fo[i + 1], fo[i]], 0.17, M.line);   // one mitred quad per wall (clear of the walk top, no depth fight)
  // parking: double rows perpendicular to the front, stalls 2.7 x 5.5, aisles 7.3
  const lineAt = (x0, y0, x1, y1) => { const w = 0.12; flat(root, x0 === x1 ? [[x0 - w, y0], [x0 + w, y0], [x0 + w, y1], [x0 - w, y1]] : [[x0, y0 - w], [x1, y0 - w], [x1, y0 + w], [x0, y0 + w]], 0.02, M.line); };
  const rowsAt = (cx, ya, yb) => { lineAt(cx, ya, cx, yb); for (let y = ya; y <= yb + 0.01; y += 2.7) lineAt(cx - 5.5, y, cx + 5.5, y); };
  for (const bx of [0, 18.3, 36.6, 54.9, 73.2, 104, 122.3, 140.6, 158.9]) {
    for (const [ya, yb] of [[-83, -26], [-148, -90]]) {
      rowsAt(bx + 5.5, ya, yb);
      slab(root, [[bx, ya - 3.2], [bx + 11, ya - 3.2], [bx + 11, ya], [bx, ya]], 0, 0.15, M.plant);
      tree(root, bx + 5.5, ya - 1.6, 5.5, 1.6);
      if (yb === -26) slab(root, [[bx, yb], [bx + 11, yb], [bx + 11, yb + 3.2], [bx, yb + 3.2]], 0, 0.15, M.plant);   // planted head of the row, by the store
    }
  }
  for (const bx of [138, 156.3]) rowsAt(bx + 5.5, -6, 70);
  slab(root, [[93.5, -152], [99.5, -152], [99.5, -20], [93.5, -20]], 0, 0.15, M.walk);
  if (!BW) for (let y = -30; y > -146; y -= 14) { tree(root, 92, y, 6, 1.8); tree(root, 101, y, 6, 1.8); }   // the page keeps this aisle open
  slab(root, [[-14, -156], [178, -156], [178, -151], [-14, -151]], 0, 0.15, M.plant);
  for (let x = -8; x < 178; x += 16) tree(root, x, -153.5, 8, 2.6);
  slab(root, [[136, 72], [178, 72], [178, 76], [136, 76]], 0, 0.15, M.plant);
  for (let x = 140; x < 178; x += 10) tree(root, x, 74, 7, 2.2);
  // planters along the front (page foreground) + small trees by the left corner
  if (!BW) for (const [x0, x1] of [[30, 42], [52, 64]]) { slab(root, [[x0, -11], [x1, -11], [x1, -8], [x0, -8]], 0, 0.45, M.mulch); tree(root, (x0 + x1) / 2, -9.5, 6, 1.8); }
  slab(root, [[-12, -12], [-5, -12], [-5, 28], [-12, 28]], 0, 0.15, M.plant);   // bed by the left corner
  tree(root, -8.5, -8, 7, 2.2); tree(root, -8.5, 10, 7, 2.2);
}

export function buildScene(scene, opts = {}) {
  BW = !!opts.bw; TREES.length = 0;
  if (BW) { makeTexturesBW(); matsBW(); } else { makeTextures(); mats(); }
  const root = new THREE.Group(); building(root); site(root); scene.add(root);
  if (BW) return finishBW(scene, root);
  scene.background = new THREE.Color(0xcfe2f3);
  scene.add(new THREE.HemisphereLight(0xeaf2ff, 0x8a8577, 1.1));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.0);
  sun.position.copy(V(-60, -120, 110)); sun.target.position.copy(V(60, 40, 0)); scene.add(sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -170, right: 170, top: 170, bottom: -170, near: 1, far: 500 }); sun.shadow.bias = -0.0004;
  scene.add(sun);
  return root;
}
export { V };

// BW: black outlines on every edge where faces meet at an angle (like the page), soft even light, no shadows
function finishBW(scene, root) {
  const lm = new THREE.LineBasicMaterial({ color: 0x000000 }), add = [];
  root.traverse(o => {
    if (!o.isMesh || o.userData.tree || o.userData.noEdge) return;
    const g = o.geometry, n = g.attributes.position.count;
    if (o.material === M.line) return;
    const thr = g.type === "CylinderGeometry" ? 40 : 20;
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(g, thr), lm);
    e.position.copy(o.position); e.rotation.copy(o.rotation); e.scale.copy(o.scale); add.push([o.parent, e]);
  });
  for (const [p, e] of add) p.add(e);
  const trees = []; root.traverse(o => { if (o.userData.tree) trees.push(o); o.castShadow = o.receiveShadow = false; });
  for (const t of trees) t.parent.remove(t);   // no trees, bushes or cars in the BW model (Ahmed); standees() is kept for later
  scene.background = new THREE.Color(0xffffff);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xeeeeee, 2.4));
  const sun = new THREE.DirectionalLight(0xffffff, 0.6); sun.position.set(-40, 80, 70); scene.add(sun);
  return root;
}

// paper cut-outs from the page (coloring/standees.py): the page's tree, its two planters with bushes, its car.
// They turn to face the camera (call faceCamera before each render).
const STANDEES = [];
const ST = { tree: [6.0, 10.801], bush_a: [8.0, 2.305], bush_b: [5.0, 1.723], car: [2.013, 1.35] };
function standees(root) {
  const L = new THREE.TextureLoader(), mats = {};
  for (const k in ST) { const t = L.load(new URL(`./standees/${k}.png`, import.meta.url).href); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    mats[k] = new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide }); }
  const put = (k, x, y, s = 1) => { const [w, h] = ST[k]; const m = new THREE.Mesh(new THREE.PlaneGeometry(w * s, h * s), mats[k]);
    m.position.copy(V(x, y, h * s / 2 + (k === "car" ? 0.02 : 0.15))); m.userData.standee = true; root.add(m); STANDEES.push(m); };
  // the page's group in front of the entrance: back planter, front planter with the tree, the car in the aisle
  // bushes and the page tree only on the planted heads of the rows (x 73.2-84.2 and 54.9-65.9, y -26 to -22.8)
  put("bush_a", 78.7, -24.4); put("tree", 79.5, -24.6, 0.72); put("bush_b", 60.4, -24.4); put("car", 101.5, -25);
  for (const [x, y, h] of TREES) put("tree", x, y, h / 7.5);
  // a few more of the page's car in the stalls nearest the door
  for (const [x, y] of [[76, -33], [81.4, -38.4], [76, -46.5], [106.9, -35.7], [112.4, -44], [106.9, -51.1], [127.8, -30.3], [58, -41]]) put("car", x, y);
}
export function faceCamera(cam) { for (const m of STANDEES) m.rotation.y = Math.atan2(cam.position.x - m.position.x, cam.position.z - m.position.z); }
