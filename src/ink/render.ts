import { getStroke } from 'perfect-freehand'
import type { DiagramNode, ImageItem, Page, Paper, PaperColor, Point, Stroke } from '../types'
import { INK, pageSize, paperInfo } from '../types'
import { getImage } from '../assets'
import { segDist } from './shapes'
import { drawLinks, drawNode } from './diagram'

function inkOptions(s: Stroke, last: boolean) {
  const streamline = s.sl ?? 0.32
  if (s.tool === 'highlighter') {
    return { size: s.size, thinning: 0, smoothing: 0.5, streamline: Math.max(streamline, 0.3), simulatePressure: false, last }
  }
  const th = s.th ?? 0.6
  if (s.pen === 'ball') {
    return { size: s.size * 0.82, thinning: 0.08, smoothing: 0.5, streamline, simulatePressure: false, last }
  }
  if (s.pen === 'brush') {
    return {
      size: s.size * 1.25, thinning: Math.min(0.9, th + 0.3), smoothing: 0.6, streamline,
      simulatePressure: !!s.sim, easing: (t: number) => t * (2 - t),
      start: { taper: 14, cap: true }, end: { taper: 18, cap: true }, last,
    }
  }
  return {
    size: s.size,
    thinning: s.sim ? 0.5 : th,
    smoothing: 0.5,
    streamline,
    simulatePressure: !!s.sim,
    easing: (t: number) => t,
    start: { cap: true, taper: s.sim ? 6 : 0 },
    end: { cap: true, taper: s.sim ? 6 : 0 },
    last,
  }
}

function outlinePath(outline: number[][]): Path2D {
  const p = new Path2D()
  if (!outline.length) return p
  p.moveTo(outline[0][0], outline[0][1])
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length]
    p.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
  }
  p.closePath()
  return p
}

function shapePath(s: Stroke): Path2D {
  const p = new Path2D()
  s.points.forEach((pt, i) => (i ? p.lineTo(pt[0], pt[1]) : p.moveTo(pt[0], pt[1])))
  if (s.closed) p.closePath()
  return p
}

const cache = new WeakMap<Stroke, Path2D>()

function pathFor(s: Stroke, live: boolean): Path2D {
  if (s.shape) return shapePath(s)
  if (live) return outlinePath(getStroke(s.points, inkOptions(s, false)))
  let p = cache.get(s)
  if (!p) {
    p = outlinePath(getStroke(s.points, inkOptions(s, true)))
    cache.set(s, p)
  }
  return p
}

export const HIGHLIGHT_ALPHA = 0.62

/** En hojas oscuras, la tinta negra por defecto se muestra clara para que se lea. */
const inkFor = (color: string, dark: boolean) => (dark && color === INK ? '#eceef1' : color)

function arrowHead(s: Stroke): Path2D | null {
  const n = s.points.length
  if (!s.arrow || n < 2) return null
  const [bx, by] = s.points[n - 1], [ax, ay] = s.points[n - 2]
  const ang = Math.atan2(by - ay, bx - ax)
  const len = Math.max(12, s.size * 3.4)
  const p = new Path2D()
  p.moveTo(bx - Math.cos(ang - 0.45) * len, by - Math.sin(ang - 0.45) * len)
  p.lineTo(bx, by)
  p.lineTo(bx - Math.cos(ang + 0.45) * len, by - Math.sin(ang + 0.45) * len)
  return p
}

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, live = false, dark = false) {
  const path = pathFor(s, live)
  const color = inkFor(s.color, dark)
  ctx.save()
  if (s.tool === 'highlighter') ctx.globalAlpha = HIGHLIGHT_ALPHA
  if (s.shape) {
    if (s.fill && s.closed) {
      ctx.save()
      ctx.globalAlpha *= 0.18
      ctx.fillStyle = color
      ctx.fill(path)
      ctx.restore()
    }
    ctx.strokeStyle = color
    ctx.lineWidth = s.tool === 'highlighter' ? s.size : s.size * 0.78
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke(path)
    const head = arrowHead(s)
    if (head) ctx.stroke(head)
  } else {
    ctx.fillStyle = color
    ctx.fill(path)
  }
  ctx.restore()
}

/** Dibuja resaltador debajo y tinta encima, como en papel. */
export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], dark = false) {
  ctx.save()
  ctx.globalCompositeOperation = dark ? 'source-over' : 'multiply'
  for (const s of strokes) if (s.tool === 'highlighter') drawStroke(ctx, s, false, dark)
  ctx.restore()
  for (const s of strokes) if (s.tool !== 'highlighter') drawStroke(ctx, s, false, dark)
}

/** Dibuja imágenes y stickers. Si alguno aún no carga, llama `onReady` cuando esté. */
export function drawImages(ctx: CanvasRenderingContext2D, images: ImageItem[], onReady: () => void) {
  for (const it of images) {
    const img = getImage(it.src, onReady)
    if (!img) continue
    const rot = ((it.rot ?? 0) * Math.PI) / 180
    const swap = (it.rot ?? 0) % 180 !== 0
    const dw = swap ? it.h : it.w, dh = swap ? it.w : it.h
    ctx.save()
    ctx.translate(it.x + it.w / 2, it.y + it.h / 2)
    if (rot) ctx.rotate(rot)
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)
    ctx.restore()
  }
}

// Espaciado de cada tipo de hoja.
const SPECS: Record<Paper, { kind: 'blank' | 'lines' | 'grid' | 'dots' | 'cornell'; gap: number; margin?: boolean }> = {
  blank: { kind: 'blank', gap: 0 },
  lined: { kind: 'lines', gap: 32, margin: true },
  'lined-narrow': { kind: 'lines', gap: 24, margin: true },
  'lined-wide': { kind: 'lines', gap: 42, margin: true },
  'lined-plain': { kind: 'lines', gap: 32 },
  grid: { kind: 'grid', gap: 26 },
  'grid-small': { kind: 'grid', gap: 16 },
  'grid-large': { kind: 'grid', gap: 40 },
  dots: { kind: 'dots', gap: 26 },
  'dots-large': { kind: 'dots', gap: 40 },
  cornell: { kind: 'cornell', gap: 32 },
}

export function drawPaper(ctx: CanvasRenderingContext2D, paper: Paper, color: PaperColor | undefined, W: number, H: number) {
  const info = paperInfo(color)
  const d = info.dark
  const spec = SPECS[paper] ?? SPECS.blank
  const g = spec.gap
  const line = d ? 'rgba(255,255,255,0.1)' : 'rgba(60,100,150,0.17)'
  const red = d ? 'rgba(255,120,120,0.22)' : 'rgba(220,90,80,0.3)'
  ctx.fillStyle = info.bg
  ctx.fillRect(0, 0, W, H)
  ctx.lineWidth = 1
  const hLines = (x0: number, x1: number, y0: number, y1: number) => {
    ctx.beginPath()
    for (let y = y0; y < y1; y += g) { ctx.moveTo(x0, y + 0.5); ctx.lineTo(x1, y + 0.5) }
    ctx.stroke()
  }
  if (spec.kind === 'lines') {
    ctx.strokeStyle = line
    hLines(0, W, 118, H - 30)
    if (spec.margin) {
      ctx.strokeStyle = red
      ctx.beginPath(); ctx.moveTo(92.5, 0); ctx.lineTo(92.5, H); ctx.stroke()
    }
  } else if (spec.kind === 'grid') {
    ctx.strokeStyle = d ? 'rgba(255,255,255,0.07)' : 'rgba(60,90,130,0.1)'
    ctx.lineWidth = 0.9
    ctx.beginPath()
    for (let x = g; x < W; x += g) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H) }
    for (let y = g; y < H; y += g) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5) }
    ctx.stroke()
  } else if (spec.kind === 'dots') {
    ctx.fillStyle = d ? 'rgba(255,255,255,0.22)' : 'rgba(60,75,95,0.28)'
    const r = g > 30 ? 1.5 : 1.15
    for (let x = g; x < W; x += g)
      for (let y = g; y < H; y += g) {
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
  } else if (spec.kind === 'cornell') {
    // Encabezado, columna de preguntas clave, notas y resumen al final.
    const cue = Math.round(W * 0.28), sum = H - Math.round(H * 0.2)
    ctx.strokeStyle = line
    hLines(cue, W, 118, sum - 10)
    ctx.strokeStyle = d ? 'rgba(255,255,255,0.28)' : 'rgba(60,100,150,0.45)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, 86.5); ctx.lineTo(W, 86.5)
    ctx.moveTo(cue + 0.5, 86); ctx.lineTo(cue + 0.5, sum)
    ctx.moveTo(0, sum + 0.5); ctx.lineTo(W, sum + 0.5)
    ctx.stroke()
  }
}

/** Dibuja una página completa (hoja, imágenes, diagramas y trazos). */
export function drawPage(ctx: CanvasRenderingContext2D, page: Page, onReady: () => void, hidden?: Set<string>, editingNode?: string | null) {
  const { w, h } = pageSize(page)
  const dark = paperInfo(page.color).dark
  const show = <T extends { id: string }>(list: T[] | undefined) => (hidden?.size ? (list ?? []).filter((x) => !hidden.has(x.id)) : list ?? [])
  drawPaper(ctx, page.paper, page.color, w, h)
  drawImages(ctx, show(page.images), onReady)
  const nodes = show(page.nodes)
  drawLinks(ctx, (page.links ?? []).filter((l) => !hidden?.has(l.from) && !hidden?.has(l.to) && !hidden?.has(l.id)), nodes, dark)
  for (const n of nodes) drawNode(ctx, n, dark, n.id === editingNode)
  drawStrokes(ctx, show(page.strokes), dark)
}

// ---- Geometría para borrador, lazo y selección ----

export interface Box { minX: number; minY: number; maxX: number; maxY: number }

const boxCache = new WeakMap<Stroke, Box>()

export function strokeBox(s: Stroke): Box {
  let b = boxCache.get(s)
  if (!b) {
    const pad = s.size / 2 + (s.arrow ? s.size * 3.4 : 0)
    b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    for (const p of s.points) {
      b.minX = Math.min(b.minX, p[0] - pad); b.maxX = Math.max(b.maxX, p[0] + pad)
      b.minY = Math.min(b.minY, p[1] - pad); b.maxY = Math.max(b.maxY, p[1] + pad)
    }
    boxCache.set(s, b)
  }
  return b
}

export const imageBox = (i: ImageItem): Box => ({ minX: i.x, minY: i.y, maxX: i.x + i.w, maxY: i.y + i.h })

export function unionBox(strokes: Stroke[], images: ImageItem[] = [], nodes: DiagramNode[] = []): Box | null {
  if (!strokes.length && !images.length && !nodes.length) return null
  const out = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  const add = (b: Box) => {
    out.minX = Math.min(out.minX, b.minX); out.minY = Math.min(out.minY, b.minY)
    out.maxX = Math.max(out.maxX, b.maxX); out.maxY = Math.max(out.maxY, b.maxY)
  }
  strokes.forEach((s) => add(strokeBox(s)))
  images.forEach((i) => add(imageBox(i)))
  nodes.forEach((n) => add({ minX: n.x, minY: n.y, maxX: n.x + n.w, maxY: n.y + n.h }))
  return out
}

export function strokeHits(s: Stroke, p: Point, r: number): boolean {
  const b = strokeBox(s)
  if (p[0] < b.minX - r || p[0] > b.maxX + r || p[1] < b.minY - r || p[1] > b.maxY + r) return false
  const reach = r + s.size * 0.4
  const pts = s.points
  if (pts.length === 1) return Math.hypot(pts[0][0] - p[0], pts[0][1] - p[1]) <= reach
  const n = s.closed ? pts.length : pts.length - 1
  for (let i = 0; i < n; i++) {
    if (segDist(p, pts[i], pts[(i + 1) % pts.length]) <= reach) return true
  }
  return false
}

export function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function translateStroke(s: Stroke, dx: number, dy: number): Stroke {
  return { ...s, points: s.points.map((p) => [p[0] + dx, p[1] + dy, p[2]]) }
}

export const translateImage = (i: ImageItem, dx: number, dy: number): ImageItem => ({ ...i, x: i.x + dx, y: i.y + dy })

/** Escala respecto a un punto fijo (la esquina opuesta al tirador). */
export function scaleStroke(s: Stroke, ax: number, ay: number, k: number): Stroke {
  return { ...s, size: s.size * k, points: s.points.map((p) => [ax + (p[0] - ax) * k, ay + (p[1] - ay) * k, p[2]]) }
}

export const scaleImage = (i: ImageItem, ax: number, ay: number, k: number): ImageItem =>
  ({ ...i, x: ax + (i.x - ax) * k, y: ay + (i.y - ay) * k, w: i.w * k, h: i.h * k })

/** Gira la página 90° a la derecha, con todo su contenido. */
export function rotatePage(p: Page): Page {
  const { h } = pageSize(p)
  return {
    ...p,
    landscape: !p.landscape,
    strokes: p.strokes.map((s) => ({ ...s, points: s.points.map((q) => [h - q[1], q[0], q[2]]) })),
    images: p.images?.map((i) => ({ ...i, x: h - (i.y + i.h), y: i.x, w: i.h, h: i.w, rot: ((i.rot ?? 0) + 90) % 360 })),
    // Las figuras giran de lugar, pero su texto sigue derecho.
    nodes: p.nodes?.map((n) => ({ ...n, x: h - (n.y + n.h), y: n.x, w: n.h, h: n.w })),
    links: p.links?.map((l) => ({
      ...l,
      mid: undefined,
      fromPort: l.fromPort === undefined ? undefined : (l.fromPort + 1) % 4,
      toPort: l.toPort === undefined ? undefined : (l.toPort + 1) % 4,
    })),
  }
}

export const translateNode = (n: DiagramNode, dx: number, dy: number): DiagramNode => ({ ...n, x: n.x + dx, y: n.y + dy })

export const scaleNode = (n: DiagramNode, ax: number, ay: number, k: number): DiagramNode =>
  ({ ...n, x: ax + (n.x - ax) * k, y: ay + (n.y - ay) * k, w: n.w * k, h: n.h * k, fontSize: Math.max(10, n.fontSize * k) })

export const nodeBox = (n: DiagramNode): Box => ({ minX: n.x, minY: n.y, maxX: n.x + n.w, maxY: n.y + n.h })
