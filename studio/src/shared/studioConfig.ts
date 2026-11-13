// Shared constants for the studio client and the local publish server.
// Keep this file free of DOM and Node APIs: it is type-checked by both
// tsconfig.app.json (browser) and tsconfig.node.json (dev-server).

export const CANVAS_W = 1600
export const CANVAS_H = 800
export const WEBP_QUALITY = 0.85

export const REPO_OWNER = 'Babar-Meet'
export const REPO_NAME = 'coc-img'
export const BRANCH = 'main'
export const RAW_URL_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}`

export const TH_LEVELS = Array.from({ length: 18 }, (_, i) => `TH_${i + 1}`)

export interface AllowedCategory {
  label: string
  subs: readonly string[]
}

export const ALLOWED_CATEGORIES: Record<string, AllowedCategory> = {
  'Bases_img/home_village_bases': { label: 'Home Village Bases', subs: ['War', 'Farming', 'Progress', 'Art', 'Rank'] },
  army_img: { label: 'Army Images', subs: ['War', 'Farming', 'Rank', 'Simple'] },
}

export const STEM_MAX_LENGTH = 60
export const STEM_FALLBACK = 'image'
export const FILENAME_PATTERN = /^[a-z0-9_]{1,60}_\d{6}\.webp$/
export const PUBLISH_REQUEST_HEADER = 'publish'
export const PUBLISH_BODY_LIMIT_BYTES = 20 * 1024 * 1024

/** lowercase, non-alphanumeric -> "_", collapsed, trimmed, capped, never empty. */
export function sanitizeStem(raw: string): string {
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const capped = cleaned.slice(0, STEM_MAX_LENGTH).replace(/_+$/g, '')
  return capped || STEM_FALLBACK
}

/** Raw GitHub URL for a repo-relative POSIX path, encoded per segment. */
export function rawUrlForPath(repoRelPath: string): string {
  const encoded = repoRelPath.split('/').filter(segment => segment.length > 0).map(encodeURIComponent).join('/')
  return `${RAW_URL_BASE}/${encoded}`
}
