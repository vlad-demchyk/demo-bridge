# Bridge - Motion Demo

A visual demo of words, particles, a city and a bridge. Neutral placeholder copy; no product pitch, accounts or analytics.

Scroll to explore, choose a checkpoint, or press **Watch** for automatic playback. Music is optional and starts only after Watch is pressed.

## Local development

```sh
cd app
npm ci
npm run dev
```

## Build and check

```sh
cd app
npm test
npm run lint
npm run build
```

The static site is generated in `app/dist`. GitHub Actions deploys it to GitHub Pages on pushes to `main`. Asset paths support the `/demo-bridge/` subdirectory.

The custom WebGL2 renderer lives in `app/src/scene/`. Edit demo copy in `app/src/content/landing.js`; the scene uses the phrases as its glyph source. Local images, fonts and audio are in `app/public/`.

Requires a modern browser with WebGL2. Respect the license notices included with the bundled fonts and the repository license.
