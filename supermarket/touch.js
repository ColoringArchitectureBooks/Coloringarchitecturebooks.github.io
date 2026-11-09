// Two-finger touch. One finger turns the model (OrbitControls); two fingers do the same and more:
//   move both fingers together (keeping their spacing)  turn the model exactly like one finger does:
//                     sideways turns it round (360°), down rises to a bird's view from above, up sinks to an ant's view at the ground
//   pinch (change the spacing)  zoom in toward the point between the fingers, or back out
//   twist             turn the model round about that point
// All of these work in one gesture, around the point between the fingers. Letting go while moving
// keeps the view gliding for a moment and slowing down, so it feels smooth.
import * as THREE from "three";

export function mapTouch(controls, camera, canvas, scene) {
  controls.touches.TWO = -1;                                 // OrbitControls leaves two-finger gestures to this code
  // iPad Safari: keep the browser's own pinch and two-finger scroll off the model. When it takes a touch over it cancels
  // our pointers half way through a gesture, which feels like the view pushing back (Ahmed)
  for (const t of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(t, (e) => e.preventDefault(), { passive: false });
  canvas.addEventListener("touchstart", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  canvas.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
  const TILT = 1.6;                                          // two-finger up/down tilts a little faster than one finger, so a short drag reaches the bird's view
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

  // move the whole view about P: zoom by k, twist by th, and turn like one finger by a drag of (dx, dy) pixels
  function step(P, k, th, dx, dy) {
    const cam = camera.position, tgt = controls.target, d0 = cam.distanceTo(tgt), h = canvas.clientHeight || 1;
    k = THREE.MathUtils.clamp(k, controls.minDistance / d0, controls.maxDistance / d0);
    cam.sub(P).multiplyScalar(k).add(P); tgt.sub(P).multiplyScalar(k).add(P);
    // round about the upright line through P: the twist, plus a sideways drag at one-finger speed
    const q = new THREE.Quaternion().setFromAxisAngle(up, th - 2 * Math.PI * dx / h * controls.rotateSpeed);
    cam.sub(P).applyQuaternion(q).add(P); tgt.sub(P).applyQuaternion(q).add(P);
    // over the top: a drag down rises to look from above, a drag up sinks toward the ground (as with one finger)
    const off = cam.clone().sub(tgt), phi = Math.acos(THREE.MathUtils.clamp(off.y / off.length(), -1, 1));
    const nphi = THREE.MathUtils.clamp(phi - 2 * Math.PI * dy / h * controls.rotateSpeed * TILT, 0.03, controls.maxPolarAngle);
    if (Math.abs(nphi - phi) > 1e-5) {
      const axis = new THREE.Vector3().crossVectors(up, off).normalize(), qt = new THREE.Quaternion().setFromAxisAngle(axis, phi - nphi);
      const o2 = off.clone().applyQuaternion(qt);
      if (Math.abs(Math.acos(THREE.MathUtils.clamp(o2.y / o2.length(), -1, 1)) - nphi) > 1e-3) qt.setFromAxisAngle(axis, nphi - phi);
      cam.sub(P).applyQuaternion(qt).add(P); tgt.sub(P).applyQuaternion(qt).add(P);
      if (cam.y < 0.3) { const lift = 0.3 - cam.y; cam.y += lift; tgt.y += lift; }   // never below the ground
    }
    if (tgt.y < -3) {                                        // the aim point (what one finger turns about) sank well under the ground: bring it up to the ground
      const d = cam.distanceTo(tgt), R = new THREE.Ray(cam.clone(), tgt.clone().sub(cam).normalize()), G = R.intersectPlane(new THREE.Plane(up, 0.6), new THREE.Vector3());
      if (G && G.distanceTo(cam) > 0.5 * d) tgt.copy(G);
    }
    camera.lookAt(tgt); controls.update();
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
    step(g.P, k, th, m.x - pm.x, m.y - pm.y);
    const now = performance.now(), f = Math.min(1, (now - g.t) / 50); g.t = now;   // remember how fast it was going (smoothed)
    const v = g.v, s = 0.5 + 0.5 * f;
    v.k = Math.pow(v.k, 1 - s) * Math.pow(k, s); v.th = v.th * (1 - s) + th * s;
    v.x = v.x * (1 - s) + (m.x - pm.x) * s; v.y = v.y * (1 - s) + (m.y - pm.y) * s;
  }

  function coast(G) {                                        // keep gliding after the fingers lift, slowing down each frame
    const v = { ...G.v }, P = G.P;
    const tick = () => {
      v.k = Math.pow(v.k, 0.9); v.th *= 0.9; v.x *= 0.9; v.y *= 0.9;
      if (Math.abs(Math.log(v.k)) < 0.0005 && Math.abs(v.th) < 0.0005 && Math.hypot(v.x, v.y) < 0.3) { glide = 0; return; }
      step(P, v.k, v.th, v.x, v.y);
      glide = requestAnimationFrame(tick);
    };
    glide = requestAnimationFrame(tick);
  }

  return { active: () => multi, stop: () => { cancelAnimationFrame(glide); glide = 0; } };   // active: a two-finger touch (so not a tap); stop: a view button was pressed
}
