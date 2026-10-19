import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, GripVertical, Plus, X } from 'lucide-react'
import { Popover } from './Popover'
import { moveItem, useSortable } from './useSortable'
import { t } from '../i18n'

interface Props {
  /** Colores que se ven en la barra, en el orden elegido. */
  palette: string[]
  /** "Mis colores": guardados pero fuera de la barra. */
  custom: string[]
  value: string
  onChange: (color: string) => void
  onListsChange: (palette: string[], custom: string[]) => void
}

type Row = 'palette' | 'custom'

export function ColorPicker({ palette, custom, value, onChange, onListsChange }: Props) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const close = useCallback(() => setOpen(false), [])
  const inPalette = palette.includes(value)

  // Arrastrar para ordenar, o para pasar un color entre la barra y "Mis colores".
  const sort = useSortable<Row>((from, to) => {
    const next = moveItem({ palette, custom }, from, to)
    onListsChange(next.palette, next.custom)
  })

  // Se usa el evento nativo "change" (al cerrar el selector) para no guardar
  // un color por cada movimiento dentro del selector.
  const latest = useRef({ palette, custom, onChange, onListsChange })
  latest.current = { palette, custom, onChange, onListsChange }
  useEffect(() => {
    const el = inputRef.current
    if (!open || !el) return
    const onPick = () => {
      const c = el.value
      const l = latest.current
      if (!l.custom.includes(c) && !l.palette.includes(c)) l.onListsChange(l.palette, [...l.custom, c])
      l.onChange(c)
    }
    el.addEventListener('change', onPick)
    return () => el.removeEventListener('change', onPick)
  }, [open])

  const swatch = (c: string, row: Row, index: number, small = false) => (
    <button
      key={c}
      {...sort.itemProps(row, index)}
      className={`swatch ${small ? 'small' : ''} ${value === c ? 'active' : ''} ${sort.cls(row, index)}`}
      style={{ ['--c' as string]: c }}
      onClick={() => onChange(c)}
      title={c}
    />
  )

  return (
    <div className="swatches">
      {palette.map((c, i) => swatch(c, 'palette', i))}
      {!inPalette && (
        <button className="swatch active" style={{ ['--c' as string]: value }} title={value} />
      )}
      <Popover
        open={open}
        onClose={close}
        align="right"
        className="color-pop"
        trigger={
          <button className={`swatch-more ${open ? 'open' : ''}`} onClick={() => setOpen((v) => !v)} title={t('Más colores')}>
            <ChevronDown size={15} />
          </button>
        }
      >
        <div className="pop-label">{t('En la barra')}</div>
        <div className={`pop-swatches sortable-row ${sort.rowCls('palette', palette.length)}`} {...sort.rowProps('palette', palette.length)}>
          {palette.map((c, i) => swatch(c, 'palette', i, true))}
        </div>
        <div className="pop-label">{t('Mis colores')}</div>
        <div className={`pop-swatches sortable-row ${sort.rowCls('custom', custom.length)}`} {...sort.rowProps('custom', custom.length)}>
          {custom.map((c, i) => (
            <span key={c} className="custom-swatch">
              {swatch(c, 'custom', i, true)}
              <button className="swatch-remove" onClick={() => onListsChange(palette, custom.filter((x) => x !== c))} title={t('Quitar color')}>
                <X size={10} strokeWidth={3} />
              </button>
            </span>
          ))}
          <label className="swatch-add" title={t('Agregar color')}>
            <Plus size={15} />
            <input ref={inputRef} type="color" defaultValue={value} />
          </label>
        </div>
        <p className="pop-hint">
          <GripVertical size={12} /> {t('Arrastra los colores para ordenarlos, o para pasarlos entre la barra y "Mis colores".')}
        </p>
      </Popover>
    </div>
  )
}
