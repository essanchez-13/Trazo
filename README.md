# Trazo

**Handwritten digital notebooks for Windows.** Trazo is a desktop note-taking app built for pen tablets: pressure-sensitive ink, unlimited notebooks and folders, PDF annotation, a whiteboard with diagrams, and automatic updates. I built it as a personal replacement for subscription-based note apps and use it daily for my university classes.

**[▶ Try it in your browser](https://essanchez-13.github.io/Trazo/)** · **[⬇ Download for Windows](https://github.com/essanchez-13/trazo-releases/releases/latest/download/Trazo-Setup.exe)** · [Release notes](https://github.com/essanchez-13/trazo-releases/releases)

The web demo is the same app running in the browser. It opens with a sample notebook and whiteboard, and everything you write stays in your browser (IndexedDB): there is no server. The desktop app adds file storage on disk and automatic updates.

**Stack:** Electron · React 19 · TypeScript · Vite · HTML Canvas · perfect-freehand · pdf-lib · pdf.js · electron-updater

## Highlights

- **Pressure-sensitive ink engine** (`src/ink/render.ts`). Built on the Pointer Events API: it reads pen pressure and the eraser button, while touch input only scrolls. It offers three pen types (fountain, ballpoint, brush) with their own tapering and thinning, adjustable stabilization, and a highlighter that blends under the ink.
- **Shape recognition** (`src/ink/shapes.ts`). Hold the pen at the end of a stroke and the freehand path is recognized as a line, triangle, rectangle, polygon or ellipse, then snapped into a clean shape.
- **Stroke and precise erasers** (`src/ink/erase.ts`). The precise mode densifies the stroke and splits it at the eraser's radius, removing only the ink it touches.
- **Diagram whiteboard** (`src/ink/diagram.ts`). Nodes with text, plus port-based connectors with elbow, curved or straight routing that follow the nodes when they move.
- **PDF import and export** (`src/exporter.ts`). Imported PDF pages become locked backgrounds you can write over, and notebooks export to PDF or to a portable `.trazo` file.
- **Library.** Folders and notebooks are reorderable by drag and drop, with covers, tabs, bookmarks, stickers, images, and 11 paper styles in portrait, landscape and whiteboard formats.
- **Auto-updates.** `electron-updater` checks a public releases repo, shows an in-app download progress pill, and shows "what's new" notes generated from `src/changelog.json`.

## Engineering notes

- **English and Spanish.** UI strings go through a small `t()` helper (`src/i18n.ts`) with an English dictionary. The web demo starts in English, the desktop app in Spanish, and Settings → Language switches between them.
- **Web demo pipeline.** A GitHub Actions workflow (`.github/workflows/pages.yml`) builds the Vite app and deploys it to GitHub Pages on every push to `main`. In the browser, storage falls back to IndexedDB and first-time visitors get sample content (`src/demo.ts`).
- **Local-first and crash-safe.** Notes are JSON files in `%APPDATA%\trazo\data`. Every save writes to a temp file and renames it, so a crash mid-save can't corrupt a notebook.
- **Locked-down renderer.** The renderer runs with `contextIsolation` and `sandbox` enabled. It can only reach disk through a narrow IPC API whose keys are validated against a strict pattern. External links open only for `http(s)` URLs.
- **Backward compatible.** New page settings are optional fields, so notebooks created in older versions keep working after every update.
- **Release pipeline.** `scripts/release.ps1` builds the NSIS installer, generates release notes and publishes them to GitHub Releases. `scripts/make-icon.cjs` renders a multi-resolution `.ico` with a simplified design for small sizes.

## Project structure

```
electron/          main process: window, atomic file storage, auto-updates
src/components/    library, editor, page canvas, menus and panels
src/ink/           ink rendering, shapes, eraser, diagrams
src/exporter.ts    PDF and .trazo import/export
scripts/           icon generation and release automation
```

## Running locally

```bash
npm install
npm run dev    # web version in the browser (uses IndexedDB)
npm run app    # desktop app with live reload
npm run dist   # build the Windows installer into release/
```

Build the installer from PowerShell; NSIS fails under Git Bash with `spawn UNKNOWN`.

---

© Esteban Sánchez. The source is published as a portfolio piece. All rights reserved.
