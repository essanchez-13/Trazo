import { useEffect, useRef } from 'react'
import type { Paper, PaperColor } from '../types'
import { drawPaper } from '../ink/render'

// Muestra la esquina superior izquierda de la hoja con zoom, para que se
// note la diferencia entre rayado angosto, ancho, cuadrícula fina, etc.
const VIEW_W = 190

export function PaperPreview({ paper, color }: { paper: Paper; color?: PaperColor }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = c.clientWidth || 70, h = c.clientHeight || 93
    c.width = Math.round(w * dpr)
    c.height = Math.round(h * dpr)
    const k = (w * dpr) / VIEW_W
    const ctx = c.getContext('2d')!
    ctx.setTransform(k, 0, 0, k, 0, 0)
    drawPaper(ctx, paper, color, VIEW_W, (VIEW_W * h) / w)
  }, [paper, color])
  return <canvas ref={ref} className="paper-preview" />
}
