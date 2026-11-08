// Parked cars, the same models as the school's car park (sedan, hatchback, SUV at US sizes): white body, black outlines.
// Each kind is built once, merged, and then copied into the stalls.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
const V = (x, y, z) => new THREE.Vector3(x, z, -y);
const W0 = new THREE.MeshLambertMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
const M = { line: new THREE.LineBasicMaterial({ color: 0x000000 }) };
const TCAR = (() => { const LG = 0;
  function box(root, x0, x1, y0, y1, z0, z1, mat = W0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0), Math.abs(y1 - y0)), mat);
    m.position.copy(V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); root.add(m); return m;
  }
  const shapeOf = (pts) => new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
  function sideShape(root, shape, x0, x1, mat = W0) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false, curveSegments: 24 });
    g.rotateY(Math.PI / 2); const m = new THREE.Mesh(g, mat); m.position.x = x0; root.add(m); return m;
  }
  const side = (root, pts, x0, x1, mat) => sideShape(root, shapeOf(pts), x0, x1, mat);
  function lines(root, segs) {
    const pts = []; for (const [a, b] of segs) pts.push(V(...a), V(...b));
    root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), M.line));
  }
  // cylinder along plan 'z' (up), 'x' or 'y', centred at (x, y, z)
  function cyl(root, x, y, z, r, len, axis = "z", seg = 20, mat = W0, rTop = r) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, len, seg), mat);
    if (axis === "x") m.rotation.z = -Math.PI / 2; else if (axis === "y") m.rotation.x = -Math.PI / 2;
    m.position.copy(V(x, y, z)); root.add(m); return m;
  }
  // parked cars at US sizes: sedan ~ Camry 4.85 x 1.84 x 1.44, hatchback ~ Civic hatch 4.45 x 1.80 x 1.45, SUV ~ RAV4 4.65 x 1.86 x 1.72
  const CARS = {
    sedan: { hl: 2.33, wf: 1.45, wr: -1.42, r: 0.33, sill: 0.28, belt: 0.9, roof: 1.44, cf: 0.92, rf: 0.05, rr: -0.95, cb: -1.72, deck: true, w: 0.92 },
    hatch: { hl: 2.13, wf: 1.33, wr: -1.33, r: 0.32, sill: 0.28, belt: 0.9, roof: 1.45, cf: 0.85, rf: 0.02, rr: -1.55, cb: -2.02, deck: false, w: 0.9 },
    suv:   { hl: 2.25, wf: 1.38, wr: -1.38, r: 0.37, sill: 0.42, belt: 1.08, roof: 1.72, cf: 1.0, rf: 0.3, rr: -1.85, cb: -2.12, deck: false, w: 0.93 },
  };
  function car(root, cx, cy, d = 1, kind = "sedan") {   // nose toward +y when d = 1: wheel arches, glasshouse, doors, lamps, bumpers, wheels with rims
    const C = CARS[kind], { hl, wf, wr, r, sill, belt, roof, cf, rf, rr, cb, w } = C, ra = r + 0.07;
    const G = new THREE.Group(); G.position.copy(V(cx, cy, LG)); G.rotation.y = d > 0 ? 0 : Math.PI; root.add(G);
    const S = (f) => { const s = new THREE.Shape(); f(s); return s; };
    sideShape(G, S((s) => {                                                         // lower body in side view, the two wheel arches cut into the sill
      s.moveTo(-hl + 0.12, sill); s.lineTo(wr - ra, sill); s.absarc(wr, r, ra, Math.PI, 0, true); s.lineTo(wf - ra, sill); s.absarc(wf, r, ra, Math.PI, 0, true);
      s.lineTo(hl - 0.12, sill); s.quadraticCurveTo(hl + 0.02, sill + 0.02, hl, sill + 0.27); s.quadraticCurveTo(hl - 0.02, belt - 0.12, hl - 0.28, belt - 0.1);
      s.lineTo(cf - 0.05, belt); s.lineTo(cb, belt + 0.02);
      if (C.deck) { s.lineTo(-hl + 0.18, belt); s.quadraticCurveTo(-hl - 0.02, belt - 0.05, -hl, sill + 0.27); }
      else s.quadraticCurveTo(-hl + 0.02, belt - 0.02, -hl, sill + 0.27);
      s.quadraticCurveTo(-hl + 0.01, sill + 0.02, -hl + 0.12, sill); }), -w, w);
    const cw = w - 0.15, cc0 = [cf - (cf - rf) * 0.75, belt + (roof - belt) * 0.85], cc1 = C.deck ? [rr - (rr - cb) * 0.5, roof - 0.05] : [cb + 0.06, roof - 0.12];
    sideShape(G, S((s) => { s.moveTo(cb, belt - 0.02); s.lineTo(cf, belt - 0.02); s.quadraticCurveTo(...cc0, rf, roof); s.lineTo(rr, roof); s.quadraticCurveTo(...cc1, cb, belt - 0.02); }), -cw, cw);
    const bp = (rf + rr) / 2 + 0.12, gb = belt + 0.07, gt = roof - 0.08;
    for (const xs of [-cw - 0.012, cw + 0.002]) {                                    // side glass: front and rear doors, and the quarter light on the longer roofs
      side(G, [[cf - 0.22, gb], [rf + 0.06, gt], [bp, gt], [bp, gb]], xs, xs + 0.01);
      if (C.deck) side(G, [[bp - 0.12, gb], [bp - 0.12, gt], [rr + 0.02, gt], [cb + 0.3, gb]], xs, xs + 0.01);
      else { const bc = wr + 0.1; side(G, [[bp - 0.12, gb], [bp - 0.12, gt], [bc, gt], [bc, gb]], xs, xs + 0.01);
        side(G, [[bc - 0.1, gb], [bc - 0.1, gt], [rr + 0.04, gt], [cb + 0.16, gb]], xs, xs + 0.01); }
    }
    const Ln = [], dR = C.deck ? cb + 0.22 : wr + 0.12, at = r + ra + 0.04;
    for (const xs of [-w - 0.005, w + 0.005]) {
      const sg = Math.sign(xs);
      Ln.push([[xs, cf - 0.05, at], [xs, cf - 0.05, belt - 0.01]], [[xs, bp - 0.06, sill], [xs, bp - 0.06, belt + 0.01]], [[xs, dR, at], [xs, dR, belt + 0.01]],   // door shuts
        [[xs, hl - 0.3, belt - 0.28], [xs, -hl + 0.25, belt - 0.28]]);                                                                                               // shoulder crease
      box(G, xs - 0.01, xs + 0.01, cf - 0.75, cf - 0.57, belt - 0.12, belt - 0.08); box(G, xs - 0.01, xs + 0.01, bp - 0.65, bp - 0.47, belt - 0.12, belt - 0.08);   // handles
      box(G, sg * (cw - 0.02), sg * (w + 0.05), cf - 0.28, cf - 0.17, belt + 0.03, belt + 0.11);                                                                     // mirror
      for (const o of [wr, wf]) { cyl(G, sg * (w - 0.1), o, r, r, 0.22, "x", 24); cyl(G, sg * (w - 0.08), o, r, r * 0.6, 0.22, "x", 20); cyl(G, sg * (w - 0.07), o, r, 0.06, 0.22, "x", 10); }   // tyre, rim, hub
    }
    for (const [p0, c, p1, sg] of [[[cf, belt - 0.02], cc0, [rf, roof], 1], [[cb, belt - 0.02], cc1, [rr, roof], -1]]) {   // windscreen and back light on the curved cabin
      const Q = (t) => { const u = 1 - t, o = u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], h = u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1];
        const to = 2 * u * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0]), th = 2 * u * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1]), n = Math.hypot(to, th) || 1;
        return [o + sg * Math.abs(th) / n * 0.012, h + Math.abs(to) / n * 0.012]; };
      const ts = [0.12, 0.3, 0.5, 0.7, 0.9], xw = cw - 0.13;
      for (const xs of [-xw, xw]) for (let i = 0; i < ts.length - 1; i++) { const a = Q(ts[i]), b = Q(ts[i + 1]); Ln.push([[xs, a[0], a[1]], [xs, b[0], b[1]]]); }
      for (const t of [ts[0], ts[ts.length - 1]]) { const a = Q(t); Ln.push([[-xw, a[0], a[1]], [xw, a[0], a[1]]]); }
    }
    const hb = sill - 0.01;
    box(G, -w - 0.03, w + 0.03, hl - 0.1, hl + 0.06, hb, hb + 0.15); box(G, -w - 0.03, w + 0.03, -hl - 0.06, -hl + 0.1, hb, hb + 0.15);   // bumpers
    box(G, -0.42, 0.42, hl - 0.06, hl + 0.01, sill + 0.18, sill + 0.36);                                                                 // grille
    lines(G, [0.23, 0.28, 0.33].map((h) => [[-0.42, hl + 0.015, sill + h], [0.42, hl + 0.015, sill + h]]));
    for (const xh of [-(w - 0.3), w - 0.3]) { cyl(G, xh, hl - 0.03, sill + 0.3, 0.11, 0.06, "y", 18); box(G, xh - 0.17, xh + 0.17, -hl - 0.03, -hl + 0.04, belt - 0.28, belt - 0.15); }   // head and tail lamps
    box(G, -0.26, 0.26, -hl - 0.08, -hl - 0.04, sill + 0.17, sill + 0.31); box(G, -0.26, 0.26, hl + 0.06, hl + 0.08, sill + 0.01, sill + 0.12);   // number plates
    if (kind === "suv") for (const xr of [-(cw - 0.12), cw - 0.12]) { box(G, xr - 0.03, xr + 0.03, rr + 0.1, rf - 0.1, roof + 0.05, roof + 0.09);   // roof rails
      for (const o of [rr + 0.15, rf - 0.15]) box(G, xr - 0.03, xr + 0.03, o - 0.04, o + 0.04, roof - 0.01, roof + 0.05); }
  }
  return { CARS, car }; })();
let KIND = null;
function kinds() {
  if (KIND) return KIND; KIND = {};
  for (const kind of ["sedan", "hatch", "suv"]) { const g = new THREE.Group(); TCAR.car(g, 0, 0, 1, kind); g.updateMatrixWorld(true);
    const ms = [], ls = [];
    g.traverse(o => { if (o.isMesh) { const t = o.geometry.type, thr = t === "CylinderGeometry" ? 40 : 20;
        ls.push(new THREE.EdgesGeometry(o.geometry, thr).applyMatrix4(o.matrixWorld)); const q = o.geometry.clone().applyMatrix4(o.matrixWorld); q.deleteAttribute("uv"); ms.push(q.index ? q.toNonIndexed() : q); }
      else if (o.isLineSegments) ls.push(o.geometry.clone().applyMatrix4(o.matrixWorld)); });
    KIND[kind] = { body: mergeGeometries(ms), line: mergeGeometries(ls), len: 2 * TCAR.CARS[kind].hl + 0.12 }; }
  return KIND;
}
// stalls: [d0, d1, c, face, along] like the school's park(): depth d0..d1 along x (or y when along = "y"), centre c across,
// face = +1/-1 toward the aisle. share: how many stalls are taken (0..1). z: the surface the tyres stand on.
export function parkCars(root, stalls, share = 0.4, z = 0, seed = 4242, count = 0) {   // count > 0: exactly that many cars, in stalls picked at random
  const K = kinds(), noEdge = (m) => { m.userData.noEdge = true; return m; };
  const crand = (s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(seed);
  const pick = () => { const r = crand(); return r < 0.4 ? "sedan" : r < 0.65 ? "hatch" : "suv"; };
  let take = null;
  if (count > 0) { const idx = stalls.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(crand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; } take = new Set(idx.slice(0, count)); }
  for (const [i, [d0, d1, c, face, along]] of stalls.entries()) {
    if (take ? !take.has(i) : crand() > share) continue;
    const k = K[pick()], L = k.len, f = crand() < 0.85 ? face : -face;   // most drive in nose first
    const gap = Math.min(0.35, d1 - d0 - L - 0.1), mid = face > 0 ? d1 - gap - L / 2 : d0 + gap + L / 2, cc = c + (crand() - 0.5) * 0.25, h = (crand() - 0.5) * 0.06;
    const hd = along === "y" ? (f > 0 ? Math.PI / 2 : -Math.PI / 2) : (f > 0 ? 0 : Math.PI);   // heading in plan; the model's nose points +y
    const p = along === "y" ? V(cc, mid, z) : V(mid, cc, z), ry = hd + h - Math.PI / 2;
    const b = noEdge(new THREE.Mesh(k.body, W0)), l = new THREE.LineSegments(k.line, M.line);
    for (const o of [b, l]) { o.position.copy(p); o.rotation.y = ry; root.add(o); }
  }
}
