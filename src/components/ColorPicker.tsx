import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Plus, X } from 'lucide-react'
import { Popover } from './Popover'

interface Props {
  presets: string[]
  custom: string[]
  value: string
  onChange: (color: string) => void
  onCustomChange: (colors: string[]) => void
}

export function ColorPicker({ presets, custom, value, onChange, onCustomChange }: Props) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const close = useCallback(() => setOpen(false), [])
  const isPreset = presets.includes(value)

  // Se usa el evento nativo "change" (al cerrar el selector) para no guardar
  // un color por cada movimiento dentro del selector.
  const latest = useRef({ custom, onChange, onCustomChange })
  latest.current = { custom, onChange, onCustomChange }
  useEffect(() => {
    const el = inputRef.current
    if (!open || !el) return
    const onPick = () => {
      const c = el.value
      const l = latest.current
      if (!l.custom.includes(c)) l.onCustomChange([...l.custom, c])
      l.onChange(c)
    }
    el.addEventListener('change', onPick)
    return () => el.removeEventListener('change', onPick)
  }, [open])

  const swatch = (c: string, small = false) => (
    <button
      key={c}
      className={`swatch ${small ? 'small' : ''} ${value === c ? 'active' : ''}`}
      style={{ ['--c' as string]: c }}
      onClick={() => onChange(c)}
      title={c}
    />
  )

  return (
    <div className="swatches">
      {presets.map((c) => swatch(c))}
      {!isPreset && swatch(value)}
      <Popover
        open={open}
        onClose={close}
        align="center"
        className="color-pop"
        trigger={
          <button className={`swatch-more ${open ? 'open' : ''}`} onClick={() => setOpen((v) => !v)} title="Más colores">
            <ChevronDown size={15} />
          </button>
        }
      >
        <div className="pop-label">Predeterminados</div>
        <div className="pop-swatches">{presets.map((c) => swatch(c, true))}</div>
        <div className="pop-label">Mis colores</div>
        <div className="pop-swatches">
          {custom.map((c) => (
            <span key={c} className="custom-swatch">
              {swatch(c, true)}
              <button className="swatch-remove" onClick={() => onCustomChange(custom.filter((x) => x !== c))} title="Quitar color">
                <X size={10} strokeWidth={3} />
              </button>
            </span>
          ))}
          <label className="swatch-add" title="Agregar color">
            <Plus size={15} />
            <input ref={inputRef} type="color" defaultValue={value} />
          </label>
        </div>
        {!custom.length && <p className="pop-hint">Toca + para guardar un color. Se queda aquí para la próxima vez.</p>}
      </Popover>
    </div>
  )
}
