// constants
export const REPO_OWNER = 'Babar-Meet'
export const REPO_NAME  = 'coc-img'
export const BRANCH     = 'main'
export const RAW_BASE   = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}`

export const TH_LEVELS = Array.from({ length: 18 }, (_, i) => `TH_${i + 1}`)
export const BASES_SUBS = ['War', 'Farming', 'Progress', 'Art', 'Rank']
export const ARMY_SUBS  = ['War', 'Farming', 'Rank', 'Simple']

export const CATEGORY_ROOTS: Record<string, { label: string; thPath: (th: string) => string; subs: string[] }> = {
  'Bases_img/home_village_bases': { label: 'Home Village Bases', thPath: (th: string) => `Bases_img/home_village_bases/${th}`, subs: BASES_SUBS },
  'army_img':                     { label: 'Army Images',        thPath: (th: string) => `army_img/${th}`,                     subs: ARMY_SUBS  },
}

export const WATERMARK_SOURCES = [
  { src: '/BabariyaMeet.webp',       label: 'BabariyaMeet Logo' },
  { src: '/splash_logo_padded.png',  label: 'Splash Logo (Padded)' },
  { src: '/splash_logo_round.png',   label: 'Splash Logo (Round)' },
  { src: '/app-icon.png',            label: 'App Icon' },
]

export function makeRawUrl(repoRelPath: string): string {
  const encoded = repoRelPath.split('/').map(encodeURIComponent).join('/')
  return `${RAW_BASE}/${encoded}`
}

export function randomId(n = 6): string {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('')
}

export function sanitizeFilename(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'image'
}
