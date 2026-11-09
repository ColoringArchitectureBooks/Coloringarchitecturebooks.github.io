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
  TEX.blockBW = canvasTex(2048, 816, (g, w, h) => {   // BW block front, clean vector lines (z 4.1..10.8), measured off the page grid
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h);
    const xm = m => (m / 16.8) * w, zt = v => h - ((v - 4.1) / 6.7) * h;
    g.strokeStyle = "#111"; g.lineWidth = 3;
    for (const m of [2.01, 4.51, 9.86, 12.47, 14.56]) { g.beginPath(); g.moveTo(xm(m), zt(10.5)); g.lineTo(xm(m), h); g.stroke(); }
    for (const z of [10.5, 9.5, 5.96]) { g.beginPath(); g.moveTo(0, zt(z)); g.lineTo(w, zt(z)); g.stroke(); }
    g.font = `900 ${Math.round(zt(7.0) - zt(8.5))}px "Arial Black", "Helvetica Neue", Arial, "DejaVu Sans", sans-serif`;
    g.textBaseline = "bottom"; g.lineJoin = "round";
    const tw = g.measureText("SUPERMARKET").width, sx = (xm(12.1) - xm(0.8)) / tw;
    g.save(); g.translate(xm(0.8), zt(7.0)); g.scale(sx, 1);
    g.lineWidth = 34; g.strokeStyle = "#ffffff"; g.strokeText("SUPERMARKET", 0, 0);   // clear the grid round the letters
    // raised letters: a dark offset copy reads as the letter depth, then the bold outlined face on top (Ahmed: thicker / 3D)
    for (let k = 1; k <= 10; k++) { g.lineWidth = 12; g.strokeStyle = "#111"; g.strokeText("SUPERMARKET", k, k); g.fillStyle = "#111"; g.fillText("SUPERMARKET", k, k); }
    g.lineWidth = 12; g.strokeStyle = "#111"; g.strokeText("SUPERMARKET", 0, 0); g.fillStyle = "#ffffff"; g.fillText("SUPERMARKET", 0, 0); g.restore();
  }, false);
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
  M.panel = M.page; M.block = L({ map: TEX.blockBW });
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
  M.panelPV = L({ color: 0x24324a }); M.trailer = L({ color: 0xf4f4f2 }); M.concrete = L({ color: 0xc8c6c0 }); M.logo = L({ map: TEX.logo, transparent: true, alphaTest: 0.5 });
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
// a tractor-trailer parked nose to +y, the trailer's back at yRear on the centre line x; every wheel stands on the ground (z 0)
function truck(root, x, yRear) {
  const y = yRear, wheel = (wx, wy, r = 0.5) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.32, 18), M.dark); m.rotation.z = Math.PI / 2; m.position.copy(V(wx, wy, r)); m.castShadow = true; root.add(m); };
  // trailer: box body, rear bumper, landing legs, tandem axles at the back
  box(root, x - 1.3, x + 1.3, y, y + 15.2, 1.25, 4.05, M.trailer);
  box(root, x - 1.2, x + 1.2, y + 0.1, y + 0.3, 0.55, 0.75, M.metal);
  for (const s of [-1, 1]) box(root, x + s * 0.95 - 0.07, x + s * 0.95 + 0.07, y + 11.8, y + 11.95, 0, 1.25, M.metal);
  for (const ay of [y + 1.5, y + 2.8]) for (const s of [-1, 1]) wheel(x + s * 1.0, ay);
  // tractor: chassis under the trailer's nose, cab with a windscreen, hood and bumper, steer axle and two drive axles
  box(root, x - 0.5, x + 0.5, y + 12.3, y + 18.6, 0.55, 1.05, M.metal);
  box(root, x - 1.25, x + 1.25, y + 15.4, y + 18.0, 1.05, 3.8, M.white);
  box(root, x - 1.1, x + 1.1, y + 17.98, y + 18.04, 2.3, 3.5, M.glass);
  box(root, x - 1.25, x + 1.25, y + 18.0, y + 18.6, 0.55, 1.8, M.white);
  for (const s of [-1, 1]) { box(root, x + s * 1.3 - 0.06, x + s * 1.3 + 0.06, y + 15.7, y + 16.9, 1.5, 3.0, M.metal); box(root, x + s * 0.95 - 0.35, x + s * 0.95 + 0.35, y + 13.4, y + 15.3, 0.6, 1.2, M.metal); }   // mirrors, fuel tanks
  for (const ay of [y + 12.9, y + 14.3, y + 17.4]) for (const s of [-1, 1]) wheel(x + s * 1.0, ay);
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
  if (BW) root.children.at(-1).geometry.attributes.uv.array.set([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);   // own clean texture, not the page scan
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
  if (BW) {   // where the canopy runs into the SUPERMARKET block: draw the meeting line (no shared edge there otherwise) (Ahmed)
    const yb = b.y0 - 0.02, pts = [];
    for (const z of [c.z0 - 0.02, c.z1 + 0.02]) pts.push(V(c.x0, yb, z), V(b.x1, yb, z), V(b.x1 + 0.01, b.y0, z), V(b.x1 + 0.01, c.y1, z));
    pts.push(V(c.x0, yb, c.z0), V(c.x0, yb, c.z1));
    root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x000000 })));
  }
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
  // (Ahmed) reversed: the doors face the service road behind the store, so a truck drives along the road, pulls past and backs straight in
  for (const xx of [102.5, 109]) { box(root, xx - 1.5, xx + 1.5, 90.42, 90.5, 1.2, 4.0, M.dark); truck(root, xx, 90.7); }   // two tractor-trailers backed onto the doors
  box(root, 94, 98.5, 90.6, 94.4, 0, 2.6, M.beige);   // compactor
  // (Ahmed) a long screen wall on the side facing the green area, hiding the trucks; the drive stays open to the service road
  wall(root, [117.4, 90.5], [117.4, 108], 0, 4.0, M.brick); wall(root, [117.8, 108], [117.8, 90.5], 0, 4.0, M.brick);
  box(root, 117.4, 117.8, 90.5, 108, 4.0, 4.15, M.cap); box(root, 117.4, 117.8, 107.6, 108, 0, 4.0, M.brick);

}

// ---------- site ----------
// ---------- plot and streets (Ahmed, as in the other models): only the plot shows, with a light fence on its edge; the two
// streets on its corner run on past it, with sidewalks on both sides. Plot x -14..183, y -156..120 (widened 5 m east for the row along the east fence, Ahmed).
// Front street: road y -174..-159 (dashes at -166.5), sidewalks -177..-174 and -159..-156. Side street: road x 186..201, sidewalks 183..186 and 201..204.
// Road top -0.03, sidewalks 0..0.15, the lot 0.
const PLOT = { x0: -14, x1: 183, y0: -156, y1: 120 };
// Site plan option A (Ahmed picked it): every customer drive sits exactly on a parking aisle (front: the aisles 84.2..92.1 and
// 115..122.3; side: the fire lane in front of the store, -22.8..-15). Trucks have their own drive at the back of the side street
// (105..117.3) onto a 7.3 m service and fire road that runs behind the store and down its west side to the fire lane, so the
// fire brigade can drive all the way round the building and trucks never cross the customers' lot. US right-hand traffic.
// Ahmed's mark-up: the walk runs between the two front drives, exit on its west side and entry on its east side; a second exit at the west corner on the
// aisle along the west fence; side drives on the fire lane, the cross aisle and the side lot's top aisle; trucks at the back.
const DRIVES = { front: [[-8.5, 0], [84.2, 92.1], [96.1, 104]], side: [[-91, -83], [-21.3, -13.5], [67.2, 74.5], [110, 117.3]] };   // the fire-lane drive is centred on the aisle between the front lot and the side lot (Ahmed)
// (Ahmed) a drive off a public street opens out toward the street (curb returns) so a car can turn in from its lane without
// running over the kerb: the fence and kerb opening is the drive plus a flare each side, and the planting is rounded off from
// the opening down to the aisle. Cars about 4 m each side; the truck drive more; none on the side touching the walk gate.
const FLARE = { front: [[0, 0], [0, 0], [0, 0]], side: [[0, 0], [0, 0], [0, 0], [6, 2.5]] };   // (Ahmed) cars: a small curb return at the sidewalk only (see streets()); trucks keep a wide one
const OPEN = (k, i) => { const [a, b] = DRIVES[k][i], [l, r] = FLARE[k][i]; return [a - l, b + r]; };
const OPENS = (k) => DRIVES[k].map((_, i) => OPEN(k, i));
const arcPts = (cx, cy, rx, ry, a0, a1, n = 10) => { const out = []; for (let i = 0; i <= n; i++) { const t = a0 + (a1 - a0) * i / n; out.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]); } return out; };
// soften a polygon's corners with small fillets (Ahmed: no sharp noses on the planting); corners on the plot's edge stay square
function roundPoly(pts, r = 0.9, keep = () => false) {   // keep(P): leave that corner square
  const n = pts.length, out = [], onEdge = ([x, y]) => x <= PLOT.x0 + 0.01 || x >= PLOT.x1 - 0.01 || y <= PLOT.y0 + 0.01 || y >= PLOT.y1 - 0.01;
  for (let i = 0; i < n; i++) {
    const P = pts[i], A = pts[(i + n - 1) % n], B = pts[(i + 1) % n];
    const la = Math.hypot(A[0] - P[0], A[1] - P[1]), lb = Math.hypot(B[0] - P[0], B[1] - P[1]);
    const cross = (P[0] - A[0]) * (B[1] - P[1]) - (P[1] - A[1]) * (B[0] - P[0]);
    if (onEdge(P) || keep(P) || la < 0.05 || lb < 0.05 || Math.abs(cross) < 1e-6 * la * lb) { out.push(P); continue; }
    const d = Math.min(r, la / 2, lb / 2), p0 = [P[0] + (A[0] - P[0]) * d / la, P[1] + (A[1] - P[1]) * d / la], p1 = [P[0] + (B[0] - P[0]) * d / lb, P[1] + (B[1] - P[1]) * d / lb];
    for (let k = 0; k <= 6; k++) { const t = k / 6, u = 1 - t; out.push([u * u * p0[0] + 2 * u * t * P[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * P[1] + t * t * p1[1]]); }
  }
  return out;
}
const plantSlab = (root, pts, r, keep) => slab(root, roundPoly(pts, r, keep), 0, 0.15, M.plant);
// (Ahmed) an island at the end of a row: square (90 degrees) on the side that touches the stalls, rounded only where cars turn.
// stall: the y edge(s) the stalls sit against ("y0", "y1" or "both")
const island = (root, x0, x1, y0, y1, stall) => plantSlab(root, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], 0.9,
  ([, y]) => (stall !== "y1" && Math.abs(y - y0) < 0.01) || (stall !== "y0" && Math.abs(y - y1) < 0.01));
const GATE_SLIDE = { front: [1, -1, 1], side: [-1, -1, 1, -1] };   // sliding gates (Ahmed): which way each one rolls open along the fence
const FRONT_KIND = ["exit", "exit", "entry"];   // gaps in the fence, kerb and front planting
const SRV = { w0: -12, w1: -4.7, b0: 110, b1: 117.3 };   // service road: west leg x w0..w1 (y -22.8..b1), back leg y b0..b1 (x w0..178)
const WALK = [92.1, 96.1];   // the walk to the entrance, on the entrance axis, with a gate in the front fence
const minus = (a, b, gaps) => { const out = []; let s = a; for (const [g0, g1] of gaps) { if (g0 > s) out.push([s, g0]); s = g1; } if (b > s) out.push([s, b]); return out; };
function segs(root, list) {   // thin black lines, same weight as the model's edges
  const pts = []; for (const [a, b] of list) pts.push(V(...a), V(...b));
  root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x000000 })));
}
// light fence: slim posts every 3 m, a slim top rail, a bottom wire, pickets every 0.5 m (as on the fire station)
function fenceRun(root, a, b, h = 1.6) {
  const [x0, y0] = a, [x1, y1] = b, L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / 3)), s = [], t = 0.025;
  y0 === y1 ? box(root, Math.min(x0, x1), Math.max(x0, x1), y0 - t, y0 + t, h - 0.05, h, M.white) : box(root, x0 - t, x0 + t, Math.min(y0, y1), Math.max(y0, y1), h - 0.05, h, M.white);
  for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n; box(root, x - 0.035, x + 0.035, y - 0.035, y + 0.035, 0, h + 0.05, M.white); }
  s.push([[x0, y0, 0.15], [x1, y1, 0.15]]);
  for (let d = 0.5; d < L - 0.1; d += 0.5) { const x = x0 + (x1 - x0) * d / L, y = y0 + (y1 - y0) * d / L; s.push([[x, y, 0.15], [x, y, h - 0.05]]); }
  segs(root, s);
}
// sliding gate: a fence panel as long as the opening, rolled open along the inside of the fence (dir +1/-1), and its track across the opening
function slidingGate(root, along, g0, g1, dir) {
  const P = PLOT, w = g1 - g0, a = g0 + dir * w, b = g1 + dir * w;
  if (along === "x") { const y = P.y0 + 0.35; fenceRun(root, [a, y], [b, y], 1.8); box(root, a, b, y - 0.03, y + 0.03, 0.08, 0.16, M.white); segs(root, [[[g0, P.y0 + 0.35, 0.01], [g1, P.y0 + 0.35, 0.01]]]); }
  else { const x = P.x1 - 0.35; fenceRun(root, [x, a], [x, b], 1.8); box(root, x - 0.03, x + 0.03, a, b, 0.08, 0.16, M.white); segs(root, [[[x, g0, 0.01], [x, g1, 0.01]]]); }
}
function plotFence(root) {
  const P = PLOT;
  OPENS("front").forEach(([a, b], k) => slidingGate(root, "x", a, b, GATE_SLIDE.front[k]));
  OPENS("side").forEach(([a, b], k) => slidingGate(root, "y", a, b, GATE_SLIDE.side[k]));
  const FG = [...OPENS("front"), WALK].sort((a, b) => a[0] - b[0]);
  for (const [a, b] of minus(P.x0, P.x1, FG)) fenceRun(root, [a, P.y0], [b, P.y0]);
  box(root, WALK[1] - 0.08, WALK[1] + 0.08, P.y0 - 0.08, P.y0 + 0.08, 0, 1.8, M.white);   // the walk gate's far post (the near one is the drive's)
  for (const [a, b] of minus(P.y0, P.y1, OPENS("side"))) fenceRun(root, [P.x1, a], [P.x1, b]);
  fenceRun(root, [P.x1, P.y1], [P.x0, P.y1]); fenceRun(root, [P.x0, P.y1], [P.x0, P.y0]);
  for (const [g0, g1] of OPENS("front")) for (const x of [g0, g1]) box(root, x - 0.08, x + 0.08, P.y0 - 0.08, P.y0 + 0.08, 0, 1.8, M.white);   // drive posts
  for (const [g0, g1] of OPENS("side")) for (const y of [g0, g1]) box(root, P.x1 - 0.08, P.x1 + 0.08, y - 0.08, y + 0.08, 0, 1.8, M.white);
}
function streets(root) {
  const E = 230, W = -40, N = 150, S = -200;   // the streets end a little past the plot and the junction (Ahmed)
  flat(root, [[W, -177], [183, -177], [183, S], [204, S], [204, -177], [E, -177], [E, -156], [204, -156], [204, N], [183, N], [183, -156], [W, -156]], -0.03, M.asphalt, 6);   // both roads in one piece
  const kerb = (pts) => slab(root, pts, 0, 0.15, M.walk);
  const RK = 2.2;   // (Ahmed) small curb return where the sidewalk meets each drive, at the road edge
  for (const [a, b] of minus(W, 186, OPENS("front"))) { const r = Math.min(RK, (b - a) / 2 - 0.02);   // the short piece at the walk between the two drives keeps both returns
    kerb([...(b < 185.9 ? arcPts(b - r, -159 + r, r, r, -Math.PI / 2, 0) : [[b, -159]]), [b, -156], [a, -156], ...(a > W + 0.1 ? arcPts(a + r, -159 + r, r, r, Math.PI, 1.5 * Math.PI) : [[a, -159]])]); }       // plot-side sidewalks, cut at the drives
  for (const [a, b] of minus(-156, N, OPENS("side"))) kerb([[183, a], ...(a > -155.9 ? arcPts(186 - RK, a + RK, RK, RK, -Math.PI / 2, 0) : [[186, a]]), ...(b < N - 0.1 ? arcPts(186 - RK, b - RK, RK, RK, 0, Math.PI / 2) : [[186, b]]), [183, b]]);
  kerb([[W, -177], [183, -177], [183, S], [186, S], [186, -174], [W, -174]]);                                   // the three other corners
  kerb([[201, N], [201, -159], [E, -159], [E, -156], [204, -156], [204, N]]);
  kerb([[201, S], [204, S], [204, -177], [E, -177], [E, -174], [201, -174]]);
  const d = [];
  for (let x = W + 2; x < E - 4; x += 8) if (x + 4 < 185 || x > 202) d.push([[x, -166.5, 0.01], [x + 4, -166.5, 0.01]]);
  for (let y = S + 2; y < N - 4; y += 8) if (y + 4 < -178 || y > -155) d.push([[193.5, y, 0.01], [193.5, y + 4, 0.01]]);
  segs(root, d);
  plotFence(root);
}

// ---------- parking (Ahmed: cart corrals, accessible stalls, working aisles) ----------
// Front lot: 9 double rows (bx .. bx+11, centre line bx+5.5), stalls 2.7 wide x 5.5 deep. Upper block y -83..-26, lower -148..-91;
// the cross aisle between them is -91..-83 (8 m, was 3.8 m). The walk (WALK) runs from the front gate to the store, with
// zebra crossings over the cross aisle and the fire lane. 18 accessible stalls (2% of ~850), 4 of them van stalls, on the two
// rows either side of the walk nearest the door. A cart corral in the middle of every row block (one per ~45 stalls).
const ACC = [['S', 2.5], ['A', 2.5], ['S', 2.5], ['S', 2.5], ['A', 1.5], ['S', 2.5], ['S', 2.5], ['A', 1.5], ['S', 2.5], ['S', 2.5], ['A', 1.5], ['S', 2.5], ['S', 2.5], ['A', 1.5]];   // from the store end: 2 van + 7 stalls
let ISA = null;
function isaMat() {   // the wheelchair symbol, black on clear (BW) / white on blue (colour)
  if (ISA) return ISA;
  const t = canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    if (!BW) { g.fillStyle = "#1f5fbf"; g.fillRect(8, 8, w - 16, h - 16); }
    const c = BW ? "#111" : "#ffffff"; g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 16; g.lineCap = "round"; g.lineJoin = "round";
    if (BW) { g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20); g.lineWidth = 16; }
    g.beginPath(); g.arc(118, 52, 17, 0, 7); g.fill();                                   // head
    g.beginPath(); g.moveTo(112, 80); g.lineTo(104, 150); g.lineTo(160, 150); g.lineTo(178, 206); g.lineTo(198, 198); g.stroke();   // body, seat, leg
    g.beginPath(); g.moveTo(108, 112); g.lineTo(156, 112); g.stroke();                    // arm
    g.beginPath(); g.arc(112, 170, 46, -0.6, 3.6); g.stroke();                             // wheel
  }, false);
  ISA = new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
  return ISA;
}
function groundSymbol(root, x, y, z, size) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), isaMat()); m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI / 2;
  m.position.copy(V(x, y, z)); m.userData.noEdge = true; root.add(m);
}
function stallSign(root, x, y, face) {   // post at the head of an accessible stall, plate facing the aisle (face +1 = +x)
  box(root, x - 0.03, x + 0.03, y - 0.03, y + 0.03, 0, 2.1, M.white);
  box(root, x - 0.015, x + 0.015, y - 0.23, y + 0.23, 1.45, 2.05, M.white);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), isaMat()); m.position.copy(V(x + face * 0.02, y, 1.8)); m.rotation.y = face * Math.PI / 2; m.userData.noEdge = true; root.add(m);
}
// a shopping cart standing on the surface at height z0, pointing +x (handle at the -x end) or -x (dir -1)
function cart(root, x, y, z0 = 0, dir = 1) {
  const L = 0.9, W = 0.55, x0 = dir > 0 ? x : x - L, x1 = x0 + L, hx = dir > 0 ? x0 : x1;
  box(root, x0 + 0.05, x1, y - W / 2, y + W / 2, z0 + 0.45, z0 + 0.9, M.white);           // basket
  box(root, x0 + 0.12, x1 - 0.05, y - 0.22, y + 0.22, z0 + 0.14, z0 + 0.17, M.white);       // bottom tray
  box(root, hx - 0.03, hx + 0.03, y - W / 2, y + W / 2, z0 + 0.98, z0 + 1.02, M.white);     // handle
  for (const yy of [y - W / 2 + 0.03, y + W / 2 - 0.03]) box(root, hx - 0.015, hx + 0.015, yy - 0.015, yy + 0.015, z0 + 0.9, z0 + 1.0, M.white);
  for (const xx of [x0 + 0.12, x1 - 0.08]) for (const yy of [y - 0.2, y + 0.2]) {          // wheels touch the surface
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12), M.metal); w.rotation.x = Math.PI / 2; w.position.copy(V(xx, yy, z0 + 0.06)); root.add(w);
    box(root, xx - 0.01, xx + 0.01, yy - 0.01, yy + 0.01, z0 + 0.12, z0 + 0.45, M.white);
  }
}
// cart corral in one stall slot: open to the aisle (side aisleX), closed at the head, rails at 0.5 and 1.0 m, a sign on the closed end
function corral(root, xa, xb, y0, open) {   // xa..xb along the stall depth, y0..y0+2.7 across; open: -1 = open at xa, +1 = open at xb
  const ya = y0 + 0.25, yb = y0 + 2.45, xs = open < 0 ? xa + 0.3 : xa + 0.6, xe = open < 0 ? xb - 0.6 : xb - 0.3, xh = open < 0 ? xe : xs;
  for (const yy of [ya, yb]) {
    for (const z of [0.5, 1.0]) box(root, xs, xe, yy - 0.025, yy + 0.025, z - 0.025, z + 0.025, M.white);
    for (const xx of [xs, (xs + xe) / 2, xe]) box(root, xx - 0.04, xx + 0.04, yy - 0.04, yy + 0.04, 0, 1.05, M.white);
  }
  for (const z of [0.5, 1.0]) box(root, xh - 0.025, xh + 0.025, ya, yb, z - 0.025, z + 0.025, M.white);   // closed end
  box(root, xh - 0.015, xh + 0.015, ya + 0.3, yb - 0.3, 1.15, 1.65, M.white);                              // "cart return" sign plate
  box(root, xh - 0.03, xh + 0.03, ya + 0.3 - 0.03, ya + 0.3 + 0.03, 1.0, 1.65, M.white); box(root, xh - 0.03, xh + 0.03, yb - 0.3 - 0.03, yb - 0.3 + 0.03, 1.0, 1.65, M.white);
  const yc = y0 + 1.35, d = -open;                                                                          // three nested carts, handles to the aisle
  for (let k = 0; k < 3; k++) { const hx = (open < 0 ? xs + 0.25 : xe - 0.25) + d * k * 0.32; cart(root, hx, yc, 0, d); }
}

// ---------- curb ramps, EV chargers, bike racks, order pickup (Ahmed; after US big-box stores, e.g. Target: Electrify America
// DC fast chargers on the lot, inverted-U bike racks by the doors, signed and numbered Drive Up stalls near the entrance) ----------
const tri = (root, a, b, c, mat = M.walk) => root.add(quad(a, b, c, c, mat));
// a ramp from the road (zero at yFoot) up to the kerb top (0.15 at yTop), x0..x1 wide, with a truncated-dome band at the foot
function curbRamp(root, x0, x1, yFoot, yTop) {
  const h = 0.15;
  root.add(quad(V(x0, yFoot, 0.001), V(x1, yFoot, 0.001), V(x1, yTop, h), V(x0, yTop, h), M.walk));
  for (const x of [x0, x1]) tri(root, V(x, yFoot, 0), V(x, yTop, 0), V(x, yTop, h));
  const d = Math.sign(yTop - yFoot), s = [];
  for (let k = 0; k < 4; k++) { const y = yFoot + d * (0.1 + k * 0.15), z = h * (0.1 + k * 0.15) / Math.abs(yTop - yFoot) + 0.01;
    for (let x = x0 + 0.15; x < x1 - 0.1; x += 0.2) s.push([[x - 0.04, y, z], [x + 0.04, y, z]]); }
  segs(root, s);
}
const TXT = {};
function textMat(key, lines, w = 256, h = 256, frame = true) {   // black words on white (a sign) or on clear (paint on the ground)
  if (TXT[key]) return TXT[key];
  const t = canvasTex(w, h, (g) => {
    g.clearRect(0, 0, w, h);
    if (frame) { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.strokeStyle = "#111"; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12); }
    g.fillStyle = "#111"; g.textAlign = "center"; g.textBaseline = "middle";
    lines.forEach(([txt, size], i) => { g.font = `900 ${size}px "Arial Black", Arial, "DejaVu Sans", sans-serif`; g.fillText(txt, w / 2, h * (i + 0.5) / lines.length); });
  }, false);
  return (TXT[key] = new THREE.MeshBasicMaterial({ map: t, transparent: !frame, alphaTest: frame ? 0 : 0.4, side: THREE.DoubleSide }));
}
function groundText(root, mat, x, y, w, h, rot) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.rotation.x = -Math.PI / 2; m.rotation.z = rot; m.position.copy(V(x, y, 0.03)); m.userData.noEdge = true; root.add(m); }
function signPlate(root, mat, x, y, z, w, h, face) {   // a plate facing +x (face 1) or -x (face -1)
  box(root, x - 0.015, x + 0.015, y - w / 2, y + w / 2, z - h / 2, z + h / 2, M.white);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.04, h - 0.04), mat); m.position.copy(V(x + face * 0.02, y, z)); m.rotation.y = face * Math.PI / 2; m.userData.noEdge = true; root.add(m);
}
const bollard = (root, x, y, z0 = 0, h = 1.0) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, h, 12), M.metal); m.position.copy(V(x, y, z0 + h / 2)); root.add(m); };
// stall k (0 = nearest the store) of an upper-block row: centre y
const stallY = (k) => -26.3 - 1.35 - 2.7 * k;
// EV: 4 DC fast chargers on the centre line of the first row on the left (bay 0), each serving the stall on both sides = 8 EV stalls
function evChargers(root) {
  const cx = 5.5;
  for (let k = 0; k < 4; k++) {
    const y = stallY(k);
    slab(root, [[cx - 0.6, y - 0.9], [cx + 0.6, y - 0.9], [cx + 0.6, y + 0.9], [cx - 0.6, y + 0.9]], 0, 0.12, M.concrete);   // pad
    box(root, cx - 0.25, cx + 0.25, y - 0.35, y + 0.35, 0.12, 2.35, M.white);                                               // charger cabinet
    box(root, cx - 0.27, cx + 0.27, y - 0.37, y + 0.37, 2.35, 2.45, M.white);                                               // cap
    for (const f of [-1, 1]) {                                                                                                // a screen and a holstered cable on each face
      box(root, cx + f * 0.25 - 0.01, cx + f * 0.25 + 0.01, y - 0.22, y + 0.22, 1.35, 1.85, M.dark);
      box(root, cx + f * 0.25 - 0.06, cx + f * 0.25 + 0.06, y - 0.08, y + 0.08, 0.95, 1.15, M.dark);
      segs(root, [[[cx + f * 0.31, y, 1.05], [cx + f * 0.45, y + 0.15, 0.6]], [[cx + f * 0.45, y + 0.15, 0.6], [cx + f * 0.3, y + 0.3, 0.3]]]);
      groundText(root, textMat("ev", [["EV", 150]], 256, 256, false), cx + f * 3.0, y, 1.6, 1.6, f * Math.PI / 2);
    }
    for (const dy of [-0.8, 0.8]) bollard(root, cx, y + dy, 0.12, 0.9);
  }
  signPlate(root, textMat("evs", [["EV", 120], ["CHARGING", 40], ["ONLY", 40]], 256, 320), cx + 0.03, stallY(4) + 0.6, 1.9, 0.5, 0.62, 1);
  box(root, cx - 0.03, cx + 0.03, stallY(4) + 0.57, stallY(4) + 0.63, 0, 2.2, M.white);
}
// bike racks: 5 inverted-U racks on the sidewalk right of the entrance, 0.9 m apart, set along the walk
function bikeRacks(root) {
  const z = 0.15, s = [];
  for (let k = 0; k < 5; k++) {
    const x = 110.6 + k * 0.85, y0 = -9.8, y1 = -9.0, top = z + 0.85;
    for (const y of [y0, y1]) box(root, x - 0.025, x + 0.025, y - 0.025, y + 0.025, z, top - 0.1, M.metal);
    box(root, x - 0.025, x + 0.025, y0, y1, top - 0.1, top - 0.05, M.metal);
  }
  segs(root, s);
}
// order pickup (like Drive Up): the first 8 stalls of the next row east (bay 122.3, west half), each with a numbered sign
// at its head and its number painted at the aisle end; a "pickup" sign on the store sidewalk where staff come out
function orderPickup(root) {
  const cx = 127.8;   // bay 122.3, west half: its own row, across the aisle from the accessible stalls, still next to the door
  for (let k = 0; k < 8; k++) {
    const y = stallY(k), n = String(k + 1);
    box(root, cx - 0.18, cx - 0.12, y - 0.03, y + 0.03, 0, 2.5, M.white);
    signPlate(root, textMat("pu" + n, [["ORDER", 46], ["PICKUP", 46], [n, 110]], 256, 360), cx - 0.2, y, 2.0, 0.55, 0.78, -1);
    groundText(root, textMat("pn" + n, [[n, 200]], 256, 256, false), cx - 4.3, y, 1.4, 1.4, -Math.PI / 2);
  }
  box(root, 103.5, 103.56, -12.6, -12.54, 0.15, 2.6, M.white);
  signPlate(root, textMat("pus", [["ORDER", 46], ["PICKUP", 46], ["STAFF", 40], ["CROSSING", 40]], 256, 360), 103.59, -12.57, 2.1, 0.55, 0.78, 1);
}
function parking(root) {
  const lineAt = (x0, y0, x1, y1, w = 0.12) => flat(root, x0 === x1 ? [[x0 - w, y0], [x0 + w, y0], [x0 + w, y1], [x0 - w, y1]] : [[x0, y0 - w], [x1, y0 - w], [x1, y0 + w], [x0, y0 + w]], 0.02, M.line);
  const hatch = (xa, xb, y0, y1) => { const s = []; for (let t = 0; t < (xb - xa) + (y1 - y0); t += 0.6) {   // diagonal no-parking stripes inside a rectangle
      const p0 = [xa + Math.max(0, t - (y1 - y0)), y0 + Math.min(t, y1 - y0)], p1 = [xa + Math.min(t, xb - xa), y0 + Math.max(0, t - (xb - xa))];
      s.push([[p0[0], p0[1], 0.025], [p1[0], p1[1], 0.025]]); } segs(root, s); };
  // one double row: centre line, stall lines per half; acc = { half: -1|+1 } puts the accessible run at the store end of that half
  const rowsAt = (cx, ya, yb, acc, cor, only = 0) => {
    lineAt(cx, ya, cx, yb);
    for (const h of [-1, 1]) {
      if (only && h !== only) continue;
      const xa = h < 0 ? cx - 5.5 : cx, xb = h < 0 ? cx : cx + 5.5;
      if (acc && acc.half === h) {
        let y = yb; lineAt(xa, y, xb, y);
        for (const [k, w] of ACC) {
          const y1 = y - w;
          if (k === 'A') hatch(xa, xb, y1, y); else { groundSymbol(root, (xa + xb) / 2 + h * 0.6, y - w / 2, 0.03, 1.6); stallSign(root, h < 0 ? xb - 0.05 : xa + 0.05, y - w / 2, h); }
          lineAt(xa, y1, xb, y1); y = y1;
        }
        let k = 0; for (let yy = y - 2.7; yy >= ya - 0.01; yy -= 2.7) { lineAt(xa, yy, xb, yy); k++; }
        const last = y - k * 2.7; if (last - ya > 0.3) hatch(xa, xb, ya, last);
      } else for (let y = ya; y <= yb + 0.01; y += 2.7) lineAt(xa, y, xb, y);
      if (cor && cor.half === h) corral(root, xa, xb, cor.y0, h < 0 ? -1 : 1);
    }
  };
  const BAYS = [0, 18.3, 36.6, 54.9, 73.2, 104, 122.3, 140.6, 158.9];
  for (const bx of BAYS) {
    for (const [ya, yb] of [[-80.3, -26], [-148, -93.7]]) {
      const acc = yb === -26 && bx === 73.2 ? { half: 1 } : yb === -26 && bx === 104 ? { half: -1 } : null;   // the halves facing the walk's aisles
      const cor = { half: bx === 73.2 ? -1 : bx === 104 ? 1 : -1, y0: ya + 10 * 2.7 };
      rowsAt(bx + 5.5, ya, yb, acc, cor);
      if (yb !== -26) tree(root, bx + 5.5, ya - 1.6, 5.5, 1.6);   // planted head by the street (part of the front planting, see site())
      yb === -26 ? island(root, bx, bx + 11, -83, -80.3, "y1") : island(root, bx, bx + 11, -93.7, -91, "y0");   // island at the cross aisle (Ahmed)
      if (yb === -26) island(root, bx, bx + 11, yb, yb + 3.2, "y0");   // planted head of the row, by the store
    }
  }
  // side lot: rows on the same lines as the front lot's (Ahmed): bay 122.3 east half only (its west half is the aisle by the store), 140.6, 158.9
  for (const bx of [122.3, 140.6, 158.9]) {
    rowsAt(bx + 5.5, -8.8, 64, null, { half: 1, y0: -8.8 + 12 * 2.7 }, bx === 122.3 ? 1 : 0);   // starts on the line of the end of the store sidewalk, y -12 (Ahmed)
    const x0 = bx === 122.3 ? bx + 5.5 : bx;
    for (const [y0, y1, st] of [[-12, -8.8, "y1"], [64, 67.2, "y0"]]) island(root, x0, bx + 11, y0, y1, st);
  }
  // single row along the east fence (plot widened 5 m for it), on the same lines as the blocks and the side lot
  for (const [ya, yb] of [[-80.3, -26], [-148, -93.7], [-8.8, 64]]) {
    for (let y = ya; y <= yb + 0.01; y += 2.7) lineAt(177.5, y, 183, y);
    lineAt(177.5, ya, 177.5, yb, 0.06);
  }
  for (const [y0, y1, st] of [[-83, -80.3, "y1"], [-93.7, -91, "y0"], [-26, -22.8, "y0"], [-12, -8.8, "y1"], [64, 67.2, "y0"]]) island(root, 177.5, 183, y0, y1, st);
  // single row along the west fence, on the same lines as the blocks
  for (const [ya, yb] of [[-80.3, -26], [-148, -93.7]]) {
    for (let y = ya; y <= yb + 0.01; y += 2.7) lineAt(-14, y, -8.5, y);
    lineAt(-8.5, ya, -8.5, yb, 0.06);
  }
  island(root, -14, -8.5, -93.7, -80.3, "both"); island(root, -14, -8.5, -26, -22.8, "y0");
  tree(root, -11.25, -87, 7, 2.2);   // the cross aisle ends on a planted island with a tree, not an empty corner (Ahmed)
  // the walk: from the front gate to the fire lane, cut where it crosses the cross aisle; zebra crossings on both crossings
  // curb ramps (ADA: 1:12, 1.8 m for the 0.15 m kerb, 1.2 m wide minimum, a band of truncated domes at the foot) at both ends
  // of each crossing: cut into the walk, and into the store sidewalk in front of the walk
  slab(root, [[WALK[0], -156], [WALK[1], -156], [WALK[1], -92.8], [WALK[0], -92.8]], 0, 0.15, M.walk);
  slab(root, [[WALK[0], -81.2], [WALK[1], -81.2], [WALK[1], -21.8], [WALK[0], -21.8]], 0, 0.15, M.walk);
  curbRamp(root, WALK[0], WALK[1], -91, -92.8); curbRamp(root, WALK[0], WALK[1], -83, -81.2);
  curbRamp(root, WALK[0], WALK[1], -20, -21.8); curbRamp(root, WALK[0], WALK[1], -15, -13.2);
  for (const [y0, y1] of [[-91, -83], [-20, -15]]) for (let y = y0 + 0.4; y < y1 - 0.3; y += 1.0) flat(root, [[WALK[0] + 0.2, y], [WALK[1] - 0.2, y], [WALK[1] - 0.2, y + 0.5], [WALK[0] + 0.2, y + 0.5]], 0.02, M.line);
  evChargers(root); bikeRacks(root); orderPickup(root);
  solar(root);
}
// ---------- rooftop solar (Ahmed: like the real store's roof, four arrays in a 2 x 2 block in the middle) ----------
// measured off the aerial (reference/ahmed-outline-1.jpg): x 29..55 and 59..89, y 23..58 and 62..90. Rows run along x,
// tilted 10 degrees toward the street (south), 2 m deep on low racks, 3.2 m apart; module joints every 1 m.
function solar(root) {
  const R = D.roof, tilt = 10 * Math.PI / 180, dep = 2.0, zl = R + 0.35, zh = zl + dep * Math.sin(tilt), dy = dep * Math.cos(tilt), s = [];
  for (const [x0, x1] of [[29, 55], [59, 89]]) for (const [y0, y1] of [[23, 58], [62, 90]]) {
    for (let y = y0; y + dy <= y1 + 0.01; y += 3.2) {
      root.add(quad(V(x0, y, zl), V(x1, y, zl), V(x1, y + dy, zh), V(x0, y + dy, zh), M.panelPV || M.white));
      for (const [yy, z] of [[y + 0.1, zl], [y + dy - 0.1, zh]]) box(root, x0 + 0.3, x1 - 0.3, yy - 0.04, yy + 0.04, R, z - 0.02, M.white);   // racks
      for (let x = x0 + 1; x < x1 - 0.01; x += 1) s.push([[x, y, zl + 0.01], [x, y + dy, zh + 0.01]]);
      s.push([[x0, y + dy / 2, (zl + zh) / 2 + 0.01], [x1, y + dy / 2, (zl + zh) / 2 + 0.01]]);
    }
  }
  segs(root, s);
}
// paint: an arrow on the ground, at (x, y) pointing at angle a (radians, plan; 0 = +x), len long
function arrowPaint(root, x, y, a, len = 4.5, w = 0.3, head = 1.4, hw = 0.75) {
  const c = Math.cos(a), s = Math.sin(a), P = (u, v) => [x + u * c - v * s, y + u * s + v * c], L = len / 2;
  flat(root, [P(-L, -w / 2), P(L - head, -w / 2), P(L - head, -hw), P(L, 0), P(L - head, hw), P(L - head, w / 2), P(-L, w / 2)], 0.025, M.line);
}
const paintRect = (root, x0, y0, x1, y1) => flat(root, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], 0.025, M.line);
function serviceRoad(root) {
  const { w0, w1, b0, b1 } = SRV, c = (w0 + w1) / 2, cb = (b0 + b1) / 2, s = [];
  // planting either side of the road: the strip on the plot edge (west and back), the strip behind the store
  plantSlab(root, [[PLOT.x0, -22.8], [w0, -22.8], [w0, b1], [PLOT.x1, b1], [PLOT.x1, PLOT.y1], [PLOT.x0, PLOT.y1]]);
  slab(root, [[w1, -12], [-4, -12], [-4, 105], [82.7, 105], [82.7, b0], [w1, b0]], 0, 0.15, M.plant);
  { const f = FLARE.side[3][0]; plantSlab(root, [[118, 74.5], [PLOT.x1, 74.5], [PLOT.x1, b0 - f], ...arcPts(PLOT.x1 - f, b0 - f, f, f, 0, Math.PI / 2).slice(1), [118, b0]]); }   // rounded where the truck drive opens out   // green area between the side lot and the service road (Ahmed)
  for (let y = 0; y < 100; y += 14) tree(root, PLOT.x0 + 1, y, 6, 1.4);
  for (let x = 124; x < 176; x += 10) for (const y of [82, 100]) tree(root, x + (y > 90 ? 5 : 0), y, 7, 2.2);
  // edge lines and dashed centre line
  for (let y = -20; y < b0 - 4; y += 6) s.push([[c, y, 0.02], [c, y + 3, 0.02]]);
  for (let x = w1 + 3; x < PLOT.x1 - 3; x += 6) if (x + 3 < 82 || x > 119) s.push([[x, cb, 0.02], [x + 3, cb, 0.02]]);
  segs(root, s);
  // two-way, keep right: down the west leg the right lane is the west one
  arrowPaint(root, (w0 + c) / 2, 40, -Math.PI / 2); arrowPaint(root, (c + w1) / 2, 50, Math.PI / 2);
  arrowPaint(root, 30, (cb + b1) / 2, Math.PI); arrowPaint(root, 40, (b0 + cb) / 2, 0);
  arrowPaint(root, 155, (cb + b1) / 2, Math.PI); arrowPaint(root, 165, (b0 + cb) / 2, 0);
  const fl = textMat("fire", [["FIRE LANE", 70]], 512, 128, false);
  groundText(root, fl, c, 15, 6, 1.5, Math.PI / 2); groundText(root, fl, c, 80, 6, 1.5, Math.PI / 2); groundText(root, fl, 60, cb, 6, 1.5, 0);
  groundText(root, textMat("trk", [["TRUCKS", 70]], 512, 128, false), 150, cb, 5, 1.25, 0);
}
function trafficMarks(root) {
  // front drives, one way each (Ahmed): exit = stop bar across the whole drive, arrows out; entry = arrows in
  DRIVES.front.forEach(([a, b], k) => {
    const m = (a + b) / 2, q = (b - a) / 4;
    if (FRONT_KIND[k] === "exit") {
      paintRect(root, a + 0.2, -151.6, b - 0.2, -151.2);
      groundText(root, textMat("stop", [["STOP", 80]], 256, 128, false), m, -150.2, 2.8, 1.4, Math.PI);
      arrowPaint(root, m - q, -145, -Math.PI / 2); arrowPaint(root, m + q, -145, -Math.PI / 2);
    } else {
      groundText(root, textMat("enter", [["ENTER", 80]], 320, 128, false), m, -146.5, 3.5, 1.4, 0);
      arrowPaint(root, m - q, -152.5, Math.PI / 2); arrowPaint(root, m + q, -152.5, Math.PI / 2);
    }
  });
  // customer side drives, two-way: centre line, stop bar on the exit lane (leaving eastward keeps to the south lane)
  for (const [a, b] of DRIVES.side.slice(0, 3)) {
    const m = (a + b) / 2;
    segs(root, [[[175, m, 0.02], [183, m, 0.02]]]);
    paintRect(root, 180.2, a + 0.2, 180.6, m - 0.15);
    groundText(root, textMat("stop", [["STOP", 80]], 256, 128, false), 179.2, (a + m) / 2, 2.8, 1.4, -Math.PI / 2);
    arrowPaint(root, 175, (m + b) / 2, Math.PI); arrowPaint(root, 171, (a + m) / 2, 0);
  }
  arrowPaint(root, 60, -16.9, Math.PI); arrowPaint(root, 50, -20.9, 0);   // along the fire lane in front of the store
  { const [a, b] = DRIVES.side[3], m = (a + b) / 2;   // the truck drive
    segs(root, [[[181, m, 0.02], [183, m, 0.02]]]);
    paintRect(root, 180.2, a + 0.2, 180.6, m - 0.15);
  }
  // the streets: lane arrows (westbound on the plot side of the front street, southbound on the plot side of the side street)
  for (const x of [10, 140]) { arrowPaint(root, x, -162.75, Math.PI, 5); arrowPaint(root, x + 10, -170.25, 0, 5); }
  for (const y of [-100, 40]) { arrowPaint(root, 189.75, y, -Math.PI / 2, 5); arrowPaint(root, 197.25, y - 10, Math.PI / 2, 5); }
  // stop bars on the approaches to the junction (right-hand lanes)
  paintRect(root, 186.2, -155.4, 193.3, -154.9); paintRect(root, 193.7, -178.1, 200.8, -177.6);
  paintRect(root, 204.9, -166.3, 205.4, -159.2); paintRect(root, 181.6, -173.8, 182.1, -166.7);
}
function site(root) {
  flat(root, [[PLOT.x0, PLOT.y0], [PLOT.x1, PLOT.y0], [PLOT.x1, PLOT.y1], [PLOT.x0, PLOT.y1]], 0.0, M.asphalt, 6);   // the plot only: no ground around it
  streets(root);
  slab(root, [[82.7, 95.5], [93, 95.5], [93, 90.5], [118, 90.5], [118, SRV.b0], [82.7, SRV.b0]], 0, 0.03, M.concrete);   // dock apron, open to the service road
  // sidewalk following the stepped front, with the entrance bulge
  slab(root, [[-4, 105], [-4, -12], [86, -12], [86, -15], [WALK[0], -15], [WALK[0], -13.2], [WALK[1], -13.2], [WALK[1], -15], [110, -15], [110, -12], [118, -12], [118, 90.5], [114, 90.5], [114, 3], [0, 3], [0, 105]], 0, 0.15, M.walk);   // one piece, no seam lines on the walk
  // where the sidewalk meets the building: a thin line (same weight as the other edges), so walk and wall read apart in black and white (Ahmed)
  const foot = [[0, 105], [0, 3], [6.1, 3], [6.1, -3], [18.6, -3], [18.6, 0], [72.98, 0], [72.98, -5.5], [87.88, -5.5], [87.88, -8.1], [102.82, -8.1], [102.82, -5], [104.3, -5], [104.3, -5.3], [109.6, -5.3], [109.6, -5], [114, -5], [114, 90.5]];   // entrance piers and the circle panel included
  const n = foot.length;
  { const pts = []; for (let i = 0; i < n - 1; i++) pts.push(V(foot[i][0], foot[i][1], 0.16), V(foot[i + 1][0], foot[i + 1][1], 0.16));   // a plain 1 px line, same weight as the other edges (Ahmed)
    root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x000000 }))); }
  // parking: double rows perpendicular to the front, stalls 2.7 x 5.5, aisles 7.3+ (see parking() below)
  parking(root);
  if (!BW) for (let y = -30; y > -146; y -= 14) { tree(root, 92, y, 6, 1.8); tree(root, 101, y, 6, 1.8); }   // the page keeps this aisle open
  // front planting along the street, one piece with the heads of the rows (Ahmed), cut at the drives and the walk
  // (Ahmed) the green steps up into each half row by 1, 2 or 3 stalls, like notes on a stave, so the street edge isn't one hard line
  const STEP = [2, 1, 3, 1, 2, 3, 1, 2, 1, 3, 2, 1, 3, 2, 1, 2, 3, 1, 2, 1];
  const HALVES = [[-14, -8.5], ...[0, 18.3, 36.6, 54.9, 73.2, 104, 122.3, 140.6, 158.9].flatMap((b) => [[b, b + 5.5], [b + 5.5, b + 11]]), [177.5, 183]]
    .map(([h0, h1], i) => [h0, h1, -148 + STEP[i % STEP.length] * 2.7])
    // entry throat (Ahmed): beside each front drive the green runs 5 stalls deep (about 15 m), so no one backs out right at the gate
    .map(([h0, h1, top]) => DRIVES.front.some(([a, b]) => Math.abs(h1 - a) < 0.01 || Math.abs(h0 - b) < 0.01) ? [h0, h1, -148 + 5 * 2.7] : [h0, h1, top]);
  // openings along the front: o = at the fence, d = the drive at the inner edge of the planting (the walk gate has no flare)
  const OPN = [...DRIVES.front.map((d, i) => ({ o: OPEN("front", i), d })), { o: WALK, d: WALK }].sort((p, q) => p.o[0] - q.o[0]);
  const SEG = []; { let o = -14, d = -14; for (const q of OPN) { SEG.push({ o0: o, d0: d, o1: q.o[0], d1: q.d[0] }); o = q.o[1]; d = q.d[1]; } SEG.push({ o0: o, d0: d, o1: 183, d1: 183 }); }
  for (const { o0, d0, o1, d1 } of SEG.filter((g) => g.o1 - g.o0 > 0.01)) {
    const a = d0, b = d1, pts = [[o0, -156], [o1, -156]];
    if (d1 - o1 > 0.01) pts.push(...arcPts(o1, -151.2, d1 - o1, 4.8, -Math.PI / 2, 0).slice(1)); else pts.push([b, -151.2]);
    let last = null;
    for (const [h0, h1, top] of HALVES.filter(([h0, h1]) => h0 >= a - 0.01 && h1 <= b + 0.01).reverse()) {
      if (last === null || Math.abs(last - h1) > 0.01) { if (Math.abs(pts[pts.length - 1][0] - h1) > 0.01 || Math.abs(pts[pts.length - 1][1] + 151.2) > 0.01) pts.push([h1, -151.2]); }
      pts.push([h1, top], [h0, top]); last = h0;
      const nxt = HALVES.find(([q0, q1]) => Math.abs(q1 - h0) < 0.01 && q0 >= a - 0.01);
      if (!nxt) pts.push([h0, -151.2]);
      if (top > -145) tree(root, (h0 + h1) / 2, top - 2.7, 5.5, 1.6);
    }
    if (o0 - d0 > 0.01) pts.push(...arcPts(o0, -151.2, o0 - d0, 4.8, Math.PI, 1.5 * Math.PI).slice(0, -1)); else pts.push([a, -151.2]);
    plantSlab(root, pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.01), 0.9, ([, y]) => y > -150);   // step tops touch the stalls: square
  }
  for (let x = -8; x < 183; x += 16) tree(root, x, -153.5, 8, 2.6);
  // planters along the front (page foreground) + small trees by the left corner
  if (!BW) for (const [x0, x1] of [[30, 42], [52, 64]]) { slab(root, [[x0, -11], [x1, -11], [x1, -8], [x0, -8]], 0, 0.45, M.mulch); tree(root, (x0 + x1) / 2, -9.5, 6, 1.8); }
  serviceRoad(root); trafficMarks(root);
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
