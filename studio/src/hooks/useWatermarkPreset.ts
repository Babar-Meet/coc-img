import { useCallback, useState } from 'react'
import type { SavedWatermarkLayer, WatermarkPreset } from '../components/types'
import { clearWatermarkPreset, loadWatermarkPreset, saveWatermarkPreset } from '../lib/watermarkPreset'

/** The single saved watermark template, loaded from localStorage on first render. */
export function useWatermarkPreset() {
  const [preset, setPreset] = useState<WatermarkPreset | null>(() => loadWatermarkPreset())

  const save = useCallback((layers: SavedWatermarkLayer[]) => {
    const saved = saveWatermarkPreset(layers)
    if (saved) setPreset(saved)
    return Boolean(saved)
  }, [])

  const clear = useCallback(() => {
    clearWatermarkPreset()
    setPreset(null)
  }, [])

  return { preset, save, clear }
}
