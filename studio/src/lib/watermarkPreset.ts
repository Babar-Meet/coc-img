import type { SavedWatermarkLayer, WatermarkPreset } from '../components/types'

export const WATERMARK_PRESET_KEY = 'coc-studio-watermark-template-v1'

const MIN_SIZE = 20
const MAX_SIZE = 10000

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function parseLayer(value: unknown): SavedWatermarkLayer | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  const { src, label, x, y, width, height, rotation, opacity } = record
  // Only local public assets: no remote, protocol-relative or parent-relative paths.
  if (typeof src !== 'string' || !/^\/[^/\\]/.test(src) || src.includes('..')) return null
  if (typeof label !== 'string' || !label.trim()) return null
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null
  if (!isFiniteNumber(width) || !isFiniteNumber(height)) return null
  if (width < MIN_SIZE || height < MIN_SIZE || width > MAX_SIZE || height > MAX_SIZE) return null
  if (!isFiniteNumber(rotation) || !isFiniteNumber(opacity)) return null
  if (opacity < 0 || opacity > 1) return null
  return {
    src, label, x, y, width, height, rotation, opacity,
    flipX: record.flipX === true,
    flipY: record.flipY === true,
    lockAspect: record.lockAspect !== false,
  }
}

export function loadWatermarkPreset(): WatermarkPreset | null {
  try {
    const raw = window.localStorage.getItem(WATERMARK_PRESET_KEY)
    if (!raw) return null
    const data: unknown = JSON.parse(raw)
    if (typeof data !== 'object' || data === null) return null
    const record = data as Record<string, unknown>
    if (record.version !== 1 || !Array.isArray(record.layers)) return null
    const layers: SavedWatermarkLayer[] = []
    for (const entry of record.layers) {
      const layer = parseLayer(entry)
      if (!layer) return null
      layers.push(layer)
    }
    if (!layers.length) return null
    return { version: 1, savedAt: typeof record.savedAt === 'string' ? record.savedAt : '', layers }
  } catch {
    return null
  }
}

export function saveWatermarkPreset(layers: SavedWatermarkLayer[]): WatermarkPreset | null {
  if (!layers.length) return null
  const preset: WatermarkPreset = { version: 1, savedAt: new Date().toISOString(), layers }
  try {
    window.localStorage.setItem(WATERMARK_PRESET_KEY, JSON.stringify(preset))
    return preset
  } catch {
    return null
  }
}

export function clearWatermarkPreset(): void {
  try {
    window.localStorage.removeItem(WATERMARK_PRESET_KEY)
  } catch {
    // storage blocked; the in-memory template is still cleared by the caller
  }
}
