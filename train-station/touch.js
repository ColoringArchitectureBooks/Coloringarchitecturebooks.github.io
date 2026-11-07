// Two-finger touch like a maps app. One finger still turns the model (OrbitControls).
// With two fingers, one gesture can do all of these together, around the point between the fingers:
//   pinch          zoom toward that point
//   twist          turn the model all the way round (360°) about that point
//   move together  slide the view, so the point stays under the fingers
// Moving both fingers straight up or down together tilts the view instead (see more from above or from the side).
import * as THREE from "three";

export function mapTouch(controls, camera, canvas, scene) {
  controls.touches.TWO = -1;                                 // OrbitControls leaves two-finger gestures to this code
  const pts = new Map();                                     // pointerId -> {x, y}
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), up = new THREE.Vector3(0, 1, 0);
  let g = null, multi = false;                               // the gesture in progress; whether this touch used two fingers

  const two = () => [...pts.values()];
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
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
  function start() {
    const [a, b] = two(), m = mid(a, b);
    g = { a: { ...a }, b: { ...b }, a0: { ...a }, b0: { ...b }, P: anchorAt(m), mode: null };
    controls.autoRotate = false; document.getElementById("spin")?.setAttribute("aria-pressed", "false");
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (pts.size === 0) multi = false;
    if (e.pointerType !== "touch") return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { multi = true; start(); } else g = null;
  });
  const end = (e) => { if (pts.delete(e.pointerId)) g = null; };
  canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);

  canvas.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g && pts.size === 2 && !raf) raf = requestAnimationFrame(apply);   // each finger reports on its own; apply both together once a frame
  });

  let raf = 0;
  function apply() {
    raf = 0;
    if (!g || pts.size !== 2) return;
    const [a, b] = two();

    if (!g.mode) {                                           // decide what this gesture is once the fingers have moved a little
      const da = { x: a.x - g.a0.x, y: a.y - g.a0.y }, db = { x: b.x - g.b0.x, y: b.y - g.b0.y };
      const moved = Math.max(Math.hypot(da.x, da.y), Math.hypot(db.x, db.y)); if (moved < 10) return;
      const pinch = Math.abs(dist(a, b) - dist(g.a0, g.b0));
      const vert = (d) => Math.abs(d.y) > 1.5 * Math.abs(d.x);
      g.mode = vert(da) && vert(db) && Math.sign(da.y) === Math.sign(db.y) && pinch < 0.4 * moved ? "tilt" : "map";
    }                                                        // (the first few pixels count too: g.a / g.b are still where the fingers started)

    const pa = g.a, pb = g.b; g.a = { ...a }; g.b = { ...b };
    const cam = camera.position, tgt = controls.target;

    if (g.mode === "tilt") {                                 // fingers up = look more from the side, down = more from above
      const dy = mid(a, b).y - mid(pa, pb).y, h = canvas.getBoundingClientRect().height;
      const off = cam.clone().sub(tgt), s = new THREE.Spherical().setFromVector3(off);
      s.phi = THREE.MathUtils.clamp(s.phi - dy / h * Math.PI * 0.9, 0.05, controls.maxPolarAngle);
      cam.copy(tgt).add(off.setFromSpherical(s)); controls.update(); return;
    }

    const P = g.P;
    // pinch: scale the whole view about P (camera and its aim point together)
    let k = dist(pa, pb) / Math.max(1, dist(a, b));
    const d0 = cam.distanceTo(tgt);
    k = THREE.MathUtils.clamp(k, controls.minDistance / d0, controls.maxDistance / d0);
    cam.sub(P).multiplyScalar(k).add(P); tgt.sub(P).multiplyScalar(k).add(P);
    // twist: turn the view about the upright line through P
    const q = new THREE.Quaternion().setFromAxisAngle(up, ang(a, b) - ang(pa, pb));
    cam.sub(P).applyQuaternion(q).add(P); tgt.sub(P).applyQuaternion(q).add(P);
    camera.lookAt(tgt); camera.updateMatrixWorld();
    // move: slide so P sits under the fingers' new midpoint (on the plane facing the camera through P)
    const n = camera.getWorldDirection(new THREE.Vector3()), plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, P);
    const Q = rayAt(mid(a, b)).intersectPlane(plane, new THREE.Vector3());
    if (Q) { const t = P.clone().sub(Q); cam.add(t); tgt.add(t); }
    controls.update();
  }

  return { active: () => multi };                            // true until all fingers lift after a two-finger touch (so it is not a tap)
}
