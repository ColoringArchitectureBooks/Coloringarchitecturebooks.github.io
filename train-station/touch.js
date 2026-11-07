// Two-finger touch like a maps app. One finger still turns the model (OrbitControls).
// With two fingers, one gesture does all of these together, around the point between the fingers:
//   pinch          zoom toward that point
//   twist          turn the model all the way round (360°) about that point
//   move together  slide the view in any direction (up, down, left, right); the point stays under the fingers
// Letting go while moving keeps the view gliding for a moment and slowing down, so it feels smooth.
import * as THREE from "three";

export function mapTouch(controls, camera, canvas, scene) {
  controls.touches.TWO = -1;                                 // OrbitControls leaves two-finger gestures to this code
  const pts = new Map();                                     // pointerId -> {x, y}
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), up = new THREE.Vector3(0, 1, 0);
  let g = null, multi = false, raf = 0, glide = 0;           // gesture in progress; did this touch use two fingers; frame requests

  const two = () => [...pts.values()];
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x)); // keep a turn between -180° and 180°
  function rayAt(p) {
    const r = canvas.getBoundingClientRect();
    ndc.set((p.x - r.left) / r.width * 2 - 1, -(p.y - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera); return ray.ray;
  }
  function anchorAt(p) {                                     // the spot on the model under the fingers
    const R = rayAt(p);
    const hit = ray.intersectObjects(scene.children, true).find((h) => h.object.isMesh && h.object.visible);
    if (hit) return hit.point.clone();
    return R.at(camera.position.distanceTo(controls.target), new THREE.Vector3());
  }

  // move the whole view: zoom by k and turn by th about P, then slide so P sits under screen point m
  function step(P, k, th, m) {
    const cam = camera.position, tgt = controls.target, d0 = cam.distanceTo(tgt);
    k = THREE.MathUtils.clamp(k, controls.minDistance / d0, controls.maxDistance / d0);
    cam.sub(P).multiplyScalar(k).add(P); tgt.sub(P).multiplyScalar(k).add(P);
    const q = new THREE.Quaternion().setFromAxisAngle(up, th);
    cam.sub(P).applyQuaternion(q).add(P); tgt.sub(P).applyQuaternion(q).add(P);
    camera.lookAt(tgt); camera.updateMatrixWorld();
    const n = camera.getWorldDirection(new THREE.Vector3()), plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, P);
    const Q = rayAt(m).intersectPlane(plane, new THREE.Vector3());
    if (Q) { const t = P.clone().sub(Q); cam.add(t); tgt.add(t); }
    controls.update();
  }

  function start() {
    cancelAnimationFrame(glide); glide = 0;
    const [a, b] = two();
    g = { a: { ...a }, b: { ...b }, P: anchorAt(mid(a, b)), v: { k: 1, th: 0, x: 0, y: 0 }, t: performance.now() };
    controls.autoRotate = false; document.getElementById("spin")?.setAttribute("aria-pressed", "false");
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (pts.size === 0) { multi = false; cancelAnimationFrame(glide); glide = 0; }
    if (e.pointerType !== "touch") return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { multi = true; start(); } else if (g) g = null;
  });
  const end = (e) => {
    if (!pts.delete(e.pointerId)) return;
    if (g && performance.now() - g.moved < 100) coast(g);   // fingers were still moving when lifted
    g = null;
  };
  canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);

  canvas.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (g) g.moved = performance.now();
    if (g && pts.size === 2 && !raf) raf = requestAnimationFrame(apply);   // each finger reports on its own; apply both together once a frame
  });

  function apply() {
    raf = 0;
    if (!g || pts.size !== 2) return;
    const [a, b] = two(), pa = g.a, pb = g.b; g.a = { ...a }; g.b = { ...b };
    const m = mid(a, b), pm = mid(pa, pb);
    const k = dist(pa, pb) / Math.max(1, dist(a, b)), th = wrap(ang(a, b) - ang(pa, pb));
    step(g.P, k, th, m);
    const now = performance.now(), f = Math.min(1, (now - g.t) / 50); g.t = now;   // remember how fast it was going (smoothed)
    const v = g.v, s = 0.5 + 0.5 * f;
    v.k = Math.pow(v.k, 1 - s) * Math.pow(k, s); v.th = v.th * (1 - s) + th * s;
    v.x = v.x * (1 - s) + (m.x - pm.x) * s; v.y = v.y * (1 - s) + (m.y - pm.y) * s;
    g.m = m;
  }

  function coast(G) {                                        // keep gliding after the fingers lift, slowing down each frame
    const v = { ...G.v }, P = G.P; let m = G.m || mid(G.a, G.b);
    const tick = () => {
      v.k = Math.pow(v.k, 0.9); v.th *= 0.9; v.x *= 0.9; v.y *= 0.9;
      if (Math.abs(Math.log(v.k)) < 0.0005 && Math.abs(v.th) < 0.0005 && Math.hypot(v.x, v.y) < 0.3) { glide = 0; return; }
      // carry the anchor along with the slide so the glide keeps the same feel
      const m2 = { x: m.x + v.x, y: m.y + v.y }; step(P, v.k, v.th, m2); m = m2;
      glide = requestAnimationFrame(tick);
    };
    glide = requestAnimationFrame(tick);
  }

  return { active: () => multi, stop: () => { cancelAnimationFrame(glide); glide = 0; } };   // stop: a view button was pressed                            // true until all fingers lift after a two-finger touch (so it is not a tap)
}
