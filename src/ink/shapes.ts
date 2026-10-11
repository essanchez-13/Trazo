import type { Point, ShapeTool } from '../types'

// Reconocimiento de figuras al "mantener" el lápiz quieto al final de un trazo:
// líneas, triángulos, rectángulos, polígonos y elipses.

export type ShapeKind = 'line' | 'polyline' | 'polygon' | 'ellipse'
export interface Shape { kind: ShapeKind; points: Point[]; closed: boolean }

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])

export function segDist(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const l2 = dx * dx + dy * dy
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

function rdp(pts: Point[], eps: number): Point[] {
  if (pts.length < 3) return pts.slice()
  const a = pts[0], b = pts[pts.length - 1]
  let idx = 0, max = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segDist(pts[i], a, b)
    if (d > max) { max = d; idx = i }
  }
  if (max <= eps) return [a, b]
  const left = rdp(pts.slice(0, idx + 1), eps)
  return left.slice(0, -1).concat(rdp(pts.slice(idx), eps))
}

/** Endereza una línea a horizontal, vertical o 45° si está casi alineada. */
export function snapLineEnd(a: Point, b: Point): Point {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const len = Math.hypot(dx, dy)
  const ang = Math.atan2(dy, dx)
  const step = Math.PI / 4
  const nearest = Math.round(ang / step) * step
  if (Math.abs(ang - nearest) < (5 * Math.PI) / 180) {
    return [a[0] + Math.cos(nearest) * len, a[1] + Math.sin(nearest) * len, 0.5]
  }
  return [b[0], b[1], 0.5]
}

/** Quita vértices donde el trazo casi no cambia de dirección. */
function dropFlatVertices(v: Point[]): Point[] {
  const out = v.slice()
  let changed = true
  while (changed && out.length > 3) {
    changed = false
    for (let i = 0; i < out.length; i++) {
      const p = out[(i - 1 + out.length) % out.length], c = out[i], n = out[(i + 1) % out.length]
      const a1 = Math.atan2(c[1] - p[1], c[0] - p[0])
      const a2 = Math.atan2(n[1] - c[1], n[0] - c[0])
      let turn = Math.abs(a2 - a1)
      if (turn > Math.PI) turn = 2 * Math.PI - turn
      if (turn < (28 * Math.PI) / 180) { out.splice(i, 1); changed = true; break }
    }
  }
  return out
}

const P = (x: number, y: number): Point => [x, y, 0.5]

export function recognize(pts: Point[]): Shape | null {
  if (pts.length < 3) return null
  let len = 0
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    if (i) len += dist(pts[i - 1], p)
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0])
    minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1])
  }
  const w = maxX - minX, h = maxY - minY, size = Math.max(w, h)
  if (len < 16) return null

  const start = pts[0], end = pts[pts.length - 1]
  const chord = dist(start, end)

  // Línea recta
  let maxDev = 0
  for (const p of pts) maxDev = Math.max(maxDev, segDist(p, start, end))
  if (chord > 0.6 * len && maxDev < Math.max(5, chord * 0.1)) {
    return { kind: 'line', points: [P(start[0], start[1]), snapLineEnd(start, end)], closed: false }
  }

  const closed = chord < Math.max(20, 0.25 * size) && len > 1.8 * size
  if (closed) {
    if (w < 8 || h < 8) return null
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, rx = w / 2, ry = h / 2
    let err = 0
    for (const p of pts) err += Math.abs(Math.hypot((p[0] - cx) / rx, (p[1] - cy) / ry) - 1)
    err /= pts.length

    let v = rdp(pts, size * 0.08)
    if (v.length > 1 && dist(v[0], v[v.length - 1]) < 0.3 * size) v.pop()
    v = dropFlatVertices(v)

    if (v.length === 3) return { kind: 'polygon', points: v.map((p) => P(p[0], p[1])), closed: true }
    if (v.length === 4 && err > 0.085) {
      const axisAligned = v.every((p, i) => {
        const n = v[(i + 1) % 4]
        const a = Math.abs(Math.atan2(n[1] - p[1], n[0] - p[0])) % (Math.PI / 2)
        return a < 0.21 || a > Math.PI / 2 - 0.21
      })
      const quad = axisAligned
        ? [P(minX, minY), P(maxX, minY), P(maxX, maxY), P(minX, maxY)]
        : v.map((p) => P(p[0], p[1]))
      return { kind: 'polygon', points: quad, closed: true }
    }
    if (err < 0.14) {
      let erx = rx, ery = ry
      if (Math.abs(w - h) < 0.15 * size) erx = ery = (rx + ry) / 2
      const out: Point[] = []
      for (let i = 0; i < 96; i++) {
        const t = (i / 96) * Math.PI * 2
        out.push(P(cx + Math.cos(t) * erx, cy + Math.sin(t) * ery))
      }
      return { kind: 'ellipse', points: out, closed: true }
    }
    if (v.length >= 5 && v.length <= 6) return { kind: 'polygon', points: v.map((p) => P(p[0], p[1])), closed: true }
    return null
  }

  // Línea quebrada (por ejemplo, una flecha o un ángulo)
  const simp = rdp(pts, Math.max(5, size * 0.07))
  if (simp.length <= 5) return { kind: 'polyline', points: simp.map((p) => P(p[0], p[1])), closed: false }
  return null
}

// ---- Herramienta de formas: se arrastra de una esquina a la otra ----

export function buildShape(kind: ShapeTool, a: Point, b: Point, constrain: boolean): Shape {
  if (kind === 'line' || kind === 'arrow') {
    let end = snapLineEnd(a, b)
    if (constrain) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      const ang = Math.round(Math.atan2(b[1] - a[1], b[0] - a[0]) / (Math.PI / 4)) * (Math.PI / 4)
      end = P(a[0] + Math.cos(ang) * len, a[1] + Math.sin(ang) * len)
    }
    return { kind: 'line', points: [P(a[0], a[1]), end], closed: false }
  }

  let w = b[0] - a[0], h = b[1] - a[1]
  if (constrain) {
    const s = Math.max(Math.abs(w), Math.abs(h))
    w = Math.sign(w || 1) * s
    h = Math.sign(h || 1) * s
  }
  const x0 = Math.min(a[0], a[0] + w), y0 = Math.min(a[1], a[1] + h)
  const x1 = Math.max(a[0], a[0] + w), y1 = Math.max(a[1], a[1] + h)
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2

  if (kind === 'rect') return { kind: 'polygon', points: [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], closed: true }
  if (kind === 'diamond') return { kind: 'polygon', points: [P(cx, y0), P(x1, cy), P(cx, y1), P(x0, cy)], closed: true }
  if (kind === 'triangle') return { kind: 'polygon', points: [P(cx, y0), P(x1, y1), P(x0, y1)], closed: true }
  if (kind === 'ellipse') {
    const out: Point[] = []
    for (let i = 0; i < 96; i++) {
      const t = (i / 96) * Math.PI * 2
      out.push(P(cx + (Math.cos(t) * (x1 - x0)) / 2, cy + (Math.sin(t) * (y1 - y0)) / 2))
    }
    return { kind: 'ellipse', points: out, closed: true }
  }
  // Rectángulo con esquinas redondeadas
  const r = Math.min(18, (x1 - x0) / 3, (y1 - y0) / 3)
  const out: Point[] = []
  const corner = (ccx: number, ccy: number, from: number) => {
    for (let i = 0; i <= 8; i++) {
      const t = from + (i / 8) * (Math.PI / 2)
      out.push(P(ccx + Math.cos(t) * r, ccy + Math.sin(t) * r))
    }
  }
  corner(x1 - r, y0 + r, -Math.PI / 2)
  corner(x1 - r, y1 - r, 0)
  corner(x0 + r, y1 - r, Math.PI / 2)
  corner(x0 + r, y0 + r, Math.PI)
  return { kind: 'polygon', points: out, closed: true }
}

// ---- Limpieza del trazo ----
// Solo se quita un "ganchito" diminuto y brusco al levantar el lápiz.
// Nunca se recortan tramos reales del trazo.

export function cleanStroke(pts: Point[]): Point[] {
  if (pts.length < 6) return pts
  const end = pts[pts.length - 1]
  let i = pts.length - 1, d = 0
  while (i > 0 && d < 2.5) { d += dist(pts[i], pts[i - 1]); i-- }
  if (i < 3 || d < 0.8) return pts
  const hs = pts[i]
  let j = i, d2 = 0
  while (j > 0 && d2 < 8) { d2 += dist(pts[j], pts[j - 1]); j-- }
  if (d2 < 6) return pts
  const before = pts[j]
  const a1 = Math.atan2(hs[1] - before[1], hs[0] - before[0])
  const a2 = Math.atan2(end[1] - hs[1], end[0] - hs[0])
  let turn = Math.abs(a2 - a1)
  if (turn > Math.PI) turn = 2 * Math.PI - turn
  return turn > 1.9 ? pts.slice(0, i + 1) : pts
}

/**
 * Convierte la presión cruda del lápiz a una más estable: nunca llega a cero
 * (así el inicio y el final no desaparecen) y no se dispara al presionar fuerte.
 */
export const mapPressure = (raw: number) => 0.32 + 0.68 * Math.min(1, Math.max(0, raw)) ** 0.85
