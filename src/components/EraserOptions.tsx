import { useCallback, useState } from 'react'
import { Highlighter, Image as ImageIcon, PenTool, Shapes, SlidersHorizontal, Trash2 } from 'lucide-react'
import type { EraserSettings } from '../types'
import { ERASER_SIZES } from '../types'
import { Popover } from './Popover'

interface Props {
  settings: EraserSettings
  onChange: (patch: Partial<EraserSettings>) => void
  onClearPage: () => void
}

const FILTERS: { key: 'pen' | 'highlighter' | 'shapes' | 'images'; label: string; icon: React.ReactNode }[] = [
  { key: 'pen', label: 'Pluma', icon: <PenTool size={16} /> },
  { key: 'highlighter', label: 'Resaltador', icon: <Highlighter size={16} /> },
  { key: 'shapes', label: 'Formas', icon: <Shapes size={16} /> },
  { key: 'images', label: 'Imágenes y stickers', icon: <ImageIcon size={16} /> },
]

/** Barra del borrador: modo, tamaño y ajustes avanzados (se recuerdan). */
export function EraserOptions({ settings, onChange, onClearPage }: Props) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const offCount = FILTERS.filter((f) => !settings[f.key]).length

  return (
    <>
      <div className="segmented small eraser-mode">
        <button className={settings.mode === 'stroke' ? 'active' : ''} onClick={() => onChange({ mode: 'stroke' })} title="Borra el trazo entero al tocarlo">
          Trazo completo
        </button>
        <button className={settings.mode === 'precise' ? 'active' : ''} onClick={() => onChange({ mode: 'precise' })} title="Borra solo la parte que tocas">
          Parcial
        </button>
      </div>
      <span className="bar-divider" />
      <div className="sizes">
        {ERASER_SIZES.map((s, i) => (
          <button
            key={s}
            className={`size-btn ${settings.size === s ? 'active' : ''}`}
            onClick={() => onChange({ size: s })}
            title={['Pequeño', 'Mediano', 'Grande'][i]}
          >
            <span className="eraser-dot" style={{ width: 6 + i * 5, height: 6 + i * 5 }} />
          </button>
        ))}
      </div>
      <span className="bar-divider" />
      <Popover
        open={open}
        onClose={close}
        align="right"
        className="eraser-pop"
        trigger={
          <button className={`opt-btn ${open ? 'active' : ''}`} onClick={() => setOpen((v) => !v)} title="Ajustes del borrador">
            <SlidersHorizontal size={17} />
            {offCount > 0 && <span className="opt-badge">{offCount}</span>}
          </button>
        }
      >
        <div className="page-menu-head">Ajustes del borrador</div>
        <div className="pop-label">Qué borra</div>
        {FILTERS.map((f) => (
          <label key={f.key} className="switch-row">
            {f.icon}
            <span>{f.label}</span>
            <input type="checkbox" className="switch" checked={settings[f.key]} onChange={(e) => onChange({ [f.key]: e.target.checked })} />
          </label>
        ))}
        <p className="pop-hint">El borrador ignora lo que tenga apagado.</p>

        <div className="pop-label">Tamaño</div>
        <div className="size-row">
          <input
            className="slider"
            type="range"
            min={2}
            max={60}
            step={1}
            value={settings.size}
            onChange={(e) => onChange({ size: Number(e.target.value) })}
          />
          <em className="size-value">{settings.size}</em>
        </div>

        <div className="eraser-sep" />
        <label className="switch-row">
          <span>Volver a la herramienta anterior al soltar</span>
          <input type="checkbox" className="switch" checked={settings.autoDeselect} onChange={(e) => onChange({ autoDeselect: e.target.checked })} />
        </label>
        <button className="menu-item danger" onClick={() => { onClearPage(); setOpen(false) }}>
          <Trash2 size={16} /> <span>Limpiar página</span>
        </button>
      </Popover>
    </>
  )
}
