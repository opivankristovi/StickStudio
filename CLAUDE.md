# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

StickStudio is a browser-only stick-figure comic editor written in plain vanilla JS and SVG. It has no npm, no bundler, no dependencies, no tests and no linter. The shipped artifact is one self-contained `index.html` that works offline from `file://`.

## Commands

```powershell
# Rebuild index.html after ANY change to src/, css/ or js/
powershell -ExecutionPolicy Bypass -File build.ps1

# Optional static server at http://localhost:8765 (opening index.html directly also works)
powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 8765]
```

## Build model (important)

- `index.html` is **generated**, so never edit it by hand. Your edits would be overwritten on the next build.
- `build.ps1` takes `src/index.template.html` and inlines into it every `<link rel="stylesheet" href="...">` and every `<script src="..."></script>` by regex. The tags must keep exactly that form (attribute order and quoting included), or they won't be inlined.
- Script order in the template matters: `figures.js` → `objects.js` → `balloons.js` → `pdf.js` → `app.js`.
- Everything has to keep working offline from a `file://` URL. Don't add CDN or network dependencies, ES modules or `fetch` of local files.

## Architecture

Each file in `js/` is an IIFE. Files talk to each other only through these globals:

| Global | File | Role |
|---|---|---|
| `FIG` | `figures.js` | Parametric figure engine. A figure is character (costume + proportions) × pose (absolute joint angles in degrees: 0 = down, 90 = forward, 180 = up) × expression × effects. Figures are drawn facing right in a 120×220 native box (`NW`/`NH`, ground at `GROUND`). Flipping is done by the item transform. |
| `OBJ` | `objects.js` | `OBJECTS` (props, each drawn in its own native `w`×`h` box, ground at the bottom) and `SCENES` (panel backgrounds in a 400×300 box, scaled with `slice` to cover the panel). |
| `BAL` | `balloons.js` | Balloon styles, fonts, text layout and `fit()` auto-sizing. |
| `PDF` | `pdf.js` | A small dependency-free PDF writer (one JPEG per page) and a zip writer. |
| `StickStudio` | `app.js` | The editor. It exposes `doc`, `state`, `renderAll`, `rasterize`, `makePdf` and `_migrate` for debugging in the console. |

Library items draw themselves as **SVG strings**: `svg(it)` and `draw(it)` return markup, and `app.js` puts it together with string templates.

### Document model (`app.js`)

- `doc = { id, title, format, mono, pages[] }`. Each page is `{ id, layout, panels: {key: panelData}, items[], format? }`.
- Panels are not stored as rectangles. `computePanels(pg)` derives them from `layout` (`rows`, `cols[]` per row, `heights[]`, `widths[][]` ratios, `margin`, `gutter`, title). Panel keys are `"row-col"` strings such as `"1-0"`. `pg.panels[key]` holds only per-panel settings (scene, bg, zoom…).
- Items (`type: 'figure' | 'object' | 'balloon'`) store `x`/`y` **relative to their panel** (`it.panel`) and the centre of the item. `it.pw`/`it.ph` record the panel size the item was laid out for. `panelFor()` rescales the item lazily when the panel size changes, so changing the layout keeps the composition. If you change layouts, use `remapPanels()` to move panel data and items to new keys.
- `migrateDoc()` is the single gate for every document loaded from localStorage, files or older versions. It repairs or drops invalid data. **Whenever you add a field or an enum value, update `migrateDoc` too**, and keep old files loading.

### Render / state flow

- `pageContent(pg, {export, mono})` builds the full page SVG. The editor and every export path (PNG, PDF, print/vector PDF, strip) go through it, and `export: true` removes the editor overlay and hit rects. Rendering is a full `innerHTML` re-render, with no virtual DOM.
- `state` holds transient UI state: current page, selection, zoom, library tab, drag and clipboard. It is never persisted.
- To mutate, change `doc`, then call `commit()` (or `commitSoon()` for debounced input). That pushes a JSON snapshot onto the undo history (max 150), saves to localStorage and refreshes the dirty marker and thumbnails. Undo/redo restores whole-document snapshots.
- localStorage keys: `stickstudio.doc.v1` (current doc), `stickstudio.projects.v1` (project index), `stickstudio.proj.<id>` (each project), `stickstudio.mychars.v1` (saved "My characters"), `stickstudio.helpSeen`.

### Export

- Raster exports use `rasterize()`, which takes the SVG string, draws it through an `Image` onto a canvas and returns PNG/JPEG. `PDF.build()` and `PDF.zip()` package the results.
- Vector PDF uses the browser print dialog (`printPages`).

## Conventions

- The UI text is English and written for non-technical users. Keep `README.md` (the user-facing feature list and shortcuts) and the in-app help modal in `src/index.template.html` in sync when you add features or shortcuts.
- Ink colour defaults to `#1d1d1d` and paper to `#ffffff`. Library drawings use the stroke and fill set on the parent `<g>`, so they can be recoloured.
