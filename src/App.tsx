import { useCallback, useEffect, useRef, useState } from 'react'
import { Home, Plus, X } from 'lucide-react'
import type { Folder, Library as Lib, NotebookMeta } from './types'
import { uid } from './types'
import { deleteAsset, deleteNotebookData, loadLibrary, loadNotebook, saveLibrary, saveNotebook } from './storage'
import { Library, type NewNotebook } from './components/Library'
import { Editor, newPage } from './components/Editor'
import { exportPdf, exportTrazo, importPdf, importTrazo } from './exporter'
import { UpdateToast } from './updates'

const TABS_KEY = 'trazo.tabs'

function readTabs(): { open: string[]; active: string | null } {
  try {
    const v = JSON.parse(localStorage.getItem(TABS_KEY) ?? '')
    if (Array.isArray(v.open)) return v
  } catch { /* primera vez */ }
  return { open: [], active: null }
}

export function App() {
  const [library, setLibrary] = useState<Lib | null>(null)
  const [folderId, setFolderId] = useState<string | null>(null)
  // Pestañas: cuadernos abiertos a la vez. `active` null = Inicio (biblioteca).
  const [tabs, setTabs] = useState<string[]>(() => readTabs().open)
  const [active, setActive] = useState<string | null>(() => readTabs().active)
  const libRef = useRef<Lib | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    loadLibrary().then((l) => { libRef.current = l; setLibrary(l) })
  }, [])

  useEffect(() => {
    try { localStorage.setItem(TABS_KEY, JSON.stringify({ open: tabs, active })) } catch { /* sin almacenamiento */ }
  }, [tabs, active])

  const update = useCallback((fn: (l: Lib) => Lib) => {
    if (!libRef.current) return
    const next = fn(libRef.current)
    libRef.current = next
    setLibrary(next)
    void saveLibrary(next)
  }, [])

  const openTab = (id: string) => {
    setTabs((t) => (t.includes(id) ? t : [...t, id]))
    setActive(id)
  }

  const closeTab = (id: string) => {
    setTabs((t) => {
      const i = t.indexOf(id)
      const next = t.filter((x) => x !== id)
      if (active === id) setActive(next[Math.min(i, next.length - 1)] ?? null)
      return next
    })
  }

  const createNotebook = async (n: NewNotebook) => {
    const now = Date.now()
    const meta: NotebookMeta = { ...n, id: uid(), folderId, createdAt: now, updatedAt: now }
    await saveNotebook({ id: meta.id, pages: [newPage(n.paper, n.paperColor, n.size)] })
    update((l) => ({ ...l, notebooks: [...l.notebooks, meta] }))
    openTab(meta.id)
  }

  const createFolder = (name: string, color: string) => {
    const f: Folder = { id: uid(), name, color, parentId: folderId, createdAt: Date.now() }
    update((l) => ({ ...l, folders: [...l.folders, f] }))
  }

  const updateNotebook = useCallback((id: string, patch: Partial<NotebookMeta>) => {
    update((l) => ({ ...l, notebooks: l.notebooks.map((n) => (n.id === id ? { ...n, ...patch } : n)) }))
  }, [update])

  const updateFolder = (id: string, patch: Partial<Folder>) =>
    update((l) => ({ ...l, folders: l.folders.map((f) => (f.id === id ? { ...f, ...patch } : f)) }))

  const deleteNotebook = async (id: string) => {
    closeTab(id)
    update((l) => ({ ...l, notebooks: l.notebooks.filter((n) => n.id !== id) }))
    // También se borran las imágenes que ese cuaderno tenía guardadas aparte.
    const doc = await loadNotebook(id)
    doc?.pages.forEach((p) => p.images?.forEach((i) => i.src.startsWith('asset:') && void deleteAsset(i.src.slice(6))))
    void deleteNotebookData(id)
  }

  const importFiles = async (files: File[]) => {
    let last: string | null = null
    for (const file of files) {
      try {
        setBusy('Importando ' + file.name + '…')
        const imp = /\.pdf$/i.test(file.name)
          ? await importPdf(file, (d, t) => setBusy(`Importando PDF… página ${d} de ${t}`))
          : await importTrazo(file)
        const now = Date.now()
        const meta: NotebookMeta = { ...imp.meta, id: uid(), folderId, createdAt: now, updatedAt: now }
        await saveNotebook({ id: meta.id, pages: imp.pages })
        update((l) => ({ ...l, notebooks: [...l.notebooks, meta] }))
        last = meta.id
      } catch (err) {
        alert('No se pudo importar ' + file.name + ': ' + (err as Error).message)
      }
    }
    setBusy(null)
    if (last) openTab(last)
  }

  const exportNotebook = async (id: string, kind: 'pdf' | 'trazo') => {
    const meta = libRef.current?.notebooks.find((n) => n.id === id)
    const doc = await loadNotebook(id)
    if (!meta || !doc) return
    try {
      setBusy('Preparando…')
      if (kind === 'pdf') await exportPdf(meta.title, doc.pages, (d, t) => setBusy(`Creando PDF… ${d} de ${t}`))
      else await exportTrazo(meta, doc)
    } catch (err) {
      alert('No se pudo exportar: ' + (err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  // Al borrar una carpeta, su contenido sube un nivel en vez de perderse.
  const deleteFolder = (id: string) =>
    update((l) => {
      const parent = l.folders.find((f) => f.id === id)?.parentId ?? null
      return {
        folders: l.folders.filter((f) => f.id !== id).map((f) => (f.parentId === id ? { ...f, parentId: parent } : f)),
        notebooks: l.notebooks.map((n) => (n.folderId === id ? { ...n, folderId: parent } : n)),
      }
    })

  if (!library) return <div className="boot" />

  const openMetas = tabs.map((id) => library.notebooks.find((n) => n.id === id)).filter((n): n is NotebookMeta => !!n)
  const activeId = openMetas.some((m) => m.id === active) ? active : null

  return (
    <div className="app">
      <nav className="tabbar">
        <button className={`tab home ${activeId === null ? 'active' : ''}`} onClick={() => setActive(null)} title="Inicio">
          <Home size={17} />
        </button>
        {openMetas.map((m) => (
          <div
            key={m.id}
            className={`tab ${activeId === m.id ? 'active' : ''}`}
            onClick={() => setActive(m.id)}
            onAuxClick={(e) => e.button === 1 && closeTab(m.id)}
            title={m.title}
          >
            <span className="tab-dot" style={{ background: m.cover }} />
            <span className="tab-title">{m.title}</span>
            <button className="tab-close" onClick={(e) => { e.stopPropagation(); closeTab(m.id) }} title="Cerrar pestaña">
              <X size={14} />
            </button>
          </div>
        ))}
        <button className="tab-new" onClick={() => setActive(null)} title="Abrir otro cuaderno">
          <Plus size={16} />
        </button>
        <div className="tabbar-drag" />
      </nav>

      <div className="app-body">
        <div className={`view ${activeId === null ? '' : 'is-hidden'}`}>
          <Library
            library={library}
            folderId={folderId}
            busy={busy}
            onImport={(files) => void importFiles(files)}
            onExport={(id, kind) => void exportNotebook(id, kind)}
            onFolderChange={setFolderId}
            onOpen={openTab}
            onCreateNotebook={createNotebook}
            onCreateFolder={createFolder}
            onUpdateNotebook={updateNotebook}
            onUpdateFolder={updateFolder}
            onDeleteNotebook={(id) => void deleteNotebook(id)}
            onDeleteFolder={deleteFolder}
          />
        </div>
        {openMetas.map((m) => (
          <Editor key={m.id} meta={m} active={activeId === m.id} onMetaChange={updateNotebook} />
        ))}
      </div>
      <UpdateToast />
    </div>
  )
}
