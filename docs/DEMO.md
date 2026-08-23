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

## Adding the readme image

Save the frame as `docs/studio.png` and put this under the opening paragraph of
the readme:

```markdown
![The studio: models and tools wired into an agent loop, compiling to a cordis.patch.yml overlay](docs/studio.png)
```

The line is not there yet on purpose. A readme that points at an image which
does not exist renders a broken frame on the repository front page, which is a
worse first impression than prose.
