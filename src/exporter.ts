import type { NotebookDoc, NotebookMeta, Page } from './types'
import { PAGE_W, pageSize, uid } from './types'
import { drawPage } from './ink/render'
import { preloadImages, storeImageFile } from './assets'
import { loadAsset, saveAsset } from './storage'
import { t } from './i18n'

// ---- Exportar ----

const PT_PER_UNIT = 595.28 / PAGE_W // A4 en puntos PDF

async function renderPage(page: Page, scale: number): Promise<HTMLCanvasElement> {
  await preloadImages((page.images ?? []).map((i) => i.src))
  await document.fonts?.ready
  const { w, h } = pageSize(page)
  const c = document.createElement('canvas')
  c.width = Math.round(w * scale)
  c.height = Math.round(h * scale)
  const ctx = c.getContext('2d')!
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  drawPage(ctx, page, () => {})
  return c
}

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '').trim() || t('Cuaderno')

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** PDF para compartir con cualquiera (se abre en cualquier computadora o celular). */
export async function exportPdf(title: string, pages: Page[], onProgress?: (done: number, total: number) => void) {
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  pdf.setTitle(title)
  pdf.setCreator('Trazo')
  for (const [i, page] of pages.entries()) {
    const canvas = await renderPage(page, 2)
    const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.9))
    const img = await pdf.embedJpg(await blob.arrayBuffer())
    const { w, h } = pageSize(page)
    const p = pdf.addPage([w * PT_PER_UNIT, h * PT_PER_UNIT])
    p.drawImage(img, { x: 0, y: 0, width: w * PT_PER_UNIT, height: h * PT_PER_UNIT })
    onProgress?.(i + 1, pages.length)
  }
  const bytes = await pdf.save()
  download(new Blob([bytes as BlobPart], { type: 'application/pdf' }), safeName(title) + '.pdf')
}

interface TrazoFile {
  format: 'trazo'
  version: 1
  meta: Pick<NotebookMeta, 'title' | 'cover' | 'coverDesign' | 'label' | 'paper' | 'paperColor' | 'size'>
  pages: Page[]
  assets: Record<string, string>
}

/** Archivo .trazo: el cuaderno completo y editable, para abrirlo en otra copia de Trazo. */
export async function exportTrazo(meta: NotebookMeta, doc: NotebookDoc) {
  const ids = new Set<string>()
  for (const p of doc.pages) for (const i of p.images ?? []) if (i.src.startsWith('asset:')) ids.add(i.src.slice(6))
  if (meta.coverImage?.startsWith('asset:')) ids.add(meta.coverImage.slice(6))
  const assets: Record<string, string> = {}
  for (const id of ids) {
    const data = await loadAsset(id)
    if (data) assets[id] = data
  }
  const file: TrazoFile = {
    format: 'trazo',
    version: 1,
    meta: { title: meta.title, cover: meta.cover, coverDesign: meta.coverDesign, label: meta.label, paper: meta.paper, paperColor: meta.paperColor, size: meta.size },
    pages: doc.pages,
    assets,
  }
  const coverImage = meta.coverImage?.startsWith('asset:') ? meta.coverImage : undefined
  download(new Blob([JSON.stringify({ ...file, coverImage })], { type: 'application/json' }), safeName(meta.title) + '.trazo')
}

// ---- Importar ----

export interface Imported {
  meta: Omit<NotebookMeta, 'id' | 'folderId' | 'createdAt' | 'updatedAt'>
  pages: Page[]
}

export async function importTrazo(file: File): Promise<Imported> {
  const data = JSON.parse(await file.text()) as TrazoFile & { coverImage?: string }
  if (data.format !== 'trazo' || !Array.isArray(data.pages)) throw new Error(t('Este archivo no es un cuaderno de Trazo.'))
  for (const [id, url] of Object.entries(data.assets ?? {})) await saveAsset(id, url)
  // Ids nuevos, para poder importar el mismo archivo dos veces sin choques.
  const pages = data.pages.map((p) => ({ ...p, id: uid() }))
  return {
    meta: {
      title: data.meta.title || file.name.replace(/\.trazo$/i, ''),
      cover: data.meta.cover,
      coverDesign: data.meta.coverDesign,
      label: data.meta.label,
      coverImage: data.coverImage,
      paper: data.meta.paper,
      paperColor: data.meta.paperColor,
      size: data.meta.size,
    },
    pages,
  }
}

/** Convierte cada página del PDF en una hoja con la página de fondo, lista para escribir encima. */
export async function importPdf(file: File, onProgress?: (done: number, total: number) => void): Promise<Imported> {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages: Page[] = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const pg = await pdf.getPage(n)
    const base = pg.getViewport({ scale: 1 })
    const landscape = base.width > base.height
    const { w, h } = pageSize({ landscape })
    // Se renderiza al doble del tamaño de la hoja para que se vea nítido con zoom.
    const scale = (Math.max(w, h) * 2) / Math.max(base.width, base.height)
    const viewport = pg.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await pg.render({ canvasContext: ctx, viewport, canvas }).promise
    const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/webp', 0.92))
    const stored = await storeImageFile(blob, 2600)
    // Cabe en la hoja sin deformarse, centrada.
    const k = Math.min(w / stored.w, h / stored.h)
    const iw = stored.w * k, ih = stored.h * k
    pages.push({
      id: uid(),
      paper: 'blank',
      color: 'white',
      landscape,
      strokes: [],
      images: [{ id: uid(), src: stored.src, x: (w - iw) / 2, y: (h - ih) / 2, w: iw, h: ih, locked: true }],
    })
    onProgress?.(n, pdf.numPages)
  }
  return {
    meta: { title: file.name.replace(/\.pdf$/i, ''), cover: '#7c2f3c', coverDesign: 'classic', paper: 'blank', paperColor: 'white' },
    pages,
  }
}

