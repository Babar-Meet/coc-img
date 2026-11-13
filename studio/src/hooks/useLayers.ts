import { useState, useCallback } from 'react'
import type { LayerSnapshot, WatermarkLayer } from '../components/types'
import { randomId } from '../components/constants'
import { preloadImage } from '../components/scene'

const DEFAULT_WIDTH = 160
const DEFAULT_HEIGHT = 100

export function useLayers() {
  const [layers, setLayers] = useState<WatermarkLayer[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const addLayer = useCallback(async (src: string, label: string) => {
    const img = await preloadImage(src)
    const width = DEFAULT_WIDTH
    const height = img && img.naturalWidth > 0
      ? Math.max(20, Math.round(DEFAULT_WIDTH * img.naturalHeight / img.naturalWidth))
      : DEFAULT_HEIGHT
    const initial: LayerSnapshot = { x: 40, y: 40, width, height, rotation: 0, opacity: 1 }
    const id = randomId(8)
    const layer: WatermarkLayer = {
      id, src, label,
      ...initial,
      visible: true, flipX: false, flipY: false,
      lockAspect: true,
      initial,
    }
    setLayers(prev => [...prev, layer])
    setSelectedId(id)
  }, [])

  const updateLayer = useCallback((id: string, patch: Partial<WatermarkLayer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
  }, [])

  const removeLayer = useCallback((id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id))
    setSelectedId(prev => prev === id ? null : prev)
  }, [])

  const moveUp = useCallback((id: string) => {
    setLayers(prev => {
      const idx = prev.findIndex(l => l.id === id)
      if (idx >= prev.length - 1) return prev
      const a = [...prev]; [a[idx], a[idx+1]] = [a[idx+1], a[idx]]; return a
    })
  }, [])

  const moveDown = useCallback((id: string) => {
    setLayers(prev => {
      const idx = prev.findIndex(l => l.id === id)
      if (idx <= 0) return prev
      const a = [...prev]; [a[idx], a[idx-1]] = [a[idx-1], a[idx]]; return a
    })
  }, [])

  const clearLayers = useCallback(() => { setLayers([]); setSelectedId(null) }, [])

  /** Replace the whole stack, for undo/redo and applying the saved template. */
  const replaceLayers = useCallback((next: WatermarkLayer[]) => { setLayers(next) }, [])

  return { layers, selectedId, setSelectedId, addLayer, updateLayer, removeLayer, moveUp, moveDown, clearLayers, replaceLayers }
}
