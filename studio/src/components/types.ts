// Shared types for the CoC Studio

export type TabId = 'editor' | 'library' | 'publish'

/** Active pointer tool on the canvas: Select manages handles, Move only drags. */
export type CanvasTool = 'select' | 'move'

/** Values captured when a watermark layer is added; per-field reset restores from here. */
export interface LayerSnapshot {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
}

export interface WatermarkLayer {
  id: string
  src: string
  label: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  visible: boolean
  flipX: boolean
  flipY: boolean
  /** Keep width/height proportional on handle drags and typed sizes. Per layer, not part of `initial`. */
  lockAspect: boolean
  initial: LayerSnapshot
}

/** One watermark as stored in the saved template: no id, no initial snapshot, no visibility. */
export interface SavedWatermarkLayer {
  src: string
  label: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  flipX: boolean
  flipY: boolean
  lockAspect: boolean
}

/** The single saved watermark template, kept in localStorage. */
export interface WatermarkPreset {
  version: 1
  savedAt: string
  layers: SavedWatermarkLayer[]
}

/** The phone screenshot placed on the fixed 1600x800 document. */
export interface PhotoTransform {
  src: string
  naturalWidth: number
  naturalHeight: number
  x: number
  y: number
  width: number
  height: number
}

export type Selection = { kind: 'layer'; id: string } | { kind: 'photo' } | null

export interface FolderPath {
  root: string
  th: string
  sub: string
}

export interface LibraryItem {
  path: string
  filename: string
  rawUrl: string
  note: string
  tags: string[]
  addedAt: string
}

export type HttpStatus = 'unchecked' | 'ok' | 'missing' | 'checking'
