import { useEffect, useState } from 'react'
import { getSticker, stickerUrl } from './stickers'
import { loadAsset, saveAsset } from './storage'
import type { ImageItem } from './types'
import { uid } from './types'

// Caché de imágenes ya decodificadas, para dibujarlas en el canvas sin demora.
const cache = new Map<string, HTMLImageElement>()
const waiting = new Map<string, Set<() => void>>()

function notify(src: string) {
  waiting.get(src)?.forEach((fn) => fn())
  waiting.delete(src)
}

/** Devuelve la imagen si ya está lista; si no, la carga y avisa con `onReady`. */
export function getImage(src: string, onReady: () => void): HTMLImageElement | null {
  const hit = cache.get(src)
  if (hit?.complete && hit.naturalWidth) return hit
  let set = waiting.get(src)
  if (!set) {
    set = new Set()
    waiting.set(src, set)
  }
  set.add(onReady)
  if (!hit) {
    const img = new Image()
    img.decoding = 'async'
    cache.set(src, img)
    img.onload = () => notify(src)
    if (src.startsWith('sticker:')) {
      const st = getSticker(src.slice(8))
      if (st) img.src = stickerUrl(st)
    } else if (src.startsWith('asset:')) {
      loadAsset(src.slice(6)).then((data) => { if (data) img.src = data })
    }
  }
  return null
}

const MAX_SIDE = 1800

/** Reduce la imagen si es enorme y la guarda aparte del cuaderno. */
export async function storeImageFile(blob: Blob, maxSide = MAX_SIDE): Promise<{ src: string; w: number; h: number }> {
  const bitmap = await createImageBitmap(blob)
  const k = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * k), h = Math.round(bitmap.height * k)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const data = canvas.toDataURL('image/webp', 0.9)
  const id = uid()
  await saveAsset(id, data)
  const src = 'asset:' + id
  const img = new Image()
  img.src = data
  cache.set(src, img)
  return { src, w, h }
}

/** Crea el elemento de página centrado en (cx, cy), con un ancho máximo. */
export function placeImage(src: string, w: number, h: number, cx: number, cy: number, maxW: number): ImageItem {
  const k = Math.min(1, maxW / w, (maxW * 1.3) / h)
  const iw = w * k, ih = h * k
  return { id: uid(), src, x: cx - iw / 2, y: cy - ih / 2, w: iw, h: ih }
}

/** Espera a que todas estas imágenes estén listas para dibujarse. */
export function preloadImages(srcs: string[], timeoutMs = 8000): Promise<void> {
  const each = srcs.map((src) => new Promise<void>((res) => {
    const done = () => res()
    if (getImage(src, done)) res()
    setTimeout(done, timeoutMs)
  }))
  return Promise.all(each).then(() => undefined)
}

/** URL de datos de una imagen guardada (para usarla en CSS, por ejemplo en portadas). */
export function useAssetUrl(src?: string): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    if (!src?.startsWith('asset:')) { setUrl(null); return }
    loadAsset(src.slice(6)).then((d) => { if (alive) setUrl(d) })
    return () => { alive = false }
  }, [src])
  return url
}
