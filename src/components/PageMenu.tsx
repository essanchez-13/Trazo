import { useState } from 'react'
import {
  ArrowRightToLine, Bookmark, BookmarkMinus, ChevronLeft, ChevronRight, ClipboardPaste, Copy, CopyPlus, Eraser,
  FileCog, ListPlus, RotateCw, Trash2,
} from 'lucide-react'
import type { Page } from '../types'
import { PaperPanel, type PaperScope } from './PaperPanel'

interface Props {
  page: Page
  index: number
  total: number
  canPaste: boolean
  onBookmark: () => void
  onCopy: () => void
  onPaste: () => void
  onDuplicate: () => void
  onRotate: () => void
  onTitle: (title: string) => void
  onPaper: (patch: Parameters<React.ComponentProps<typeof PaperPanel>['onApply']>[0], scope: PaperScope) => void
  onGoTo: (index: number) => void
  onClear: () => void
  onDelete: () => void
  close: () => void
}

type View = 'main' | 'paper' | 'title' | 'goto'

/** Menú de una página, como el ⋯ de GoodNotes. */
export function PageMenu(p: Props) {
  const [view, setView] = useState<View>('main')
  const [title, setTitle] = useState(p.page.title ?? `Tema ${p.index + 1}`)
  const [goto, setGoto] = useState(String(p.index + 1))
  const act = (fn: () => void) => () => { fn(); p.close() }

  if (view === 'paper') {
    return (
      <div className="page-menu">
        <BackHeader label="Cambiar plantilla" onBack={() => setView('main')} />
        <PaperPanel page={p.page} pageNumber={p.index + 1} onApply={p.onPaper} />
      </div>
    )
  }

  if (view === 'title') {
    const save = () => { p.onTitle(title.trim()); p.close() }
    return (
      <div className="page-menu">
        <BackHeader label={p.page.title ? 'Título en el índice' : 'Agregar al índice'} onBack={() => setView('main')} />
        <input
          className="input"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="Ej.: Tema 3 · Congruencias"
        />
        <div className="menu-actions">
          {p.page.title && <button className="btn ghost" onClick={() => { p.onTitle(''); p.close() }}>Quitar del índice</button>}
          <button className="btn primary" onClick={save}>Guardar</button>
        </div>
      </div>
    )
  }

  if (view === 'goto') {
    const go = () => {
      const n = Math.min(p.total, Math.max(1, parseInt(goto, 10) || 1))
      p.onGoTo(n - 1)
      p.close()
    }
    return (
      <div className="page-menu">
        <BackHeader label="Ir a página" onBack={() => setView('main')} />
        <div className="goto-row">
          <input
            className="input"
            type="number"
            min={1}
            max={p.total}
            autoFocus
            value={goto}
            onChange={(e) => setGoto(e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => e.key === 'Enter' && go()}
          />
          <span>de {p.total}</span>
          <button className="btn primary" onClick={go}>Ir</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-menu">
      <div className="page-menu-head">Página {p.index + 1}</div>
      <MenuItem icon={p.page.bookmark ? <BookmarkMinus size={17} /> : <Bookmark size={17} />} onClick={act(p.onBookmark)}>
        {p.page.bookmark ? 'Quitar marcador' : 'Marcar página'}
      </MenuItem>
      <MenuItem icon={<Copy size={17} />} onClick={act(p.onCopy)}>Copiar página</MenuItem>
      {p.canPaste && <MenuItem icon={<ClipboardPaste size={17} />} onClick={act(p.onPaste)}>Pegar página después</MenuItem>}
      <MenuItem icon={<CopyPlus size={17} />} onClick={act(p.onDuplicate)}>Duplicar página</MenuItem>
      <MenuItem icon={<RotateCw size={17} />} onClick={act(p.onRotate)}>Rotar página</MenuItem>
      <MenuItem icon={<ListPlus size={17} />} onClick={() => setView('title')} more>
        {p.page.title ? 'Renombrar en el índice' : 'Agregar al índice'}
      </MenuItem>
      <MenuItem icon={<FileCog size={17} />} onClick={() => setView('paper')} more>Cambiar plantilla</MenuItem>
      <MenuItem icon={<ArrowRightToLine size={17} />} onClick={() => setView('goto')} hint={`${p.index + 1} de ${p.total}`}>Ir a página</MenuItem>
      <div className="page-menu-sep">Limpiar o eliminar</div>
      <MenuItem icon={<Eraser size={17} />} onClick={act(p.onClear)} danger>Limpiar página</MenuItem>
      {p.total > 1 && <MenuItem icon={<Trash2 size={17} />} onClick={act(p.onDelete)} danger>Eliminar página</MenuItem>}
    </div>
  )
}

function MenuItem(props: { icon: React.ReactNode; onClick: () => void; children: React.ReactNode; danger?: boolean; more?: boolean; hint?: string }) {
  return (
    <button className={`menu-item ${props.danger ? 'danger' : ''}`} onClick={props.onClick}>
      {props.icon}
      <span>{props.children}</span>
      {props.hint && <em>{props.hint}</em>}
      {props.more && <ChevronRight size={15} className="menu-more" />}
    </button>
  )
}

function BackHeader({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="page-menu-back">
      <button className="icon-btn small" onClick={onBack}><ChevronLeft size={17} /></button>
      <span>{label}</span>
    </div>
  )
}
