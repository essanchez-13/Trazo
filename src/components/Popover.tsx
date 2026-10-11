import { useEffect, useRef } from 'react'

/** Contenedor anclado que se cierra al tocar afuera o con Escape. */
export function Popover(props: {
  open: boolean
  onClose: () => void
  trigger: React.ReactNode
  children: React.ReactNode
  className?: string
  align?: 'left' | 'center' | 'right'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { open, onClose } = props

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return (
    <div className="pop-anchor" ref={ref}>
      {props.trigger}
      {open && <div className={`popover align-${props.align ?? 'center'} ${props.className ?? ''}`}>{props.children}</div>}
    </div>
  )
}
