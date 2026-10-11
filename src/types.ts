export type Paper =
  | 'blank' | 'lined' | 'lined-narrow' | 'lined-wide' | 'lined-plain'
  | 'grid' | 'grid-small' | 'grid-large' | 'dots' | 'dots-large' | 'cornell'
export type PaperColor = 'cream' | 'white' | 'yellow' | 'gray' | 'blue' | 'slate' | 'black'
export type PageSizeKind = 'a4' | 'board'
export type Tool = 'pen' | 'highlighter' | 'eraser' | 'lasso' | 'shape' | 'diagram'
export type ShapeTool = 'line' | 'arrow' | 'rect' | 'rounded' | 'ellipse' | 'diamond' | 'triangle'
export type PenType = 'fountain' | 'ball' | 'brush'
export type NodeKind = 'rect' | 'rounded' | 'ellipse' | 'diamond' | 'note' | 'text'

/** Un punto del trazo: [x, y, presión] en coordenadas de página. */
export type Point = number[]

export interface Stroke {
  id: string
  tool: 'pen' | 'highlighter'
  color: string
  size: number
  points: Point[]
  /** Tipo de pluma (estilográfica, bolígrafo, pincel). */
  pen?: PenType
  /** Presión simulada (mouse) en vez de la del lápiz. */
  sim?: boolean
  /** Cuánto cambia el grosor con la presión (se guarda por trazo). */
  th?: number
  /** Estabilización con la que se escribió el trazo. */
  sl?: number
  /** Figura: se dibuja con líneas limpias en vez de tinta. */
  shape?: boolean
  closed?: boolean
  arrow?: boolean
  fill?: boolean
}

/** Imagen o sticker puesto en la página. `src` es "sticker:<id>" o "asset:<id>". */
export interface ImageItem {
  id: string
  src: string
  x: number
  y: number
  w: number
  h: number
  rot?: number
  /** Fondo fijo (por ejemplo, la página de un PDF importado): no se selecciona. */
  locked?: boolean
}

/** Figura de diagrama con texto adentro. */
export interface DiagramNode {
  id: string
  kind: NodeKind
  x: number
  y: number
  w: number
  h: number
  text: string
  color: string
  fill: string | null
  fontSize: number
}

/** Conector entre dos figuras: se mueve solo cuando se mueven las figuras. */
export interface DiagramLink {
  id: string
  from: string
  to: string
  color: string
  arrow: 'end' | 'both' | 'none'
  dashed?: boolean
  /** Lado de salida y de llegada (0 arriba, 1 derecha, 2 abajo, 3 izquierda). */
  fromPort?: number
  toPort?: number
  /** Con codos (por defecto), recta o curva. */
  style?: 'elbow' | 'straight' | 'curve'
  /** Posición del tramo central de los codos (se arrastra para mover el doblez). */
  mid?: number
}

export interface Page {
  id: string
  paper: Paper
  color?: PaperColor
  size?: PageSizeKind
  strokes: Stroke[]
  images?: ImageItem[]
  nodes?: DiagramNode[]
  links?: DiagramLink[]
  /** Horizontal (se activa al rotar o al cambiar la orientación). */
  landscape?: boolean
  /** Espaciado propio de líneas, cuadrícula o puntos (si no, el del tipo de hoja). */
  gap?: number
  /** Posición del margen rojo; 0 = sin margen (si no, el del tipo de hoja). */
  margin?: number
  /** Título en el índice del cuaderno. */
  title?: string
  bookmark?: boolean
}

export interface NotebookDoc {
  id: string
  pages: Page[]
}

/** Etiqueta con el título sobre la portada. */
export interface CoverLabel {
  show: boolean
  /** Color de fondo, o 'glass' para vidrio translúcido. */
  bg: string
  /** Centro de la etiqueta, en % del ancho y alto de la portada. */
  x: number
  y: number
  size: 's' | 'm' | 'l'
  /** Mostrar la marca "Pizarra" en las pizarras. */
  badge: boolean
}

export const DEFAULT_LABEL: CoverLabel = { show: true, bg: '#ffffff', x: 57, y: 24, size: 'm', badge: true }
export const LABEL_COLORS = ['#ffffff', '#fdf6e3', 'glass', '#1c1f24', '#ffd43b', '#ffc9de', '#b2f2bb', '#a5d8ff']

export interface NotebookMeta {
  id: string
  title: string
  folderId: string | null
  cover: string
  coverDesign?: string
  /** Imagen propia de portada ("asset:<id>"). */
  coverImage?: string
  label?: CoverLabel
  paper: Paper
  paperColor?: PaperColor
  size?: PageSizeKind
  createdAt: number
  updatedAt: number
}

export interface Folder {
  id: string
  name: string
  parentId: string | null
  color?: string
  createdAt: number
}

export interface Library {
  folders: Folder[]
  notebooks: NotebookMeta[]
}

/** Trazos, imágenes y figuras seleccionados. */
export interface Selection {
  pageId: string
  ids: Set<string>
}

export interface ToolStyle {
  color: string
  size: number
}

export interface Settings {
  theme: 'light' | 'dark' | 'system'
  accent: string
  /** 0 = el grosor casi no cambia con la presión, 1 = cambia mucho. */
  pressure: number
  /** 0 = el trazo sigue exacto al lápiz, 1 = se suaviza mucho. */
  stabilization: number
  penColors: string[]
  highlighterColors: string[]
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: '#2f5bea',
  pressure: 0.35,
  stabilization: 0.2,
  penColors: [],
  highlighterColors: [],
}

export const thinningFor = (pressure: number) => 0.08 + pressure * 0.6
export const streamlineFor = (stab: number) => 0.08 + stab * 0.6

// Proporción A4. La pizarra es una hoja grande y horizontal.
export const PAGE_W = 820
export const PAGE_H = 1160
export const BOARD_W = 1800
export const BOARD_H = 1200

export function pageSize(p: { landscape?: boolean; size?: PageSizeKind }) {
  const [w, h] = p.size === 'board' ? [BOARD_W, BOARD_H] : [PAGE_W, PAGE_H]
  return p.landscape ? { w: h, h: w } : { w, h }
}

export const uid = () => crypto.randomUUID()

export const COVERS = ['#2d3a44', '#1f4e8c', '#7c2f3c', '#35684d', '#c46a3a', '#d9ae3a', '#62518f', '#aab6c1', '#e38aa8', '#6fb3b8']
export const COVER_DESIGNS: { id: string; label: string }[] = [
  { id: 'classic', label: 'Clásica' },
  { id: 'linen', label: 'Lino' },
  { id: 'band', label: 'Liga' },
  { id: 'dots', label: 'Lunares' },
  { id: 'stripes', label: 'Rayas' },
  { id: 'waves', label: 'Ondas' },
  { id: 'geo', label: 'Geométrica' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'terrazzo', label: 'Terrazo' },
  { id: 'stars', label: 'Estrellas' },
  { id: 'grid', label: 'Cuadros' },
  { id: 'kraft', label: 'Kraft' },
]
export const FOLDER_COLORS = ['#7aa2d6', '#6fc2a0', '#f2b35e', '#ef8a8a', '#b495e0', '#8c9aad', '#f09ac4', '#5fc4d4']
export const ACCENTS = ['#2f5bea', '#7b4fe0', '#0f9b8e', '#e0457b', '#e8792b', '#5b6270']

export const INK = '#1c1f24'
export const PEN_COLORS = [INK, '#1d3f8f', '#2f6fe4', '#d33f37', '#23875a', '#8a4fd8']
export const HIGHLIGHTER_COLORS = ['#ffe066', '#a6ec9a', '#ffadd2', '#a5d8ff', '#ffc078']
export const NODE_FILLS = ['#ffffff', '#fff3bf', '#d3f9d8', '#d0ebff', '#ffe3e3', '#e5dbff', '#ffe8cc']
export const PEN_SIZES = [2.6, 4, 6.5]
export const HIGHLIGHTER_SIZES = [14, 20, 28]

export const PEN_TYPES: { id: PenType; label: string }[] = [
  { id: 'fountain', label: 'Pluma estilográfica' },
  { id: 'ball', label: 'Bolígrafo' },
  { id: 'brush', label: 'Pincel' },
]

export const PAPERS: { id: Paper; label: string }[] = [
  { id: 'blank', label: 'En blanco' },
  { id: 'lined', label: 'Rayado' },
  { id: 'lined-narrow', label: 'Rayado angosto' },
  { id: 'lined-wide', label: 'Rayado ancho' },
  { id: 'lined-plain', label: 'Rayado sin margen' },
  { id: 'grid', label: 'Cuadriculado' },
  { id: 'grid-small', label: 'Cuadrícula fina' },
  { id: 'grid-large', label: 'Cuadrícula grande' },
  { id: 'dots', label: 'Puntos' },
  { id: 'dots-large', label: 'Puntos grandes' },
  { id: 'cornell', label: 'Cornell' },
]

export const PAPER_COLORS: { id: PaperColor; label: string; bg: string; dark: boolean }[] = [
  { id: 'cream', label: 'Crema', bg: '#fffefb', dark: false },
  { id: 'white', label: 'Blanco', bg: '#ffffff', dark: false },
  { id: 'yellow', label: 'Amarillo', bg: '#fbf4dc', dark: false },
  { id: 'gray', label: 'Gris', bg: '#eff0f2', dark: false },
  { id: 'blue', label: 'Azul', bg: '#eaf2fb', dark: false },
  { id: 'slate', label: 'Pizarra', bg: '#2a2e35', dark: true },
  { id: 'black', label: 'Negro', bg: '#151618', dark: true },
]

export const paperInfo = (c?: PaperColor) => PAPER_COLORS.find((p) => p.id === c) ?? PAPER_COLORS[0]

export const SHAPES: { id: ShapeTool; label: string }[] = [
  { id: 'line', label: 'Línea' },
  { id: 'arrow', label: 'Flecha' },
  { id: 'rect', label: 'Rectángulo' },
  { id: 'rounded', label: 'Redondeado' },
  { id: 'ellipse', label: 'Círculo' },
  { id: 'diamond', label: 'Rombo' },
  { id: 'triangle', label: 'Triángulo' },
]

export const NODE_KINDS: { id: NodeKind; label: string }[] = [
  { id: 'rounded', label: 'Caja' },
  { id: 'rect', label: 'Rectángulo' },
  { id: 'ellipse', label: 'Óvalo' },
  { id: 'diamond', label: 'Decisión' },
  { id: 'note', label: 'Nota' },
  { id: 'text', label: 'Texto' },
]
