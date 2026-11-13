import React, { useRef, useState, useEffect } from 'react'
import type { CanvasTool, PhotoTransform, Selection, WatermarkLayer } from './types'
import {
  HANDLE_SIZE_PX, ROTATION_HANDLE_OFFSET_PX, handleSigns,
  hitTestHandle, MIN_HANDLE_LAYER_SCREEN_PX, pointInLayer, pointInRect, resizeLayerFromSnapshot, rotationFromSnapshot,
  type HandleId, type Vec,
} from './canvasMath'
import { CANVAS_H, CANVAS_W } from './constants'
import { drawScene, preloadImage } from './scene'

type DragState =
  | { kind: 'move'; pointerId: number; layer: WatermarkLayer; start: Vec }
  | { kind: 'resize'; pointerId: number; layer: WatermarkLayer; handle: HandleId; start: Vec }
  | { kind: 'rotate'; pointerId: number; layer: WatermarkLayer; start: Vec }
  | { kind: 'photo'; pointerId: number; photo: PhotoTransform; start: Vec }

interface Props {
  photo: PhotoTransform | null
  layers: WatermarkLayer[]
  selection: Selection
  tool: CanvasTool
  onSelectLayer: (id: string) => void
  onSelectPhoto: () => void
  onDeselect: () => void
  onUpdateLayer: (id: string, patch: Partial<WatermarkLayer>) => void
  onUpdatePhoto: (patch: Partial<PhotoTransform>) => void
  /** A new pointer interaction began; drop any stale gesture state. */
  onGestureStart: () => void
  /** A drag ended normally. */
  onGestureEnd: () => void
  /** A drag was cancelled with Escape and the start state was restored. */
  onGestureCancel: () => void
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}

export default function Canvas({
  photo, layers, selection, tool, onSelectLayer, onSelectPhoto, onDeselect, onUpdateLayer, onUpdatePhoto,
  onGestureStart, onGestureEnd, onGestureCancel, canvasRef,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [scale, setScale] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      const next = Math.min(rect.width / CANVAS_W, rect.height / CANVAS_H, 1)
      setScale(next > 0 ? next : 0)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let cancelled = false
    let frame = 0
    const draw = () => {
      frame = 0
      if (cancelled) return
      drawScene(ctx, { photo, layers })
    }
    frame = requestAnimationFrame(draw)
    const sources = new Set<string>()
    if (photo) sources.add(photo.src)
    for (const layer of layers) if (layer.visible) sources.add(layer.src)
    Promise.all([...sources].map(preloadImage)).then(() => {
      if (cancelled || frame) return
      frame = requestAnimationFrame(draw)
    }).catch(() => { /* a failed image is skipped by drawScene */ })
    return () => {
      cancelled = true
      if (frame) cancelAnimationFrame(frame)
    }
  }, [photo, layers, canvasRef])

  function toCanvasPoint(clientX: number, clientY: number): Vec | null {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect || !(rect.width > 0)) return null
    const k = rect.width / CANVAS_W
    return { x: (clientX - rect.left) / k, y: (clientY - rect.top) / k }
  }

  function capturePointer(event: React.PointerEvent<HTMLDivElement>) {
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* pointer already gone */ }
  }

  function releasePointer(event: React.PointerEvent<HTMLDivElement>) {
    try { event.currentTarget.releasePointerCapture(event.pointerId) } catch { /* pointer already gone */ }
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    const point = toCanvasPoint(event.clientX, event.clientY)
    if (!point) return
    onGestureStart()
    const selected = selection?.kind === 'layer' ? layers.find(layer => layer.id === selection.id) ?? null : null

    // In Select mode: try handles on the selected layer, unless the layer is too small
    // (handles would cover the whole body). In Move mode: skip handles entirely.
    if (tool === 'select' && selected) {
      const layerScreenW = selected.width * scale
      const layerScreenH = selected.height * scale
      const tooSmall = layerScreenW < MIN_HANDLE_LAYER_SCREEN_PX || layerScreenH < MIN_HANDLE_LAYER_SCREEN_PX
      if (!tooSmall) {
        const handle = hitTestHandle(point, selected, scale)
        if (handle) {
          if (handle === 'rot') dragRef.current = { kind: 'rotate', pointerId: event.pointerId, layer: { ...selected }, start: point }
          else dragRef.current = { kind: 'resize', pointerId: event.pointerId, layer: { ...selected }, handle, start: point }
          capturePointer(event)
          return
        }
      }
    }

    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i]
      if (!layer.visible) continue
      if (pointInLayer(point, layer)) {
        onSelectLayer(layer.id)
        dragRef.current = { kind: 'move', pointerId: event.pointerId, layer: { ...layer }, start: point }
        capturePointer(event)
        return
      }
    }

    if (photo && pointInRect(point, photo)) {
      onSelectPhoto()
      dragRef.current = { kind: 'photo', pointerId: event.pointerId, photo: { ...photo }, start: point }
      capturePointer(event)
      return
    }

    onDeselect()
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const point = toCanvasPoint(event.clientX, event.clientY)
    if (!point) return
    const dx = point.x - drag.start.x
    const dy = point.y - drag.start.y
    if (drag.kind === 'move') {
      onUpdateLayer(drag.layer.id, { x: drag.layer.x + dx, y: drag.layer.y + dy })
    } else if (drag.kind === 'resize') {
      const rect = resizeLayerFromSnapshot(drag.layer, drag.handle, point, event.shiftKey)
      onUpdateLayer(drag.layer.id, rect)
    } else if (drag.kind === 'rotate') {
      onUpdateLayer(drag.layer.id, { rotation: rotationFromSnapshot(drag.layer, drag.start, point, event.shiftKey) })
    } else {
      onUpdatePhoto({ x: drag.photo.x + dx, y: drag.photo.y + dy })
    }
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    releasePointer(event)
    onGestureEnd()
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      const drag = dragRef.current
      if (!drag) {
        onDeselect()
        return
      }
      dragRef.current = null
      const stage = stageRef.current
      if (stage) {
        try { stage.releasePointerCapture(drag.pointerId) } catch { /* pointer already gone */ }
      }
      if (drag.kind === 'photo') {
        onUpdatePhoto({ x: drag.photo.x, y: drag.photo.y, width: drag.photo.width, height: drag.photo.height })
      } else {
        onUpdateLayer(drag.layer.id, {
          x: drag.layer.x, y: drag.layer.y, width: drag.layer.width, height: drag.layer.height, rotation: drag.layer.rotation,
        })
      }
      onGestureCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onUpdateLayer, onUpdatePhoto, onDeselect, onGestureCancel])

  const selectedLayer = selection?.kind === 'layer' ? layers.find(layer => layer.id === selection.id) ?? null : null
  const photoSelected = selection?.kind === 'photo' && Boolean(photo)

  return (
    <div ref={containerRef}
      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', overflow: 'hidden', padding: 16 }}>
      {scale > 0 && (
        <div ref={stageRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            position: 'relative', width: CANVAS_W * scale, height: CANVAS_H * scale,
            background: '#ffffff', borderRadius: 3, boxShadow: '0 10px 34px rgba(0, 0, 0, .45)',
            touchAction: 'none', cursor: tool === 'move' ? 'grab' : 'default',
          }}>
          <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H}
            style={{ width: '100%', height: '100%', display: 'block', borderRadius: 3 }} />
          {photoSelected && photo && (
            <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
              <rect x={photo.x} y={photo.y} width={photo.width} height={photo.height}
                fill="none" stroke="#f4a443" strokeWidth={1} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            </svg>
          )}
          {selectedLayer && <SelectionOverlay layer={selectedLayer} screenScale={scale} tool={tool} />}
        </div>
      )}
    </div>
  )
}

function SelectionOverlay({ layer, screenScale, tool }: { layer: WatermarkLayer; screenScale: number; tool: CanvasTool }) {
  const unitPx = 1 / screenScale
  const half = HANDLE_SIZE_PX / 2 * unitPx
  const rotOffset = ROTATION_HANDLE_OFFSET_PX * unitPx
  const handleRadius = 5 * unitPx
  const handles: HandleId[] = ['tl', 'tm', 'tr', 'ml', 'mr', 'bl', 'bm', 'br']
  const w = layer.width
  const h = layer.height
  // Move mode has no interactive handles, and tiny layers fall back to moving, so draw none there either.
  const showHandles = tool === 'select'
    && w * screenScale >= MIN_HANDLE_LAYER_SCREEN_PX
    && h * screenScale >= MIN_HANDLE_LAYER_SCREEN_PX
  return (
    <svg viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
      <g transform={`translate(${layer.x + w / 2} ${layer.y + h / 2}) rotate(${layer.rotation})`}>
        <rect x={-w / 2} y={-h / 2} width={w} height={h}
          fill="none" stroke="#f4a443" strokeWidth={1.5} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
        {showHandles && (
          <>
            <line x1={0} y1={-h / 2} x2={0} y2={-h / 2 - rotOffset}
              stroke="#f4a443" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            {handles.map(handle => {
              const { sx, sy } = handleSigns(handle)
              return (
                <rect key={handle}
                  x={sx * w / 2 - half} y={sy * h / 2 - half} width={half * 2} height={half * 2}
                  fill="#1e2535" stroke="#f4a443" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              )
            })}
            <circle cx={0} cy={-h / 2 - rotOffset} r={handleRadius}
              fill="#f4a443" stroke="#0f1117" strokeWidth={1.5 * unitPx} />
          </>
        )}
      </g>
    </svg>
  )
}
