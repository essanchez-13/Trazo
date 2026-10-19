import { lang, t } from './i18n'
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
  /** Imagen de fondo al estar dentro de la carpeta ("asset:<id>"). */
  background?: string
  createdAt: number
}

/** Pantalla de inicio de la biblioteca. */
export interface LibraryHome {
  /** Nombre en lugar de "Documentos". */
  name?: string
  /** Imagen de fondo ("asset:<id>"). */
  background?: string
}

export interface Library {
  folders: Folder[]
  notebooks: NotebookMeta[]
  home?: LibraryHome
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

/** Qué borra el borrador y cómo. */
export interface EraserSettings {
  /** Trazo completo o solo la parte que se toca. */
  mode: 'stroke' | 'precise'
  /** Radio en unidades de página. */
  size: number
  pen: boolean
  highlighter: boolean
  shapes: boolean
  images: boolean
  /** Al soltar, volver a la herramienta que se usaba antes del borrador. */
  autoDeselect: boolean
}

export const ERASER_SIZES = [5, 10, 20]

export interface Settings {
  theme: 'light' | 'dark' | 'system'
  accent: string
  /** 0 = el grosor casi no cambia con la presión, 1 = cambia mucho. */
  pressure: number
  /** 0 = el trazo sigue exacto al lápiz, 1 = se suaviza mucho. */
  stabilization: number
  /** "Mis colores" (guardados, fuera de la barra). */
  penColors: string[]
  highlighterColors: string[]
  /** Colores de la barra, en el orden elegido. */
  penPalette: string[]
  highlighterPalette: string[]
  /** Grosores guardados (botones rápidos de la barra). */
  penSizes: number[]
  highlighterSizes: number[]
  eraser: EraserSettings
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: '#2f5bea',
  pressure: 0.35,
  stabilization: 0.2,
  penColors: [],
  highlighterColors: [],
  penPalette: ['#1c1f24', '#1d3f8f', '#2f6fe4', '#d33f37', '#23875a', '#8a4fd8'],
  highlighterPalette: ['#ffe066', '#a6ec9a', '#ffadd2', '#a5d8ff', '#ffc078'],
  penSizes: [2.6, 4, 6.5],
  highlighterSizes: [14, 20, 28],
  eraser: { mode: 'stroke', size: 10, pen: true, highlighter: true, shapes: true, images: false, autoDeselect: false },
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
  { id: 'classic', label: t('Clásica') },
  { id: 'linen', label: t('Lino') },
  { id: 'band', label: t('Liga') },
  { id: 'dots', label: t('Lunares') },
  { id: 'stripes', label: t('Rayas') },
  { id: 'waves', label: t('Ondas') },
  { id: 'geo', label: t('Geométrica') },
  { id: 'aurora', label: t('Aurora') },
  { id: 'terrazzo', label: t('Terrazo') },
  { id: 'stars', label: t('Estrellas') },
  { id: 'grid', label: t('Cuadros') },
  { id: 'kraft', label: t('Kraft') },
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
  { id: 'fountain', label: t('Pluma estilográfica') },
  { id: 'ball', label: t('Bolígrafo') },
  { id: 'brush', label: t('Pincel') },
]

export const PAPERS: { id: Paper; label: string }[] = [
  { id: 'blank', label: t('En blanco') },
  { id: 'lined', label: t('Rayado') },
  { id: 'lined-narrow', label: t('Rayado angosto') },
  { id: 'lined-wide', label: t('Rayado ancho') },
  { id: 'lined-plain', label: t('Rayado sin margen') },
  { id: 'grid', label: t('Cuadriculado') },
  { id: 'grid-small', label: t('Cuadrícula fina') },
  { id: 'grid-large', label: t('Cuadrícula grande') },
  { id: 'dots', label: t('Puntos') },
  { id: 'dots-large', label: t('Puntos grandes') },
  { id: 'cornell', label: t('Cornell') },
]

export const PAPER_COLORS: { id: PaperColor; label: string; bg: string; dark: boolean }[] = [
  { id: 'cream', label: t('Crema'), bg: '#fffefb', dark: false },
  { id: 'white', label: t('Blanco'), bg: '#ffffff', dark: false },
  { id: 'yellow', label: t('Amarillo'), bg: '#fbf4dc', dark: false },
  { id: 'gray', label: t('Gris'), bg: '#eff0f2', dark: false },
  { id: 'blue', label: t('Azul'), bg: '#eaf2fb', dark: false },
  { id: 'slate', label: lang === 'en' ? 'Slate' : 'Pizarra', bg: '#2a2e35', dark: true },
  { id: 'black', label: t('Negro'), bg: '#151618', dark: true },
]

export const paperInfo = (c?: PaperColor) => PAPER_COLORS.find((p) => p.id === c) ?? PAPER_COLORS[0]

export const SHAPES: { id: ShapeTool; label: string }[] = [
  { id: 'line', label: t('Línea') },
  { id: 'arrow', label: t('Flecha') },
  { id: 'rect', label: t('Rectángulo') },
  { id: 'rounded', label: t('Redondeado') },
  { id: 'ellipse', label: t('Círculo') },
  { id: 'diamond', label: t('Rombo') },
  { id: 'triangle', label: t('Triángulo') },
]

export const NODE_KINDS: { id: NodeKind; label: string }[] = [
  { id: 'rounded', label: t('Caja') },
  { id: 'rect', label: t('Rectángulo') },
  { id: 'ellipse', label: t('Óvalo') },
  { id: 'diamond', label: t('Decisión') },
  { id: 'note', label: t('Nota') },
  { id: 'text', label: t('Texto') },
]
