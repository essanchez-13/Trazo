import { useMemo, useRef } from 'react'
import { Clock } from 'lucide-react'
import { STICKER_PACKS, getSticker, stickerUrl, type Sticker } from '../stickers'
import { t } from '../i18n'

const RECENT_KEY = 'trazo.recentStickers'

export function readRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') } catch { return [] }
}

export function pushRecent(id: string) {
  try {
    const list = [id, ...readRecent().filter((x) => x !== id)].slice(0, 12)
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch { /* sin almacenamiento */ }
}

export function StickerPicker({ onPick }: { onPick: (st: Sticker) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const recent = useMemo(() => readRecent().map(getSticker).filter((s): s is Sticker => !!s), [])

  const sections = [
    ...(recent.length ? [{ id: 'recent', label: t('Recientes'), items: recent }] : []),
    ...STICKER_PACKS,
  ]

  const jump = (id: string) => {
    const el = scrollRef.current?.querySelector(`[data-section="${id}"]`) as HTMLElement | null
    const box = scrollRef.current
    if (!el || !box) return
    // Posición de la sección dentro de la lista con scroll (no respecto a toda la ventana).
    const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
    box.scrollTo({ top: top - 4, behavior: 'smooth' })
  }

  return (
    <div className="sticker-picker">
      <div className="sticker-packs">
        {recent.length > 0 && (
          <button onClick={() => jump('recent')} title={t('Recientes')}><Clock size={18} /></button>
        )}
        {STICKER_PACKS.map((p) => {
          const icon = getSticker(p.icon)!
          return (
            <button key={p.id} onClick={() => jump(p.id)} title={p.label}>
              <img src={stickerUrl(icon)} alt="" />
            </button>
          )
        })}
      </div>
      <div className="sticker-scroll" ref={scrollRef}>
        {sections.map((sec) => (
          <section key={sec.id} data-section={sec.id}>
            <h4>{sec.label}</h4>
            <div className="sticker-grid">
              {sec.items.map((st) => (
                <button key={st.id} className={st.w > st.h ? 'wide' : ''} onClick={() => onPick(st)} title={st.label}>
                  <img src={stickerUrl(st)} alt={st.label} draggable={false} />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
