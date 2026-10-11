import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Brush, ChevronDown, Circle, Diamond, Eraser, FilePlus2, Highlighter, ImagePlus, Lasso, Minus, MoreHorizontal,
  MoveUpRight, PaintBucket, PanelLeft, Pen, PenTool, Plus, RectangleHorizontal, Redo2, Settings as SettingsIcon,
  Hand, Shapes, Share, Slash, Square, Sticker as StickerIcon, Triangle, Type, Undo2, Workflow, Diamond as DiamondIcon, StickyNote,
} from 'lucide-react'
import type {
  DiagramLink, DiagramNode, ImageItem, NodeKind, NotebookDoc, NotebookMeta, Page, PageSizeKind, Paper, PaperColor, PenType,
  Selection, ShapeTool, Stroke, Tool, ToolStyle,
} from '../types'
import {
  HIGHLIGHTER_COLORS, HIGHLIGHTER_SIZES, NODE_KINDS, PAGE_W, PAPERS, PEN_COLORS, PEN_SIZES, PEN_TYPES, SHAPES, pageSize,
  streamlineFor, thinningFor, uid,
} from '../types'
import { loadNotebook, saveNotebook, saveNotebookNow } from '../storage'
import { useSettings } from '../settings'
import { placeImage, storeImageFile } from '../assets'
import type { Sticker } from '../stickers'
import { rotatePage, translateImage, translateNode, translateStroke, unionBox } from '../ink/render'
import { PageCanvas, type PagePatch } from './PageCanvas'
import { PaperPreview } from './PaperPreview'
import type { PaperPatch, PaperScope } from './PaperPanel'
import { exportPdf, exportTrazo } from '../exporter'
import { PageSidebar, type SidebarView } from './PageSidebar'
import { ColorPicker } from './ColorPicker'
import { Popover } from './Popover'
import { SettingsDialog } from './SettingsDialog'
import { StickerPicker, pushRecent } from './StickerPicker'
import { PageMenu } from './PageMenu'
import { SizeControl } from './SizeControl'

const PAGE_GAP = 28
const PAGES_PAD_TOP = 70
const MIN_ZOOM = 0.35
const MAX_ZOOM = 2.6
// Ctrl + rueda: 5 % por cada clic. Botones y Ctrl +/-: al siguiente múltiplo de 10 %.
const ZOOM_STEP = 0.05
const stepZoom = (z: number, dir: 1 | -1) => {
  const pct = Math.round(z * 100)
  const next = dir > 0 ? Math.floor(pct / 10) * 10 + 10 : Math.ceil(pct / 10) * 10 - 10
  return next / 100
}

const SHAPE_ICONS: Record<ShapeTool, React.ReactNode> = {
  line: <Slash size={18} />,
  arrow: <MoveUpRight size={18} />,
  rect: <Square size={18} />,
  rounded: <RectangleHorizontal size={18} />,
  ellipse: <Circle size={18} />,
  diamond: <Diamond size={18} />,
  triangle: <Triangle size={18} />,
}

const PEN_ICONS: Record<PenType, React.ReactNode> = {
  fountain: <PenTool size={18} />,
  ball: <Pen size={18} />,
  brush: <Brush size={18} />,
}

// Portapapeles interno, compartido entre pestañas: así se puede copiar
// de un cuaderno y pegar en otro.
let clipItems: { strokes: Stroke[]; images: ImageItem[]; nodes: DiagramNode[]; links: DiagramLink[] } | null = null
let clipPage: Page | null = null

interface Props {
  meta: NotebookMeta
  active: boolean
  onMetaChange: (id: string, patch: Partial<NotebookMeta>) => void
}

interface HistoryEntry { before: Page[]; after: Page[] }

export const newPage = (paper: Paper, color?: PaperColor, size?: PageSizeKind, landscape?: boolean): Page =>
  ({ id: uid(), paper, color, strokes: [], ...(size === 'board' ? { size } : {}), ...(landscape ? { landscape } : {}) })

const NODE_ICONS: Record<NodeKind, React.ReactNode> = {
  rounded: <RectangleHorizontal size={18} />,
  rect: <Square size={18} />,
  ellipse: <Circle size={18} />,
  diamond: <DiamondIcon size={18} />,
  note: <StickyNote size={18} />,
  text: <Type size={18} />,
}

const pref = (key: string, fallback: string) => {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}
const savePref = (key: string, value: string) => {
  try { localStorage.setItem(key, value) } catch { /* sin almacenamiento */ }
}

const readStyle = (key: string, fallback: ToolStyle): ToolStyle => {
  try {
    const v = JSON.parse(pref(key, ''))
    if (typeof v?.color === 'string' && typeof v?.size === 'number') return v
  } catch { /* primera vez */ }
  return fallback
}

const freshIds = <T extends { id: string }>(list: T[]) => list.map((x) => ({ ...x, id: uid() }))

export function Editor({ meta, active, onMetaChange }: Props) {
  const { settings, update: updateSettings } = useSettings()
  const [doc, setDoc] = useState<NotebookDoc | null>(null)
  const docRef = useRef<NotebookDoc | null>(null)
  const undoStack = useRef<HistoryEntry[]>([])
  const redoStack = useRef<HistoryEntry[]>([])
  const [, setHistoryTick] = useState(0)

  const [tool, setTool] = useState<Tool>('pen')
  const [penType, setPenType] = useState<PenType>(() => pref('trazo.penType', 'fountain') as PenType)
  const [pen, setPenState] = useState<ToolStyle>(() => readStyle('trazo.pen', { color: PEN_COLORS[0], size: PEN_SIZES[0] }))
  const [highlighter, setHighlighterState] = useState<ToolStyle>(() => readStyle('trazo.highlighter', { color: HIGHLIGHTER_COLORS[0], size: HIGHLIGHTER_SIZES[1] }))
  const setPen = (s: ToolStyle) => { setPenState(s); savePref('trazo.pen', JSON.stringify(s)) }
  const setHighlighter = (s: ToolStyle) => { setHighlighterState(s); savePref('trazo.highlighter', JSON.stringify(s)) }
  const [shapeKind, setShapeKind] = useState<ShapeTool>('rect')
  const [shapeFill, setShapeFill] = useState(false)
  // null = la manita (mover y seleccionar). Al elegir una figura se dibuja una vez y se vuelve a la manita.
  const [nodeKind, setNodeKind] = useState<NodeKind | null>(null)
  const backToHand = useCallback(() => setNodeKind(null), [])
  const [exportMenu, setExportMenu] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pageIndex, setPageIndex] = useState(0)
  const [title, setTitle] = useState(meta.title)
  const [paperMenu, setPaperMenu] = useState(false)
  const [sidebar, setSidebar] = useState(() => pref('trazo.sidebar', '0') === '1')
  const [sidebarView, setSidebarView] = useState<SidebarView>('pages')
  const [pageMenu, setPageMenu] = useState<number | null>(null)
  const [shapeMenu, setShapeMenu] = useState(false)
  const [stickers, setStickers] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [, setClipTick] = useState(0)

  const scrollerRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef(0)
  const dirty = useRef(false)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const pendingScroll = useRef<{ left: number; top: number } | null>(null)
  const onMetaChangeRef = useRef(onMetaChange)
  onMetaChangeRef.current = onMetaChange

  useEffect(() => setTitle(meta.title), [meta.title])

  // ---- Carga y guardado automático ----
  useEffect(() => {
    let alive = true
    loadNotebook(meta.id).then((d) => {
      if (!alive) return
      const loaded = d ?? { id: meta.id, pages: [newPage(meta.paper, meta.paperColor)] }
      docRef.current = loaded
      setDoc(loaded)
      needsFit.current = true
      fitZoom()
    })
    return () => { alive = false }
  }, [meta.id])

  // Ajusta el zoom al ancho disponible. Si la pestaña estaba oculta al cargar,
  // se hace la primera vez que se muestra.
  const needsFit = useRef(false)
  const fitZoom = () => {
    const el = scrollerRef.current
    const first = docRef.current?.pages[0]
    if (!el || !el.clientWidth || !first || !needsFit.current) return
    needsFit.current = false
    setZoom(Math.min(1.1, Math.max(MIN_ZOOM, (el.clientWidth - 96) / pageSize(first).w)))
  }
  useEffect(() => {
    if (active) requestAnimationFrame(fitZoom)
  })

  const flush = useCallback(() => {
    clearTimeout(saveTimer.current)
    if (dirty.current && docRef.current) {
      dirty.current = false
      saveNotebookNow(docRef.current)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('beforeunload', flush)
    return () => {
      window.removeEventListener('beforeunload', flush)
      flush()
    }
  }, [flush])

  // Al cambiar de pestaña se guarda de inmediato.
  useEffect(() => {
    if (!active) flush()
  }, [active, flush])

  const scheduleSave = () => {
    dirty.current = true
    clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      if (!docRef.current) return
      dirty.current = false
      void saveNotebook(docRef.current)
      onMetaChangeRef.current(meta.id, { updatedAt: Date.now() })
    }, 600)
  }

  // ---- Historial (deshacer / rehacer) ----
  const lastMerge = useRef<{ key: string; at: number } | null>(null)
  const setPages = (pages: Page[], record = true, mergeKey?: string) => {
    const cur = docRef.current
    if (!cur) return
    const now = Date.now()
    const merge = mergeKey && lastMerge.current?.key === mergeKey && now - lastMerge.current.at < 1500 && undoStack.current.length
    lastMerge.current = mergeKey ? { key: mergeKey, at: now } : null
    if (record && merge) {
      undoStack.current[undoStack.current.length - 1].after = pages
      redoStack.current = []
    } else if (record) {
      undoStack.current.push({ before: cur.pages, after: pages })
      if (undoStack.current.length > 300) undoStack.current.shift()
      redoStack.current = []
    }
    const next = { ...cur, pages }
    docRef.current = next
    setDoc(next)
    setHistoryTick((t) => t + 1)
    scheduleSave()
  }

  const updatePage = (index: number, fn: (p: Page) => Page) => {
    const cur = docRef.current
    if (!cur) return
    setPages(cur.pages.map((p, i) => (i === index ? fn(p) : p)))
  }

  const commitPage = useCallback((pageId: string, patch: PagePatch) => {
    const cur = docRef.current
    if (!cur) return
    setPages(cur.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)))
  }, [])

  const undo = () => {
    const e = undoStack.current.pop()
    if (!e) return
    redoStack.current.push(e)
    setSelection(null)
    setPages(e.before, false)
  }
  const redo = () => {
    const e = redoStack.current.pop()
    if (!e) return
    undoStack.current.push(e)
    setSelection(null)
    setPages(e.after, false)
  }

  // ---- Posiciones de las páginas (pueden tener distinto tamaño si se rotan) ----
  const pages = doc?.pages ?? []
  const offsets = useMemo(() => {
    let y = PAGES_PAD_TOP
    return pages.map((p) => {
      const o = y
      y += pageSize(p).h * zoom + PAGE_GAP
      return o
    })
  }, [pages, zoom])
  const offsetsRef = useRef(offsets)
  offsetsRef.current = offsets

  const scrollToPage = (i: number, smooth = true) => {
    setPageIndex(i)
    requestAnimationFrame(() => {
      const el = scrollerRef.current
      const top = offsetsRef.current[i]
      if (el && top !== undefined) el.scrollTo({ top: top - 16, behavior: smooth ? 'smooth' : 'auto' })
    })
  }

  const onScroll = () => {
    const el = scrollerRef.current
    if (!el) return
    const mid = el.scrollTop + el.clientHeight / 2
    const offs = offsetsRef.current
    let i = 0
    while (i + 1 < offs.length && offs[i + 1] <= mid) i++
    setPageIndex(i)
  }

  // ---- Páginas ----
  const addPage = (paper: Paper, after?: number) => {
    const cur = docRef.current
    if (!cur) return
    const at = after ?? cur.pages.length - 1
    const ref = cur.pages[at]
    const p = newPage(paper, ref?.color, ref?.size, ref?.landscape)
    setPages([...cur.pages.slice(0, at + 1), p, ...cur.pages.slice(at + 1)])
    setPaperMenu(false)
    scrollToPage(at + 1)
  }

  const deletePage = (index: number) => {
    const cur = docRef.current
    if (!cur || cur.pages.length < 2) return
    setSelection(null)
    setPages(cur.pages.filter((_, i) => i !== index))
  }

  const insertPageCopy = (source: Page, after: number) => {
    const cur = docRef.current
    if (!cur) return
    const copy: Page = { ...source, id: uid(), strokes: freshIds(source.strokes), images: source.images && freshIds(source.images) }
    setPages([...cur.pages.slice(0, after + 1), copy, ...cur.pages.slice(after + 1)])
    scrollToPage(after + 1)
  }

  const movePage = (from: number, to: number) => {
    const cur = docRef.current
    if (!cur) return
    const list = cur.pages.slice()
    const [p] = list.splice(from, 1)
    list.splice(to, 0, p)
    setPages(list)
    scrollToPage(to)
  }

  const applyPaper = (index: number, patch: PaperPatch, scope: PaperScope) => {
    const cur = docRef.current
    if (!cur) return
    // Al cambiar el tipo de hoja, el espaciado y el margen vuelven a los del tipo nuevo.
    const full = 'paper' in patch ? { ...patch, gap: undefined, margin: undefined } : patch
    const sliding = 'gap' in patch || 'margin' in patch
    setPages(
      cur.pages.map((p, i) => (scope === 'all' || i === index ? { ...p, ...full } : p)),
      true,
      sliding ? `paper-adjust-${scope}-${index}` : undefined,
    )
  }

  // ---- Imágenes y stickers ----
  /** Centro del área visible de una página, en coordenadas de página. */
  const visibleCenter = (index: number) => {
    const el = scrollerRef.current?.querySelectorAll('.page')[index] as HTMLElement | undefined
    const p = docRef.current?.pages[index]
    if (!el || !p) return { x: PAGE_W / 2, y: 300 }
    const { w, h } = pageSize(p)
    const r = el.getBoundingClientRect()
    const s = scrollerRef.current!.getBoundingClientRect()
    const y = ((Math.max(r.top, s.top) + Math.min(r.bottom, s.bottom)) / 2 - r.top) / zoomRef.current
    return { x: w / 2, y: Math.min(h - 80, Math.max(80, y)) }
  }

  const addImages = (index: number, items: ImageItem[]) => {
    const cur = docRef.current
    const p = cur?.pages[index]
    if (!p || !items.length) return
    updatePage(index, (pg) => ({ ...pg, images: [...(pg.images ?? []), ...items] }))
    setTool('lasso')
    setSelection({ pageId: p.id, ids: new Set(items.map((i) => i.id)) })
  }

  const insertFiles = async (files: File[], index = pageIndex, at?: { x: number; y: number }) => {
    const p = docRef.current?.pages[index]
    if (!p) return
    const c = at ?? visibleCenter(index)
    const maxW = pageSize(p).w * 0.6
    const items: ImageItem[] = []
    for (const [n, f] of files.entries()) {
      const stored = await storeImageFile(f)
      items.push(placeImage(stored.src, stored.w, stored.h, c.x + n * 24, c.y + n * 24, maxW))
    }
    addImages(index, items)
  }

  // Estable entre renders para no redibujar todas las páginas.
  const insertFilesRef = useRef(insertFiles)
  insertFilesRef.current = insertFiles
  const onDropFiles = useCallback((pageId: string, files: File[], x: number, y: number) => {
    const i = docRef.current?.pages.findIndex((p) => p.id === pageId) ?? -1
    if (i >= 0) void insertFilesRef.current(files, i, { x, y })
  }, [])

  const addSticker = (st: Sticker) => {
    pushRecent(st.id)
    setStickers(false)
    const c = visibleCenter(pageIndex)
    // Un poco de variación para que varios stickers seguidos no queden apilados.
    const jx = (Math.random() - 0.5) * 120, jy = (Math.random() - 0.5) * 80
    addImages(pageIndex, [placeImage('sticker:' + st.id, st.w, st.h, c.x + jx, c.y + jy, st.w > st.h ? 260 : 140)])
  }

  // ---- Copiar y pegar ----
  const selectionRef = useRef(selection)
  selectionRef.current = selection

  const copySelection = useCallback(() => {
    const cur = docRef.current
    const s = selectionRef.current
    const pg = cur?.pages.find((p) => p.id === s?.pageId)
    if (!pg || !s) return
    const nodes = (pg.nodes ?? []).filter((x) => s.ids.has(x.id))
    const nodeIds = new Set(nodes.map((n) => n.id))
    clipItems = {
      strokes: pg.strokes.filter((x) => s.ids.has(x.id)),
      images: (pg.images ?? []).filter((x) => s.ids.has(x.id)),
      nodes,
      links: (pg.links ?? []).filter((l) => nodeIds.has(l.from) && nodeIds.has(l.to)),
    }
  }, [])


  const pasteItems = () => {
    const cur = docRef.current
    if (!clipItems || !cur) return
    const index = pageIndex
    const p = cur.pages[index]
    const box = unionBox(clipItems.strokes, clipItems.images, clipItems.nodes)
    if (!p || !box) return
    const c = visibleCenter(index)
    const dx = c.x - (box.minX + box.maxX) / 2, dy = c.y - (box.minY + box.maxY) / 2
    const strokes = clipItems.strokes.map((s) => ({ ...translateStroke(s, dx, dy), id: uid() }))
    const images = clipItems.images.map((i) => ({ ...translateImage(i, dx, dy), id: uid() }))
    const idMap = new Map<string, string>()
    const nodes = clipItems.nodes.map((n) => {
      const id = uid()
      idMap.set(n.id, id)
      return { ...translateNode(n, dx, dy), id }
    })
    const links = clipItems.links.map((l) => ({ ...l, id: uid(), from: idMap.get(l.from)!, to: idMap.get(l.to)! }))
    updatePage(index, (pg) => ({
      ...pg,
      strokes: [...pg.strokes, ...strokes],
      images: [...(pg.images ?? []), ...images],
      nodes: [...(pg.nodes ?? []), ...nodes],
      links: [...(pg.links ?? []), ...links],
    }))
    setTool('lasso')
    setSelection({ pageId: p.id, ids: new Set([...strokes, ...images, ...nodes].map((x) => x.id)) })
  }

  const deleteSelection = () => {
    const s = selection
    const cur = docRef.current
    const pg = cur?.pages.find((p) => p.id === s?.pageId)
    if (!pg || !s) return
    commitPage(pg.id, {
      strokes: pg.strokes.filter((x) => !s.ids.has(x.id)),
      images: (pg.images ?? []).filter((x) => !s.ids.has(x.id)),
      nodes: (pg.nodes ?? []).filter((x) => !s.ids.has(x.id)),
      links: (pg.links ?? []).filter((l) => !s.ids.has(l.id) && !s.ids.has(l.from) && !s.ids.has(l.to)),
    })
    setSelection(null)
  }

  // Pegar imágenes desde el portapapeles del sistema (Ctrl+V).
  useEffect(() => {
    if (!active) return
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return
      const files = [...(e.clipboardData?.items ?? [])]
        .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
        .map((it) => it.getAsFile())
        .filter((f): f is File => !!f)
      e.preventDefault()
      if (files.length) void insertFiles(files)
      else pasteItems()
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  // ---- Zoom ----
  const zoomAt = useCallback((next: number, clientX?: number, clientY?: number) => {
    const el = scrollerRef.current
    if (!el) return
    const z = zoomRef.current
    const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
    if (Math.abs(nz - z) < 0.001) return
    const r = el.getBoundingClientRect()
    const cx = (clientX ?? r.left + r.width / 2) - r.left
    const cy = (clientY ?? r.top + r.height / 2) - r.top
    const ratio = nz / z
    pendingScroll.current = {
      left: (el.scrollLeft + cx) * ratio - cx,
      top: (el.scrollTop + cy) * ratio - cy,
    }
    zoomRef.current = nz
    setZoom(nz)
  }, [])

  useLayoutEffect(() => {
    const el = scrollerRef.current
    const p = pendingScroll.current
    if (el && p) {
      el.scrollLeft = p.left
      el.scrollTop = p.top
      pendingScroll.current = null
    }
  }, [zoom])

  // Ctrl + rueda, y gesto de pellizco del touchpad.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const notches = Math.max(-1, Math.min(1, -e.deltaY / 100))
      const next = zoomRef.current + notches * ZOOM_STEP
      // Con la rueda del mouse se queda en porcentajes redondos; el touchpad avanza de a poquito.
      zoomAt(Math.abs(notches) >= 1 ? Math.round(next * 100) / 100 : next, e.clientX, e.clientY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  // Dedo: un dedo desplaza, dos dedos hacen zoom.
  const touches = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; zoom: number } | null>(null)

  const onTouchDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (touches.current.size === 2) {
      const [a, b] = [...touches.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: zoomRef.current }
    }
  }
  const onTouchMove = (e: React.PointerEvent) => {
    const prev = touches.current.get(e.pointerId)
    if (!prev) return
    const el = scrollerRef.current!
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (touches.current.size === 1) {
      el.scrollLeft -= e.clientX - prev.x
      el.scrollTop -= e.clientY - prev.y
    } else if (touches.current.size === 2 && pinch.current) {
      const [a, b] = [...touches.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      zoomAt(pinch.current.zoom * (d / pinch.current.dist), (a.x + b.x) / 2, (a.y + b.y) / 2)
    }
  }
  const onTouchUp = (e: React.PointerEvent) => {
    touches.current.delete(e.pointerId)
    if (touches.current.size < 2) pinch.current = null
  }

  // ---- Atajos de teclado ----
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
      else if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomAt(stepZoom(zoomRef.current, 1)) }
      else if (mod && e.key === '-') { e.preventDefault(); zoomAt(stepZoom(zoomRef.current, -1)) }
      else if (mod && k === 'c' && selection) { e.preventDefault(); copySelection() }
      else if (mod && k === 'x' && selection) { e.preventDefault(); copySelection(); deleteSelection() }
      else if (mod) return
      else if (k === 'p') setTool('pen')
      else if (k === 'h') setTool('highlighter')
      else if (k === 'e') setTool('eraser')
      else if (k === 'l') setTool('lasso')
      else if (k === 'f') setTool('shape')
      else if (k === 'd') setTool('diagram')
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selection) deleteSelection()
      else if (e.key === 'Escape') setSelection(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    if (tool !== 'lasso') setSelection(null)
  }, [tool])

  const toggleSidebar = () => {
    setSidebar((v) => {
      savePref('trazo.sidebar', v ? '0' : '1')
      return !v
    })
  }

  const saveTitle = () => {
    const t = title.trim() || 'Sin título'
    setTitle(t)
    if (t !== meta.title) onMetaChange(meta.id, { title: t })
  }

  const closePageMenu = useCallback(() => setPageMenu(null), [])
  const closeShapeMenu = useCallback(() => setShapeMenu(false), [])
  const closeStickers = useCallback(() => setStickers(false), [])
  const closeExportMenu = useCallback(() => { if (!exporting) setExportMenu(false) }, [exporting])

  const runExport = async (kind: 'pdf' | 'pdf-page' | 'trazo') => {
    const cur = docRef.current
    if (!cur) return
    flush()
    try {
      if (kind === 'trazo') {
        setExporting('Preparando archivo…')
        await exportTrazo(meta, cur)
      } else {
        const list = kind === 'pdf' ? cur.pages : [cur.pages[pageIndex]]
        const name = kind === 'pdf' ? meta.title : `${meta.title} - página ${pageIndex + 1}`
        await exportPdf(name, list, (d, t) => setExporting(`Creando PDF… ${d} de ${t}`))
      }
      setExportMenu(false)
    } catch (err) {
      alert('No se pudo exportar: ' + (err as Error).message)
    } finally {
      setExporting(null)
    }
  }

  const isHighlighter = tool === 'highlighter'
  const style = isHighlighter ? highlighter : pen
  const setStyle = isHighlighter ? setHighlighter : setPen
  const presets = isHighlighter ? HIGHLIGHTER_COLORS : PEN_COLORS
  const custom = isHighlighter ? settings.highlighterColors : settings.penColors
  const sizes = isHighlighter ? HIGHLIGHTER_SIZES : PEN_SIZES
  const showOptions = tool === 'pen' || tool === 'highlighter' || tool === 'shape' || tool === 'diagram'
  const thinning = thinningFor(settings.pressure)
  const streamline = streamlineFor(settings.stabilization)
  const menuIndex = pageMenu === null ? pageIndex : Math.min(pageMenu, pages.length - 1)
  const menuPage = pages[menuIndex]

  return (
    <div className={`editor ${active ? '' : 'is-hidden'}`}>
      <header className="topbar toolbar">
        <div className="bar-left">
          <button className={`icon-btn ${sidebar ? 'on' : ''}`} onClick={toggleSidebar} title="Páginas, índice y marcadores">
            <PanelLeft size={18} />
          </button>
          <input
            className="title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </div>

        <div className="bar-center">
          <div className="tool-group">
            <ToolButton active={tool === 'lasso'} onClick={() => setTool('lasso')} label="Lazo (L)"><Lasso size={19} /></ToolButton>
            <ToolButton active={tool === 'pen'} onClick={() => setTool('pen')} label="Pluma (P)">{PEN_ICONS[penType]}</ToolButton>
            <ToolButton active={tool === 'highlighter'} onClick={() => setTool('highlighter')} label="Resaltador (H)"><Highlighter size={19} /></ToolButton>
            <ToolButton active={tool === 'eraser'} onClick={() => setTool('eraser')} label="Borrador (E)"><Eraser size={19} /></ToolButton>
            <ToolButton active={tool === 'shape'} onClick={() => setTool('shape')} label="Formas (F)"><Shapes size={19} /></ToolButton>
            <ToolButton active={tool === 'diagram'} onClick={() => setTool('diagram')} label="Diagramas: cajas con texto y flechas (D)"><Workflow size={19} /></ToolButton>
          </div>
          <span className="bar-divider" />
          <button className="icon-btn" onClick={() => fileRef.current?.click()} title="Insertar imagen (o pega con Ctrl+V)">
            <ImagePlus size={19} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              const files = [...(e.target.files ?? [])]
              e.target.value = ''
              if (files.length) void insertFiles(files)
            }}
          />
          <Popover
            open={stickers}
            onClose={closeStickers}
            className="sticker-pop"
            trigger={
              <button className={`icon-btn ${stickers ? 'on' : ''}`} onClick={() => setStickers((v) => !v)} title="Stickers">
                <StickerIcon size={19} />
              </button>
            }
          >
            <StickerPicker onPick={addSticker} />
          </Popover>
        </div>

        <div className="bar-right">
          <button className="icon-btn" onClick={() => addPage(pages[pageIndex]?.paper ?? meta.paper, pageIndex)} title="Agregar página después de esta">
            <FilePlus2 size={18} />
          </button>
          {menuPage && (
            <Popover
              open={pageMenu !== null}
              onClose={closePageMenu}
              align="right"
              className="page-menu-pop"
              trigger={
                <button className={`icon-btn ${pageMenu !== null ? 'on' : ''}`} onClick={() => setPageMenu(pageMenu === null ? pageIndex : null)} title="Opciones de página">
                  <MoreHorizontal size={19} />
                </button>
              }
            >
              <PageMenu
                key={menuPage.id}
                page={menuPage}
                index={menuIndex}
                total={pages.length}
                canPaste={!!clipPage}
                onBookmark={() => updatePage(menuIndex, (p) => ({ ...p, bookmark: !p.bookmark }))}
                onCopy={() => { clipPage = menuPage; setClipTick((t) => t + 1) }}
                onPaste={() => clipPage && insertPageCopy(clipPage, menuIndex)}
                onDuplicate={() => insertPageCopy(menuPage, menuIndex)}
                onRotate={() => { setSelection(null); updatePage(menuIndex, rotatePage) }}
                onTitle={(t) => {
                  updatePage(menuIndex, (p) => ({ ...p, title: t || undefined }))
                  if (t) { setSidebar(true); setSidebarView('outline') }
                }}
                onPaper={(patch, scope) => applyPaper(menuIndex, patch, scope)}
                onGoTo={(i) => scrollToPage(i)}
                onClear={() => { setSelection(null); updatePage(menuIndex, (p) => ({ ...p, strokes: [], images: [], nodes: [], links: [] })) }}
                onDelete={() => deletePage(menuIndex)}
                close={closePageMenu}
              />
            </Popover>
          )}
          <Popover
            open={exportMenu}
            onClose={closeExportMenu}
            align="right"
            className="export-pop"
            trigger={
              <button className={`icon-btn ${exportMenu ? 'on' : ''}`} onClick={() => setExportMenu((v) => !v)} title="Exportar y compartir">
                <Share size={18} />
              </button>
            }
          >
            <div className="page-menu-head">Exportar</div>
            {exporting ? (
              <p className="export-status">{exporting}</p>
            ) : (
              <>
                <button className="menu-item" onClick={() => runExport('pdf')}>
                  <span>PDF · todo el cuaderno<small>Para compartir con cualquiera</small></span>
                </button>
                <button className="menu-item" onClick={() => runExport('pdf-page')}>
                  <span>PDF · solo la página {pageIndex + 1}</span>
                </button>
                <button className="menu-item" onClick={() => runExport('trazo')}>
                  <span>Archivo Trazo<small>Editable, para abrirlo en otra copia de Trazo</small></span>
                </button>
              </>
            )}
          </Popover>
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="Ajustes"><SettingsIcon size={18} /></button>
        </div>
      </header>

      <div className="editor-body">
        {sidebar && (
          <PageSidebar
            pages={pages}
            current={pageIndex}
            view={sidebarView}
            onView={setSidebarView}
            onJump={(i) => scrollToPage(i)}
            onMove={movePage}
            onPageMenu={(i) => { scrollToPage(i); setPageMenu(i) }}
            onRename={(i, t) => updatePage(i, (p) => ({ ...p, title: t || undefined }))}
          />
        )}

        <div className="canvas-area">
          <div className="float-history">
            <button className="icon-btn" onClick={undo} disabled={!undoStack.current.length} title="Deshacer (Ctrl+Z)"><Undo2 size={18} /></button>
            <button className="icon-btn" onClick={redo} disabled={!redoStack.current.length} title="Rehacer (Ctrl+Y)"><Redo2 size={18} /></button>
          </div>

          {showOptions && (
            <div className="tool-options">
              {tool === 'pen' && (
                <>
                  {PEN_TYPES.map((t) => (
                    <button
                      key={t.id}
                      className={`opt-btn ${penType === t.id ? 'active' : ''}`}
                      onClick={() => { setPenType(t.id); savePref('trazo.penType', t.id) }}
                      title={t.label}
                    >
                      {PEN_ICONS[t.id]}
                    </button>
                  ))}
                  <span className="bar-divider" />
                </>
              )}
              {tool === 'diagram' && (
                <>
                  <button className={`opt-btn ${nodeKind === null ? 'active' : ''}`} onClick={() => setNodeKind(null)} title="Mover y seleccionar (la manita)">
                    <Hand size={18} />
                  </button>
                  <span className="bar-divider" />
                  {NODE_KINDS.map((k) => (
                    <button key={k.id} className={`opt-btn ${nodeKind === k.id ? 'active' : ''}`} onClick={() => setNodeKind(nodeKind === k.id ? null : k.id)} title={k.label}>
                      {NODE_ICONS[k.id]}
                    </button>
                  ))}
                  <span className="bar-divider" />
                  <span className="opt-hint">{nodeKind
                    ? 'Arrastra en la hoja para dibujar la figura del tamaño que quieras'
                    : 'Arrastra una figura para moverla · doble toque para escribir · arrastra sus puntitos para conectar'}</span>
                </>
              )}
              {tool === 'shape' && (
                <>
                  <Popover
                    open={shapeMenu}
                    onClose={closeShapeMenu}
                    align="left"
                    className="shape-pop"
                    trigger={
                      <button className="shape-trigger" onClick={() => setShapeMenu((v) => !v)} title="Tipo de forma">
                        {SHAPE_ICONS[shapeKind]}
                        <ChevronDown size={14} />
                      </button>
                    }
                  >
                    {SHAPES.map((s) => (
                      <button
                        key={s.id}
                        className={`shape-option ${shapeKind === s.id ? 'active' : ''}`}
                        onClick={() => { setShapeKind(s.id); setShapeMenu(false) }}
                      >
                        {SHAPE_ICONS[s.id]}
                        <span>{s.label}</span>
                      </button>
                    ))}
                    <p className="pop-hint">Mantén Shift para cuadrados, círculos y ángulos exactos.</p>
                  </Popover>
                  <button
                    className={`opt-btn ${shapeFill ? 'active' : ''}`}
                    onClick={() => setShapeFill((v) => !v)}
                    title={shapeFill ? 'Relleno: activado' : 'Relleno: desactivado'}
                  >
                    <PaintBucket size={17} />
                  </button>
                  <span className="bar-divider" />
                </>
              )}
              {tool !== 'diagram' && (<>
              <SizeControl
                presets={sizes}
                value={style.size}
                onChange={(size) => setStyle({ ...style, size })}
                min={isHighlighter ? 6 : 0.6}
                max={isHighlighter ? 50 : 16}
                step={isHighlighter ? 1 : 0.2}
                color={style.color}
                tool={isHighlighter ? 'highlighter' : 'pen'}
              />
              <span className="bar-divider" />
              <ColorPicker
                presets={presets}
                custom={custom}
                value={style.color}
                onChange={(c) => setStyle({ ...style, color: c })}
                onCustomChange={(list) => updateSettings(isHighlighter ? { highlighterColors: list } : { penColors: list })}
              />
              </>)}
            </div>
          )}

          <div
            ref={scrollerRef}
            className="scroller"
            onScroll={onScroll}
            onPointerDown={onTouchDown}
            onPointerMove={onTouchMove}
            onPointerUp={onTouchUp}
            onPointerCancel={onTouchUp}
          >
            <div className="pages" style={{ gap: PAGE_GAP, paddingTop: PAGES_PAD_TOP }}>
              {pages.map((p, i) => (
                <div key={p.id} className="page-slot">
                  {p.title && <div className="page-title-chip">{p.title}</div>}
                  <PageCanvas
                    page={p}
                    zoom={zoom}
                    tool={tool}
                    pen={pen}
                    penType={penType}
                    highlighter={highlighter}
                    shapeKind={shapeKind}
                    shapeFill={shapeFill}
                    nodeKind={nodeKind}
                    onNodeCreated={backToHand}
                    thinning={thinning}
                    streamline={streamline}
                    selection={selection}
                    onCommit={commitPage}
                    onSelect={setSelection}
                    onCopySelection={copySelection}
                    onDropFiles={onDropFiles}
                  />
                  <div className="page-actions">
                    <span>{i + 1}</span>
                    <button className="icon-btn small" onClick={() => setPageMenu(i)} title="Opciones de página">
                      <MoreHorizontal size={15} />
                    </button>
                  </div>
                </div>
              ))}

              {doc && (
                <div className="add-page" style={{ width: PAGE_W * zoom }}>
                  <button className="add-page-btn" onClick={() => addPage(pages[pages.length - 1]?.paper ?? meta.paper)}>
                    <Plus size={18} /> Agregar página
                  </button>
                  <button className="add-page-more" onClick={() => setPaperMenu((v) => !v)}>Otro tipo de hoja</button>
                  {paperMenu && (
                    <div className="paper-menu">
                      {PAPERS.map((p) => (
                        <button key={p.id} onClick={() => addPage(p.id)}>
                          <PaperPreview paper={p.id} color={pages[pages.length - 1]?.color} />
                          <span>{p.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="float-zoom">
            <button className="icon-btn small" onClick={() => zoomAt(stepZoom(zoom, -1))} title="Alejar (Ctrl -)"><Minus size={15} /></button>
            <button className="zoom-label" onClick={() => zoomAt(1)} title="Restablecer al 100%">{Math.round(zoom * 100)}%</button>
            <button className="icon-btn small" onClick={() => zoomAt(stepZoom(zoom, 1))} title="Acercar (Ctrl +)"><Plus size={15} /></button>
          </div>
          {pages.length > 0 && <div className="page-indicator">{pageIndex + 1} / {pages.length}</div>}
        </div>
      </div>

      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

function ToolButton(props: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button className={`tool-btn ${props.active ? 'active' : ''}`} onClick={props.onClick} title={props.label}>
      {props.children}
    </button>
  )
}
