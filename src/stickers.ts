import { t } from './i18n'
// Stickers incluidos en la app. Todos son SVG dibujados a mano (código),
// con borde blanco de "recortado" y una sombra suave, como un sticker de papel.

export interface Sticker { id: string; label: string; svg: string; w: number; h: number }
export interface StickerPack { id: string; label: string; icon: string; items: Sticker[] }

const O = '#2b2d33'

// Borde blanco + sombra alrededor de todo el dibujo.
const FILTER = `<defs><filter id="o" x="-25%" y="-25%" width="150%" height="150%">
<feMorphology in="SourceAlpha" operator="dilate" radius="7" result="d"/>
<feFlood flood-color="#fff"/><feComposite in2="d" operator="in" result="w"/>
<feGaussianBlur in="d" stdDeviation="3" result="b"/><feOffset in="b" dy="3" result="bo"/>
<feFlood flood-color="#000" flood-opacity=".2"/><feComposite in2="bo" operator="in" result="sh"/>
<feMerge><feMergeNode in="sh"/><feMergeNode in="w"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter></defs>`

const svg = (inner: string, w = 200, h = 200) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 2}" height="${h * 2}">${FILTER}<g filter="url(#o)" stroke="${O}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round">${inner}</g></svg>`

/** Carita: ojos, sonrisa y cachetes. */
const face = (cx: number, cy: number, k = 1) =>
  `<circle cx="${cx - 10 * k}" cy="${cy}" r="${3.8 * k}" fill="${O}" stroke="none"/>` +
  `<circle cx="${cx + 10 * k}" cy="${cy}" r="${3.8 * k}" fill="${O}" stroke="none"/>` +
  `<path d="M${cx - 7 * k} ${cy + 8 * k} Q${cx} ${cy + 15 * k} ${cx + 7 * k} ${cy + 8 * k}" fill="none" stroke-width="${3.6 * k}"/>` +
  `<ellipse cx="${cx - 17 * k}" cy="${cy + 8 * k}" rx="${5 * k}" ry="${3 * k}" fill="#ff8fa3" stroke="none" opacity=".6"/>` +
  `<ellipse cx="${cx + 17 * k}" cy="${cy + 8 * k}" rx="${5 * k}" ry="${3 * k}" fill="#ff8fa3" stroke="none" opacity=".6"/>`

const s = (id: string, label: string, inner: string, w = 200, h = 200): Sticker => ({ id, label, svg: svg(inner, w, h), w, h })

const TEMAS: Sticker[] = [
  s('rocket', t('Cohete'), `
    <path d="M100 22 C132 44 140 88 128 132 L72 132 C60 88 68 44 100 22 Z" fill="#f4f6fa"/>
    <path d="M100 22 C114 32 122 44 126 56 L74 56 C78 44 86 32 100 22 Z" fill="#ff5d5d"/>
    <circle cx="100" cy="86" r="16" fill="#7cc6ff"/>
    <path d="M72 108 L48 138 L72 132 Z" fill="#ff5d5d"/><path d="M128 108 L152 138 L128 132 Z" fill="#ff5d5d"/>
    <path d="M82 134 Q100 190 118 134 Z" fill="#ffb13b"/><path d="M92 136 Q100 166 108 136 Z" fill="#ffe066" stroke-width="3"/>`),
  s('idea', t('Idea'), `
    <path d="M60 40 L48 28 M140 40 L152 28 M100 18 L100 4 M36 82 L20 82 M164 82 L180 82" stroke="#ffc53d" stroke-width="7"/>
    <path d="M100 30 C136 30 154 58 146 88 C141 106 126 114 124 132 L76 132 C74 114 59 106 54 88 C46 58 64 30 100 30 Z" fill="#ffe066"/>
    <rect x="76" y="132" width="48" height="20" rx="6" fill="#c9ced8"/><rect x="82" y="152" width="36" height="16" rx="6" fill="#a9b0bd"/>
    ${face(100, 82, 1.1)}`),
  s('book', t('Libro'), `
    <path d="M100 58 C80 44 50 42 26 50 L26 156 C50 148 80 150 100 164 C120 150 150 148 174 156 L174 50 C150 42 120 44 100 58 Z" fill="#fff"/>
    <path d="M100 58 L100 164" />
    <path d="M26 50 L18 54 L18 164 C46 156 78 158 100 172 C122 158 154 156 182 164 L182 54 L174 50" fill="#4f7cff"/>
    <path d="M40 72 L84 70 M40 90 L84 88 M116 70 L160 72 M116 88 L160 90" stroke="#b9c3d6" stroke-width="4"/>
    ${face(100, 122, 0.9)}`),
  s('summit', t('Cima'), `
    <path d="M14 170 L78 64 L108 108 L130 84 L186 170 Z" fill="#7fa7c9"/>
    <path d="M78 64 L94 90 L84 86 L74 96 L66 84 Z" fill="#fff" stroke-width="3.5"/>
    <path d="M78 64 L78 18" /><path d="M78 20 L118 30 L78 42 Z" fill="#ff5d5d"/>
    <path d="M40 170 L96 132 L150 170 Z" fill="#6cc48a"/>`),
  s('sparkles', t('Brillos'), `
    <path d="M86 26 Q94 76 142 84 Q94 92 86 142 Q78 92 30 84 Q78 76 86 26 Z" fill="#ffd43b"/>
    <path d="M150 104 Q154 128 176 132 Q154 136 150 160 Q146 136 124 132 Q146 128 150 104 Z" fill="#ff9fce"/>
    <path d="M150 20 Q153 38 168 40 Q153 42 150 60 Q147 42 132 40 Q147 38 150 20 Z" fill="#8fd3ff"/>`),
  s('planet', t('Planeta'), `
    <ellipse cx="100" cy="100" rx="84" ry="26" fill="none" stroke="#ffb13b" stroke-width="12" transform="rotate(-18 100 100)"/>
    <circle cx="100" cy="100" r="50" fill="#9b7bff"/>
    <path d="M58 88 Q100 78 142 90" fill="none" stroke="#b9a3ff" stroke-width="6"/>
    ${face(100, 104, 1)}
    <path d="M20 122 Q100 150 180 78" fill="none" stroke="#ffb13b" stroke-width="12"/>`),
  s('target', t('Meta'), `
    <circle cx="96" cy="104" r="72" fill="#fff"/><circle cx="96" cy="104" r="52" fill="#ff5d5d"/>
    <circle cx="96" cy="104" r="32" fill="#fff"/><circle cx="96" cy="104" r="13" fill="#ff5d5d"/>
    <path d="M96 104 L170 30" stroke-width="6"/><path d="M160 22 L176 18 L180 36 L168 40 Z" fill="#ffd43b"/>`),
  s('rainbow', t('Arcoíris'), `
    <path d="M20 146 A80 80 0 0 1 180 146" fill="none" stroke="#ff6b6b" stroke-width="16"/>
    <path d="M38 146 A62 62 0 0 1 162 146" fill="none" stroke="#ffd43b" stroke-width="16"/>
    <path d="M56 146 A44 44 0 0 1 144 146" fill="none" stroke="#69db7c" stroke-width="16"/>
    <path d="M74 146 A26 26 0 0 1 126 146" fill="none" stroke="#74c0fc" stroke-width="16"/>
    <path d="M8 160 Q8 136 30 138 Q36 120 56 130 Q76 132 70 160 Z" fill="#fff"/>
    <path d="M130 160 Q124 132 146 130 Q164 120 170 138 Q192 136 192 160 Z" fill="#fff"/>`),
]

const ESCUELA: Sticker[] = [
  s('pencil', t('Lápiz'), `
    <g transform="rotate(-38 100 100)">
    <rect x="30" y="76" width="120" height="48" rx="6" fill="#ffc53d"/>
    <path d="M30 92 L150 92 M30 108 L150 108" stroke="#e5a100" stroke-width="3"/>
    <path d="M150 76 L186 100 L150 124 Z" fill="#f6d7b0"/><path d="M174 92 L186 100 L174 108 Z" fill="${O}"/>
    <rect x="14" y="76" width="18" height="48" rx="6" fill="#ff8fa3"/><rect x="28" y="76" width="8" height="48" fill="#c9ced8"/>
    </g>${face(92, 96, 0.9)}`),
  s('apple', t('Manzana'), `
    <path d="M100 58 C70 38 30 56 34 104 C38 150 72 182 100 168 C128 182 162 150 166 104 C170 56 130 38 100 58 Z" fill="#ff4d4d"/>
    <path d="M100 58 Q98 40 108 26" fill="none"/><path d="M108 40 Q130 22 150 34 Q130 54 108 40 Z" fill="#51cf66"/>
    <path d="M140 118 Q170 108 172 132 Q174 150 152 146" fill="#b2f2bb"/>
    <circle cx="160" cy="124" r="2.6" fill="${O}" stroke="none"/><circle cx="168" cy="124" r="2.6" fill="${O}" stroke="none"/>
    <path d="M60 86 Q66 76 76 74" stroke="#fff" stroke-width="6" fill="none" opacity=".8"/>`),
  s('calculator', t('Calculadora'), `
    <rect x="46" y="20" width="108" height="160" rx="16" fill="#5c7cfa"/>
    <rect x="60" y="34" width="80" height="40" rx="8" fill="#d3f9d8"/>
    ${face(100, 50, 0.7)}
    <g stroke-width="3.5" fill="#fff"><rect x="60" y="88" width="20" height="18" rx="4"/><rect x="90" y="88" width="20" height="18" rx="4"/><rect x="120" y="88" width="20" height="18" rx="4" fill="#ffc53d"/>
    <rect x="60" y="116" width="20" height="18" rx="4"/><rect x="90" y="116" width="20" height="18" rx="4"/><rect x="120" y="116" width="20" height="18" rx="4" fill="#ffc53d"/>
    <rect x="60" y="144" width="50" height="18" rx="4"/><rect x="120" y="144" width="20" height="18" rx="4" fill="#ff8787"/></g>`),
  s('coffee', t('Café'), `
    <path d="M78 36 Q70 26 78 16 M100 36 Q92 26 100 16 M122 36 Q114 26 122 16" fill="none" stroke="#adb5bd" stroke-width="5"/>
    <path d="M142 80 Q176 80 172 108 Q168 132 138 128" fill="none" stroke-width="10" stroke="${O}"/>
    <path d="M142 80 Q176 80 172 108 Q168 132 138 128" fill="none" stroke-width="3" stroke="#f1f3f5"/>
    <path d="M40 56 L152 56 L144 160 Q142 176 124 176 L68 176 Q50 176 48 160 Z" fill="#f1f3f5"/>
    <path d="M44 70 L148 70 L146 92 L46 92 Z" fill="#a0785a" stroke-width="3.5"/>
    ${face(96, 126, 1.1)}`),
  s('laptop', t('Laptop'), `
    <rect x="36" y="36" width="128" height="92" rx="10" fill="#495057"/>
    <rect x="46" y="46" width="108" height="72" rx="4" fill="#99e9f2"/>
    ${face(100, 78, 1)}
    <path d="M16 136 L184 136 L172 160 L28 160 Z" fill="#ced4da"/><path d="M84 146 L116 146" stroke-width="3.5"/>`),
  s('backpack', t('Mochila'), `
    <path d="M76 42 Q76 18 100 18 Q124 18 124 42" fill="none" stroke-width="8"/>
    <rect x="42" y="38" width="116" height="144" rx="36" fill="#20c997"/>
    <rect x="58" y="112" width="84" height="54" rx="14" fill="#63e6be"/><path d="M58 128 L142 128"/>
    <rect x="92" y="120" width="16" height="16" rx="4" fill="#ffd43b" stroke-width="3.5"/>
    ${face(100, 76, 1)}`),
  s('glasses', t('Lentes'), `
    <path d="M86 96 Q100 84 114 96" fill="none" stroke-width="7"/>
    <path d="M22 88 L10 70 M178 88 L190 70" stroke-width="7"/>
    <circle cx="54" cy="104" r="34" fill="#c5f6fa"/><circle cx="146" cy="104" r="34" fill="#c5f6fa"/>
    <path d="M38 92 Q46 82 58 82 M130 92 Q138 82 150 82" stroke="#fff" stroke-width="6" fill="none"/>`),
  s('aplus', 'A+', `
    <path d="M44 20 L148 20 L164 36 L164 184 L44 184 Z" fill="#fff"/>
    <path d="M60 138 L140 138 M60 156 L120 156" stroke="#ced4da" stroke-width="5"/>
    <circle cx="104" cy="82" r="46" fill="none" stroke="#ff4d4d" stroke-width="6"/>
    <text x="104" y="102" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="52" fill="#ff4d4d" stroke="none">A+</text>`),
]

const REACCIONES: Sticker[] = [
  s('star', t('Estrella'), `
    <path d="M100 14 L124 70 L184 74 L138 114 L152 174 L100 142 L48 174 L62 114 L16 74 L76 70 Z" fill="#ffd43b"/>
    <path d="M78 94 l6 -12 l6 12 l-12 -7 h12 z M110 94 l6 -12 l6 12 l-12 -7 h12 z" fill="#ff6b6b" stroke-width="2.5"/>
    <path d="M86 112 Q100 128 114 112 Z" fill="${O}"/>`),
  s('fire', t('Fuego'), `
    <path d="M100 18 C112 52 150 64 150 118 C150 156 126 182 100 182 C74 182 50 156 50 118 C50 90 66 78 72 60 C80 78 88 82 92 82 C88 56 92 36 100 18 Z" fill="#ff922b"/>
    <path d="M100 96 C110 116 128 124 128 148 C128 166 116 176 100 176 C84 176 72 166 72 148 C72 130 90 120 100 96 Z" fill="#ffd43b" stroke-width="3.5"/>
    ${face(100, 144, 0.8)}`),
  s('hundred', '100', `
    <text x="100" y="118" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="84" font-style="italic" fill="#ff3b3b" stroke="${O}" stroke-width="4">100</text>
    <path d="M28 138 Q100 124 176 134 M40 158 Q100 146 164 152" fill="none" stroke="#ff3b3b" stroke-width="9"/>`),
  s('thumbs', t('Bien'), `
    <path d="M58 92 L86 34 Q100 22 108 40 L102 78 L152 78 Q172 80 166 102 L154 160 Q150 176 132 176 L58 176 Z" fill="#ffd8a8"/>
    <rect x="22" y="86" width="38" height="96" rx="8" fill="#4dabf7"/>
    <path d="M110 104 L160 104 M112 128 L156 128 M114 152 L152 152" stroke-width="3.5"/>`),
  s('heart', t('Corazón'), `
    <path d="M100 176 C40 132 16 100 20 70 C24 40 60 26 84 46 Q94 54 100 64 Q106 54 116 46 C140 26 176 40 180 70 C184 100 160 132 100 176 Z" fill="#ff6b8b"/>
    <path d="M44 66 Q50 52 64 50" stroke="#fff" stroke-width="7" fill="none" opacity=".8"/>
    ${face(100, 104, 1.1)}`),
  s('check', t('Listo'), `
    <path d="M100 14 L120 30 L146 26 L154 52 L178 64 L168 90 L180 114 L156 128 L150 154 L124 152 L104 172 L84 156 L58 162 L50 136 L26 124 L36 98 L24 74 L48 62 L54 36 L80 38 Z" fill="#40c057"/>
    <path d="M66 98 L90 122 L136 74" fill="none" stroke="#fff" stroke-width="14"/>`),
  s('brain', t('Cerebro'), `
    <path d="M100 44 C88 26 56 28 50 50 C28 52 20 78 32 94 C18 110 28 138 50 140 C54 164 86 170 100 152 C114 170 146 164 150 140 C172 138 182 110 168 94 C180 78 172 52 150 50 C144 28 112 26 100 44 Z" fill="#ffa8c5"/>
    <path d="M100 44 L100 152 M62 70 Q78 76 74 92 M138 70 Q122 76 126 92 M60 118 Q74 110 84 122 M140 118 Q126 110 116 122" fill="none" stroke-width="3.5"/>
    <path d="M34 26 L44 38 M166 26 L156 38 M100 6 L100 22" stroke="#ffd43b" stroke-width="6"/>`),
  s('trophy', t('Trofeo'), `
    <path d="M58 40 Q20 40 28 72 Q34 96 66 100 M142 40 Q180 40 172 72 Q166 96 134 100" fill="none" stroke-width="9"/>
    <path d="M56 26 L144 26 L140 86 Q136 124 100 128 Q64 124 60 86 Z" fill="#ffd43b"/>
    <rect x="88" y="126" width="24" height="24" fill="#fab005"/><rect x="60" y="150" width="80" height="30" rx="6" fill="#845ef7"/>
    <path d="M100 48 L106 62 L120 62 L109 71 L113 85 L100 77 L87 85 L91 71 L80 62 L94 62 Z" fill="#fff" stroke-width="3"/>`),
  s('question', t('Duda'), `
    <path d="M44 132 C16 132 14 94 40 88 C36 58 68 44 88 58 C100 32 146 34 152 66 C182 66 190 104 166 116 C170 140 142 150 124 138 C112 152 80 150 72 134 C64 138 52 138 44 132 Z" fill="#e7f5ff"/>
    <text x="104" y="124" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="72" fill="#4dabf7" stroke="${O}" stroke-width="4">?</text>
    <circle cx="44" cy="164" r="10" fill="#e7f5ff"/><circle cx="24" cy="184" r="6" fill="#e7f5ff"/>`),
  s('wow', t('¡Wow!'), `
    <path d="M100 8 L118 44 L156 24 L152 66 L194 70 L162 98 L192 128 L150 132 L160 174 L122 154 L100 192 L80 154 L40 174 L50 132 L8 128 L38 98 L6 70 L48 66 L44 24 L82 44 Z" fill="#ffe066"/>
    <text x="100" y="118" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="44" fill="#ff4d4d" stroke="${O}" stroke-width="3" transform="rotate(-8 100 100)">¡WOW!</text>`),
]

const NOTAS: Sticker[] = [
  s('note-yellow', t('Nota amarilla'), `
    <path d="M24 24 L176 24 L176 146 L146 176 L24 176 Z" fill="#fff3a3"/>
    <path d="M146 176 L146 146 L176 146 Z" fill="#f5d94f"/>`),
  s('note-pink', t('Nota rosada'), `
    <path d="M24 24 L176 24 L176 146 L146 176 L24 176 Z" fill="#ffd1e3"/>
    <path d="M146 176 L146 146 L176 146 Z" fill="#f7a4c4"/>`),
  s('note-blue', t('Nota con cinta'), `
    <rect x="24" y="30" width="152" height="148" rx="4" fill="#d0ebff"/>
    <rect x="70" y="16" width="60" height="26" fill="#ffd43b" opacity=".85" stroke-width="3" transform="rotate(-6 100 29)"/>`),
  s('tape-mint', t('Cinta menta'), `
    <path d="M10 14 L290 14 L284 30 L290 46 L284 62 L290 76 L10 76 L16 60 L10 44 L16 28 Z" fill="#96f2d7"/>
    <path d="M40 14 L20 76 M80 14 L60 76 M120 14 L100 76 M160 14 L140 76 M200 14 L180 76 M240 14 L220 76 M280 14 L260 76" stroke="#63e6be" stroke-width="10"/>
    <path d="M10 14 L290 14 L284 30 L290 46 L284 62 L290 76 L10 76 L16 60 L10 44 L16 28 Z" fill="none"/>`, 300, 90),
  s('tape-pink', t('Cinta de puntos'), `
    <path d="M10 14 L290 14 L284 30 L290 46 L284 62 L290 76 L10 76 L16 60 L10 44 L16 28 Z" fill="#ffc9de"/>
    <g fill="#fff" stroke="none">${Array.from({ length: 13 }, (_, i) => `<circle cx="${30 + i * 20}" cy="${i % 2 ? 34 : 56}" r="6"/>`).join('')}</g>`, 300, 90),
  s('tape-yellow', t('Cinta amarilla'), `
    <path d="M10 14 L290 14 L284 30 L290 46 L284 62 L290 76 L10 76 L16 60 L10 44 L16 28 Z" fill="#ffec99"/>
    <path d="M24 45 L276 45" stroke="#fcc419" stroke-width="5" stroke-dasharray="14 10"/>`, 300, 90),
  s('pin', t('Chincheta'), `
    <path d="M100 118 L100 186" stroke-width="6"/>
    <path d="M62 116 L138 116 Q140 96 118 90 L114 54 Q132 48 132 30 L68 30 Q68 48 86 54 L82 90 Q60 96 62 116 Z" fill="#ff5d5d"/>
    <path d="M84 40 L92 40" stroke="#fff" stroke-width="6"/>`),
  s('clip', t('Clip'), `
    <path d="M78 150 L78 52 Q78 24 104 24 Q130 24 130 52 L130 158 Q130 180 108 180 Q86 180 86 158 L86 64 Q86 52 100 52 Q114 52 114 64 L114 146" fill="none" stroke="${O}" stroke-width="16"/>
    <path d="M78 150 L78 52 Q78 24 104 24 Q130 24 130 52 L130 158 Q130 180 108 180 Q86 180 86 158 L86 64 Q86 52 100 52 Q114 52 114 64 L114 146" fill="none" stroke="#adb5bd" stroke-width="8"/>`),
  s('doodle-arrow', t('Flechita'), `
    <path d="M24 150 C40 60 110 150 130 90 C140 60 120 50 110 64 C100 80 140 96 170 60" fill="none" stroke="#845ef7" stroke-width="10"/>
    <path d="M146 58 L174 54 L170 84" fill="none" stroke="#845ef7" stroke-width="10"/>`),
]

const ANTOJOS: Sticker[] = [
  s('pizza', t('Pizza'), `
    <path d="M30 52 Q100 26 170 52 L104 186 Q100 192 96 186 Z" fill="#ffd166"/>
    <path d="M58 116 Q62 140 72 150 M132 112 Q128 132 120 146" fill="none" stroke="#f4b740" stroke-width="7"/>
    <path d="M22 44 Q100 6 178 44 Q186 62 172 66 Q100 36 28 66 Q14 62 22 44 Z" fill="#e39b47"/>
    <path d="M44 42 Q100 20 156 42" fill="none" stroke="#f7c27a" stroke-width="5" opacity=".8"/>
    <circle cx="78" cy="86" r="15" fill="#e63946"/><circle cx="126" cy="90" r="13" fill="#e63946"/><circle cx="100" cy="132" r="12" fill="#e63946"/>
    <circle cx="74" cy="82" r="4" fill="#ff8a93" stroke="none"/><circle cx="122" cy="86" r="3.5" fill="#ff8a93" stroke="none"/>
    <ellipse cx="104" cy="104" rx="9" ry="5" fill="#52b788" transform="rotate(-30 104 104)"/>
    <ellipse cx="84" cy="114" rx="7" ry="4" fill="#52b788" transform="rotate(25 84 114)" stroke-width="3"/>`),
  s('donut', t('Dona'), `
    <circle cx="100" cy="104" r="76" fill="#f2c086"/>
    <path d="M100 38 C 136 34, 170 60, 170 98 C 172 120, 160 128, 150 132 C 140 150, 120 160, 100 158 C 76 162, 50 148, 44 126 C 32 116, 30 96, 36 84 C 46 54, 70 38, 100 38 Z" fill="#ff8fc0"/>
    <circle cx="100" cy="100" r="22" fill="#ffffff"/>
    <g stroke-width="0" >
      <rect x="66" y="62" width="14" height="5" rx="2.5" fill="#ffe066" transform="rotate(-30 73 64)"/>
      <rect x="120" y="58" width="14" height="5" rx="2.5" fill="#74c0fc" transform="rotate(20 127 60)"/>
      <rect x="140" y="98" width="14" height="5" rx="2.5" fill="#ffffff" transform="rotate(70 147 100)"/>
      <rect x="58" y="110" width="14" height="5" rx="2.5" fill="#69db7c" transform="rotate(50 65 112)"/>
      <rect x="96" y="138" width="14" height="5" rx="2.5" fill="#ffe066" transform="rotate(-15 103 140)"/>
      <rect x="128" y="130" width="14" height="5" rx="2.5" fill="#b197fc" transform="rotate(-40 135 132)"/>
      <rect x="84" y="48" width="14" height="5" rx="2.5" fill="#b197fc" transform="rotate(10 91 50)"/>
    </g>`),
  s('icecream', t('Helado'), `
    <path d="M62 102 L100 188 L138 102 Z" fill="#f2b766"/>
    <path d="M74 120 L120 150 M86 104 L130 128 M126 120 L80 150 M114 104 L70 128" stroke="#d68f3a" stroke-width="4"/>
    <circle cx="78" cy="94" r="30" fill="#b5ead7"/>
    <circle cx="122" cy="94" r="30" fill="#ffc8dd"/>
    <circle cx="100" cy="64" r="34" fill="#fff1b8"/>
    <circle cx="104" cy="26" r="11" fill="#e63946"/>
    <path d="M104 16 Q110 4 122 6" fill="none" stroke-width="4"/>
    ${face(100, 66, 0.75)}`),
  s('popcorn', t('Palomitas'), `
    <circle cx="66" cy="70" r="20" fill="#fff6d6"/><circle cx="96" cy="56" r="22" fill="#fffaf0"/><circle cx="128" cy="62" r="20" fill="#fff6d6"/>
    <circle cx="146" cy="84" r="16" fill="#fffaf0"/><circle cx="56" cy="92" r="16" fill="#fffaf0"/><circle cx="110" cy="82" r="18" fill="#ffe8a3"/>
    <path d="M48 96 L152 96 L138 184 L62 184 Z" fill="#ffffff"/>
    <path d="M64 96 L72 184 L88 184 L84 96 Z M100 96 L100 184 L116 184 L118 96 Z M136 96 L130 184 L138 184 L152 96 Z" fill="#ff5d5d" stroke-width="0"/>
    <path d="M48 96 L152 96 L138 184 L62 184 Z" fill="none"/>
    ${face(100, 138, 0.8)}`),
]

export const STICKER_PACKS: StickerPack[] = [
  { id: 'temas', label: t('Para empezar un tema'), icon: 'rocket', items: TEMAS },
  { id: 'escuela', label: t('Escuela'), icon: 'apple', items: ESCUELA },
  { id: 'reacciones', label: t('Reacciones'), icon: 'star', items: REACCIONES },
  { id: 'antojos', label: t('Antojos'), icon: 'pizza', items: ANTOJOS },
  { id: 'notas', label: t('Notas y cintas'), icon: 'note-yellow', items: NOTAS },
]

const byId = new Map(STICKER_PACKS.flatMap((p) => p.items).map((it) => [it.id, it]))

export const getSticker = (id: string) => byId.get(id)

export const stickerUrl = (st: Sticker) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(st.svg)
