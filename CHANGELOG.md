# Changes

## 2026-10-28 - Opening dust

- Add a stable brightness gradient to roughly 20% of opening particles, preserving the dark base and visibility mask.
- Vary the base size of roughly 40% of particles by up to +/-15%, independently of brightness.
- Add up to 15% extra near-camera size, fading smoothly over distances 1200-6500 scene units. Existing perspective scaling still applies. Combined maximum size multiplier is 1.3225.
- All changes are confined to `VS_PARTICLE`, `st(s==0)` in `app/src/scene/shaders.js`. Core, explosion and world states retain their existing settings. No new particles, buffers or textures.
- Verified with 23 tests, ESLint and a production build. Earlier performance measurements predate these changes.

To integrate only the dust adjustment, merge the opening `st(s==0)` block into the matching shader. Keep your project's copy, palettes and other scene states.

## 2026-10-28 - Public demo

- Replace product copy with neutral English demo phrases, six slides and short supporting sections.
- Translate controls, accessibility labels and page metadata; rename progress endpoints to START / VIEW.
- Generate scene glyphs from the Latin demo phrases and use Latin font-readiness samples.
- Add automatic GitHub Pages deployment from main with tests, lint and build checks.
