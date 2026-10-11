import { useEffect, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'
import type { UpdateStatus } from './storage'

// Estado compartido de las actualizaciones (lo emite la app de escritorio).
let current: UpdateStatus | null = null
const listeners = new Set<(u: UpdateStatus | null) => void>()

if (window.trazo) {
  window.trazo.onUpdate((u) => {
    current = u
    listeners.forEach((fn) => fn(u))
  })
}

export function useUpdateStatus() {
  const [status, setStatus] = useState(current)
  useEffect(() => {
    listeners.add(setStatus)
    return () => { listeners.delete(setStatus) }
  }, [])
  return status
}

export function useAppVersion() {
  const [version, setVersion] = useState<string | null>(null)
  useEffect(() => { window.trazo?.version().then(setVersion) }, [])
  return version
}

/** Aviso abajo a la derecha cuando hay una versión nueva descargada. */
export function UpdateToast() {
  const status = useUpdateStatus()
  const [hidden, setHidden] = useState<string | null>(null)
  if (!status || status.state !== 'ready' || hidden === status.version) return null
  return (
    <div className="update-toast">
      <Download size={18} />
      <div>
        <strong>Nueva versión lista{status.version ? ` (${status.version})` : ''}</strong>
        <span>Se instala al reiniciar. Tus cuadernos no se tocan.</span>
      </div>
      <button className="btn primary" onClick={() => window.trazo?.installUpdate()}>
        <RefreshCw size={15} /> Reiniciar
      </button>
      <button className="icon-btn small" onClick={() => setHidden(status.version ?? '')} title="Más tarde"><X size={15} /></button>
    </div>
  )
}

export function updateLabel(s: UpdateStatus | null): string {
  if (!s) return ''
  if (s.state === 'checking') return 'Buscando actualizaciones…'
  if (s.state === 'downloading') return s.percent !== undefined ? `Descargando actualización… ${s.percent}%` : 'Descargando actualización…'
  if (s.state === 'ready') return `Versión ${s.version ?? 'nueva'} lista: reinicia para instalarla.`
  if (s.state === 'latest') return 'Tienes la versión más reciente.'
  return 'No se pudo buscar actualizaciones (¿sin internet?).'
}
