// Shared types for the CoC Studio

export type TabId = 'editor' | 'library' | 'publish'

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
}

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
