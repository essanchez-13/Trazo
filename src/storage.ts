import { get, set, del } from 'idb-keyval'
import type { Library, NotebookDoc, Settings } from './types'

// En la app de escritorio los datos van a archivos JSON (vía Electron).
// En el navegador (modo desarrollo) caen a IndexedDB.
export interface UpdateStatus {
  state: 'checking' | 'downloading' | 'ready' | 'latest' | 'error'
  version?: string
  percent?: number
  message?: string
}

declare global {
  interface Window {
    trazo?: {
      isDesktop: true
      read(key: string): Promise<string | null>
      write(key: string, data: string): Promise<void>
      remove(key: string): Promise<void>
      writeSync(key: string, data: string): boolean
      setTitleBar(opts: { color: string; symbolColor: string }): void
      version(): Promise<string>
      checkUpdates(): void
      installUpdate(): void
      onUpdate(cb: (u: UpdateStatus) => void): () => void
    }
  }
}

async function read<T>(key: string): Promise<T | null> {
  const raw = window.trazo ? await window.trazo.read(key) : await get<string>(key)
  return raw ? (JSON.parse(raw) as T) : null
}

async function write(key: string, value: unknown) {
  const raw = JSON.stringify(value)
  if (window.trazo) await window.trazo.write(key, raw)
  else await set(key, raw)
}

async function remove(key: string) {
  if (window.trazo) await window.trazo.remove(key)
  else await del(key)
}

export const loadLibrary = async (): Promise<Library> =>
  (await read<Library>('library')) ?? { folders: [], notebooks: [] }

export const saveLibrary = (lib: Library) => write('library', lib)

export const loadNotebook = (id: string) => read<NotebookDoc>('nb-' + id)

export const saveNotebook = (doc: NotebookDoc) => write('nb-' + doc.id, doc)

/** Guardado síncrono para cuando la ventana se está cerrando. */
export function saveNotebookNow(doc: NotebookDoc) {
  if (window.trazo) window.trazo.writeSync('nb-' + doc.id, JSON.stringify(doc))
  else void saveNotebook(doc)
}

export const deleteNotebookData = (id: string) => remove('nb-' + id)

export const loadSettings = () => read<Partial<Settings>>('settings')

export const saveSettings = (s: Settings) => write('settings', s)

// Las imágenes se guardan aparte para que el cuaderno siga siendo liviano.
export const saveAsset = (id: string, dataUrl: string) => write('asset-' + id, dataUrl)

export const loadAsset = (id: string) => read<string>('asset-' + id)

export const deleteAsset = (id: string) => remove('asset-' + id)
