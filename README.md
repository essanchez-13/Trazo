# Trazo

Cuadernos digitales para escribir a mano en Windows, al estilo de GoodNotes: tinta con presión, carpetas y cuadernos ilimitados, pestañas, stickers, imágenes, índice, pizarra con diagramas, PDFs y portadas personalizables.

Hecha con Electron + React + TypeScript. Las notas se guardan solo en la computadora (`%APPDATA%\trazo\data`).

## Desarrollo

```bash
npm install
npm run dev      # versión web en el navegador (http://localhost:5173)
npm run app      # app de escritorio con recarga en vivo
```

## Compilar el instalador

```bash
npm run build
npx electron-builder --win --publish never
```

El instalador queda en `release/`. Desde PowerShell, no desde Git Bash: en Git Bash el paso de NSIS falla con `spawn UNKNOWN`.

## Ícono

El ícono se genera desde `scripts/make-icon.cjs` (`npm run icon`), que crea `build/icon.ico` con versiones para cada tamaño.

## Estructura

- `electron/`: ventana, guardado de archivos y actualizaciones.
- `src/components/`: biblioteca, editor, página (`PageCanvas`), menús y paneles.
- `src/ink/`: motor de tinta, hojas, figuras y diagramas.
- `src/exporter.ts`: exportar e importar PDF y archivos `.trazo`.
