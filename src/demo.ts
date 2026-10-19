// Contenido de ejemplo para la demo web: la primera vez que alguien abre Trazo en el navegador
// encuentra un cuaderno y una pizarra con ejemplos, en vez de una biblioteca vacía.
// Solo se usa en el navegador; la app de escritorio nunca crea estos ejemplos.
import { t } from './i18n'
import { STICKER_PACKS } from './stickers'
import type { DiagramLink, DiagramNode, ImageItem, Library, NodeKind, NotebookDoc, NotebookMeta, Page, Stroke } from './types'
import { DEFAULT_LABEL, INK, uid } from './types'

const node = (kind: NodeKind, x: number, y: number, w: number, h: number, text: string, extra: Partial<DiagramNode> = {}): DiagramNode =>
  ({ id: uid(), kind, x, y, w, h, text, color: INK, fill: kind === 'text' ? null : '#ffffff', fontSize: 18, ...extra })

const link = (from: DiagramNode, to: DiagramNode, fromPort: number, toPort: number, extra: Partial<DiagramLink> = {}): DiagramLink =>
  ({ id: uid(), from: from.id, to: to.id, color: INK, arrow: 'end', fromPort, toPort, ...extra })

function sticker(id: string, x: number, y: number, max: number): ImageItem {
  const st = STICKER_PACKS.flatMap((p) => p.items).find((s) => s.id === id)!
  const k = max / Math.max(st.w, st.h)
  return { id: uid(), src: 'sticker:' + id, x, y, w: st.w * k, h: st.h * k }
}

/** Trazo "a mano": una línea ondulada con presión variable, como un subrayado. */
function underline(x0: number, x1: number, y: number, color: string): Stroke {
  const points = []
  for (let x = x0; x <= x1; x += 6) {
    const k = (x - x0) / (x1 - x0)
    points.push([x, y + Math.sin(k * Math.PI * 3) * 3 + k * 4, 0.35 + Math.sin(k * Math.PI) * 0.4])
  }
  return { id: uid(), tool: 'pen', color, size: 4, points, pen: 'fountain' }
}

/** Resaltador detrás de un texto. */
function highlight(x0: number, x1: number, y: number): Stroke {
  const points = []
  for (let x = x0; x <= x1; x += 10) points.push([x, y + Math.sin(x / 40), 0.5])
  return { id: uid(), tool: 'highlighter', color: '#ffe066', size: 22, points }
}

/** Figura limpia (como las que salen al sostener el lápiz al final de un trazo). */
function ellipse(cx: number, cy: number, rx: number, ry: number, color: string): Stroke {
  const points = []
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2
    points.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 0.5])
  }
  return { id: uid(), tool: 'pen', color, size: 3.2, points, shape: true, closed: true }
}

function welcomePages(): Page[] {
  const title = node('text', 70, 64, 560, 64, t('Bienvenido a Trazo'), { fontSize: 38 })
  const tips = [
    t('Elige la pluma (P) y escribe donde quieras. Con un lápiz, Trazo usa la presión (en Chrome y Edge).'),
    t('Sostén el lápiz al final de una línea o un círculo y se convierte en una figura limpia.'),
    t('El borrador quita el trazo entero o solo la parte que tocas.'),
    t('Diagramas (D): cajas con texto y flechas que se mueven juntas.'),
    t('Desde el inicio puedes importar un PDF, escribirle encima y exportarlo otra vez.'),
  ]
  const notes = tips.map((text, i) =>
    node('note', i % 2 ? 430 : 80, 220 + Math.floor(i / 2) * 210, 310, 150, text, { fill: ['#fff3bf', '#d3f9d8', '#d0ebff', '#ffe3e3', '#e5dbff'][i], fontSize: 17 }))
  const links = [link(notes[0], notes[1], 1, 3), link(notes[2], notes[3], 1, 3, { style: 'curve', color: '#2f6fe4' })]
  const first: Page = {
    id: uid(), paper: 'lined', color: 'cream',
    strokes: [highlight(196, 488, 104), underline(192, 498, 142, '#2f6fe4'), ellipse(650, 1030, 110, 44, '#d33f37')],
    nodes: [title, ...notes, node('text', 560, 1004, 180, 52, t('¡Pruébalo!'), { fontSize: 24, color: '#d33f37' })],
    links,
    images: [sticker('rocket', 660, 50, 110), sticker('star', 90, 990, 90)],
    title: t('Bienvenido a Trazo'),
    bookmark: true,
  }
  const second: Page = {
    id: uid(), paper: 'grid', color: 'white', strokes: [],
    nodes: [node('text', 70, 60, 600, 50, t('Tu turno: escribe aquí'), { fontSize: 26, color: '#2f6fe4' })],
    images: [sticker('pencil', 650, 40, 110)],
  }
  return [first, second]
}

function boardPages(): Page[] {
  const a = node('rounded', 140, 470, 260, 110, t('Idea'), { fill: '#fff3bf', fontSize: 24 })
  const b = node('rounded', 540, 470, 260, 110, t('Prototipo'), { fill: '#d0ebff', fontSize: 24 })
  const c = node('diamond', 940, 430, 300, 190, t('¿Funciona?'), { fill: '#e5dbff', fontSize: 22 })
  const d = node('rounded', 1400, 470, 260, 110, t('Publicar'), { fill: '#d3f9d8', fontSize: 24 })
  const e = node('note', 960, 790, 260, 130, t('Ajustar y volver a probar'), { fill: '#ffe3e3', fontSize: 19 })
  const head = node('text', 140, 140, 1100, 80, t('Ejemplo de pizarra: un flujo de trabajo'), { fontSize: 40 })
  const yes = node('text', 1270, 450, 90, 40, t('Sí'), { fontSize: 20, color: '#23875a' })
  const no = node('text', 1110, 650, 90, 40, t('No'), { fontSize: 20, color: '#d33f37' })
  return [{
    id: uid(), paper: 'dots', color: 'white', size: 'board', strokes: [underline(145, 900, 240, '#8a4fd8')],
    nodes: [head, a, b, c, d, e, yes, no],
    links: [
      link(a, b, 1, 3), link(b, c, 1, 3), link(c, d, 1, 3, { color: '#23875a' }),
      link(c, e, 2, 0, { color: '#d33f37' }), link(e, b, 3, 2, { dashed: true }),
    ],
    images: [sticker('idea', 1460, 120, 150)],
  }]
}

/** Biblioteca de ejemplo y los cuadernos que la acompañan. */
export function demoContent(): { library: Library; docs: NotebookDoc[] } {
  const now = Date.now()
  const welcome: NotebookMeta = {
    id: uid(), title: t('Bienvenido a Trazo'), folderId: null, cover: '#1f4e8c', coverDesign: 'aurora',
    label: { ...DEFAULT_LABEL }, paper: 'lined', paperColor: 'cream', createdAt: now, updatedAt: now,
  }
  const board: NotebookMeta = {
    id: uid(), title: t('Pizarra de ejemplo'), folderId: null, cover: '#35684d', coverDesign: 'geo',
    label: { ...DEFAULT_LABEL }, paper: 'dots', paperColor: 'white', size: 'board', createdAt: now - 1, updatedAt: now - 1,
  }
  return {
    library: { folders: [], notebooks: [welcome, board] },
    docs: [{ id: welcome.id, pages: welcomePages() }, { id: board.id, pages: boardPages() }],
  }
}
