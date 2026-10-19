import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen, ChevronRight, ImageOff, Pencil, Wallpaper, FolderPlus, ImagePlus, MoreHorizontal, Plus, Presentation, Search, Settings as SettingsIcon,
  Upload, X,
} from 'lucide-react'
import type { CoverLabel, Folder, Library as Lib, LibraryHome, NotebookMeta, PageSizeKind, Paper, PaperColor } from '../types'
import { COVERS, COVER_DESIGNS, DEFAULT_LABEL, FOLDER_COLORS, LABEL_COLORS } from '../types'
import { storeImageFile, useAssetUrl } from '../assets'
import { Modal } from './Modal'
import { PaperColorRow, PaperGrid } from './PaperPanel'
import { SettingsDialog } from './SettingsDialog'
import { lang, t } from '../i18n'

export interface NewNotebook {
  title: string
  cover: string
  coverDesign: string
  coverImage?: string
  label: CoverLabel
  paper: Paper
  paperColor: PaperColor
  size: PageSizeKind
}

interface Props {
  library: Lib
  folderId: string | null
  busy: string | null
  onFolderChange: (id: string | null) => void
  onOpen: (id: string) => void
  onCreateNotebook: (n: NewNotebook) => void
  onCreateFolder: (name: string, color: string) => void
  onUpdateNotebook: (id: string, patch: Partial<NotebookMeta>) => void
  onUpdateFolder: (id: string, patch: Partial<Folder>) => void
  onDeleteNotebook: (id: string) => void
  onDeleteFolder: (id: string) => void
  onImport: (files: File[]) => void
  onUpdateHome: (patch: Partial<LibraryHome>) => void
  onExport: (id: string, kind: 'pdf' | 'trazo') => void
}

type Target = { type: 'notebook'; item: NotebookMeta } | { type: 'folder'; item: Folder }

type Dialog =
  | { kind: 'new-notebook'; board: boolean }
  | { kind: 'new-folder' }
  | { kind: 'edit'; target: Target }
  | { kind: 'move'; target: Target }
  | { kind: 'delete'; target: Target }

const dateFmt = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' })
const IMPORT_TYPES = '.trazo,.pdf,application/pdf'

export function Library(props: Props) {
  const { library, folderId } = props
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const [newMenu, setNewMenu] = useState(false)
  const [bgMenu, setBgMenu] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dropping, setDropping] = useState(false)
  // Arrastrar cuadernos y carpetas para moverlos ('root' = Documentos).
  const [dragItem, setDragItem] = useState<{ type: 'notebook' | 'folder'; id: string } | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!menu && !newMenu && !bgMenu) return
    const close = () => { setMenu(null); setNewMenu(false); setBgMenu(false) }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [menu, newMenu, bgMenu])

  const trail = useMemo(() => {
    const out: Folder[] = []
    let id = folderId
    while (id) {
      const f = library.folders.find((x) => x.id === id)
      if (!f) break
      out.unshift(f)
      id = f.parentId
    }
    return out
  }, [library.folders, folderId])

  const q = query.trim().toLowerCase()
  const folders = q
    ? library.folders.filter((f) => f.name.toLowerCase().includes(q))
    : library.folders.filter((f) => f.parentId === folderId).sort((a, b) => a.name.localeCompare(b.name))
  const notebooks = (q
    ? library.notebooks.filter((n) => n.title.toLowerCase().includes(q))
    : library.notebooks.filter((n) => n.folderId === folderId)
  ).sort((a, b) => b.updatedAt - a.updatedAt)

  const countIn = (id: string) =>
    library.folders.filter((f) => f.parentId === id).length + library.notebooks.filter((n) => n.folderId === id).length

  const current = trail[trail.length - 1]
  const homeName = library.home?.name?.trim() || t('Documentos')

  // Fondo: el de la carpeta actual, o el de la carpeta de arriba más cercana, o el del inicio.
  const background = [...trail].reverse().find((f) => f.background)?.background ?? library.home?.background
  const backgroundUrl = useAssetUrl(background)
  const ownBackground = current ? current.background : library.home?.background
  const bgRef = useRef<HTMLInputElement>(null)
  const [renaming, setRenaming] = useState(false)
  const setBackground = (src: string | undefined) => {
    if (current) props.onUpdateFolder(current.id, { background: src })
    else props.onUpdateHome({ background: src })
  }

  /** ¿Se puede soltar lo que se arrastra dentro de esta carpeta? (null = Documentos) */
  const canDropInto = (target: string | null) => {
    if (!dragItem) return false
    if (dragItem.type === 'notebook') return library.notebooks.find((n) => n.id === dragItem.id)?.folderId !== target
    const folder = library.folders.find((f) => f.id === dragItem.id)
    if (!folder || folder.parentId === target) return false
    // Una carpeta no puede ir dentro de sí misma ni de sus subcarpetas.
    let id = target
    while (id) {
      if (id === folder.id) return false
      id = library.folders.find((f) => f.id === id)?.parentId ?? null
    }
    return true
  }

  const dropProps = (target: string | null) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!canDropInto(target)) return
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'move'
      setDropTarget(target ?? 'root')
    },
    onDragLeave: () => setDropTarget((t) => (t === (target ?? 'root') ? null : t)),
    onDrop: (e: React.DragEvent) => {
      if (!dragItem || !canDropInto(target)) return
      e.preventDefault()
      e.stopPropagation()
      if (dragItem.type === 'notebook') props.onUpdateNotebook(dragItem.id, { folderId: target })
      else props.onUpdateFolder(dragItem.id, { parentId: target })
      setDragItem(null)
      setDropTarget(null)
    },
  })

  const dragProps = (type: 'notebook' | 'folder', id: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('application/x-trazo', id)
      setMenu(null)
      setDragItem({ type, id })
    },
    onDragEnd: () => { setDragItem(null); setDropTarget(null) },
  })

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDropping(false)
    const files = [...e.dataTransfer.files].filter((f) => /\.(pdf|trazo)$/i.test(f.name))
    if (files.length) props.onImport(files)
  }

  return (
    <div className={`library ${backgroundUrl ? 'has-bg' : ''}`} style={backgroundUrl ? { ['--lib-bg' as string]: `url("${backgroundUrl}")` } : undefined}>
      <header className="topbar lib-bar">
        <div className="bar-left">
          <div className="brand">
            <img className="brand-icon" src="./icon.png" alt="" />
            Trazo
          </div>
        </div>
        <div className="search">
          <Search size={16} />
          <input placeholder={t('Buscar cuadernos y carpetas')} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="bar-right">
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} title={t('Ajustes')}><SettingsIcon size={18} /></button>
        </div>
      </header>

      <main
        className={`lib-main ${dropping ? 'dropping' : ''}`}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropping(true) } }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDropping(false) }}
        onDrop={onDrop}
      >
        <div className="lib-head">
          <div>
            <nav className="crumbs">
              <button
                onClick={() => props.onFolderChange(null)}
                className={`${!folderId ? 'current' : ''} ${dropTarget === 'root' ? 'drop-target' : ''}`}
                {...dropProps(null)}
              >
                {homeName}
              </button>
              {trail.map((f) => (
                <span key={f.id} className="crumb">
                  <ChevronRight size={14} />
                  <button
                    onClick={() => props.onFolderChange(f.id)}
                    className={`${f.id === folderId ? 'current' : ''} ${dropTarget === f.id ? 'drop-target' : ''}`}
                    {...dropProps(f.id)}
                  >
                    {f.name}
                  </button>
                </span>
              ))}
            </nav>
            {!q && !current && renaming ? (
              <input
                className="title-edit"
                autoFocus
                defaultValue={homeName}
                onFocus={(e) => e.target.select()}
                onBlur={(e) => { props.onUpdateHome({ name: e.target.value.trim() || undefined }); setRenaming(false) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  if (e.key === 'Escape') setRenaming(false)
                }}
              />
            ) : (
              <h1 className="lib-title">
                {q ? t('Resultados') : current ? current.name : homeName}
                {!q && !current && (
                  <button className="icon-btn small rename-btn" onClick={() => setRenaming(true)} title={t('Cambiar el nombre')}>
                    <Pencil size={15} />
                  </button>
                )}
              </h1>
            )}
          </div>
          <div className="lib-actions">
            <div className="card-menu-wrap new-wrap" onPointerDown={(e) => e.stopPropagation()}>
              <button className="btn ghost" onClick={() => setBgMenu((v) => !v)} title={current ? t('Fondo de esta carpeta') : t('Fondo del inicio')}>
                <Wallpaper size={17} /> {t('Fondo')}
              </button>
              {bgMenu && (
                <div className="menu new-menu">
                  <button onClick={() => { setBgMenu(false); bgRef.current?.click() }}>
                    <Wallpaper size={17} /> <span>{ownBackground ? t('Cambiar imagen') : t('Elegir una imagen')}<small>{current ? t('Solo dentro de «{name}»', { name: current.name }) : t('Para «{name}» y sus carpetas', { name: homeName })}</small></span>
                  </button>
                  {ownBackground && (
                    <button onClick={() => { setBgMenu(false); setBackground(undefined) }}>
                      <ImageOff size={17} /> <span>{t('Quitar fondo')}</span>
                    </button>
                  )}
                </div>
              )}
              <input
                ref={bgRef}
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) setBackground((await storeImageFile(f, 2400)).src)
                }}
              />
            </div>
            <button className="btn ghost" onClick={() => importRef.current?.click()} title={t('Importar un PDF o un archivo de Trazo')}>
              <Upload size={17} /> {t('Importar')}
            </button>
            <input
              ref={importRef}
              type="file"
              accept={IMPORT_TYPES}
              multiple
              hidden
              onChange={(e) => {
                const files = [...(e.target.files ?? [])]
                e.target.value = ''
                if (files.length) props.onImport(files)
              }}
            />
            <button className="btn ghost" onClick={() => setDialog({ kind: 'new-folder' })}>
              <FolderPlus size={17} /> {t('Carpeta')}
            </button>
            <div className="card-menu-wrap new-wrap" onPointerDown={(e) => e.stopPropagation()}>
              <button className="btn primary" onClick={() => setNewMenu((v) => !v)}>
                <Plus size={17} /> {t('Nuevo')}
              </button>
              {newMenu && (
                <div className="menu new-menu">
                  <button onClick={() => { setNewMenu(false); setDialog({ kind: 'new-notebook', board: false }) }}>
                    <BookOpen size={17} /> <span>{t('Cuaderno')}<small>{t('Páginas para tomar apuntes')}</small></span>
                  </button>
                  <button onClick={() => { setNewMenu(false); setDialog({ kind: 'new-notebook', board: true }) }}>
                    <Presentation size={17} /> <span>{t('Pizarra')}<small>{t('Hoja grande para diagramas e ideas')}</small></span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {!folders.length && !notebooks.length ? (
          <div className="empty">
            {q ? (
              <p>{t('No hay resultados para “{q}”.', { q: query })}</p>
            ) : (
              <>
                <div className="empty-art" />
                <p>{current ? t('Esta carpeta está vacía.') : t('Todavía no tienes cuadernos.')}</p>
                <button className="btn primary" onClick={() => setDialog({ kind: 'new-notebook', board: false })}>
                  <Plus size={17} /> {t('Crear cuaderno')}
                </button>
                <span className="empty-hint">{t('También puedes arrastrar aquí un PDF para escribirle encima.')}</span>
              </>
            )}
          </div>
        ) : (
          <div className="grid">
            {folders.map((f) => (
              <div
                key={f.id}
                className={`card ${dropTarget === f.id ? 'drop-target' : ''} ${dragItem?.id === f.id ? 'dragging' : ''}`}
                onClick={() => { setQuery(''); props.onFolderChange(f.id) }}
                {...dragProps('folder', f.id)}
                {...dropProps(f.id)}
              >
                <FolderArt color={f.color ?? FOLDER_COLORS[0]} count={countIn(f.id)} />
                <CardInfo
                  title={f.name}
                  sub={`${countIn(f.id)} elementos`}
                  menuOpen={menu === f.id}
                  onMenu={() => setMenu(menu === f.id ? null : f.id)}
                  actions={[
                    [t('Editar carpeta'), () => setDialog({ kind: 'edit', target: { type: 'folder', item: f } })],
                    [t('Mover a…'), () => setDialog({ kind: 'move', target: { type: 'folder', item: f } })],
                    [t('Eliminar'), () => setDialog({ kind: 'delete', target: { type: 'folder', item: f } }), true],
                  ]}
                />
              </div>
            ))}
            {notebooks.map((n) => (
              <div
                key={n.id}
                className={`card ${dragItem?.id === n.id ? 'dragging' : ''}`}
                onClick={() => props.onOpen(n.id)}
                {...dragProps('notebook', n.id)}
              >
                <Cover color={n.cover} design={n.coverDesign} image={n.coverImage} title={n.title} board={n.size === 'board'} label={n.label} />
                <CardInfo
                  title={n.title}
                  sub={dateFmt.format(n.updatedAt)}
                  menuOpen={menu === n.id}
                  onMenu={() => setMenu(menu === n.id ? null : n.id)}
                  actions={[
                    [t('Editar portada'), () => setDialog({ kind: 'edit', target: { type: 'notebook', item: n } })],
                    [t('Mover a…'), () => setDialog({ kind: 'move', target: { type: 'notebook', item: n } })],
                    [t('Exportar PDF'), () => props.onExport(n.id, 'pdf')],
                    [t('Exportar archivo Trazo'), () => props.onExport(n.id, 'trazo')],
                    [t('Eliminar'), () => setDialog({ kind: 'delete', target: { type: 'notebook', item: n } }), true],
                  ]}
                />
              </div>
            ))}
          </div>
        )}
        {dragItem && (
          <div className="drag-hint">
            {trail.length
              ? t('Suelta sobre una carpeta para guardarlo ahí, o sobre la ruta de arriba (por ejemplo «{home}») para sacarlo.', { home: homeName })
              : t('Suelta sobre una carpeta para guardarlo ahí.')}
          </div>
        )}
        {dropping && <div className="drop-hint"><Upload size={28} /> {t('Suelta aquí tus PDF o archivos de Trazo')}</div>}
      </main>

      {props.busy && (
        <div className="busy-toast"><span className="spinner" /> {props.busy}</div>
      )}

      {dialog?.kind === 'new-notebook' && (
        <NotebookDialog
          heading={dialog.board ? t('Nueva pizarra') : t('Nuevo cuaderno')}
          confirm={t('Crear')}
          initial={{
            title: '',
            cover: COVERS[library.notebooks.length % COVERS.length],
            coverDesign: 'classic',
            paper: dialog.board ? 'dots-large' : 'lined',
            paperColor: dialog.board ? 'white' : 'cream',
            size: dialog.board ? 'board' : 'a4',
            label: DEFAULT_LABEL,
          }}
          showPaper
          onClose={() => setDialog(null)}
          onSave={(v) => { props.onCreateNotebook(v); setDialog(null) }}
        />
      )}
      {dialog?.kind === 'new-folder' && (
        <FolderDialog heading={t('Nueva carpeta')} confirm={t('Crear')} initial={{ name: '', color: FOLDER_COLORS[library.folders.length % FOLDER_COLORS.length] }}
          onClose={() => setDialog(null)}
          onSave={(v) => { props.onCreateFolder(v.name, v.color); setDialog(null) }} />
      )}
      {dialog?.kind === 'edit' && dialog.target.type === 'notebook' && (
        <NotebookDialog
          heading={t('Editar portada')}
          confirm={t('Guardar')}
          initial={{ ...dialog.target.item, coverDesign: dialog.target.item.coverDesign ?? 'classic', paperColor: dialog.target.item.paperColor ?? 'cream', size: dialog.target.item.size ?? 'a4', label: dialog.target.item.label ?? DEFAULT_LABEL }}
          onClose={() => setDialog(null)}
          onSave={(v) => {
            props.onUpdateNotebook(dialog.target.item.id, { title: v.title, cover: v.cover, coverDesign: v.coverDesign, coverImage: v.coverImage, label: v.label })
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === 'edit' && dialog.target.type === 'folder' && (
        <FolderDialog heading={t('Editar carpeta')} confirm={t('Guardar')}
          initial={{ name: dialog.target.item.name, color: dialog.target.item.color ?? FOLDER_COLORS[0] }}
          onClose={() => setDialog(null)}
          onSave={(v) => { props.onUpdateFolder(dialog.target.item.id, { name: v.name, color: v.color }); setDialog(null) }} />
      )}
      {dialog?.kind === 'move' && (
        <MoveDialog
          library={library}
          target={dialog.target}
          onClose={() => setDialog(null)}
          onMove={(dest) => {
            const t = dialog.target
            if (t.type === 'notebook') props.onUpdateNotebook(t.item.id, { folderId: dest })
            else props.onUpdateFolder(t.item.id, { parentId: dest })
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === 'delete' && (
        <Modal
          title={dialog.target.type === 'notebook' ? t('¿Eliminar cuaderno?') : t('¿Eliminar carpeta?')}
          onClose={() => setDialog(null)}
          footer={
            <>
              <button className="btn ghost" onClick={() => setDialog(null)}>{t('Cancelar')}</button>
              <button
                className="btn danger"
                onClick={() => {
                  const t = dialog.target
                  if (t.type === 'notebook') props.onDeleteNotebook(t.item.id)
                  else props.onDeleteFolder(t.item.id)
                  setDialog(null)
                }}
              >
                Eliminar
              </button>
            </>
          }
        >
          {dialog.target.type === 'notebook' ? (
            <p>{t('“{title}” y todas sus páginas se eliminarán. Esto no se puede deshacer.', { title: dialog.target.item.title })}</p>
          ) : (
            <p>{t('La carpeta “{name}” se eliminará. Lo que tenga adentro se moverá a la carpeta superior.', { name: dialog.target.item.name })}</p>
          )}
        </Modal>
      )}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

/** Texto oscuro o claro según qué tan claro sea el fondo. */
function readableOn(bg: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(bg)
  if (!m) return '#2b2f36'
  const n = parseInt(m[1], 16)
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum > 0.6 ? '#2b2f36' : '#ffffff'
}

export function Cover(props: {
  color: string; design?: string; image?: string; title: string; board?: boolean; small?: boolean
  label?: CoverLabel
  /** Si se pasa, la etiqueta se puede arrastrar para moverla. */
  onMoveLabel?: (x: number, y: number) => void
}) {
  const url = useAssetUrl(props.image)
  const ref = useRef<HTMLDivElement>(null)
  const label = props.label ?? DEFAULT_LABEL
  const glass = label.bg === 'glass'

  const startDrag = (e: React.PointerEvent) => {
    if (!props.onMoveLabel || !ref.current) return
    e.preventDefault()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      const r = ref.current!.getBoundingClientRect()
      const x = Math.min(88, Math.max(12, ((ev.clientX - r.left) / r.width) * 100))
      const y = Math.min(92, Math.max(8, ((ev.clientY - r.top) / r.height) * 100))
      props.onMoveLabel!(Math.round(x), Math.round(y))
    }
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      target.removeEventListener('pointercancel', up)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
    target.addEventListener('pointercancel', up)
  }

  return (
    <div
      ref={ref}
      className={`cover d-${props.design ?? 'classic'} ${url ? 'has-image' : ''} ${props.board ? 'is-board' : ''}`}
      style={{ ['--cover' as string]: props.color, ...(url ? { ['--img' as string]: `url("${url}")` } : {}) }}
    >
      {!props.small && label.show && (
        <div
          className={`cover-label size-${label.size} ${glass ? 'glass' : ''} ${props.onMoveLabel ? 'movable' : ''}`}
          style={{ left: `${label.x}%`, top: `${label.y}%`, ...(glass ? {} : { background: label.bg, color: readableOn(label.bg) }) }}
          onPointerDown={startDrag}
        >
          {props.title}
        </div>
      )}
      {!props.small && props.board && label.badge && (
        // Si el título está abajo, la marca se pasa arriba para no taparlo.
        <span className={`cover-badge ${label.show && label.y > 60 ? 'top' : ''}`}>{t('Pizarra')}</span>
      )}
    </div>
  )
}

function FolderArt({ color }: { color: string; count: number }) {
  return (
    <div className="folder-art">
      <svg viewBox="0 0 120 96" className="folder-svg">
        <path d="M6 18 Q6 8 16 8 L44 8 Q50 8 54 13 L60 20 L104 20 Q114 20 114 30 L114 34 L6 34 Z" fill={color} style={{ filter: 'brightness(0.82)' }} />
        <rect x="10" y="26" width="100" height="10" rx="2" fill="#fff" opacity=".85" />
        <path d="M6 32 Q6 26 14 26 L106 26 Q114 26 114 32 L114 80 Q114 90 104 90 L16 90 Q6 90 6 80 Z" fill={color} />
        <path d="M6 40 L114 40" stroke="#fff" strokeOpacity=".18" strokeWidth="2" />
      </svg>
    </div>
  )
}

function CardInfo(props: {
  title: string
  sub: string
  menuOpen: boolean
  onMenu: () => void
  actions: [string, () => void, boolean?][]
}) {
  return (
    <div className="card-info">
      <div className="card-text">
        <div className="card-title">{props.title}</div>
        <div className="card-sub">{props.sub}</div>
      </div>
      <div className="card-menu-wrap" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <button className="icon-btn small" onClick={props.onMenu} title={t('Opciones')}>
          <MoreHorizontal size={16} />
        </button>
        {props.menuOpen && (
          <div className="menu">
            {props.actions.map(([label, fn, danger]) => (
              <button key={label} className={danger ? 'danger' : ''} onClick={() => { props.onMenu(); fn() }}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NotebookDialog(props: {
  heading: string
  confirm: string
  initial: Omit<NewNotebook, 'coverImage' | 'label'> & { coverImage?: string; label?: CoverLabel }
  showPaper?: boolean
  onClose: () => void
  onSave: (v: NewNotebook) => void
}) {
  const [title, setTitle] = useState(props.initial.title)
  const [cover, setCover] = useState(props.initial.cover)
  const [design, setDesign] = useState(props.initial.coverDesign)
  const [image, setImage] = useState(props.initial.coverImage)
  const [paper, setPaper] = useState<Paper>(props.initial.paper)
  const [paperColor, setPaperColor] = useState<PaperColor>(props.initial.paperColor)
  const [label, setLabel] = useState<CoverLabel>({ ...DEFAULT_LABEL, ...props.initial.label })
  const patchLabel = (p: Partial<CoverLabel>) => setLabel((l) => ({ ...l, ...p }))
  const [loadingImage, setLoadingImage] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const board = props.initial.size === 'board'
  const save = () => props.onSave({
    title: title.trim() || (board ? t('Pizarra') : t('Sin título')),
    cover, coverDesign: design, coverImage: image, label, paper, paperColor, size: props.initial.size,
  })

  return (
    <Modal
      title={props.heading}
      onClose={props.onClose}
      footer={
        <>
          <button className="btn ghost" onClick={props.onClose}>{t('Cancelar')}</button>
          <button className="btn primary" onClick={save} disabled={loadingImage}>{props.confirm}</button>
        </>
      }
    >
      <div className="nb-dialog">
        <div className="nb-preview">
          <Cover
            color={cover} design={design} image={image} title={title || (board ? t('Pizarra') : t('Sin título'))} board={board}
            label={label} onMoveLabel={(x, y) => patchLabel({ x, y })}
          />
          {label.show && <p className="preview-hint">{t('Arrastra el título para moverlo')}</p>}
        </div>
        <div className="nb-fields">
          <label className="field">
            <span>{t('Título')}</span>
            <AutoFocusInput value={title} onChange={setTitle} onEnter={save} placeholder={board ? t('Pizarra') : t('Sin título')} />
          </label>
          <div className="field">
            <span>{t('Diseño de portada')}</span>
            <div className="design-grid">
              {COVER_DESIGNS.map((d) => (
                <button
                  key={d.id}
                  className={`design-option ${design === d.id && !image ? 'active' : ''}`}
                  onClick={() => { setDesign(d.id); setImage(undefined) }}
                  title={d.label}
                >
                  <Cover color={cover} design={d.id} title="" small />
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>{t('Color')}</span>
            <div className="cover-swatches">
              {COVERS.map((c) => (
                <button key={c} className={`cover-swatch ${cover === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setCover(c)} />
              ))}
            </div>
          </div>
          <div className="field">
            <span>{t('Etiqueta del título')}</span>
            <div className="label-controls">
              <Toggle on={label.show} onChange={(show) => patchLabel({ show })} text={t('Mostrar')} />
              {board && <Toggle on={label.badge} onChange={(badge) => patchLabel({ badge })} text={t('Marca «Pizarra»')} />}
            </div>
            {label.show && (
              <>
                <div className="cover-swatches">
                  {LABEL_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`cover-swatch label-swatch ${c === 'glass' ? 'glass' : ''} ${label.bg === c ? 'active' : ''}`}
                      style={c === 'glass' ? undefined : { background: c }}
                      onClick={() => patchLabel({ bg: c })}
                      title={c === 'glass' ? t('Vidrio') : c}
                    />
                  ))}
                  <label className="cover-swatch custom-color" title={t('Otro color')} style={LABEL_COLORS.includes(label.bg) ? undefined : { background: label.bg }}>
                    <input type="color" value={label.bg.startsWith('#') ? label.bg : '#ffffff'} onChange={(e) => patchLabel({ bg: e.target.value })} />
                  </label>
                </div>
                <div className="label-controls">
                  <div className="segmented small">
                    {(['s', 'm', 'l'] as const).map((sz, i) => (
                      <button key={sz} className={label.size === sz ? 'active' : ''} onClick={() => patchLabel({ size: sz })}>
                        {[t('Pequeña'), t('Mediana'), t('Grande')][i]}
                      </button>
                    ))}
                  </div>
                  <button className="btn ghost small-btn" onClick={() => patchLabel({ x: DEFAULT_LABEL.x, y: DEFAULT_LABEL.y })}>{t('Posición original')}</button>
                </div>
              </>
            )}
          </div>
          <div className="cover-image-row">
            <button className="btn ghost" onClick={() => fileRef.current?.click()} disabled={loadingImage}>
              <ImagePlus size={16} /> {image ? t('Cambiar imagen') : t('Usar una imagen de portada')}
            </button>
            {image && (
              <button className="btn ghost" onClick={() => setImage(undefined)} title={t('Quitar imagen')}><X size={16} /></button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                setLoadingImage(true)
                try { setImage((await storeImageFile(f, 900)).src) } finally { setLoadingImage(false) }
              }}
            />
          </div>
          {props.showPaper && (
            <div className="field">
              <span>{t('Hoja')}</span>
              <PaperGrid value={paper} color={paperColor} onChange={setPaper} />
              <PaperColorRow value={paperColor} onChange={setPaperColor} />
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

function Toggle({ on, onChange, text }: { on: boolean; onChange: (v: boolean) => void; text: string }) {
  return (
    <button className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span className="toggle-track"><span className="toggle-thumb" /></span>
      {text}
    </button>
  )
}

function FolderDialog(props: {
  heading: string
  confirm: string
  initial: { name: string; color: string }
  onClose: () => void
  onSave: (v: { name: string; color: string }) => void
}) {
  const [name, setName] = useState(props.initial.name)
  const [color, setColor] = useState(props.initial.color)
  const save = () => props.onSave({ name: name.trim() || t('Nueva carpeta'), color })
  return (
    <Modal
      title={props.heading}
      onClose={props.onClose}
      footer={
        <>
          <button className="btn ghost" onClick={props.onClose}>{t('Cancelar')}</button>
          <button className="btn primary" onClick={save}>{props.confirm}</button>
        </>
      }
    >
      <div className="folder-dialog">
        <div className="folder-preview"><FolderArt color={color} count={0} /></div>
        <div className="nb-fields">
          <label className="field">
            <span>{t('Nombre')}</span>
            <AutoFocusInput value={name} onChange={setName} onEnter={save} placeholder={t('Nueva carpeta')} />
          </label>
          <div className="field">
            <span>{t('Color')}</span>
            <div className="cover-swatches">
              {FOLDER_COLORS.map((c) => (
                <button key={c} className={`cover-swatch ${color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
              ))}
              <label className="cover-swatch custom-color" title={t('Otro color')} style={{ background: FOLDER_COLORS.includes(color) ? undefined : color }}>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
              </label>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function MoveDialog(props: { library: Lib; target: Target; onClose: () => void; onMove: (dest: string | null) => void }) {
  const { library, target } = props
  // Una carpeta no puede moverse dentro de sí misma ni de sus subcarpetas.
  const blocked = useMemo(() => {
    const out = new Set<string>()
    if (target.type !== 'folder') return out
    const walk = (id: string) => {
      out.add(id)
      library.folders.filter((f) => f.parentId === id).forEach((f) => walk(f.id))
    }
    walk(target.item.id)
    return out
  }, [library.folders, target])

  const currentParent = target.type === 'notebook' ? target.item.folderId : target.item.parentId
  const [dest, setDest] = useState<string | null>(currentParent)

  const rows: { id: string | null; name: string; depth: number; color?: string }[] = [{ id: null, name: library.home?.name?.trim() || t('Documentos'), depth: 0 }]
  const walk = (parent: string | null, depth: number) => {
    library.folders
      .filter((f) => f.parentId === parent && !blocked.has(f.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((f) => { rows.push({ id: f.id, name: f.name, depth, color: f.color }); walk(f.id, depth + 1) })
  }
  walk(null, 1)

  return (
    <Modal
      title={t('Mover a…')}
      onClose={props.onClose}
      footer={
        <>
          <button className="btn ghost" onClick={props.onClose}>{t('Cancelar')}</button>
          <button className="btn primary" onClick={() => props.onMove(dest)}>{t('Mover')}</button>
        </>
      }
    >
      <div className="move-list">
        {rows.map((r) => (
          <button key={r.id ?? 'root'} className={`move-row ${dest === r.id ? 'active' : ''}`} style={{ paddingLeft: 12 + r.depth * 18 }} onClick={() => setDest(r.id)}>
            <span className="move-dot" style={{ background: r.color ?? 'var(--faint)' }} /> {r.name}
          </button>
        ))}
      </div>
    </Modal>
  )
}

function AutoFocusInput(props: { value: string; onChange: (v: string) => void; onEnter: () => void; placeholder: string }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  return (
    <input
      ref={ref}
      className="input"
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && props.onEnter()}
    />
  )
}
