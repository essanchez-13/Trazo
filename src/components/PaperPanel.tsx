import { useState } from 'react'
import { RectangleHorizontal, RectangleVertical, Presentation, RotateCcw } from 'lucide-react'
import type { Page, PageSizeKind, Paper, PaperColor } from '../types'
import { PAPER_COLORS, PAPERS } from '../types'
import { DEFAULT_MARGIN, paperLayout, type PaperOptions } from '../ink/render'
import { PaperPreview } from './PaperPreview'

export type PaperScope = 'page' | 'all'
export interface PaperPatch {
  paper?: Paper
  color?: PaperColor
  size?: PageSizeKind
  landscape?: boolean
  gap?: number
  margin?: number
}

interface Props {
  page: Page
  pageNumber: number
  onApply: (patch: PaperPatch, scope: PaperScope) => void
}

// Rango del espaciado según el tipo de hoja.
const GAP_RANGE = {
  lines: [16, 64],
  cornell: [20, 56],
  grid: [10, 60],
  dots: [10, 60],
} as const

/** Cambia el tipo, color, formato y espaciado de una página ya creada (o de todas). */
export function PaperPanel({ page, pageNumber, onApply }: Props) {
  const [scope, setScope] = useState<PaperScope>('page')
  const color = page.color ?? 'cream'
  const format = page.size === 'board' ? 'board' : page.landscape ? 'landscape' : 'portrait'
  const opts: PaperOptions = { gap: page.gap, margin: page.margin }
  const layout = paperLayout(page.paper, opts)
  const range = layout.kind === 'blank' ? null : GAP_RANGE[layout.kind]
  const customized = page.gap !== undefined || page.margin !== undefined

  return (
    <div className="paper-panel">
      <div className="segmented small">
        <button className={scope === 'page' ? 'active' : ''} onClick={() => setScope('page')}>Página {pageNumber}</button>
        <button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>Todas las páginas</button>
      </div>

      <div className="pop-label">Formato</div>
      <div className="segmented small">
        <button className={format === 'portrait' ? 'active' : ''} onClick={() => onApply({ size: 'a4', landscape: false }, scope)}>
          <RectangleVertical size={15} /> Vertical
        </button>
        <button className={format === 'landscape' ? 'active' : ''} onClick={() => onApply({ size: 'a4', landscape: true }, scope)}>
          <RectangleHorizontal size={15} /> Horizontal
        </button>
        <button className={format === 'board' ? 'active' : ''} onClick={() => onApply({ size: 'board', landscape: false }, scope)}>
          <Presentation size={15} /> Pizarra
        </button>
      </div>

      <div className="pop-label">Tipo de hoja</div>
      <PaperGrid value={page.paper} color={color} onChange={(p) => onApply({ paper: p }, scope)} />

      {range && (
        <>
          <div className="pop-label paper-adjust-head">
            Ajustar la hoja
            {customized && (
              <button className="link-btn" onClick={() => onApply({ gap: undefined, margin: undefined }, scope)}>
                <RotateCcw size={12} /> Original
              </button>
            )}
          </div>
          <div className="paper-adjust">
            <label className="adjust-row">
              <span>{layout.kind === 'lines' || layout.kind === 'cornell' ? 'Espacio entre líneas' : layout.kind === 'grid' ? 'Tamaño de cuadros' : 'Espacio entre puntos'}</span>
              <input
                className="slider"
                type="range"
                min={range[0]}
                max={range[1]}
                step={1}
                value={layout.gap}
                onChange={(e) => onApply({ gap: Number(e.target.value) }, scope)}
              />
              <em>{layout.gap}</em>
            </label>
            {layout.kind === 'lines' && (
              <>
                <label className="adjust-check">
                  <input
                    type="checkbox"
                    checked={layout.margin > 0}
                    onChange={(e) => onApply({ margin: e.target.checked ? DEFAULT_MARGIN : 0 }, scope)}
                  />
                  Margen rojo
                </label>
                {layout.margin > 0 && (
                  <label className="adjust-row">
                    <span>Posición del margen</span>
                    <input
                      className="slider"
                      type="range"
                      min={24}
                      max={320}
                      step={2}
                      value={layout.margin}
                      onChange={(e) => onApply({ margin: Number(e.target.value) }, scope)}
                    />
                    <em>{layout.margin}</em>
                  </label>
                )}
              </>
            )}
          </div>
        </>
      )}

      <div className="pop-label">Color de hoja</div>
      <PaperColorRow value={color} onChange={(c) => onApply({ color: c }, scope)} />
    </div>
  )
}

export function PaperGrid({ value, color, onChange }: { value: Paper; color?: PaperColor; onChange: (p: Paper) => void }) {
  return (
    <div className="paper-options">
      {PAPERS.map((p) => (
        <button key={p.id} className={`paper-option ${value === p.id ? 'active' : ''}`} onClick={() => onChange(p.id)} title={p.label}>
          <PaperPreview paper={p.id} color={color} />
          <span>{p.label}</span>
        </button>
      ))}
    </div>
  )
}

export function PaperColorRow({ value, onChange }: { value: PaperColor; onChange: (c: PaperColor) => void }) {
  return (
    <div className="paper-colors">
      {PAPER_COLORS.map((c) => (
        <button
          key={c.id}
          className={`paper-color ${value === c.id ? 'active' : ''}`}
          style={{ background: c.bg }}
          onClick={() => onChange(c.id)}
          title={c.label}
        />
      ))}
    </div>
  )
}
