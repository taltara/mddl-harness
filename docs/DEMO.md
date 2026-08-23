# Reproducing the screenshots

The studio is a Vite app in this repo, so the canvas shots in the readme come
from a real run rather than a mockup.

```sh
pnpm install
pnpm dev
```

Then open <http://localhost:5173> and, for a clean frame:

1. **Dismiss hint** — clears the callout over the canvas.
2. **Hide overlay** — collapses the YAML drawer, which otherwise takes about
   forty percent of the height.
3. **Fit view** — the control at the bottom-left of the canvas.

A 1600x900 window gives the readme image its proportions. The starter graph is
what loads on a fresh `localStorage`, so **Reset** in the header returns to
exactly the state the screenshot was taken from.

`.claude/launch.json` declares the same server for editors that read it.

## Regenerating the readme image

`scripts/shoot-studio.mjs` drives the same three steps and writes
`docs/studio.png`, so the picture and these instructions cannot drift apart:

```sh
pnpm dev                        # in another shell
npm i -D playwright-core
node scripts/shoot-studio.mjs
```

It uses the installed Chrome through Playwright's `channel` option, so nothing
downloads a browser. The shot is taken at 1600x900 with a 2x device pixel ratio
and then halved, which is why it stays sharp on a retina display.

It also selects a node before shooting. An unselected canvas leaves the
inspector showing the standalone-mode caveat panel, which is accurate but is not
what the tool looks like in use.
