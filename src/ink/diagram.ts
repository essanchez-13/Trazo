import type { DiagramLink, DiagramNode, Point } from '../types'
import { INK } from '../types'
import { segDist } from './shapes'

// Figuras de diagrama (con texto) y conectores que las siguen al moverlas.

export const FONT = '"Inter Variable", system-ui, sans-serif'
const LIGHT_INK = '#eceef1'

/** Puntos de conexión: 0 arriba, 1 derecha, 2 abajo, 3 izquierda. */
export type Port = 0 | 1 | 2 | 3
export const DIRS: Point[] = [[0, -1], [1, 0], [0, 1], [-1, 0]]

export function nodePath(n: DiagramNode): Path2D {
  const p = new Path2D()
  const { x, y, w, h } = n
  if (n.kind === 'ellipse') p.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
  else if (n.kind === 'diamond') {
    p.moveTo(x + w / 2, y); p.lineTo(x + w, y + h / 2); p.lineTo(x + w / 2, y + h); p.lineTo(x, y + h / 2); p.closePath()
  } else if (n.kind === 'rounded') p.roundRect(x, y, w, h, Math.min(16, w / 4, h / 4))
  else if (n.kind === 'note') {
    const f = Math.min(22, w / 5, h / 5)
    p.moveTo(x, y); p.lineTo(x + w, y); p.lineTo(x + w, y + h - f); p.lineTo(x + w - f, y + h); p.lineTo(x, y + h); p.closePath()
  } else p.rect(x, y, w, h)
  return p
}

/** Parte el texto en líneas que caben en el ancho disponible. */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/)) {
      if (!word) continue
      const test = line ? line + ' ' + word : word
      if (ctx.measureText(test).width <= maxW || !line) line = test
      else { out.push(line); line = word }
    }
    out.push(line)
  }
  return out
}

/** Área útil para el texto dentro de cada figura. */
export function textBox(n: DiagramNode) {
  const k = n.kind === 'diamond' ? 0.58 : n.kind === 'ellipse' ? 0.74 : 1
  const w = n.w * k - 20
  return { x: n.x + (n.w - w) / 2, w: Math.max(20, w) }
}

export const textColor = (n: DiagramNode, dark: boolean) => {
  if (n.fill) return n.color === INK || n.color === LIGHT_INK ? INK : n.color
  return dark && n.color === INK ? LIGHT_INK : n.color
}

export function drawNode(ctx: CanvasRenderingContext2D, n: DiagramNode, dark: boolean, hideText = false) {
  const path = nodePath(n)
  ctx.save()
  if (n.fill && n.kind !== 'text') {
    ctx.shadowColor = 'rgba(0,0,0,0.12)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 2
    ctx.fillStyle = n.fill
    ctx.fill(path)
    ctx.shadowColor = 'transparent'
  }
  if (n.kind !== 'text') {
    ctx.strokeStyle = !n.fill && dark && n.color === INK ? LIGHT_INK : n.color
    ctx.lineWidth = 2.4
    ctx.lineJoin = 'round'
    ctx.stroke(path)
    if (n.kind === 'note') {
      const f = Math.min(22, n.w / 5, n.h / 5)
      ctx.beginPath()
      ctx.moveTo(n.x + n.w, n.y + n.h - f); ctx.lineTo(n.x + n.w - f, n.y + n.h - f); ctx.lineTo(n.x + n.w - f, n.y + n.h)
      ctx.stroke()
    }
  }
  if (!hideText && n.text) {
    ctx.font = `500 ${n.fontSize}px ${FONT}`
    ctx.fillStyle = textColor(n, dark)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const tb = textBox(n)
    const lines = wrapText(ctx, n.text, tb.w)
    const lh = n.fontSize * 1.3
    const top = n.y + n.h / 2 - ((lines.length - 1) * lh) / 2
    lines.forEach((l, i) => ctx.fillText(l, n.x + n.w / 2, top + i * lh))
  }
  ctx.restore()
}

// ---- Puntos de conexión ----

/** Punto medio de cada lado, justo sobre el borde de la figura. */
export function portPoint(n: DiagramNode, p: Port): Point {
  if (p === 0) return [n.x + n.w / 2, n.y]
  if (p === 1) return [n.x + n.w, n.y + n.h / 2]
  if (p === 2) return [n.x + n.w / 2, n.y + n.h]
  return [n.x, n.y + n.h / 2]
}

/** Los cuatro puntitos que se muestran (un poco afuera del borde). */
export const ports = (n: DiagramNode): Point[] =>
  ([0, 1, 2, 3] as Port[]).map((p) => {
    const q = portPoint(n, p)
    return [q[0] + DIRS[p][0] * 14, q[1] + DIRS[p][1] * 14]
  })

export function nearestPort(n: DiagramNode, pt: Point): Port {
  let best: Port = 0, bd = Infinity
  for (const p of [0, 1, 2, 3] as Port[]) {
    const q = portPoint(n, p)
    const d = Math.hypot(q[0] - pt[0], q[1] - pt[1])
    if (d < bd) { bd = d; best = p }
  }
  return best
}

/** Punto del borde de la figura en dirección a `toward` (conectores sin punto fijo). */
export function anchorPoint(n: DiagramNode, toward: Point): Point {
  const cx = n.x + n.w / 2, cy = n.y + n.h / 2
  const dx = toward[0] - cx, dy = toward[1] - cy
  if (!dx && !dy) return [cx, cy]
  const w2 = n.w / 2, h2 = n.h / 2
  let t: number
  if (n.kind === 'ellipse') t = 1 / Math.hypot(dx / w2, dy / h2)
  else if (n.kind === 'diamond') t = 1 / (Math.abs(dx) / w2 + Math.abs(dy) / h2)
  else t = Math.min(dx ? w2 / Math.abs(dx) : Infinity, dy ? h2 / Math.abs(dy) : Infinity)
  return [cx + dx * t, cy + dy * t]
}

const center = (n: DiagramNode): Point => [n.x + n.w / 2, n.y + n.h / 2]

// ---- Rutas de los conectores ----

export interface Route {
  kind: 'straight' | 'elbow' | 'curve'
  /** Para 'curve': [inicio, control1, control2, fin]. Para las demás: la polilínea. */
  points: Point[]
  /** Tramo central que se puede arrastrar para mover el doblez. */
  mid?: { a: Point; b: Point; axis: 'x' | 'y' }
}

const GAP = 26

function simplify(pts: Point[]): Point[] {
  const out: Point[] = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (last && Math.abs(last[0] - p[0]) < 0.5 && Math.abs(last[1] - p[1]) < 0.5) continue
    if (out.length >= 2) {
      const a = out[out.length - 2], b = out[out.length - 1]
      const collinear = (Math.abs(a[0] - b[0]) < 0.5 && Math.abs(b[0] - p[0]) < 0.5) || (Math.abs(a[1] - b[1]) < 0.5 && Math.abs(b[1] - p[1]) < 0.5)
      if (collinear) { out[out.length - 1] = p; continue }
    }
    out.push(p)
  }
  return out
}

/** Camino en ángulos rectos entre dos puntos que salen en las direcciones dadas. */
export function elbowPath(p1: Point, d1: Point, p2: Point, d2: Point | null, mid?: number): Route {
  const q1: Point = [p1[0] + d1[0] * GAP, p1[1] + d1[1] * GAP]
  const q2: Point = d2 ? [p2[0] + d2[0] * GAP, p2[1] + d2[1] * GAP] : p2
  const h1 = d1[0] !== 0
  const h2 = d2 ? d2[0] !== 0 : !h1
  let pts: Point[]
  let midSeg: Route['mid']
  if (h1 && h2) {
    const mx = mid ?? (q1[0] + q2[0]) / 2
    pts = [p1, q1, [mx, q1[1]], [mx, q2[1]], q2, p2]
    midSeg = { a: [mx, q1[1]], b: [mx, q2[1]], axis: 'x' }
  } else if (!h1 && !h2) {
    const my = mid ?? (q1[1] + q2[1]) / 2
    pts = [p1, q1, [q1[0], my], [q2[0], my], q2, p2]
    midSeg = { a: [q1[0], my], b: [q2[0], my], axis: 'y' }
  } else if (h1) pts = [p1, q1, [q2[0], q1[1]], q2, p2]
  else pts = [p1, q1, [q1[0], q2[1]], q2, p2]
  return { kind: 'elbow', points: simplify(pts), mid: midSeg }
}

export function linkRoute(l: DiagramLink, a: DiagramNode, b: DiagramNode): Route {
  if (l.fromPort === undefined || l.toPort === undefined || l.style === 'straight') {
    const p1 = l.fromPort !== undefined ? portPoint(a, l.fromPort as Port) : anchorPoint(a, center(b))
    const p2 = l.toPort !== undefined ? portPoint(b, l.toPort as Port) : anchorPoint(b, center(a))
    return { kind: 'straight', points: [p1, p2] }
  }
  const p1 = portPoint(a, l.fromPort as Port), p2 = portPoint(b, l.toPort as Port)
  const d1 = DIRS[l.fromPort], d2 = DIRS[l.toPort]
  if (l.style === 'curve') {
    const k = Math.max(50, Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 0.45)
    return { kind: 'curve', points: [p1, [p1[0] + d1[0] * k, p1[1] + d1[1] * k], [p2[0] + d2[0] * k, p2[1] + d2[1] * k], p2] }
  }
  return elbowPath(p1, d1, p2, d2, l.mid)
}

/** Los dos extremos del conector (para los tiradores). */
export const routeEnds = (r: Route): [Point, Point] => [r.points[0], r.points[r.points.length - 1]]

function head(ctx: CanvasRenderingContext2D, from: Point, to: Point) {
  const ang = Math.atan2(to[1] - from[1], to[0] - from[0])
  const len = 13
  ctx.beginPath()
  ctx.moveTo(to[0] - Math.cos(ang - 0.42) * len, to[1] - Math.sin(ang - 0.42) * len)
  ctx.lineTo(to[0], to[1])
  ctx.lineTo(to[0] - Math.cos(ang + 0.42) * len, to[1] - Math.sin(ang + 0.42) * len)
  ctx.closePath()
  ctx.fill()
}

export function drawRoute(ctx: CanvasRenderingContext2D, r: Route, color: string, arrow: DiagramLink['arrow'], dashed = false) {
  const pts = r.points
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (dashed) ctx.setLineDash([9, 7])
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  if (r.kind === 'curve') {
    ctx.bezierCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1])
  } else {
    // Esquinas redondeadas en los dobleces.
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1]
      const rad = Math.min(12, Math.hypot(b[0] - a[0], b[1] - a[1]) / 2, Math.hypot(c[0] - b[0], c[1] - b[1]) / 2)
      ctx.arcTo(b[0], b[1], c[0], c[1], rad)
    }
    ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1])
  }
  ctx.stroke()
  ctx.setLineDash([])
  const n = pts.length
  if (arrow !== 'none') head(ctx, pts[n - 2], pts[n - 1])
  if (arrow === 'both') head(ctx, pts[1], pts[0])
  ctx.restore()
}

export function drawLinks(ctx: CanvasRenderingContext2D, links: DiagramLink[], nodes: DiagramNode[], dark: boolean) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  for (const l of links) {
    const a = byId.get(l.from), b = byId.get(l.to)
    if (!a || !b) continue
    drawRoute(ctx, linkRoute(l, a, b), dark && l.color === INK ? LIGHT_INK : l.color, l.arrow, l.dashed)
  }
}

/** Puntos a lo largo de la ruta (para detectar toques sobre el conector). */
export function routeSamples(r: Route): Point[] {
  if (r.kind !== 'curve') return r.points
  const [p0, p1, p2, p3] = r.points
  const out: Point[] = []
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, u = 1 - t
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ])
  }
  return out
}

export function nodeAt(nodes: DiagramNode[], p: Point, pad = 0): DiagramNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i]
    if (p[0] >= n.x - pad && p[0] <= n.x + n.w + pad && p[1] >= n.y - pad && p[1] <= n.y + n.h + pad) return n
  }
  return null
}

export function linkAt(links: DiagramLink[], nodes: DiagramNode[], p: Point, r: number): DiagramLink | null {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  for (let i = links.length - 1; i >= 0; i--) {
    const a = byId.get(links[i].from), b = byId.get(links[i].to)
    if (!a || !b) continue
    const s = routeSamples(linkRoute(links[i], a, b))
    for (let k = 0; k < s.length - 1; k++) if (segDist(p, s[k], s[k + 1]) <= r) return links[i]
  }
  return null
}
