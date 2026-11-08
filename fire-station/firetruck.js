// US fire apparatus, built like the coloring page: white solids with black outlines (the page's outline pass adds the edges).
// Local frame (plan metres): x across (left -, right +), y along the truck (nose at -y), z up; the tyres stand on z = 0.06.
//   engine  : custom cab with crew doors, roof light bar, pump panel behind the cab, roll-up compartment doors, ground ladders
//             on the left side, hard suction hoses on the right, hose bed on top, tailboard, rear warning lights
//   ladder  : the same cab and chassis with a turntable at the back and the aerial ladder lying forward over the cab, outriggers
// Returns { group, lights, wheels }: lights are [material, phase] pairs (phase 0/1 flash in turn), wheels spin when it drives.
import * as THREE from "three";
const V = (x, y, z) => new THREE.Vector3(x, z, -y);
const W = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, color: 0xffffff, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
const LINE = new THREE.LineBasicMaterial({ color: 0x000000 });
const G0 = 0.06;                                   // floor level under the tyres

function kit(g) {
  const box = (x0, x1, y0, y1, z0, z1, mat = W) => { const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0), Math.abs(y1 - y0)), mat);
    m.position.copy(V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)); g.add(m); return m; };
  const cyl = (x, y, z, r, len, axis = "z", seg = 16, mat = W, parent = g) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
    if (axis === "x") m.rotation.z = Math.PI / 2; else if (axis === "y") m.rotation.x = Math.PI / 2; m.position.copy(V(x, y, z)); parent.add(m); return m; };
  const segs = [], ln = (a, b) => segs.push(V(...a), V(...b));
  const rect = (x, y0, y1, z0, z1) => { ln([x, y0, z0], [x, y1, z0]); ln([x, y1, z0], [x, y1, z1]); ln([x, y1, z1], [x, y0, z1]); ln([x, y0, z1], [x, y0, z0]); };
  const ring = (x, y, z, r, n = 14) => { for (let k = 0; k < n; k++) { const a = 2 * Math.PI * k / n, b = 2 * Math.PI * (k + 1) / n; ln([x, y + r * Math.cos(a), z + r * Math.sin(a)], [x, y + r * Math.cos(b), z + r * Math.sin(b)]); } };
  // a side profile (y, z) extruded across the truck from x0 to x1
  const prof = (shape, x0, x1) => { const geo = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false, curveSegments: 20 });
    geo.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, x0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1)); const m = new THREE.Mesh(geo, W); g.add(m); return m; };
  const done = () => g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(segs), LINE));
  return { box, cyl, ln, rect, ring, prof, done };
}

export function fireTruck(kind = "engine") {
  const g = new THREE.Group(), K = kit(g), { box, cyl, ln, rect, ring, prof } = K;
  const hw = 1.25, yF = -5.0, yC = -2.2, yR = kind === "ladder" ? 5.4 : 4.9, fa = -3.85, ra = kind === "ladder" ? 3.0 : 2.7, r = 0.52, ac = G0 + r, arch = 0.64, sill = 0.85;
  const lights = [], wheels = [];
  const lamp = (x0, x1, y0, y1, z0, z1, phase) => { const m = new THREE.MeshBasicMaterial({ color: 0xffffff }); box(x0, x1, y0, y1, z0, z1, m); lights.push([m, phase]); };

  // ---- chassis and wheels (single front tyres, dual rear: one wide tyre each side), each with rim and hub
  box(-0.45, 0.45, yF + 0.3, yR - 0.1, 0.55, sill);
  for (const [y, tw] of [[fa, 0.36], [ra, 0.56]]) for (const s of [-1, 1]) {
    const wg = new THREE.Group(); wg.position.copy(V(s * (hw - tw / 2 - 0.02), y, ac)); g.add(wg); wheels.push(wg);
    cyl(0, 0, 0, r, tw, "x", 26, W, wg); cyl(s * 0.01, 0, 0, 0.31, tw + 0.02, "x", 18, W, wg); cyl(s * 0.02, 0, 0, 0.1, tw + 0.04, "x", 8, W, wg);
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, m = cyl(s * (tw / 2 + 0.025), 0.2 * Math.cos(a), 0.2 * Math.sin(a), 0.03, 0.02, "x", 6, W, wg); }   // wheel nuts
  }
  // ---- cab: side profile with the front wheel arch, a flat nose and a raised crew roof
  { const s = new THREE.Shape(); s.moveTo(yF, sill); s.lineTo(fa - arch, sill); s.absarc(fa, ac, arch, Math.PI, 0, true); s.lineTo(yC, sill);
    s.lineTo(yC, 3.15); s.lineTo(-3.75, 3.15); s.lineTo(-3.85, 2.98); s.lineTo(yF + 0.12, 2.98); s.quadraticCurveTo(yF, 2.98, yF, 2.86); s.lineTo(yF, sill);
    prof(s, -hw, hw); }
  // front: two-pane windscreen, grille with slats, quad headlights, turn signals, warning lamps either side of the grille
  const f = yF - 0.012;
  box(-hw + 0.1, -0.03, f - 0.02, f, 1.95, 2.8); box(0.03, hw - 0.1, f - 0.02, f, 1.95, 2.8);       // windscreen panes
  box(-0.7, 0.7, f - 0.05, f, 0.98, 1.78);                                                         // grille
  for (let x = -0.6; x <= 0.61; x += 0.12) ln([x, f - 0.055, 1.03], [x, f - 0.055, 1.73]);
  for (const s of [-1, 1]) { for (const x of [0.86, 1.08]) box(s * x - 0.09, s * x + 0.09, f - 0.04, f, 1.05, 1.3); box(s * 0.97 - 0.2, s * 0.97 + 0.2, f - 0.03, f, 1.38, 1.48);
    lamp(s * 0.97 - 0.2, s * 0.97 + 0.2, f - 0.05, f, 1.56, 1.74, s < 0 ? 0 : 1); }
  // bumper: extended front bumper with the siren speaker and the two air horns
  box(-hw - 0.08, hw + 0.08, yF - 0.38, yF, 0.48, 0.88); for (const z of [0.6, 0.76]) ln([-hw - 0.08, yF - 0.385, z], [hw + 0.08, yF - 0.385, z]);
  cyl(0, yF - 0.39, 0.68, 0.17, 0.04, "y", 18);
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.13, 0.42, 12), W); h.rotation.x = Math.PI / 2; h.position.copy(V(s * 0.6, yF - 0.22, 0.98)); g.add(h); }   // air horns on the bumper
  // roof: full-width light bar of 6 modules (they flash in turn), a siren speaker in the middle
  box(-1.12, 1.12, -4.75, -4.35, 2.98, 3.02);
  for (let k = 0; k < 6; k++) { const x0 = -1.1 + k * 0.37; lamp(x0, x0 + 0.33, -4.73, -4.37, 3.02, 3.2, k < 3 ? (k % 2) : 1 - (k % 2)); }
  // sides of the cab: front door and crew door with windows, handles, two steps, grab rails, mirrors, upper warning lamps
  for (const s of [-1, 1]) { const x = s * (hw + 0.005), xo = s * (hw + 0.03);
    rect(x, -4.65, -3.65, 0.9, 2.85); rect(x, -3.55, -2.3, 0.9, 3.05);
    box(x - 0.01, x + 0.01, -4.5, -3.8, 1.95, 2.7); box(x - 0.01, x + 0.01, -3.45, -2.4, 1.95, 2.85);   // door windows
    box(xo - 0.02, xo + 0.02, -3.85, -3.7, 1.7, 1.76); box(xo - 0.02, xo + 0.02, -2.6, -2.45, 1.7, 1.76);  // handles
    for (const [z0, z1] of [[0.42, 0.5], [0.78, 0.86]]) box(s * (hw - 0.02), s * (hw + 0.12), -4.6, -2.35, z0, z1);   // steps
    for (const y of [-4.75, -2.3]) cyl(s * (hw + 0.08), y, 1.9, 0.025, 1.2, "z", 8);
    box(s * hw, s * (hw + 0.35), -4.72, -4.66, 2.55, 2.6); box(s * (hw + 0.32), s * (hw + 0.42), -4.8, -4.6, 2.0, 2.65);   // mirror arm + head
    lamp(x - 0.01, x + 0.03, -2.65, -2.35, 2.8, 2.98, s < 0 ? 0 : 1);
  }
  // ---- body behind the cab, with the rear wheel arch
  const yB = yC + 0.05, top = kind === "ladder" ? 2.7 : 2.85;
  { const s = new THREE.Shape(); s.moveTo(yB, sill); s.lineTo(ra - arch, sill); s.absarc(ra, ac, arch, Math.PI, 0, true); s.lineTo(yR, sill); s.lineTo(yR, top); s.lineTo(yB, top); s.lineTo(yB, sill);
    prof(s, -hw, hw); }
  // pump panel just behind the cab (both sides): gauges, discharge outlets with caps, intake
  for (const s of [-1, 1]) { const x = s * (hw + 0.01);
    box(x - 0.01, x + s * 0.02, yB + 0.05, yB + 0.75, 0.95, 2.6);
    for (const [y, z] of [[yB + 0.25, 2.25], [yB + 0.55, 2.25], [yB + 0.4, 1.95]]) ring(s * (hw + 0.035), y, z, 0.09);
    for (const y of [yB + 0.2, yB + 0.6]) cyl(s * (hw + 0.1), y, 1.3, 0.07, 0.14, "x", 12);
    cyl(s * (hw + 0.09), yB + 0.4, 1.65, 0.13, 0.12, "x", 16);
  }
  // compartments with roll-up doors: frames, slats and a lift bar along the bottom
  const comps = kind === "ladder" ? [[yB + 0.85, 1.85, 1.0], [ra + arch + 0.1, yR - 0.15, 1.0]] : [[yB + 0.85, 0.3, 1.0], [0.4, ra - arch - 0.1, 1.0], [ra - arch + 0.05, ra + arch - 0.05, 1.42], [ra + arch + 0.1, yR - 0.15, 1.0]];
  for (const s of [-1, 1]) { const x = s * (hw + 0.006);
    for (const [y0, y1, z0] of comps) { const z1 = top - 0.2; rect(x, y0, y1, z0, z1); for (let z = z0 + 0.15; z < z1 - 0.05; z += 0.15) ln([x, y0, z], [x, y1, z]);
      box(x - 0.02, x + 0.02, y0 + 0.1, y1 - 0.1, z0 + 0.04, z0 + 0.1); }
    ln([x, yB, sill + 0.08], [x, yR, sill + 0.08]);                 // rub rail line
    lamp(x - 0.01, x + 0.03, yR - 0.4, yR - 0.15, top - 0.12, top - 0.02, s < 0 ? 1 : 0);   // upper rear side lamps
  }
  if (kind === "engine") {
    // ground ladders in a side rack on the left (two ladders, rails and rungs), with brackets
    for (const [z0, dy] of [[2.32, 0], [2.52, 0.3]]) { const x = -hw - 0.1 - dy * 0.3, ya = yB + 0.95 + dy, yb = yR - 0.35;
      box(x - 0.03, x + 0.03, ya, yb, z0, z0 + 0.05); box(x - 0.03, x + 0.03, ya, yb, z0 + 0.34, z0 + 0.39);
      for (let y = ya + 0.15; y < yb; y += 0.3) ln([x, y, z0 + 0.05], [x, y, z0 + 0.34]); }
    for (const y of [yB + 1.2, 3.9]) box(-hw - 0.25, -hw, y - 0.05, y + 0.05, 2.25, 2.95);
    // two hard suction hoses along the right side, in their brackets
    for (const z of [2.45, 2.66]) cyl(hw + 0.12, (yB + 0.95 + 4.4) / 2, z, 0.08, 4.4 - yB - 0.95, "y", 12);
    for (const y of [yB + 1.2, 3.9]) box(hw, hw + 0.24, y - 0.05, y + 0.05, 2.32, 2.78);
    // hose bed on top: side boards and the folded hose (layers seen from above)
    for (const s of [-1, 1]) box(s * hw - (s > 0 ? 0.08 : 0), s * hw + (s < 0 ? 0.08 : 0), yB + 0.8, yR, top, top + 0.25);
    for (let k = 0; k < 4; k++) { const x0 = -1.1 + k * 0.56; box(x0, x0 + 0.5, yB + 0.85, yR - 0.05, top, top + 0.16 + (k % 2) * 0.03); }
    box(-1.17, 1.17, yB + 0.05, yB + 0.8, top, top + 0.12);            // deck over the pump with the deck gun
    cyl(0, yB + 0.42, top + 0.25, 0.12, 0.26, "z", 12); { const n = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.7, 10), W); n.rotation.x = -1.2; n.position.copy(V(0, yB + 0.2, top + 0.45)); g.add(n); }
  } else {
    // aerial ladder: turntable at the back, the ladder lying forward over the cab on its rest, outriggers under the body
    cyl(0, ra + 0.2, top + 0.15, 0.95, 0.3, "z", 28); box(-0.55, 0.55, ra - 0.3, ra + 0.8, top + 0.3, top + 0.95);   // turntable + ladder base
    const yl0 = yF - 1.1, yl1 = ra + 0.7, zl = 3.55;
    for (const [z, h] of [[zl, 0.1], [zl + 0.42, 0.06]]) for (const s of [-1, 1]) box(s * 0.55 - 0.05, s * 0.55 + 0.05, yl0, yl1, z, z + h);   // rails + handrails
    for (let y = yl0 + 0.2; y < yl1; y += 0.35) { ln([-0.55, y, zl + 0.1], [0.55, y, zl + 0.1]); for (const s of [-1, 1]) ln([s * 0.55, y, zl + 0.1], [s * 0.55, y + 0.17, zl + 0.42]); }
    box(-0.3, 0.3, -3.1, -2.9, 3.15, zl);                              // ladder rest on the cab roof
    for (const y of [yB + 0.6, yR - 0.5]) for (const s of [-1, 1]) { box(s * 0.4, s * (hw + 0.1), y - 0.2, y + 0.2, 0.5, 0.82); box(s * (hw + 0.02), s * (hw + 0.12), y - 0.25, y + 0.25, 0.25, 0.85); }
    for (const s of [-1, 1]) box(s * hw - 0.05, s * hw + 0.05, yB + 0.1, yR, top, top + 0.12);
  }
  // ---- rear: tailboard step, rear door, tail lights, warning lights, grab rails
  box(-hw, hw, yR, yR + 0.35, 0.55, 0.7);
  for (const s of [-1, 1]) { box(s * 1.0 - 0.13, s * 1.0 + 0.13, yR, yR + 0.04, 1.0, 1.25); lamp(s * 1.0 - 0.13, s * 1.0 + 0.13, yR, yR + 0.04, 1.35, 1.6, s < 0 ? 0 : 1);
    lamp(s * 1.0 - 0.13, s * 1.0 + 0.13, yR, yR + 0.04, top - 0.3, top - 0.05, s < 0 ? 1 : 0); cyl(s * 0.75, yR + 0.08, 1.8, 0.025, 1.4, "z", 8); }
  ln([-0.6, yR + 0.005, 0.95], [0.6, yR + 0.005, 0.95]); ln([0.6, yR + 0.005, 0.95], [0.6, yR + 0.005, top - 0.4]); ln([0.6, yR + 0.005, top - 0.4], [-0.6, yR + 0.005, top - 0.4]); ln([-0.6, yR + 0.005, top - 0.4], [-0.6, yR + 0.005, 0.95]);
  K.done();
  return { group: g, lights, wheels, r };
}
// light pattern: phase 0 and phase 1 lamps double-flash in turn (lit = black, like ink on the page)
export function flashLights(lights, t) {
  const p = t % 0.5, on0 = (p < 0.07) || (p >= 0.12 && p < 0.19), on1 = (p >= 0.25 && p < 0.32) || (p >= 0.37 && p < 0.44);
  for (const [m, ph] of lights) m.color.setHex((ph ? on1 : on0) ? 0x111111 : 0xffffff);
}
export function lightsOff(lights) { for (const [m] of lights) m.color.setHex(0xffffff); }
