// Genera el ícono de Trazo: una carita feliz escrita con tinta caligráfica,
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

// Curva de la sonrisa (versión chica).
const SMILE = [[262, 574], [318, 770], [636, 812], [742, 648]]
const smileEnd = SMILE[3]
const tangent = Math.atan2(SMILE[3][1] - SMILE[2][1], SMILE[3][0] - SMILE[2][0])

// ---- Versión grande (a partir de 64 px) ----

function fullSvg() {
  // Nib angle follows the smile at its end.
  const deg = -54
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="#2d3494"/>
      <stop offset="0.55" stop-color="#1f2368"/>
      <stop offset="1" stop-color="#141641"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.26" cy="0.16" r="0.8">
      <stop offset="0" stop-color="#8b97ff" stop-opacity="0.42"/>
      <stop offset="1" stop-color="#8b97ff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ink" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fbf8f1"/>
      <stop offset="0.7" stop-color="#f8f0de"/>
      <stop offset="1" stop-color="#ffd978"/>
    </linearGradient>
    <linearGradient id="eye" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#efe8da"/>
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
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#05061a" flood-opacity="0.45"/>
    </filter>
  </defs>

  <rect x="32" y="32" width="960" height="960" rx="228" fill="url(#bg)"/>
  <rect x="32" y="32" width="960" height="960" rx="228" fill="url(#glow)"/>
  <rect x="34" y="34" width="956" height="956" rx="226" fill="none" stroke="#ffffff" stroke-opacity="0.1" stroke-width="3"/>

  <g filter="url(#shadow)">
    <!-- Ojos -->
    <rect x="364" y="318" width="54" height="138" rx="27" fill="url(#eye)" transform="rotate(-3 391 387)"/>
    <rect x="578" y="310" width="54" height="138" rx="27" fill="url(#eye)" transform="rotate(-3 605 379)"/>

    <!-- Sonrisa: medialuna de tinta, fina al inicio y firme al llegar a la plumilla -->
    <path d="M 252 566
             C 262 560, 272 562, 278 570
             C 330 700, 470 770, 600 742
             C 650 731, 690 704, 716 668
             A 22 22 0 0 1 752 694
             C 718 752, 660 790, 590 806
             C 446 838, 300 752, 248 590
             C 245 580, 246 571, 252 566 Z" fill="url(#ink)"/>

    <!-- Pluma amarilla: la punta dorada termina la sonrisa -->
    <g transform="translate(734 680) rotate(${deg})">
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
  const deg = (tangent * 180) / Math.PI
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="#3038a0"/>
      <stop offset="1" stop-color="#171a4d"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="1024" height="1024" rx="230" fill="url(#bg)"/>
  <g fill="none" stroke="#fbf8f1" stroke-linecap="round">
    <path d="M392 300 L 392 450" stroke-width="112"/>
    <path d="M612 292 L 612 442" stroke-width="112"/>
    <path d="M${SMILE[0].join(' ')} C ${SMILE[1].join(' ')}, ${SMILE[2].join(' ')}, ${SMILE[3].join(' ')}" stroke-width="112"/>
  </g>
  <g transform="translate(${smileEnd[0]} ${smileEnd[1]}) rotate(${deg.toFixed(2)})">
    <path d="M-20 0 L 150 -78 L 190 -50 L 190 50 L 150 78 Z" fill="#ffc83d"/>
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
