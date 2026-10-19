import { useCallback, useEffect, useRef, useState } from 'react'
import { BookmarkPlus, ChevronDown, Minus, Plus, X } from 'lucide-react'
import type { Stroke } from '../types'
import { drawStroke } from '../ink/render'
import { Popover } from './Popover'
import { moveItem, useSortable } from './useSortable'
import { t } from '../i18n'

interface Props {
  /** Grosores guardados: se ven como botones rápidos en la barra. */
  saved: number[]
  onSavedChange: (sizes: number[]) => void
  value: number
  onChange: (size: number) => void
  min: number
  max: number
  step: number
  color: string
  tool: Stroke['tool']
}

const same = (a: number, b: number) => Math.abs(a - b) < 0.001
const fmt = (n: number) => String(Number(n.toFixed(2)))

/** Grosores guardados (reordenables) más un ajuste libre: deslizador o número escrito. */
export function SizeControl({ saved, onSavedChange, value, onChange, min, max, step, color, tool }: Props) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 100) / 100))
  const isSaved = saved.some((s) => same(s, value))
  const sort = useSortable<'sizes'>((from, to) => onSavedChange(moveItem({ sizes: saved }, from, to).sizes))

  // Punto proporcional al grosor, para reconocerlos de un vistazo.
  const dot = (s: number) => {
    const px = tool === 'highlighter' ? Math.min(16, 3 + s / 3.2) : Math.min(16, 2.5 + s * 1.4)
    return <span style={{ width: px, height: px, background: tool === 'highlighter' ? color : 'var(--ink)' }} />
  }

  return (
    <div className="sizes">
      {saved.map((s, i) => (
        <button
          key={s}
          {...sort.itemProps('sizes', i)}
          className={`size-btn ${same(value, s) ? 'active' : ''} ${sort.cls('sizes', i)}`}
          onClick={() => onChange(s)}
          title={`Grosor ${fmt(s)}`}
        >
          {dot(s)}
        </button>
      ))}
      <Popover
        open={open}
        onClose={close}
        className="size-pop"
        trigger={
          <button className={`size-custom ${!isSaved ? 'active' : ''} ${open ? 'open' : ''}`} onClick={() => setOpen((v) => !v)} title={t('Ajustar grosor')}>
            {fmt(value)}
            <ChevronDown size={13} />
          </button>
        }
      >
        <div className="pop-label">{t('Grosor')}</div>
        <SizePreview size={value} color={color} tool={tool} />
        <div className="size-row">
          <button className="icon-btn small" onClick={() => onChange(clamp(value - step))} title={t('Más fino')}><Minus size={15} /></button>
          <input
            className="slider"
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(clamp(Number(e.target.value)))}
          />
          <button className="icon-btn small" onClick={() => onChange(clamp(value + step))} title={t('Más grueso')}><Plus size={15} /></button>
          <NumberField value={value} onCommit={(n) => onChange(clamp(n))} />
        </div>
        <div className="slider-labels">
          <span>{min}</span>
          <span>{max}</span>
        </div>

        <div className="pop-label saved-head">
          Mis grosores
          <button className="link-btn" disabled={isSaved} onClick={() => onSavedChange([...saved, value])}>
            <BookmarkPlus size={13} /> {t('Guardar')} {fmt(value)}
          </button>
        </div>
        <div className={`saved-sizes sortable-row ${sort.rowCls('sizes', saved.length)}`} {...sort.rowProps('sizes', saved.length)}>
          {saved.map((s, i) => (
            <span
              key={s}
              {...sort.itemProps('sizes', i)}
              className={`size-chip ${same(value, s) ? 'active' : ''} ${sort.cls('sizes', i)}`}
              onClick={() => onChange(s)}
              title={t('Usar este grosor · arrastra para ordenar')}
            >
              {dot(s)}
              {fmt(s)}
              {saved.length > 1 && (
                <button
                  className="chip-remove"
                  onClick={(e) => { e.stopPropagation(); onSavedChange(saved.filter((x) => !same(x, s))) }}
                  title={t('Quitar')}
                >
                  <X size={10} strokeWidth={3} />
                </button>
              )}
            </span>
          ))}
        </div>
        <p className="pop-hint">{t('Los grosores guardados aparecen en la barra. Arrástralos para cambiar el orden.')}</p>
      </Popover>
    </div>
  )
}

/** Campo para escribir el grosor (por ejemplo 0.9). Se aplica con Enter o al salir. */
function NumberField({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const [text, setText] = useState(fmt(value))
  const [editing, setEditing] = useState(false)
  useEffect(() => { if (!editing) setText(fmt(value)) }, [value, editing])
  const commit = () => {
    setEditing(false)
    const n = Number(text.replace(',', '.'))
    if (Number.isFinite(n) && n > 0) onCommit(n)
    else setText(fmt(value))
  }
  return (
    <input
      className="size-number"
      inputMode="decimal"
      value={text}
      onFocus={(e) => { setEditing(true); e.target.select() }}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur() }
        if (e.key === 'Escape') { setText(fmt(value)); setEditing(false); (e.target as HTMLInputElement).blur() }
      }}
    />
  )
}

/** Una onda de muestra con el grosor elegido. */
function SizePreview({ size, color, tool }: { size: number; color: string; tool: Stroke['tool'] }) {
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
    for (let i = 0; i <= 60; i++) {
      const t = i / 60
      pts.push([16 + t * (w - 32), h / 2 + Math.sin(t * Math.PI * 2) * h * 0.18, 0.7])
    }
    ctx.globalCompositeOperation = tool === 'highlighter' ? 'multiply' : 'source-over'
    drawStroke(ctx, { id: 'preview', tool, color, size, points: pts, pen: 'ball' }, false, false)
  }, [size, color, tool])
  return <canvas ref={ref} className="size-preview" />
}
