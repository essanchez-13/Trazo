// Escribe las notas de una versión (desde src/changelog.json) en un archivo Markdown.
//   node scripts/release-notes.cjs 0.9.0 salida.md
const fs = require('fs')
const path = require('path')

const [version, out] = process.argv.slice(2)
const changelog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'changelog.json'), 'utf8'))
const items = changelog[version] ?? []
const body = [`Novedades de Trazo ${version}:`, '', ...items.map((i) => `- ${i}`)].join('\n') + '\n'
fs.writeFileSync(out, body, 'utf8')
