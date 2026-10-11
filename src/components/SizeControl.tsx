import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Minus, Plus } from 'lucide-react'
import type { Stroke } from '../types'
import { drawStroke } from '../ink/render'
import { Popover } from './Popover'

interface Props {
  presets: number[]
  value: number
  onChange: (size: number) => void
  min: number
  max: number
  step: number
  color: string
  tool: Stroke['tool']
}

const round = (n: number, step: number) => Math.round(n / step) * step

/** Tres grosores rápidos más un ajuste libre con vista previa. */
export function SizeControl({ presets, value, onChange, min, max, step, color, tool }: Props) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const set = (n: number) => onChange(Math.min(max, Math.max(min, Number(round(n, step).toFixed(1)))))
  const isPreset = presets.some((p) => Math.abs(p - value) < 0.01)

  return (
    <div className="sizes">
      {presets.map((s, i) => (
        <button
          key={s}
          className={`size-btn ${Math.abs(value - s) < 0.01 ? 'active' : ''}`}
          onClick={() => onChange(s)}
          title={['Fino', 'Medio', 'Grueso'][i]}
        >
          <span style={{ width: 4 + i * 4, height: 4 + i * 4, background: tool === 'highlighter' ? color : 'var(--ink)' }} />
        </button>
      ))}
      <Popover
        open={open}
        onClose={close}
        className="size-pop"
        trigger={
          <button className={`size-custom ${!isPreset ? 'active' : ''} ${open ? 'open' : ''}`} onClick={() => setOpen((v) => !v)} title="Ajustar grosor">
            {value.toFixed(1).replace(/\.0$/, '')}
            <ChevronDown size={13} />
          </button>
        }
      >
        <div className="pop-label">Grosor</div>
        <SizePreview size={value} color={color} tool={tool} />
        <div className="size-row">
          <button className="icon-btn small" onClick={() => set(value - step)} title="Más fino"><Minus size={15} /></button>
          <input
            className="slider"
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => set(Number(e.target.value))}
          />
          <button className="icon-btn small" onClick={() => set(value + step)} title="Más grueso"><Plus size={15} /></button>
        </div>
        <div className="slider-labels">
          <span>{min}</span>
          <strong>{value.toFixed(1).replace(/\.0$/, '')}</strong>
          <span>{max}</span>
        </div>
      </Popover>
    </div>
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
