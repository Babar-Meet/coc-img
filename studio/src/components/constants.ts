// Client-facing constants. Shared values live in src/shared/studioConfig.ts and are re-exported here.
import { ALLOWED_CATEGORIES, rawUrlForPath, sanitizeStem } from '../shared/studioConfig'

export * from '../shared/studioConfig'

export const BASES_SUBS = [...ALLOWED_CATEGORIES['Bases_img/home_village_bases'].subs]
export const ARMY_SUBS = [...ALLOWED_CATEGORIES.army_img.subs]

export const CATEGORY_ROOTS: Record<string, { label: string; thPath: (th: string) => string; subs: string[] }> = {
  'Bases_img/home_village_bases': { label: ALLOWED_CATEGORIES['Bases_img/home_village_bases'].label, thPath: (th: string) => `Bases_img/home_village_bases/${th}`, subs: BASES_SUBS },
  'army_img':                     { label: ALLOWED_CATEGORIES.army_img.label,                     thPath: (th: string) => `army_img/${th}`,                     subs: ARMY_SUBS  },
}

export const WATERMARK_SOURCES = [
  { src: '/BabariyaMeet.webp',       label: 'BabariyaMeet Logo' },
  { src: '/splash_logo_padded.png',  label: 'Splash Logo (Padded)' },
  { src: '/splash_logo_round.png',   label: 'Splash Logo (Round)' },
  { src: '/app-icon.png',            label: 'App Icon' },
]

export function makeRawUrl(repoRelPath: string): string {
  return rawUrlForPath(repoRelPath)
}

export function randomId(n = 6): string {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('')
}

export function sanitizeFilename(raw: string): string {
  return sanitizeStem(raw)
}
