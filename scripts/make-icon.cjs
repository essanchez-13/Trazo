// Genera el ícono de Trazo: una carita feliz en trazos turquesa sobre blanco,
// cuya sonrisa termina en una plumilla dorada.
//   node scripts/make-icon.cjs
//
// Las formas están dibujadas a mano con curvas, para que se vean limpias.
// Para tamaños chicos (barra de tareas, 16–48 px) se usa una versión simplificada
// con trazos más gruesos, para que se vea nítida y no borrosa.

const fs = require('fs')
const path = require('path')
const { Resvg } = require('@resvg/resvg-js')

const root = path.join(__dirname, '..')

// ---- Geometría ----

// ---- Geometría de la sonrisa ----
// Curva completa de comisura a comisura; se dibuja solo una parte
// (la pluma todavía la está terminando).
const SMILE = [[262, 574], [318, 770], [706, 770], [762, 574]]
const SMILE_END = 0.75

const at = (t) => {
  const [p0, p1, p2, p3] = SMILE, u = 1 - t
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ]
}

/** Trazo de ancho variable (fino al empezar, firme al llegar a la pluma), con puntas redondas. */
function smilePath() {
  const n = 64
  const left = [], right = []
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * SMILE_END
    const p = at(t), q = at(Math.min(1, t + 0.001))
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1
    const nx = -(q[1] - p[1]) / len, ny = (q[0] - p[0]) / len
    const w = 7 + 23 * Math.sin(Math.min(1, t / 0.45) * Math.PI / 2)
    left.push([p[0] + nx * w, p[1] + ny * w])
    right.push([p[0] - nx * w, p[1] - ny * w])
  }
  const f = (p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`
  const endW = Math.hypot(left[n][0] - right[n][0], left[n][1] - right[n][1]) / 2
  return `M ${f(left[0])} ` + left.slice(1).map((p) => `L ${f(p)}`).join(' ') +
    ` A ${endW.toFixed(1)} ${endW.toFixed(1)} 0 0 0 ${f(right[n])} ` +
    right.slice(0, -1).reverse().map((p) => `L ${f(p)}`).join(' ') +
    ` A 7 7 0 0 0 ${f(left[0])} Z`
}

const PEN_TIP = at(SMILE_END)
// La pluma baja hacia la derecha, lejos de la boca.
const PEN_ANGLE = 30

// ---- Versión grande (a partir de 64 px) ----

function fullSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#eef5f5"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.26" cy="0.16" r="0.8">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ink" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#2ad4c4"/>
      <stop offset="0.75" stop-color="#10b3a8"/>
      <stop offset="1" stop-color="#0e9f96"/>
    </linearGradient>
    <linearGradient id="eye" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2ad4c4"/>
      <stop offset="1" stop-color="#10ada3"/>
    </linearGradient>
    <linearGradient id="nib" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff1bd"/>
      <stop offset="0.5" stop-color="#f7c348"/>
      <stop offset="1" stop-color="#c98309"/>
    </linearGradient>
    <linearGradient id="barrel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe27a"/>
      <stop offset="0.45" stop-color="#ffc629"/>
      <stop offset="1" stop-color="#e79c00"/>
    </linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#0b5f5a" flood-opacity="0.18"/>
    </filter>
  </defs>

  <rect x="32" y="32" width="960" height="960" rx="228" fill="url(#bg)"/>
  <rect x="32" y="32" width="960" height="960" rx="228" fill="url(#glow)"/>
  <rect x="34" y="34" width="956" height="956" rx="226" fill="none" stroke="#d5e3e3" stroke-width="3"/>

  <g filter="url(#shadow)">
    <!-- Ojos -->
    <rect x="364" y="318" width="54" height="138" rx="27" fill="url(#eye)" transform="rotate(-3 391 387)"/>
    <rect x="578" y="310" width="54" height="138" rx="27" fill="url(#eye)" transform="rotate(-3 605 379)"/>

    <!-- Sonrisa a medio dibujar: fina al inicio y firme donde está la pluma -->
    <path d="${smilePath()}" fill="url(#ink)"/>

    <!-- Pluma amarilla: toca la sonrisa desde abajo, terminando de dibujarla -->
    <g transform="translate(${PEN_TIP[0].toFixed(1)} ${PEN_TIP[1].toFixed(1)}) rotate(${PEN_ANGLE}) scale(0.86)">
      <path d="M-4 0 C 26 -16, 64 -36, 110 -44 L 124 -34 L 124 34 L 110 44 C 64 36, 26 16, -4 0 Z" fill="url(#nib)"/>
      <path d="M4 0 L 78 0" stroke="#7a4a00" stroke-width="4.5" stroke-linecap="round"/>
      <circle cx="84" cy="0" r="8" fill="#7a4a00"/>
      <path d="M34 -18 C 58 -28, 84 -34, 106 -37" stroke="#ffffff" stroke-opacity="0.6" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <rect x="118" y="-44" width="34" height="88" rx="8" fill="#c98a12"/>
      <rect x="118" y="-44" width="34" height="20" rx="8" fill="#ffe9a8" opacity=".55"/>
      <rect x="148" y="-46" width="210" height="92" rx="26" fill="url(#barrel)"/>
      <rect x="162" y="-36" width="180" height="12" rx="6" fill="#ffffff" opacity="0.35"/>
    </g>
  </g>
</svg>`
}

// ---- Versión chica (16–48 px): menos detalle, trazos más gruesos ----

function smallSvg() {
  const pts = Array.from({ length: 33 }, (_, i) => at((i / 32) * SMILE_END).map((v) => v.toFixed(1)).join(' ')).join(' L ')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#eaf3f3"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="1024" height="1024" rx="230" fill="url(#bg)"/>
  <g fill="none" stroke="#11b3a8" stroke-linecap="round">
    <path d="M392 300 L 392 450" stroke-width="112"/>
    <path d="M612 292 L 612 442" stroke-width="112"/>
    <path d="M ${pts}" stroke-width="112" stroke-linejoin="round"/>
  </g>
  <g transform="translate(${PEN_TIP[0].toFixed(1)} ${PEN_TIP[1].toFixed(1)}) rotate(${PEN_ANGLE})">
    <path d="M-20 0 L 150 -78 L 190 -50 L 190 50 L 150 78 Z" fill="#f5b400"/>
  </g>
</svg>`
}

// ---- Salida ----

const render = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()

/** .ico de Windows con una imagen PNG por tamaño. */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, png }, i) => {
    const e = 6 + i * 16
    header.writeUInt8(size >= 256 ? 0 : size, e)
    header.writeUInt8(size >= 256 ? 0 : size, e + 1)
    header.writeUInt8(0, e + 2)
    header.writeUInt8(0, e + 3)
    header.writeUInt16LE(1, e + 4)
    header.writeUInt16LE(32, e + 6)
    header.writeUInt32LE(png.length, e + 8)
    header.writeUInt32LE(offset, e + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...images.map((i) => i.png)])
}

const full = fullSvg()
const small = smallSvg()
fs.writeFileSync(path.join(root, 'build', 'icon.svg'), full)
fs.writeFileSync(path.join(root, 'build', 'icon-small.svg'), small)
fs.writeFileSync(path.join(root, 'build', 'icon.png'), render(full, 1024))

const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256]
const images = sizes.map((size) => ({ size, png: render(size <= 48 ? small : full, size) }))
const icoFile = ico(images)
fs.writeFileSync(path.join(root, 'build', 'icon.ico'), icoFile)

fs.mkdirSync(path.join(root, 'public'), { recursive: true })
fs.writeFileSync(path.join(root, 'public', 'icon.png'), render(full, 256))
fs.writeFileSync(path.join(root, 'public', 'icon.ico'), icoFile)
console.log('Íconos generados')
