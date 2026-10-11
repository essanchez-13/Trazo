import { useEffect, useState } from 'react'
import { Download, PartyPopper, RefreshCw, X } from 'lucide-react'
import type { UpdateStatus } from './storage'
import { CHANGELOG } from './changelog'

// Estado compartido de las actualizaciones (lo emite la app de escritorio).
let current: UpdateStatus | null = null
const listeners = new Set<(u: UpdateStatus | null) => void>()

if (window.trazo) {
  window.trazo.onUpdate((u) => {
    // El progreso de descarga no repite la versión: se conserva la que ya se sabía.
    current = { ...u, version: u.version ?? current?.version }
    listeners.forEach((fn) => fn(current))
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

/** Las notas de la versión llegan de GitHub como HTML o Markdown: se dejan solo las viñetas. */
function noteLines(notes?: string): string[] {
  if (!notes) return []
  const text = notes
    .replace(/<li>/gi, '\n- ')
    .replace(/<br\s*\/?>|<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- ') || l.startsWith('* '))
    .map((l) => l.slice(2))
    .slice(0, 5)
}

/** Avisos de actualización: progreso de descarga y tarjeta cuando está lista. */
export function UpdateToast() {
  const status = useUpdateStatus()
  const [dismissed, setDismissed] = useState<string | null>(null)
  if (!status || dismissed === `${status.state}-${status.version}`) return null

  if (status.state === 'downloading') {
    return (
      <div className="update-pill">
        <Download size={15} />
        <span>Descargando Trazo {status.version ?? ''}…</span>
        <div className="update-progress"><span style={{ width: `${status.percent ?? 5}%` }} /></div>
      </div>
    )
  }

  if (status.state !== 'ready') return null
  const lines = noteLines(status.notes)
  return (
    <div className="update-card">
      <button className="icon-btn small update-close" onClick={() => setDismissed(`ready-${status.version}`)} title="Después"><X size={15} /></button>
      <div className="update-head">
        <img src="./icon.png" alt="" />
        <div>
          <strong>Trazo {status.version} está lista</strong>
          <span>Se instala al reiniciar. Tus cuadernos no se tocan.</span>
        </div>
      </div>
      {lines.length > 0 && (
        <ul className="update-notes">
          {lines.map((l) => <li key={l}>{l}</li>)}
        </ul>
      )}
      <div className="update-actions">
        <button className="btn ghost" onClick={() => setDismissed(`ready-${status.version}`)}>Después</button>
        <button className="btn primary" onClick={() => window.trazo?.installUpdate()}>
          <RefreshCw size={15} /> Reiniciar ahora
        </button>
      </div>
    </div>
  )
}

const SEEN_KEY = 'trazo.lastVersion'

/** La primera vez que se abre una versión nueva, muestra qué trae. */
export function WhatsNew() {
  const version = useAppVersion()
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!version) return
    let previous: string | null = null
    try {
      previous = localStorage.getItem(SEEN_KEY)
      localStorage.setItem(SEEN_KEY, version)
    } catch { /* sin almacenamiento */ }
    // En la primera instalación no hay "antes": no se muestra nada.
    if (previous && previous !== version && CHANGELOG[version]) setShow(true)
  }, [version])
  if (!show || !version) return null
  return (
    <div className="modal-backdrop" onPointerDown={() => setShow(false)}>
      <div className="whats-new" onPointerDown={(e) => e.stopPropagation()}>
        <div className="whats-new-badge"><PartyPopper size={22} /></div>
        <h2>¡Trazo se actualizó a la versión {version}!</h2>
        <p>Esto es lo nuevo:</p>
        <ul>
          {CHANGELOG[version].map((l) => <li key={l}>{l}</li>)}
        </ul>
        <button className="btn primary" onClick={() => setShow(false)}>¡Genial!</button>
      </div>
    </div>
  )
}

export function updateLabel(s: UpdateStatus | null): string {
  if (!s) return ''
  if (s.state === 'checking') return 'Buscando actualizaciones…'
  if (s.state === 'downloading') return s.percent !== undefined ? `Descargando actualización… ${s.percent}%` : 'Descargando actualización…'
  if (s.state === 'ready') return `Versión ${s.version ?? 'nueva'} lista: reinicia para instalarla.`
  if (s.state === 'latest') return 'Tienes la versión más reciente.'
  const msg = s.message ?? ''
  if (/ENOTFOUND|ENETUNREACH|ECONNREFUSED|ETIMEDOUT|ERR_INTERNET_DISCONNECTED|net::/i.test(msg)) {
    return 'No se pudo buscar actualizaciones: parece que no hay internet.'
  }
  if (/404|Cannot find|No published versions/i.test(msg)) {
    return 'No se encontraron versiones publicadas en GitHub. Descarga la última versión desde la página de Trazo.'
  }
  return 'No se pudo buscar actualizaciones. Inténtalo más tarde.'
}
