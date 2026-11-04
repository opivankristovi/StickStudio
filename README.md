# StickStudio – stick-figure cartoon maker

**▶ Try it online: https://opivankristovi.github.io/StickStudio/**

Open **`index.html`** in Chrome, Edge or Firefox. Nothing to install and no internet needed.
`index.html` is a single self-contained file (all styles and code inlined), so you can copy it anywhere.

### Editing the source
The source lives in `src/index.template.html`, `css/` and `js/`. After changing anything, rebuild the single file:

    powershell -ExecutionPolicy Bypass -File build.ps1

(Optional: `powershell -ExecutionPolicy Bypass -File serve.ps1` serves it at http://localhost:8765.)

## What you can do
- **Layout**: pick from 16 quick layouts (classic page, splash, staggered, 4-koma, …), or set the number of rows, the panels per row and each row's height. Click a panel to change its **width**, **split** it or **merge** it with its neighbour. You can also set margins, gutter, border width and colour, rounded corners and a page title. Each page can use the cartoon's format or its own (e.g. a wide strip page inside an A4 book). "Use this layout on all pages" copies a layout to every page.
- **Pages**: add, duplicate, delete, and drag the **page thumbnails** at the bottom to reorder them (PgUp/PgDn to switch pages).
- **Characters**: Boy, Girl, Man, Woman, Cop, King, Queen, Knight, Wizard, Chef, Doctor, Pirate, Baby and Robot. Each has 30 poses (walk, run, panic, jump, wave, point, think, confused, shocked, angry, fight, kick, sit, kneel, bow, fly, …), 17 facial expressions, 12 effects (speed lines, sweat, anger mark, !?, hearts, Zzz, idea bulb, …) and 23 things to hold in either hand.
- **Objects**: about 70 props in 8 groups (furniture, outdoors, sky, vehicles, fantasy including a dragon and horse, animals, things, effects).
- **Scenes**: 21 panel backgrounds (park, city, suburb, living room, kitchen, classroom, office, bedroom, castle, throne room, forest, beach, night, mountains, desert, road, space, dungeon, underwater, …). Per panel you can zoom, shift, mirror or fade the scene and set a background colour.
- **Balloons**: speech, boxed speech, thought, shout, whisper, caption, plain text and sound effects. Drag the orange dot to aim the tail. Double-click a balloon to type straight onto the canvas. `*bold*` and `_italic_` work in the text, and you can change font, size, alignment, capitals and colours. Balloons can resize themselves to fit the text.
- **Toolbar**: select something and the toolbar under the title bar shows the tools for it, as icon buttons with tooltips: duplicate, delete, flip, rotate in 15° steps, resize, **align in the panel** (left, centre, right, top, middle, bottom; figures stand on the panel edge with their feet), layer order and lock. For balloons it also has font, size, bold, italic, capitals and text alignment. With a panel selected it has split, merge, even widths, copy to next panel, scene on all panels and empty panel. Pose, face, colours and the other settings are in the panel on the right, in sections you can fold away.
- **Editing**: drag and drop from the library, move items between panels (they snap to panel centres and other items; hold Ctrl to stop snapping), resize from the corners (Shift = free ratio), rotate from the round handle, flip, change layers, adjust opacity, black & white, clip to the panel, lock, duplicate, copy/paste, and undo/redo. **Copy to next panel** repeats a panel's scene and cast for the next moment.
- **My characters**: style a character (clothes, hair, held items) and click *★ Save as "My character"* to reuse it from the library.
- **Export**: one Export dialog for **PDF** (image-based, 150/220/300 dpi, optional crop marks), **vector PDF** (via the print dialog → "Save as PDF", with selectable text), **PNG** per page, **all pages as a .zip**, or **one long strip image** for web/social media. Choose all pages, the current page or a range such as `1-3, 5`, set the file name, and optionally export in black & white. There's also a **Print** button.
- **Projects**: work saves automatically, and **Projects** lists every cartoon in this browser (open, copy, delete). **Save**/**Open** (or drag a `.json` onto the window) stores and loads a project file. The orange ● means there are changes that aren't saved to a file yet. Opening damaged or older files repairs them where possible.

## Shortcuts
Del delete · Ctrl+D duplicate · Ctrl+C/V copy/paste · Alt+drag copy · arrows nudge (Shift ×10) · H/V flip · +/− bigger/smaller · [ ] layer · Esc deselect · Enter / double-click edit balloon text · Ctrl+Z/Y undo/redo · Ctrl+S save · Ctrl+O open · Ctrl+E export · Ctrl+P print · PgUp/PgDn page · F1 or ? help · Ctrl+wheel zoom
