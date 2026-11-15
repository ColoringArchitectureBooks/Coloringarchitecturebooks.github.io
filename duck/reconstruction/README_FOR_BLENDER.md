# Rubber Duck / Reconstruction Package 01

**Authoritative appearance reference:** `00_ORIGINAL_REFERENCE_UNCHANGED.jpg`. No new duck image was generated for this package.

## Geometry units & convention
- Blender units: total height 2.00 BU. X = lateral, Y = rearward, Z = vertical. Beak points toward negative Y.
- Body Z = 0..0.94, head Z = 0.88..2.00, overlap = 0.06.
- Head and body section CSVs are coordinate profiles for the **first fitting pass**, not certified geometry.

## Important status distinctions
- `01_head_sections_11_levels.csv`: previous approximate front/side image measurements; visual estimates, not verified orthographic slices.
- `02_body_sections_11_levels_PROVISIONAL.csv`: proposed manually interpreted rings; shape control suggestions NOT verified measurement.
- `03_face_landmarks.csv`: approximate landmarks measured from supplied image; old eye center .63 local conflicts with the image-derived ~.48 local.
- Global dimensions from historical approved sheets are **design targets**; not all can be fitted simultaneously without adjustment.
- Beak 0.31 visible-height decomposition is a numerical convention; verify against visual mouth depth from source.

## Build checklist for Codex/Blender
1. Load the unmodified original as scene reference. Generate head and body meshes using sections from CSV with editable ring coordinates. Do not substitute two UV spheres.
2. Build upper/lower beak as separate custom polygon meshes with raised center ridge, horizontal forward flattening, and curved mouth split.
3. Eyes: match the original positions first; expose both legacy .63 BU and image-estimated .48 BU as alternatives, with image-estimated as fitting baseline.
4. Wings: flat, broad custom-mesh wedge / leaflike forms. Avoid ellipsoid spheres. Use original 3/4 and side silhouettes for fitting.
5. Tail must flow upward from body surface, not float as a separate spike.
6. Render orthographic front, side, back, top from a SINGLE mesh; match field of view and silhouette against the original, acknowledging that illustration viewpoints are not perfectly orthographic.
7. Report silhouette deviation and unresolved landmarks after iteration; do not claim verified from source alone.

## Missing or ambiguous
- Original upper/lower head views do not define underside reliably.
- Full three-dimensional wing thickness/shape and tail position on Y require iteration.
- Total Y depth, exact cranial rotation and eye inset remain estimates.
