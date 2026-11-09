# Coloring Architecture Books — rules for Claude

## Interactive 3D models: default touch and mouse controls (always, no need to ask)

Ahmed wants every interactive 3D file in this repo to move the same way as the supermarket model.
Use this by default in every new 3D page, without being asked:

- **One finger / mouse drag** turns the model (three.js `OrbitControls`): sideways spins it 360°,
  down rises to a bird's view from above, up sinks to an ant's view at the ground.
- **Two fingers moved together (spacing unchanged)** do exactly what one finger does, so the view
  can be tilted to the top or down to the ground with two fingers too.
- **Pinch** zooms toward the point between the fingers; **twist** turns the model around that point.
  All of it works in one gesture, and letting go while moving glides to a stop.
- Two fingers are read from **touch events** (not pointer events), and Safari's own
  `gesturestart/gesturechange/gestureend` are prevented, so iPad never pushes back mid-gesture.

How to use it:

1. Copy `shared/touch.js` next to the new page (it imports `"three"` through the page's importmap).
2. In the page CSS: `html, body { touch-action: none; overscroll-behavior: none; }`
3. After creating `OrbitControls`:
   ```js
   import { mapTouch } from "./touch.js?v=1";
   mapTouch(controls, camera, renderer.domElement, scene);
   ```
4. Test two-finger tilt with real touch events (Playwright + CDP `Input.dispatchTouchEvent`,
   `hasTouch: true, isMobile: true`) before shipping.

`shared/touch.js` is the master copy (same as `supermarket/touch.js`). Improve it there and copy it out.
