import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeftRight, Copy, CopyPlus, CornerDownRight, Minus, MoveRight, Slash, Spline, Trash2, Type } from 'lucide-react'
import type {
  DiagramLink, DiagramNode, ImageItem, NodeKind, Page, PenType, Point, Selection, ShapeTool, Stroke, Tool, ToolStyle,
} from '../types'
import { INK, NODE_FILLS, PEN_COLORS, pageSize, paperInfo, uid } from '../types'
import {
  drawImages, drawPage, drawStroke, imageBox, pointInPolygon, scaleImage, scaleNode, scaleStroke, strokeHits,
  translateImage, translateNode, translateStroke, unionBox, type Box,
} from '../ink/render'
import { buildShape, cleanStroke, mapPressure, recognize, snapLineEnd, type Shape } from '../ink/shapes'
import {
  DIRS, FONT, drawLinks, drawNode, drawRoute, elbowPath, linkAt, linkRoute, nearestPort, nodeAt, nodePath, portPoint, ports,
  routeEnds, routeSamples, type Port, type Route,
} from '../ink/diagram'

const HOLD_MS = 480
const ERASER_R = 9
const SEL_PAD = 8
// Límite de píxeles por canvas para no reventar la memoria con zoom alto.
const MAX_PIXELS = 9_000_000

type Gesture =
  | {
      kind: 'draw'; pointerId: number; stroke: Stroke; points: Point[]; predicted: Point[]
      anchor: Point; timer: number; shape: Shape | null
    }
  | { kind: 'shape'; pointerId: number; start: Point; end: Point; constrain: boolean }
  | { kind: 'erase'; pointerId: number; last: Point; pos: Point; removed: Set<string> }
  | { kind: 'lasso'; pointerId: number; points: Point[] }
  | { kind: 'move'; pointerId: number; start: Point; dx: number; dy: number; tapNode?: string }
  | { kind: 'scale'; pointerId: number; ax: number; ay: number; base: number; k: number }
  | { kind: 'node'; pointerId: number; start: Point; end: Point }
  | { kind: 'connect'; pointerId: number; from: string; fromPort: Port; end: Point; over: string | null }
  | { kind: 'link-end'; pointerId: number; link: string; which: 'from' | 'to'; end: Point; over: string | null }
  | { kind: 'link-mid'; pointerId: number; link: string; value: number }
  | { kind: 'pan'; pointerId: number; x: number; y: number }

export interface PagePatch { strokes?: Stroke[]; images?: ImageItem[]; nodes?: DiagramNode[]; links?: DiagramLink[] }

interface Props {
  page: Page
  zoom: number
  tool: Tool
  pen: ToolStyle
  penType: PenType
  highlighter: ToolStyle
  shapeKind: ShapeTool
  shapeFill: boolean
  /** Figura a crear; null = modo mover (la manita). */
  nodeKind: NodeKind | null
  onNodeCreated: () => void
  /** Cuánto afecta la presión al grosor (según los ajustes). */
  thinning: number
  /** Estabilización del trazo (según los ajustes). */
  streamline: number
  selection: Selection | null
  onCommit: (pageId: string, patch: PagePatch) => void
  onSelect: (sel: Selection | null) => void
  onCopySelection: () => void
  onDropFiles: (pageId: string, files: File[], x: number, y: number) => void
}

export function newNode(kind: NodeKind, x: number, y: number, w: number, h: number): DiagramNode {
  return {
    id: uid(), kind, x, y, w, h, text: '', color: INK, fontSize: 18,
    fill: kind === 'text' ? null : kind === 'note' ? '#fff3bf' : '#ffffff',
  }
}

const DEFAULT_SIZE: Record<NodeKind, [number, number]> = {
  rect: [180, 90], rounded: [180, 90], ellipse: [170, 100], diamond: [170, 120], note: [170, 150], text: [220, 50],
}

export const PageCanvas = memo(function PageCanvas(props: Props) {
  const { page, zoom, selection } = props
  const wrapRef = useRef<HTMLDivElement>(null)
  const baseRef = useRef<HTMLCanvasElement>(null)
  const liveRef = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [imagesReady, setImagesReady] = useState(0)
  const [editing, setEditing] = useState<string | null>(null)

  const { w: PW, h: PH } = pageSize(page)
  const paper = paperInfo(page.color)
  const dark = paper.dark
  const cssW = PW * zoom
  const cssH = PH * zoom
  const dpr = Math.min(window.devicePixelRatio || 1, Math.sqrt(MAX_PIXELS / (cssW * cssH)))
  const pxW = Math.round(cssW * dpr)
  const pxH = Math.round(cssH * dpr)
  const scale = pxW / PW

  const propsRef = useRef(props)
  propsRef.current = props
  const gesture = useRef<Gesture | null>(null)
  const hidden = useRef<Set<string>>(new Set())
  const hover = useRef<string | null>(null)
  const lastTap = useRef<{ id: string; t: number } | null>(null)
  const frame = useRef(0)

  const images = page.images ?? []
  const nodes = page.nodes ?? []
  const links = page.links ?? []
  const sel = selection && selection.pageId === page.id ? selection : null

  // Solo se dibujan las páginas cerca de la pantalla.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '900px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const selected = (pg: Page, s: Selection | null) => {
    if (!s || s.pageId !== pg.id) return { strokes: [] as Stroke[], images: [] as ImageItem[], nodes: [] as DiagramNode[], links: [] as DiagramLink[] }
    return {
      strokes: pg.strokes.filter((x) => s.ids.has(x.id)),
      images: (pg.images ?? []).filter((x) => s.ids.has(x.id)),
      nodes: (pg.nodes ?? []).filter((x) => s.ids.has(x.id)),
      links: (pg.links ?? []).filter((x) => s.ids.has(x.id)),
    }
  }

  const selectionBox = (pg: Page, s: Selection | null): Box | null => {
    const c = selected(pg, s)
    return unionBox(c.strokes, c.images, c.nodes)
  }

  const shapeStroke = (g: Extract<Gesture, { kind: 'shape' }>): Stroke => {
    const { shapeKind, shapeFill, pen } = propsRef.current
    const s = buildShape(shapeKind, g.start, g.end, g.constrain)
    return {
      id: uid(), tool: 'pen', color: pen.color, size: pen.size, points: s.points,
      shape: true, closed: s.closed,
      ...(shapeKind === 'arrow' ? { arrow: true } : {}),
      ...(shapeFill && s.closed ? { fill: true } : {}),
    }
  }

  const nodeFromDrag = (g: Extract<Gesture, { kind: 'node' }>): DiagramNode => {
    const kind = propsRef.current.nodeKind ?? 'rounded'
    const dx = g.end[0] - g.start[0], dy = g.end[1] - g.start[1]
    if (Math.hypot(dx, dy) < 12) {
      const [w, h] = DEFAULT_SIZE[kind]
      return newNode(kind, g.start[0] - w / 2, g.start[1] - h / 2, w, h)
    }
    return newNode(kind, Math.min(g.start[0], g.end[0]), Math.min(g.start[1], g.end[1]), Math.max(40, Math.abs(dx)), Math.max(30, Math.abs(dy)))
  }

  const onImageReady = useCallback(() => setImagesReady((n) => n + 1), [])

  const routeOf = (l: DiagramLink, pgNodes: DiagramNode[]): Route | null => {
    const a = pgNodes.find((n) => n.id === l.from), b = pgNodes.find((n) => n.id === l.to)
    return a && b ? linkRoute(l, a, b) : null
  }

  /** El conector tal como quedaría con el gesto actual (mover doblez o cambiar extremo). */
  const draftLink = (g: Gesture | null, l: DiagramLink, pgNodes: DiagramNode[]): DiagramLink => {
    if (g?.kind === 'link-mid' && g.link === l.id) return { ...l, mid: g.value }
    if (g?.kind === 'link-end' && g.link === l.id && g.over) {
      const over = pgNodes.find((n) => n.id === g.over)!
      const port = nearestPort(over, g.end)
      return g.which === 'from' ? { ...l, from: over.id, fromPort: port, mid: undefined } : { ...l, to: over.id, toPort: port, mid: undefined }
    }
    return l
  }

  const drawLive = useCallback(() => {
    const c = liveRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    const g = gesture.current
    const { page: pg, selection: s, tool } = propsRef.current
    const pgNodes = pg.nodes ?? []
    const accent = getComputedStyle(c).getPropertyValue('--accent').trim() || '#2f5bea'

    if (g?.kind === 'draw') {
      const pts = g.shape ? g.points : g.points.concat(g.predicted)
      drawStroke(ctx, { ...g.stroke, points: pts, shape: !!g.shape, closed: g.shape?.closed }, true, dark)
    } else if (g?.kind === 'shape') {
      drawStroke(ctx, shapeStroke(g), true, dark)
    } else if (g?.kind === 'node') {
      ctx.save()
      ctx.globalAlpha = 0.75
      drawNode(ctx, nodeFromDrag(g), dark)
      ctx.restore()
    } else if (g?.kind === 'connect' || (g?.kind === 'link-end' && !g.over)) {
      const over = g.over ? pgNodes.find((n) => n.id === g.over) : null
      let route: Route | null = null
      if (g.kind === 'connect') {
        const from = pgNodes.find((n) => n.id === g.from)
        if (from) {
          const p1 = portPoint(from, g.fromPort)
          if (over) { const tp = nearestPort(over, g.end); route = elbowPath(p1, DIRS[g.fromPort], portPoint(over, tp), DIRS[tp]) }
          else route = elbowPath(p1, DIRS[g.fromPort], g.end, null)
        }
      } else {
        const l = (pg.links ?? []).find((x) => x.id === g.link)
        const other = l && pgNodes.find((n) => n.id === (g.which === 'from' ? l.to : l.from))
        if (l && other) {
          const op = (g.which === 'from' ? l.toPort : l.fromPort) ?? nearestPort(other, g.end)
          route = elbowPath(portPoint(other, op as Port), DIRS[op], g.end, null)
        }
      }
      if (route) {
        drawRoute(ctx, route, accent, 'end')
        if (over) {
          ctx.lineWidth = 3 / zoom
          ctx.strokeStyle = accent
          ctx.stroke(nodePath({ ...over, x: over.x - 4, y: over.y - 4, w: over.w + 8, h: over.h + 8 }))
        }
      }
    } else if (g?.kind === 'erase') {
      ctx.beginPath()
      ctx.arc(g.pos[0], g.pos[1], ERASER_R, 0, Math.PI * 2)
      ctx.fillStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(40,44,52,0.06)'
      ctx.fill()
      ctx.lineWidth = 1 / zoom
      ctx.strokeStyle = dark ? 'rgba(255,255,255,0.6)' : 'rgba(40,44,52,0.45)'
      ctx.stroke()
    } else if (g?.kind === 'lasso') {
      ctx.beginPath()
      g.points.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
      ctx.closePath()
      ctx.save()
      ctx.globalAlpha = 0.06
      ctx.fillStyle = accent
      ctx.fill()
      ctx.restore()
      ctx.setLineDash([6 / zoom, 5 / zoom])
      ctx.lineWidth = 1.4 / zoom
      ctx.strokeStyle = accent
      ctx.stroke()
      ctx.setLineDash([])
    }

    const chosen = selected(pg, s)
    let box = unionBox(chosen.strokes, chosen.images, chosen.nodes)
    if (box) {
      // Mientras se mueve o escala, el contenido elegido se dibuja aquí transformado.
      if (g?.kind === 'move' || g?.kind === 'scale') {
        const tn = (n: DiagramNode) => (g.kind === 'move' ? translateNode(n, g.dx, g.dy) : scaleNode(n, g.ax, g.ay, g.k))
        const movedNodes = chosen.nodes.map(tn)
        const all = pgNodes.map((n) => (s!.ids.has(n.id) ? tn(n) : n))
        const touched = (pg.links ?? []).filter((l) => s!.ids.has(l.from) || s!.ids.has(l.to))
        drawLinks(ctx, touched, all, dark)
        drawImages(ctx, chosen.images.map((i) => (g.kind === 'move' ? translateImage(i, g.dx, g.dy) : scaleImage(i, g.ax, g.ay, g.k))), onImageReady)
        movedNodes.forEach((n) => drawNode(ctx, n, dark))
        for (const st of chosen.strokes) drawStroke(ctx, g.kind === 'move' ? translateStroke(st, g.dx, g.dy) : scaleStroke(st, g.ax, g.ay, g.k), true, dark)
        box = g.kind === 'move'
          ? { minX: box.minX + g.dx, maxX: box.maxX + g.dx, minY: box.minY + g.dy, maxY: box.maxY + g.dy }
          : { minX: g.ax, minY: g.ay, maxX: g.ax + (box.maxX - g.ax) * g.k, maxY: g.ay + (box.maxY - g.ay) * g.k }
      }
      ctx.setLineDash([5 / zoom, 4 / zoom])
      ctx.lineWidth = 1.3 / zoom
      ctx.strokeStyle = accent
      ctx.beginPath()
      ctx.roundRect(box.minX - SEL_PAD, box.minY - SEL_PAD, box.maxX - box.minX + SEL_PAD * 2, box.maxY - box.minY + SEL_PAD * 2, 6)
      ctx.stroke()
      ctx.setLineDash([])
      // Tirador para cambiar el tamaño.
      ctx.beginPath()
      ctx.arc(box.maxX + SEL_PAD, box.maxY + SEL_PAD, 7 / zoom, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.fill()
      ctx.lineWidth = 2.2 / zoom
      ctx.strokeStyle = accent
      ctx.stroke()
    }
    // Conector seleccionado: se resalta, con tiradores en las puntas y en el doblez.
    for (const base of chosen.links) {
      if (g?.kind === 'link-end' && !g.over) continue
      const l = draftLink(g, base, pgNodes)
      const route = routeOf(l, pgNodes)
      if (!route) continue
      if (g && (g.kind === 'link-mid' || (g.kind === 'link-end' && g.over))) drawRoute(ctx, route, dark && l.color === INK ? '#eceef1' : l.color, l.arrow, l.dashed)
      const pts = routeSamples(route)
      ctx.save()
      ctx.globalAlpha = 0.22
      ctx.strokeStyle = accent
      ctx.lineWidth = 10
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
      ctx.stroke()
      ctx.restore()
      if (chosen.links.length === 1 && g?.kind !== 'link-end') {
        const handle = (p: Point, r: number) => {
          ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2)
          ctx.fillStyle = '#fff'; ctx.fill()
          ctx.lineWidth = 2.2 / zoom; ctx.strokeStyle = accent; ctx.stroke()
        }
        routeEnds(route).forEach((p) => handle(p, 6.5 / zoom + 1))
        if (route.mid) {
          const m: Point = [(route.mid.a[0] + route.mid.b[0]) / 2, (route.mid.a[1] + route.mid.b[1]) / 2]
          const [w, h] = route.mid.axis === 'x' ? [8, 22] : [22, 8]
          ctx.beginPath(); ctx.roundRect(m[0] - w / zoom / 2 - 1, m[1] - h / zoom / 2 - 1, w / zoom + 2, h / zoom + 2, 4 / zoom)
          ctx.fillStyle = accent; ctx.fill()
        }
      }
    }

    // Puntos para conectar figuras (herramienta de diagramas).
    if (tool === 'diagram' && (!g || g.kind === 'connect' || g.kind === 'link-end')) {
      const ids = new Set<string>(chosen.nodes.length === 1 ? [chosen.nodes[0].id] : [])
      if (hover.current) ids.add(hover.current)
      if (g?.kind === 'connect') ids.add(g.from)
      if ((g?.kind === 'connect' || g?.kind === 'link-end') && g.over) ids.add(g.over)
      for (const n of pgNodes) {
        if (!ids.has(n.id)) continue
        for (const p of ports(n)) {
          ctx.beginPath()
          ctx.arc(p[0], p[1], 6.5 / zoom + 1, 0, Math.PI * 2)
          ctx.fillStyle = '#fff'
          ctx.fill()
          ctx.lineWidth = 2 / zoom
          ctx.strokeStyle = accent
          ctx.stroke()
          ctx.beginPath()
          ctx.arc(p[0], p[1], 2.4 / zoom + 0.5, 0, Math.PI * 2)
          ctx.fillStyle = accent
          ctx.fill()
        }
      }
    }
  }, [scale, zoom, dark, onImageReady])

  const drawBase = useCallback(() => {
    const c = baseRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    drawPage(ctx, page, onImageReady, hidden.current, editing)
    // Hasta que la base se redibuja, el trazo terminado sigue en la capa "en vivo":
    // así no parpadea al soltar el lápiz.
    if (!gesture.current) drawLive()
  }, [page, scale, drawLive, onImageReady, editing])

  useLayoutEffect(() => {
    if (visible) drawBase()
  }, [visible, drawBase, pxW, pxH, imagesReady])

  useEffect(() => {
    if (visible) drawLive()
  }, [visible, selection, props.tool, drawLive, pxW, pxH])

  // Al cargar la tipografía se redibuja el texto de los diagramas.
  useEffect(() => {
    document.fonts?.ready.then(() => setImagesReady((n) => n + 1))
  }, [])

  const requestLive = () => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      drawLive()
    })
  }

  const toPage = (e: { clientX: number; clientY: number; pressure: number; pointerType: string }): Point => {
    const r = liveRef.current!.getBoundingClientRect()
    const k = r.width / PW
    const pressure = e.pointerType === 'pen' ? mapPressure(e.pressure) : 0.5
    return [(e.clientX - r.left) / k, (e.clientY - r.top) / k, pressure]
  }

  const commit = (patch: PagePatch) => propsRef.current.onCommit(page.id, patch)
  const select = (ids: string[]) => propsRef.current.onSelect(ids.length ? { pageId: page.id, ids: new Set(ids) } : null)

  const trySnap = () => {
    const g = gesture.current
    if (!g || g.kind !== 'draw' || g.shape) return
    const shape = recognize(g.points)
    if (!shape) return
    g.shape = shape
    g.points = shape.points
    requestLive()
  }

  const eraseAlong = (g: Extract<Gesture, { kind: 'erase' }>, to: Point) => {
    const from = g.last
    const d = Math.hypot(to[0] - from[0], to[1] - from[1])
    const steps = Math.max(1, Math.ceil(d / (ERASER_R * 0.6)))
    let hit = false
    for (let i = 1; i <= steps; i++) {
      const p: Point = [from[0] + ((to[0] - from[0]) * i) / steps, from[1] + ((to[1] - from[1]) * i) / steps]
      for (const s of propsRef.current.page.strokes) {
        if (g.removed.has(s.id)) continue
        if (strokeHits(s, p, ERASER_R)) {
          g.removed.add(s.id)
          hidden.current.add(s.id)
          hit = true
        }
      }
    }
    g.last = to
    g.pos = to
    if (hit) drawBase()
  }

  const imageAt = (pt: Point) => {
    const list = propsRef.current.page.images ?? []
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].locked) continue
      const b = imageBox(list[i])
      if (pt[0] >= b.minX && pt[0] <= b.maxX && pt[1] >= b.minY && pt[1] <= b.maxY) return list[i]
    }
    return null
  }

  const startMove = (pointerId: number, pt: Point, ids: Set<string>, tapNode?: string) => {
    gesture.current = { kind: 'move', pointerId, start: pt, dx: 0, dy: 0, tapNode }
    ids.forEach((id) => hidden.current.add(id))
    setBusy(true)
    drawBase()
  }

  /** Tirador de tamaño o arrastre de la selección actual. */
  const grabSelection = (e: React.PointerEvent, pt: Point): boolean => {
    const b = selectionBox(page, sel)
    if (!sel || !b) return false
    const hx = b.maxX + SEL_PAD, hy = b.maxY + SEL_PAD
    if (Math.hypot(pt[0] - hx, pt[1] - hy) < 16 / zoom + 4) {
      gesture.current = { kind: 'scale', pointerId: e.pointerId, ax: b.minX, ay: b.minY, base: Math.hypot(hx - b.minX, hy - b.minY), k: 1 }
      sel.ids.forEach((id) => hidden.current.add(id))
      setBusy(true)
      drawBase()
      requestLive()
      return true
    }
    return false
  }

  const onDiagramDown = (e: React.PointerEvent, pt: Point) => {
    const pg = propsRef.current.page
    const pgNodes = pg.nodes ?? []
    const near = (p: Point, r = 12) => Math.hypot(p[0] - pt[0], p[1] - pt[1]) < r / zoom + 5
    // 0. Conector seleccionado: arrastrar sus puntas o su doblez.
    const selLinks = (pg.links ?? []).filter((l) => sel?.ids.has(l.id))
    if (selLinks.length === 1) {
      const l = selLinks[0]
      const route = routeOf(l, pgNodes)
      if (route) {
        const [a, b] = routeEnds(route)
        const which = near(a) ? 'from' : near(b) ? 'to' : null
        if (which) {
          gesture.current = { kind: 'link-end', pointerId: e.pointerId, link: l.id, which, end: pt, over: null }
          hidden.current.add(l.id)
          drawBase()
          requestLive()
          return
        }
        if (route.mid) {
          const m: Point = [(route.mid.a[0] + route.mid.b[0]) / 2, (route.mid.a[1] + route.mid.b[1]) / 2]
          if (near(m, 16)) {
            gesture.current = { kind: 'link-mid', pointerId: e.pointerId, link: l.id, value: route.mid.axis === 'x' ? m[0] : m[1] }
            hidden.current.add(l.id)
            drawBase()
            requestLive()
            return
          }
        }
      }
    }
    // 1. Punto de conexión: arrastrar para crear un conector desde ese lado.
    const candidates = pgNodes.filter((n) => n.id === hover.current || sel?.ids.has(n.id))
    for (const n of candidates) {
      const i = ports(n).findIndex((p) => near(p))
      if (i >= 0) {
        gesture.current = { kind: 'connect', pointerId: e.pointerId, from: n.id, fromPort: i as Port, end: pt, over: null }
        requestLive()
        return
      }
    }
    // 2. Tirador de tamaño.
    if (grabSelection(e, pt)) return
    // 3. Tocar una figura: seleccionarla y arrastrarla (doble toque = escribir).
    const n = nodeAt(pgNodes, pt)
    if (n) {
      const now = performance.now()
      if (lastTap.current?.id === n.id && now - lastTap.current.t < 380) {
        lastTap.current = null
        setEditing(n.id)
        select([n.id])
        return
      }
      lastTap.current = { id: n.id, t: now }
      const ids = sel?.ids.has(n.id) ? sel.ids : new Set([n.id])
      if (!sel?.ids.has(n.id)) select([n.id])
      startMove(e.pointerId, pt, ids, n.id)
      requestLive()
      return
    }
    // 4. Tocar un conector: seleccionarlo.
    const l = linkAt(pg.links ?? [], pgNodes, pt, 8 / zoom + 3)
    if (l) {
      select([l.id])
      return
    }
    // 5. Espacio vacío: con una figura elegida se dibuja arrastrando (o tocando = tamaño normal);
    //    con la manita, arrastrar desplaza la hoja.
    if (propsRef.current.selection) propsRef.current.onSelect(null)
    if (propsRef.current.nodeKind) gesture.current = { kind: 'node', pointerId: e.pointerId, start: pt, end: pt }
    else gesture.current = { kind: 'pan', pointerId: e.pointerId, x: e.clientX, y: e.clientY }
    requestLive()
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // El dedo se usa para desplazarse (lo maneja el contenedor): así la palma no raya.
    if (e.pointerType === 'touch') return
    const penEraser = e.pointerType === 'pen' && (e.button === 5 || (e.buttons & 32) !== 0)
    if (e.button !== 0 && !penEraser) return
    if (gesture.current) return
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* puntero ya liberado */ }
    const pt = toPage(e)
    const { tool, pen, penType, highlighter, thinning, streamline, onSelect } = propsRef.current
    const active: Tool = penEraser ? 'eraser' : tool

    if (active === 'pen' || active === 'highlighter') {
      if (propsRef.current.selection) onSelect(null)
      const style = active === 'pen' ? pen : highlighter
      const isPen = e.pointerType === 'pen'
      gesture.current = {
        kind: 'draw',
        pointerId: e.pointerId,
        stroke: {
          id: uid(), tool: active, color: style.color, size: style.size, points: [],
          sl: Math.round(streamline * 100) / 100,
          ...(active === 'pen' ? { pen: penType } : {}),
          ...(isPen ? (active === 'pen' ? { th: Math.round(thinning * 100) / 100 } : {}) : { sim: true }),
        },
        points: [pt],
        predicted: [],
        anchor: pt,
        timer: window.setTimeout(trySnap, HOLD_MS),
        shape: null,
      }
    } else if (active === 'shape') {
      if (propsRef.current.selection) onSelect(null)
      gesture.current = { kind: 'shape', pointerId: e.pointerId, start: pt, end: pt, constrain: e.shiftKey }
    } else if (active === 'diagram') {
      onDiagramDown(e, pt)
      return
    } else if (active === 'eraser') {
      const g: Gesture = { kind: 'erase', pointerId: e.pointerId, last: pt, pos: pt, removed: new Set() }
      gesture.current = g
      eraseAlong(g, pt)
    } else {
      if (grabSelection(e, pt)) return
      const b = selectionBox(page, sel)
      if (sel && b && pt[0] > b.minX - 10 && pt[0] < b.maxX + 10 && pt[1] > b.minY - 10 && pt[1] < b.maxY + 10) {
        startMove(e.pointerId, pt, sel.ids)
        requestLive()
        return
      }
      // Tocar una imagen, sticker o figura la selecciona y permite arrastrarla de inmediato.
      const hit = imageAt(pt) ?? nodeAt(nodes, pt)
      if (hit) {
        const ids = new Set([hit.id])
        onSelect({ pageId: page.id, ids })
        startMove(e.pointerId, pt, ids)
        requestLive()
        return
      }
      if (propsRef.current.selection) onSelect(null)
      gesture.current = { kind: 'lasso', pointerId: e.pointerId, points: [pt] }
    }
    requestLive()
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gesture.current
    const native = e.nativeEvent
    if (!g) {
      // Sin gesto: en modo diagrama se muestran los puntos de conexión al pasar encima.
      if (propsRef.current.tool === 'diagram' && e.pointerType !== 'touch') {
        const pt = toPage(native)
        const n = nodeAt(propsRef.current.page.nodes ?? [], pt, 22)
        const id = n?.id ?? null
        if (id !== hover.current) {
          hover.current = id
          requestLive()
        }
      }
      return
    }
    if (e.pointerId !== g.pointerId) return
    const events = native.getCoalescedEvents?.() ?? []
    const list = events.length ? events : [native]

    if (g.kind === 'draw') {
      if (g.shape) {
        // Tras enderezar una línea, se puede seguir moviendo el extremo.
        if (g.shape.kind === 'line') {
          const end = snapLineEnd(g.points[0], toPage(native))
          g.points = [g.points[0], end]
          requestLive()
        }
        return
      }
      for (const ev of list) {
        const pt = toPage(ev)
        const last = g.points[g.points.length - 1]
        if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) < 0.3) continue
        g.points.push(pt)
      }
      const predicted = native.getPredictedEvents?.() ?? []
      g.predicted = e.pointerType === 'pen' ? predicted.slice(0, 1).map(toPage) : []
      const cur = g.points[g.points.length - 1]
      if (Math.hypot(cur[0] - g.anchor[0], cur[1] - g.anchor[1]) > 3.5) {
        g.anchor = cur
        clearTimeout(g.timer)
        g.timer = window.setTimeout(trySnap, HOLD_MS)
      }
    } else if (g.kind === 'shape') {
      g.end = toPage(native)
      g.constrain = e.shiftKey
    } else if (g.kind === 'node') {
      g.end = toPage(native)
    } else if (g.kind === 'connect') {
      g.end = toPage(native)
      const n = nodeAt(propsRef.current.page.nodes ?? [], g.end, 10)
      g.over = n && n.id !== g.from ? n.id : null
    } else if (g.kind === 'link-end') {
      g.end = toPage(native)
      const l = (propsRef.current.page.links ?? []).find((x) => x.id === g.link)
      const other = l && (g.which === 'from' ? l.to : l.from)
      const n = nodeAt(propsRef.current.page.nodes ?? [], g.end, 10)
      g.over = n && n.id !== other ? n.id : null
    } else if (g.kind === 'link-mid') {
      const pt = toPage(native)
      const l = (propsRef.current.page.links ?? []).find((x) => x.id === g.link)
      const r = l && routeOf(l, propsRef.current.page.nodes ?? [])
      g.value = r?.mid?.axis === 'y' ? pt[1] : pt[0]
    } else if (g.kind === 'pan') {
      const scroller = wrapRef.current?.closest('.scroller')
      scroller?.scrollBy(g.x - e.clientX, g.y - e.clientY)
      g.x = e.clientX
      g.y = e.clientY
      return
    } else if (g.kind === 'erase') {
      for (const ev of list) eraseAlong(g, toPage(ev))
    } else if (g.kind === 'lasso') {
      for (const ev of list) g.points.push(toPage(ev))
    } else if (g.kind === 'move') {
      const pt = toPage(native)
      g.dx = pt[0] - g.start[0]
      g.dy = pt[1] - g.start[1]
    } else if (g.kind === 'scale') {
      const pt = toPage(native)
      g.k = Math.max(0.1, Math.hypot(pt[0] - g.ax, pt[1] - g.ay) / g.base)
    }
    requestLive()
  }

  /** Deja el trazo terminado en la capa en vivo hasta que la base se redibuje. */
  const holdOnLive = (stroke: Stroke) => {
    const ctx = liveRef.current!.getContext('2d')!
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, pxW, pxH)
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    drawStroke(ctx, stroke, false, dark)
  }

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gesture.current
    if (!g || e.pointerId !== g.pointerId) return
    gesture.current = null
    const pg = propsRef.current.page
    const strokes = pg.strokes
    const pgNodes = pg.nodes ?? []
    const pgLinks = pg.links ?? []
    const round = (n: number) => Math.round(n * 100) / 100

    if (g.kind === 'draw') {
      clearTimeout(g.timer)
      let pts = g.points
      if (!g.shape && !g.stroke.sim && g.stroke.tool === 'pen') pts = cleanStroke(pts)
      if (pts.length === 1) pts = [pts[0], [pts[0][0] + 0.2, pts[0][1] + 0.2, pts[0][2]]]
      const stroke: Stroke = {
        ...g.stroke,
        points: pts.map((p) => [round(p[0]), round(p[1]), round(p[2])]),
        ...(g.shape ? { shape: true, closed: g.shape.closed, sim: undefined, th: undefined, pen: undefined } : {}),
      }
      holdOnLive(stroke)
      commit({ strokes: [...strokes, stroke] })
    } else if (g.kind === 'shape') {
      if (Math.hypot(g.end[0] - g.start[0], g.end[1] - g.start[1]) < 4) { drawLive(); return }
      const s = shapeStroke(g)
      const stroke = { ...s, points: s.points.map((p) => [round(p[0]), round(p[1]), 0.5]) }
      holdOnLive(stroke)
      commit({ strokes: [...strokes, stroke] })
    } else if (g.kind === 'node') {
      const n = nodeFromDrag(g)
      commit({ nodes: [...pgNodes, n] })
      select([n.id])
      setEditing(n.id)
      // Después de crear una figura se vuelve a la manita, para no crear otra por accidente.
      propsRef.current.onNodeCreated()
    } else if (g.kind === 'connect') {
      const from = pgNodes.find((n) => n.id === g.from)
      if (!from) { drawLive(); return }
      const link = (to: string, toPort: Port): DiagramLink => ({ id: uid(), from: g.from, to, color: INK, arrow: 'end', fromPort: g.fromPort, toPort, style: 'elbow' })
      if (g.over) {
        const over = pgNodes.find((n) => n.id === g.over)!
        commit({ links: [...pgLinks, link(g.over, nearestPort(over, g.end))] })
      } else if (Math.hypot(g.end[0] - (from.x + from.w / 2), g.end[1] - (from.y + from.h / 2)) > Math.max(from.w, from.h) / 2 + 30) {
        // Soltar en un espacio vacío crea una figura nueva ya conectada, del lado contrario.
        const n = { ...newNode(from.kind === 'text' ? 'rounded' : from.kind, 0, 0, from.w, from.h), fill: from.fill, color: from.color }
        const fp = g.fromPort
        n.x = fp === 1 ? g.end[0] : fp === 3 ? g.end[0] - n.w : g.end[0] - n.w / 2
        n.y = fp === 2 ? g.end[1] : fp === 0 ? g.end[1] - n.h : g.end[1] - n.h / 2
        commit({ nodes: [...pgNodes, n], links: [...pgLinks, link(n.id, ((fp + 2) % 4) as Port)] })
        select([n.id])
        setEditing(n.id)
      } else drawLive()
    } else if (g.kind === 'link-end' || g.kind === 'link-mid') {
      hidden.current = new Set()
      const l = pgLinks.find((x) => x.id === g.link)
      const next = l && draftLink(g, l, pgNodes)
      if (l && next && next !== l) commit({ links: pgLinks.map((x) => (x.id === l.id ? next : x)) })
      else drawBase()
    } else if (g.kind === 'pan') {
      drawLive()
    } else if (g.kind === 'erase') {
      hidden.current = new Set()
      if (g.removed.size) commit({ strokes: strokes.filter((s) => !g.removed.has(s.id)) })
      else drawLive()
    } else if (g.kind === 'lasso') {
      const poly = g.points
      const ids = new Set<string>()
      if (poly.length > 2) {
        for (const s of strokes) {
          const step = Math.max(1, Math.floor(s.points.length / 24))
          let inside = 0, total = 0
          for (let i = 0; i < s.points.length; i += step) {
            total++
            if (pointInPolygon(s.points[i], poly)) inside++
          }
          if (total && inside / total >= 0.5) ids.add(s.id)
        }
        for (const im of pg.images ?? []) {
          if (!im.locked && pointInPolygon([im.x + im.w / 2, im.y + im.h / 2], poly)) ids.add(im.id)
        }
        for (const n of pgNodes) {
          if (pointInPolygon([n.x + n.w / 2, n.y + n.h / 2], poly)) ids.add(n.id)
        }
      }
      propsRef.current.onSelect(ids.size ? { pageId: page.id, ids } : null)
      drawLive()
    } else {
      hidden.current = new Set()
      setBusy(false)
      const s = propsRef.current.selection ?? (g.kind === 'move' && g.tapNode ? { pageId: page.id, ids: new Set([g.tapNode]) } : null)
      const moved = g.kind === 'move' ? Math.hypot(g.dx, g.dy) > 0.5 : g.k !== 1
      if (s && moved) {
        const isMove = g.kind === 'move'
        commit({
          strokes: strokes.map((st) => (s.ids.has(st.id) ? (isMove ? translateStroke(st, g.dx, g.dy) : scaleStroke(st, g.ax, g.ay, g.k)) : st)),
          images: (pg.images ?? []).map((im) => (s.ids.has(im.id) ? (isMove ? translateImage(im, g.dx, g.dy) : scaleImage(im, g.ax, g.ay, g.k)) : im)),
          nodes: pgNodes.map((n) => (s.ids.has(n.id) ? (isMove ? translateNode(n, g.dx, g.dy) : scaleNode(n, g.ax, g.ay, g.k)) : n)),
        })
      } else drawBase()
    }
  }

  const onPointerLeave = () => {
    if (hover.current && !gesture.current) {
      hover.current = null
      requestLive()
    }
  }

  const onDrop = (e: React.DragEvent) => {
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'))
    if (!files.length) return
    e.preventDefault()
    const r = wrapRef.current!.getBoundingClientRect()
    props.onDropFiles(page.id, files, (e.clientX - r.left) / zoom, (e.clientY - r.top) / zoom)
  }

  // ---- Texto dentro de las figuras ----
  const editNode = editing ? nodes.find((n) => n.id === editing) : null
  const finishEditing = (text: string) => {
    const n = editNode
    setEditing(null)
    if (!n) return
    const current = propsRef.current.page
    if (!text.trim() && n.kind === 'text') {
      commit({ nodes: (current.nodes ?? []).filter((x) => x.id !== n.id), links: (current.links ?? []).filter((l) => l.from !== n.id && l.to !== n.id) })
      propsRef.current.onSelect(null)
    } else if (text !== n.text) {
      commit({ nodes: (current.nodes ?? []).map((x) => (x.id === n.id ? { ...x, text } : x)) })
    }
  }

  // ---- Barra flotante de la selección ----
  const chosen = selected(page, sel)
  const box = unionBox(chosen.strokes, chosen.images, chosen.nodes)
  const linkBox = !box && chosen.links.length ? (() => {
    const r = routeOf(chosen.links[0], nodes)
    if (!r) return null
    const pts = routeSamples(r)
    return {
      minX: Math.min(...pts.map((p) => p[0])), minY: Math.min(...pts.map((p) => p[1])),
      maxX: Math.max(...pts.map((p) => p[0])), maxY: Math.max(...pts.map((p) => p[1])),
    }
  })() : null
  const barBox = box ?? linkBox

  const removeSelected = () => {
    if (!sel) return
    commit({
      strokes: page.strokes.filter((s) => !sel.ids.has(s.id)),
      images: images.filter((i) => !sel.ids.has(i.id)),
      nodes: nodes.filter((n) => !sel.ids.has(n.id)),
      links: links.filter((l) => !sel.ids.has(l.id) && !sel.ids.has(l.from) && !sel.ids.has(l.to)),
    })
    props.onSelect(null)
  }
  const duplicateSelection = () => {
    if (!sel) return
    const strokes = chosen.strokes.map((s) => ({ ...translateStroke(s, 24, 24), id: uid() }))
    const imgs = chosen.images.map((i) => ({ ...translateImage(i, 24, 24), id: uid() }))
    const idMap = new Map<string, string>()
    const nds = chosen.nodes.map((n) => {
      const id = uid()
      idMap.set(n.id, id)
      return { ...translateNode(n, 24, 24), id }
    })
    const lks = links
      .filter((l) => idMap.has(l.from) && idMap.has(l.to))
      .map((l) => ({ ...l, id: uid(), from: idMap.get(l.from)!, to: idMap.get(l.to)! }))
    commit({ strokes: [...page.strokes, ...strokes], images: [...images, ...imgs], nodes: [...nodes, ...nds], links: [...links, ...lks] })
    props.onSelect({ pageId: page.id, ids: new Set([...strokes, ...imgs, ...nds].map((c) => c.id)) })
  }
  const recolorStrokes = (color: string) => {
    if (!sel) return
    commit({ strokes: page.strokes.map((s) => (sel.ids.has(s.id) && s.tool === 'pen' ? { ...s, color } : s)) })
  }
  const patchNodes = (patch: Partial<DiagramNode>) => {
    if (!sel) return
    commit({ nodes: nodes.map((n) => (sel.ids.has(n.id) ? { ...n, ...patch } : n)) })
  }
  const patchLinks = (patch: Partial<DiagramLink>) => {
    if (!sel) return
    commit({ links: links.map((l) => (sel.ids.has(l.id) ? { ...l, ...patch } : l)) })
  }

  /** Los conectores viejos (sin lado fijo) toman el lado más cercano al pasar a codos o curva. */
  const withPorts = (patch: Partial<DiagramLink>) => {
    const l = chosen.links[0]
    const a = nodes.find((n) => n.id === l.from), b = nodes.find((n) => n.id === l.to)
    if (!a || !b || l.fromPort !== undefined) return patch
    return { ...patch, fromPort: nearestPort(a, [b.x + b.w / 2, b.y + b.h / 2]), toPort: nearestPort(b, [a.x + a.w / 2, a.y + a.h / 2]) }
  }

  const barRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = barRef.current
    if (!el) return
    const left = Number(el.dataset.left), top = Number(el.dataset.top), below = Number(el.dataset.below)
    el.style.left = Math.max(4, Math.min(left, cssW - el.offsetWidth - 4)) + 'px'
    el.style.top = (top < 4 ? below : top) + 'px'
  })

  const onlyDiagram = chosen.nodes.length > 0 && !chosen.strokes.length && !chosen.images.length
  const onlyLinks = !box && chosen.links.length > 0

  return (
    <div
      ref={wrapRef}
      className="page"
      style={{ width: cssW, height: cssH, background: paper.bg }}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }}
      onDrop={onDrop}
    >
      {visible && (
        <>
          <canvas ref={baseRef} width={pxW} height={pxH} className="page-base" />
          <canvas
            ref={liveRef}
            width={pxW}
            height={pxH}
            className={`page-live cursor-${props.tool}${props.tool === 'diagram' && !props.nodeKind ? '-hand' : ''} ${dark ? 'on-dark' : ''}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={onPointerLeave}
            onContextMenu={(e) => e.preventDefault()}
          />
        </>
      )}

      {editNode && (
        <NodeTextEditor node={editNode} zoom={zoom} dark={dark} onDone={finishEditing} />
      )}

      {barBox && !busy && !editNode && (
        <div
          ref={barRef}
          className="selection-bar"
          data-left={(barBox.minX - SEL_PAD) * zoom}
          data-top={(barBox.minY - SEL_PAD) * zoom - 56}
          data-below={(barBox.maxY + SEL_PAD) * zoom + 14}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {onlyLinks ? (
            <>
              <button className={`sel-btn ${(chosen.links[0].style ?? (chosen.links[0].fromPort === undefined ? 'straight' : 'elbow')) === 'elbow' ? 'on' : ''}`} onClick={() => patchLinks(withPorts({ style: 'elbow' }))} title="Con codos"><CornerDownRight size={16} /></button>
              <button className={`sel-btn ${chosen.links[0].style === 'curve' ? 'on' : ''}`} onClick={() => patchLinks(withPorts({ style: 'curve' }))} title="Curva"><Spline size={16} /></button>
              <button className={`sel-btn ${chosen.links[0].style === 'straight' || (!chosen.links[0].style && chosen.links[0].fromPort === undefined) ? 'on' : ''}`} onClick={() => patchLinks({ style: 'straight' })} title="Recta"><Slash size={16} /></button>
              <span className="sel-divider" />
              <button className={`sel-btn ${chosen.links[0].arrow === 'end' ? 'on' : ''}`} onClick={() => patchLinks({ arrow: 'end' })} title="Flecha"><MoveRight size={16} /></button>
              <button className={`sel-btn ${chosen.links[0].arrow === 'both' ? 'on' : ''}`} onClick={() => patchLinks({ arrow: 'both' })} title="Doble flecha"><ArrowLeftRight size={16} /></button>
              <button className={`sel-btn ${chosen.links[0].arrow === 'none' ? 'on' : ''}`} onClick={() => patchLinks({ arrow: 'none' })} title="Sin flecha"><Minus size={16} /></button>
              <button className={`sel-btn ${chosen.links[0].dashed ? 'on' : ''}`} onClick={() => patchLinks({ dashed: !chosen.links[0].dashed })} title="Punteada"><Minus size={16} strokeDasharray="3 3" /></button>
              <span className="sel-divider" />
              {PEN_COLORS.map((c) => (
                <button key={c} className="sel-swatch" style={{ background: c }} onClick={() => patchLinks({ color: c })} title="Color" />
              ))}
            </>
          ) : onlyDiagram ? (
            <>
              <button className="sel-swatch none" onClick={() => patchNodes({ fill: null })} title="Sin relleno" />
              {NODE_FILLS.map((c) => (
                <button key={c} className="sel-swatch" style={{ background: c }} onClick={() => patchNodes({ fill: c })} title="Relleno" />
              ))}
              <span className="sel-divider" />
              {PEN_COLORS.slice(0, 4).map((c) => (
                <button key={c} className="sel-swatch ring" style={{ ['--c' as string]: c }} onClick={() => patchNodes({ color: c })} title="Borde y texto" />
              ))}
              <span className="sel-divider" />
              <button className="sel-btn" onClick={() => patchNodes({ fontSize: Math.max(10, chosen.nodes[0].fontSize - 2) })} title="Letra más pequeña"><Type size={13} /></button>
              <button className="sel-btn" onClick={() => patchNodes({ fontSize: Math.min(64, chosen.nodes[0].fontSize + 2) })} title="Letra más grande"><Type size={18} /></button>
              {chosen.nodes.length === 1 && (
                <button className="sel-btn text-btn" onClick={() => setEditing(chosen.nodes[0].id)} title="Escribir (doble toque)">Aa</button>
              )}
            </>
          ) : (
            chosen.strokes.some((s) => s.tool === 'pen') && PEN_COLORS.map((c) => (
              <button key={c} className="sel-swatch" style={{ background: c }} onClick={() => recolorStrokes(c)} title="Cambiar color" />
            ))
          )}
          {!onlyLinks && (
            <>
              <span className="sel-divider" />
              <button className="sel-btn" onClick={props.onCopySelection} title="Copiar (Ctrl+C)"><Copy size={16} /></button>
              <button className="sel-btn" onClick={duplicateSelection} title="Duplicar"><CopyPlus size={16} /></button>
            </>
          )}
          <button className="sel-btn danger" onClick={removeSelected} title="Eliminar"><Trash2 size={16} /></button>
        </div>
      )}
    </div>
  )
})

/** Cuadro de texto encima de la figura mientras se escribe. */
function NodeTextEditor({ node, zoom, dark, onDone }: { node: DiagramNode; zoom: number; dark: boolean; onDone: (text: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [value, setValue] = useState(node.text)
  const done = useRef(false)
  const finish = () => {
    if (done.current) return
    done.current = true
    onDone(value)
  }
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])
  const lines = Math.max(1, value.split('\n').length)
  const lh = node.fontSize * 1.3
  const k = node.kind === 'diamond' ? 0.58 : node.kind === 'ellipse' ? 0.74 : 1
  const w = node.w * k - 16
  const color = node.fill ? INK : dark && node.color === INK ? '#eceef1' : node.color
  return (
    <textarea
      ref={ref}
      className="node-editor"
      value={value}
      placeholder="Escribe…"
      onChange={(e) => setValue(e.target.value)}
      onBlur={finish}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Escape') { e.preventDefault(); finish() }
      }}
      style={{
        left: (node.x + (node.w - w) / 2) * zoom,
        top: node.y * zoom,
        width: w * zoom,
        height: node.h * zoom,
        paddingTop: Math.max(0, (node.h - lines * lh) / 2) * zoom,
        fontSize: node.fontSize * zoom,
        lineHeight: `${lh * zoom}px`,
        fontFamily: FONT,
        color,
      }}
    />
  )
}
