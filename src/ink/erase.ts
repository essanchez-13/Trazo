import type { EraserSettings, ImageItem, Point, Stroke } from '../types'
import { uid } from '../types'
import { imageBox, strokeBox, strokeHits } from './render'

/** ¿Este trazo entra en lo que el borrador tiene permitido borrar? */
export function erasable(s: Stroke, e: EraserSettings) {
  if (s.tool === 'highlighter') return e.highlighter
  if (s.shape) return e.shapes
  return e.pen
}

/** Agrega puntos intermedios para que el borrado parcial corte con precisión. */
function densify(pts: Point[], step: number): Point[] {
  const out: Point[] = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)
    for (let k = 1; k <= n; k++) {
      const t = k / n
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (a[2] ?? 0.5) + ((b[2] ?? 0.5) - (a[2] ?? 0.5)) * t])
    }
  }
  return out
}

/**
 * Borra solo la parte del trazo que toca el borrador y devuelve los pedazos que quedan.
 * Devuelve null si el borrador no lo tocó.
 */
export function splitStroke(s: Stroke, p: Point, r: number): Stroke[] | null {
  if (!strokeHits(s, p, r)) return null
  const reach = r + s.size * 0.4
  const src = s.closed ? [...s.points, s.points[0]] : s.points
  const pts = densify(src, Math.max(1.2, r / 3))
  const pieces: Point[][] = []
  let run: Point[] = []
  let touchesEnd = false
  pts.forEach((q, i) => {
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) > reach) {
      run.push(q)
      if (i === pts.length - 1) touchesEnd = true
    } else if (run.length) {
      pieces.push(run)
      run = []
    }
  })
  if (run.length) pieces.push(run)
  return pieces
    .filter((piece) => piece.length >= 2)
    .map((piece, i, all) => ({
      ...s,
      id: uid(),
      points: piece,
      closed: false,
      fill: false,
      // La punta de flecha solo sigue en el pedazo que conserva el final del trazo.
      arrow: s.arrow && touchesEnd && i === all.length - 1,
    }))
}

/** Aplica el borrador en un punto sobre la lista de trazos e imágenes. */
export function eraseAt(
  strokes: Stroke[],
  images: ImageItem[],
  p: Point,
  e: EraserSettings,
): { strokes: Stroke[]; images: ImageItem[]; changed: boolean } {
  const r = e.size
  let changed = false
  const nextStrokes: Stroke[] = []
  for (const s of strokes) {
    const b = strokeBox(s)
    if (!erasable(s, e) || p[0] < b.minX - r || p[0] > b.maxX + r || p[1] < b.minY - r || p[1] > b.maxY + r) {
      nextStrokes.push(s)
      continue
    }
    if (e.mode === 'stroke') {
      if (strokeHits(s, p, r)) changed = true
      else nextStrokes.push(s)
    } else {
      const pieces = splitStroke(s, p, r)
      if (pieces) { changed = true; nextStrokes.push(...pieces) } else nextStrokes.push(s)
    }
  }
  let nextImages = images
  if (e.images) {
    nextImages = images.filter((im) => {
      if (im.locked) return true
      const b = imageBox(im)
      const hit = p[0] >= b.minX - r && p[0] <= b.maxX + r && p[1] >= b.minY - r && p[1] <= b.maxY + r
      if (hit) changed = true
      return !hit
    })
  }
  return { strokes: changed ? nextStrokes : strokes, images: nextImages, changed }
}
