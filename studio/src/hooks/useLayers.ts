import { useState, useCallback } from 'react'
import type { WatermarkLayer } from '../components/types'
import { randomId } from '../components/constants'

export function useLayers() {
  const [layers, setLayers] = useState<WatermarkLayer[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const addLayer = useCallback((src: string, label: string) => {
    const id = randomId(8)
    const layer: WatermarkLayer = {
      id, src, label,
      x: 40, y: 40, width: 160, height: 100,
      rotation: 0, opacity: 0.85, visible: true, flipX: false, flipY: false,
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

  return { layers, selectedId, setSelectedId, addLayer, updateLayer, removeLayer, moveUp, moveDown, clearLayers }
}
