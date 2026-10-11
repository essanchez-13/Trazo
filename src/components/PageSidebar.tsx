import { memo, useEffect, useRef, useState } from 'react'
import { Bookmark, LayoutGrid, ListTree, MoreHorizontal } from 'lucide-react'
import type { Page } from '../types'
import { pageSize } from '../types'
import { drawPage } from '../ink/render'

const THUMB_W = 132

export type SidebarView = 'pages' | 'outline' | 'bookmarks'

interface Props {
  pages: Page[]
  current: number
  view: SidebarView
  onView: (v: SidebarView) => void
  onJump: (index: number) => void
  onMove: (from: number, to: number) => void
  /** Abre el menú de página (el mismo del botón ⋯) para esa página. */
  onPageMenu: (index: number) => void
  onRename: (index: number, title: string) => void
}

export function PageSidebar(props: Props) {
  const { pages, current, view } = props
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Mantiene visible la página actual.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${current}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [current, view])

  const outline = pages.map((p, i) => ({ p, i })).filter(({ p }) => p.title)
  const marked = pages.map((p, i) => ({ p, i })).filter(({ p }) => p.bookmark)

  const thumbList = (items: { p: Page; i: number }[], draggable: boolean) => (
    <div className="thumbs" ref={listRef}>
      {items.map(({ p, i }) => (
        <div
          key={p.id}
          data-index={i}
          className={`thumb ${i === current ? 'active' : ''} ${drag && drag.over === i && drag.from !== i ? (drag.from < i ? 'drop-after' : 'drop-before') : ''}`}
          draggable={draggable}
          onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDrag({ from: i, over: i }) }}
          onDragOver={(e) => { if (!drag) return; e.preventDefault(); if (drag.over !== i) setDrag({ ...drag, over: i }) }}
          onDrop={(e) => { e.preventDefault(); if (drag && drag.from !== i) props.onMove(drag.from, i); setDrag(null) }}
          onDragEnd={() => setDrag(null)}
          onClick={() => props.onJump(i)}
        >
          <div className="thumb-art">
            <Thumb page={p} />
            {p.bookmark && <span className="thumb-ribbon"><Bookmark size={13} fill="currentColor" /></span>}
          </div>
          {p.title && <div className="thumb-title">{p.title}</div>}
          <div className="thumb-foot">
            <span>{i + 1}</span>
            <button
              className="icon-btn small"
              onClick={(e) => { e.stopPropagation(); props.onPageMenu(i) }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Opciones de página"
            >
              <MoreHorizontal size={15} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        <button className={view === 'pages' ? 'active' : ''} onClick={() => props.onView('pages')} title="Páginas"><LayoutGrid size={16} /></button>
        <button className={view === 'outline' ? 'active' : ''} onClick={() => props.onView('outline')} title="Índice"><ListTree size={16} /></button>
        <button className={view === 'bookmarks' ? 'active' : ''} onClick={() => props.onView('bookmarks')} title="Marcadores"><Bookmark size={16} /></button>
      </div>

      {view === 'pages' && thumbList(pages.map((p, i) => ({ p, i })), true)}

      {view === 'outline' && (
        outline.length ? (
          <div className="outline" ref={listRef}>
            {outline.map(({ p, i }) => (
              <div key={p.id} data-index={i} className={`outline-row ${i === current ? 'active' : ''}`} onClick={() => props.onJump(i)}>
                <div className="outline-mini"><Thumb page={p} width={34} /></div>
                {editing === i ? (
                  <input
                    className="outline-input"
                    autoFocus
                    defaultValue={p.title}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => { props.onRename(i, e.target.value.trim()); setEditing(null) }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      if (e.key === 'Escape') setEditing(null)
                    }}
                  />
                ) : (
                  <span className="outline-title" onDoubleClick={(e) => { e.stopPropagation(); setEditing(i) }} title="Doble clic para renombrar">
                    {p.title}
                  </span>
                )}
                <span className="outline-page">p. {i + 1}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="sidebar-empty">
            <ListTree size={28} strokeWidth={1.5} />
            <p>El índice está vacío.</p>
            <span>Usa <b>⋯ → Agregar al índice</b> en una página para ponerle un título, por ejemplo "Tema 3: Congruencias".</span>
          </div>
        )
      )}

      {view === 'bookmarks' && (
        marked.length ? thumbList(marked, false) : (
          <div className="sidebar-empty">
            <Bookmark size={28} strokeWidth={1.5} />
            <p>No hay páginas marcadas.</p>
            <span>Marca las páginas importantes con <b>⋯ → Marcar página</b>.</span>
          </div>
        )
      )}
    </aside>
  )
}

const Thumb = memo(function Thumb({ page, width = THUMB_W }: { page: Page; width?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [tick, setTick] = useState(0)
  const { w, h } = pageSize(page)
  const height = (width * h) / w
  const dpr = Math.min(2, window.devicePixelRatio || 1)

  useEffect(() => {
    const c = ref.current
    if (!c) return
    // Se dibuja en un momento libre para no trabar la escritura.
    const id = requestIdleCallback(() => {
      const ctx = c.getContext('2d')!
      const k = c.width / w
      ctx.setTransform(k, 0, 0, k, 0, 0)
      drawPage(ctx, page, () => setTick((t) => t + 1))
    }, { timeout: 400 })
    return () => cancelIdleCallback(id)
  }, [page, w, tick])

  return (
    <canvas
      ref={ref}
      className="thumb-canvas"
      width={Math.round(width * dpr)}
      height={Math.round(height * dpr)}
      style={{ width, height }}
    />
  )
})
