// Shared types for the CoC Studio

export type TabId = 'editor' | 'library' | 'publish'

export interface WatermarkLayer {
  id: string
  src: string          // /BabariyaMeet.webp | /splash_logo_padded.png | /splash_logo_round.png | /app-icon.png
  label: string
  x: number
  y: number
  width: number
  height: number
  rotation: number     // degrees
  opacity: number      // 0-1
  visible: boolean
  flipX: boolean
  flipY: boolean
}

export type CategoryType = 'Bases_img' | 'army_img' | string

export interface FolderPath {
  root: CategoryType
  th: string           // TH_1 .. TH_18
  sub: string          // War | Farming | Progress | Art | Rank | Simple
}

export interface LibraryItem {
  path: string         // repo-relative path  e.g. Bases_img/home_village_bases/TH_18/Progress/x.webp
  filename: string
  rawUrl: string
  note: string
  tags: string[]
  addedAt: string
}

export type HttpStatus = 'unchecked' | 'ok' | 'missing' | 'checking'
