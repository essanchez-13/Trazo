import { useEffect, useRef } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import type { Settings } from '../types'
import { ACCENTS, INK, thinningFor } from '../types'
import { useSettings } from '../settings'
import { drawStroke } from '../ink/render'
import { mapPressure } from '../ink/shapes'
import { Modal } from './Modal'
import { updateLabel, useAppVersion, useUpdateStatus } from '../updates'
import { lang, setLang, t, type Lang } from '../i18n'

// Los nombres de idioma van en su propio idioma, para que se reconozcan siempre.
const LANGS: { id: Lang; label: string }[] = [{ id: 'en', label: 'English' }, { id: 'es', label: 'Español' }]

const THEMES: { id: Settings['theme']; label: string; icon: React.ReactNode }[] = [
  { id: 'light', label: t('Claro'), icon: <Sun size={16} /> },
  { id: 'dark', label: t('Oscuro'), icon: <Moon size={16} /> },
  { id: 'system', label: t('Sistema'), icon: <Monitor size={16} /> },
]

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { settings, update } = useSettings()
  const version = useAppVersion()
  const updateStatus = useUpdateStatus()

  return (
    <Modal title={t('Ajustes')} onClose={onClose} footer={<button className="btn primary" onClick={onClose}>{t('Listo')}</button>}>
      <div className="settings">
        <div className="field">
          <span>{t('Apariencia')}</span>
          <div className="segmented">
            {THEMES.map((t) => (
              <button key={t.id} className={settings.theme === t.id ? 'active' : ''} onClick={() => update({ theme: t.id })}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>{t('Idioma')}</span>
          <div className="segmented">
            {LANGS.map((l) => (
              <button key={l.id} className={lang === l.id ? 'active' : ''} onClick={() => setLang(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>{t('Color de acento')}</span>
          <div className="cover-swatches">
            {ACCENTS.map((c) => (
              <button key={c} className={`cover-swatch ${settings.accent === c ? 'active' : ''}`} style={{ background: c }} onClick={() => update({ accent: c })} />
            ))}
          </div>
        </div>

        <div className="field">
          <span>{t('Sensibilidad a la presión del lápiz')}</span>
          <PressurePreview pressure={settings.pressure} />
          <input
            className="slider"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.pressure}
            onChange={(e) => update({ pressure: Number(e.target.value) })}
          />
          <div className="slider-labels">
            <span>{t('Uniforme')}</span>
            <span>{t('Marcada')}</span>
          </div>
          <p className="field-hint">{t('Si escribes fuerte y el trazo se ve muy grueso, bájala. Aplica a lo que escribas de ahora en adelante.')}</p>
        </div>

        <div className="field">
          <span>{t('Estabilización del trazo')}</span>
          <input
            className="slider"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.stabilization}
            onChange={(e) => update({ stabilization: Number(e.target.value) })}
          />
          <div className="slider-labels">
            <span>{t('Precisa')}</span>
            <span>{t('Suavizada')}</span>
          </div>
          <p className="field-hint">{t('Más baja: el trazo sigue exacto la punta del lápiz. Más alta: las líneas salen más suaves, pero con un poco de retraso.')}</p>
        </div>

        {window.trazo && (
          <div className="field about">
            <span>{t('Acerca de Trazo')}</span>
            <div className="about-row">
              <img src="./icon.png" alt="" />
              <div>
                <strong>Trazo {version ?? ''}</strong>
                <p className="field-hint">{updateLabel(updateStatus) || t('Se actualiza sola cuando hay una versión nueva.')}</p>
              </div>
              {updateStatus?.state === 'ready'
                ? <button className="btn primary" onClick={() => window.trazo?.installUpdate()}>{t('Reiniciar')}</button>
                : <button className="btn ghost" onClick={() => window.trazo?.checkUpdates()}>{t('Buscar actualizaciones')}</button>}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/** Muestra cómo se ve un trazo que va de presión suave a fuerte y de vuelta. */
function PressurePreview({ pressure }: { pressure: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    const w = c.clientWidth, h = c.clientHeight
    c.width = w * dpr
    c.height = h * dpr
    const ctx = c.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const pts: number[][] = []
    for (let i = 0; i <= 90; i++) {
      const t = i / 90
      pts.push([20 + t * (w - 40), h / 2 + Math.sin(t * Math.PI * 3) * (h * 0.22), 0.1 + 0.9 * Math.sin(t * Math.PI)])
    }
    drawStroke(ctx, { id: 'p', tool: 'pen', color: INK, size: 7, th: thinningFor(pressure), points: pts.map((q) => [q[0], q[1], mapPressure(q[2])]) }, false, false)
  }, [pressure])
  return <canvas ref={ref} className="pressure-preview" />
}
