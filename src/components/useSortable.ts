import { useState } from 'react'

export interface Slot<R extends string> { row: R; index: number }

/** Mueve un elemento dentro de una lista o de una lista a otra. */
export function moveItem<R extends string, T>(lists: Record<R, T[]>, from: Slot<R>, to: Slot<R>): Record<R, T[]> {
  const out = Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, [...(v as T[])]])) as Record<R, T[]>
  const [item] = out[from.row].splice(from.index, 1)
  if (item === undefined) return lists
  let index = to.index
  if (from.row === to.row && from.index < to.index) index--
  out[to.row].splice(Math.max(0, Math.min(index, out[to.row].length)), 0, item)
  return out
}

/**
 * Arrastrar y soltar para ordenar elementos en una o varias filas.
 * `itemProps` va en cada elemento; `rowProps` en la fila (para soltar al final).
 */
export function useSortable<R extends string>(onMove: (from: Slot<R>, to: Slot<R>) => void) {
  const [drag, setDrag] = useState<Slot<R> | null>(null)
  const [over, setOver] = useState<Slot<R> | null>(null)

  const finish = () => { setDrag(null); setOver(null) }

  const itemProps = (row: R, index: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.stopPropagation()
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', '')
      setDrag({ row, index })
    },
    onDragOver: (e: React.DragEvent) => {
      if (!drag) return
      e.preventDefault()
      e.stopPropagation()
      if (over?.row !== row || over.index !== index) setOver({ row, index })
    },
    onDrop: (e: React.DragEvent) => {
      if (!drag) return
      e.preventDefault()
      e.stopPropagation()
      onMove(drag, { row, index })
      finish()
    },
    onDragEnd: finish,
  })

  const rowProps = (row: R, length: number) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!drag) return
      e.preventDefault()
      if (over?.row !== row || over.index !== length) setOver({ row, index: length })
    },
    onDrop: (e: React.DragEvent) => {
      if (!drag) return
      e.preventDefault()
      onMove(drag, { row, index: length })
      finish()
    },
  })

  /** Clases para mostrar qué se arrastra y dónde caería. */
  const cls = (row: R, index: number) =>
    `${drag?.row === row && drag.index === index ? 'is-dragging' : ''} ${over?.row === row && over.index === index && drag ? 'drop-before' : ''}`

  const rowCls = (row: R, length: number) => (drag && over?.row === row && over.index === length ? 'drop-end' : '')

  return { itemProps, rowProps, cls, rowCls, dragging: !!drag }
}
