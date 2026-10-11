// Genera los íconos de la app a partir de build/icon.svg.
//   node scripts/make-icon.cjs
const fs = require('fs')
const path = require('path')
const { Resvg } = require('@resvg/resvg-js')

const root = path.join(__dirname, '..')
const svg = fs.readFileSync(path.join(root, 'build', 'icon.svg'))

const render = (size) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()

// electron-builder crea el .ico de Windows a partir de este PNG de 1024.
fs.writeFileSync(path.join(root, 'build', 'icon.png'), render(1024))
// Ícono de la ventana y de la pestaña del navegador.
fs.mkdirSync(path.join(root, 'public'), { recursive: true })
fs.writeFileSync(path.join(root, 'public', 'icon.png'), render(256))
console.log('Íconos generados')
