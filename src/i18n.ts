// Idioma de la interfaz. Los textos se escriben en español en el código y t() los traduce
// al inglés con el diccionario de i18n-en.ts. El idioma se fija al cargar la app: cambiarlo
// recarga la ventana, así las constantes que ya llamaron a t() quedan en el idioma correcto.
import { EN } from './i18n-en'

export type Lang = 'en' | 'es'
const KEY = 'trazo-lang'

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'en' || saved === 'es') return saved
  } catch {}
  // La app de escritorio arranca en español; la demo web, en inglés.
  return window.trazo ? 'es' : 'en'
}

export const lang: Lang = detect()
document.documentElement.lang = lang

export function setLang(next: Lang) {
  if (next === lang) return
  try { localStorage.setItem(KEY, next) } catch {}
  location.reload()
}

/** Traduce un texto escrito en español. `{nombre}` se reemplaza con vars.nombre. */
export function t(es: string, vars?: Record<string, string | number>): string {
  let s = es
  if (lang === 'en') {
    const en = EN[es]
    if (en !== undefined) s = en
    else if (import.meta.env.DEV) console.warn('[i18n] falta traducción:', es)
  }
  if (vars) for (const k in vars) s = s.split(`{${k}}`).join(String(vars[k]))
  return s
}

/** Plural simple: t1 para 1, tn para el resto (ambos pasan por t()). */
export function tn(n: number, one: string, many: string): string {
  return t(n === 1 ? one : many, { n })
}
