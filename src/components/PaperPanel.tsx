import { useState } from 'react'
import { RectangleHorizontal, RectangleVertical, Presentation } from 'lucide-react'
import type { Page, PageSizeKind, Paper, PaperColor } from '../types'
import { PAPER_COLORS, PAPERS } from '../types'
import { PaperPreview } from './PaperPreview'

export type PaperScope = 'page' | 'all'
export interface PaperPatch { paper?: Paper; color?: PaperColor; size?: PageSizeKind; landscape?: boolean }

interface Props {
  page: Page
  pageNumber: number
  onApply: (patch: PaperPatch, scope: PaperScope) => void
}

/** Cambia el tipo, color y formato de una página ya creada (o de todas). */
export function PaperPanel({ page, pageNumber, onApply }: Props) {
  const [scope, setScope] = useState<PaperScope>('page')
  const color = page.color ?? 'cream'
  const format = page.size === 'board' ? 'board' : page.landscape ? 'landscape' : 'portrait'

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
