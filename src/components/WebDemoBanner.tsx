import { useState } from 'react'
import { Code2, Download, X } from 'lucide-react'
import { t } from '../i18n'

const DOWNLOAD_URL = 'https://github.com/essanchez-13/trazo-releases/releases/latest/download/Trazo-Setup.exe'
const REPO_URL = 'https://github.com/essanchez-13/Trazo'
const KEY = 'trazo-demo-banner'

/** Aviso que solo aparece en la demo web: dónde se guardan las notas y cómo bajar la app. */
export function WebDemoBanner() {
  const [hidden, setHidden] = useState(() => {
    try { return sessionStorage.getItem(KEY) === 'hidden' } catch { return false }
  })
  if (window.trazo || hidden) return null

  const hide = () => {
    setHidden(true)
    try { sessionStorage.setItem(KEY, 'hidden') } catch { /* sin almacenamiento */ }
  }

  return (
    <div className="demo-banner" role="note">
      <span className="demo-text">{t('Estás probando la demo web de Trazo. Tus notas se guardan solo en este navegador.')}</span>
      <a className="btn primary demo-btn" href={DOWNLOAD_URL}>
        <Download size={15} /> {t('Descargar para Windows')}
      </a>
      <a className="icon-btn small" href={REPO_URL} target="_blank" rel="noopener noreferrer" title={t('Ver el código en GitHub')}>
        <Code2 size={16} />
      </a>
      <button className="icon-btn small" onClick={hide} title={t('Cerrar aviso')}>
        <X size={15} />
      </button>
    </div>
  )
}
