import React, { useRef, useState, useEffect, useCallback } from 'react'
import type { WatermarkLayer } from './types'

const CANVAS_W = 1600
const CANVAS_H = 800
type Handle = 'tl'|'tr'|'bl'|'br'|'ml'|'mr'|'tm'|'bm'|'rot'|'move'|null

interface Props {
  baseImage: string | null
  layers: WatermarkLayer[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onUpdateLayer: (id: string, patch: Partial<WatermarkLayer>) => void
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}

export default function Canvas({ baseImage, layers, selectedId, onSelect, onUpdateLayer, canvasRef }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const dragRef = useRef<{ handle: Handle; layer: WatermarkLayer; startMx: number; startMy: number } | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setScale(Math.min(r.width / CANVAS_W, r.height / CANVAS_H))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    function drawAll() {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      const tile = 40
      for (let y = 0; y < CANVAS_H; y += tile) for (let x = 0; x < CANVAS_W; x += tile) {
        ctx.fillStyle = ((x/tile + y/tile) % 2 === 0) ? '#1a2030' : '#151c28'
        ctx.fillRect(x, y, tile, tile)
      }

      function drawLayersOnCtx() {
        layers.filter(l => l.visible).forEach(l => {
          const img = document.createElement('img')
          img.src = l.src
          img.onload = () => {
            ctx.save()
            ctx.globalAlpha = l.opacity
            ctx.translate(l.x + l.width/2, l.y + l.height/2)
            ctx.rotate(l.rotation * Math.PI / 180)
            ctx.scale(l.flipX ? -1 : 1, l.flipY ? -1 : 1)
            ctx.drawImage(img, -l.width/2, -l.height/2, l.width, l.height)
            ctx.restore()
          }
        })
      }

      if (baseImage) {
        const img = document.createElement('img')
        img.src = baseImage
        img.onload = () => { ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H); drawLayersOnCtx() }
      } else {
        drawLayersOnCtx()
      }
    }

    drawAll()
  }, [baseImage, layers, canvasRef])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current!.getBoundingClientRect()
    const mx = (e.clientX - rect.left) / scale
    const my = (e.clientY - rect.top) / scale
    const sel = layers.find(l => l.id === selectedId)
    if (sel) {
      const handle = getHandle(mx, my, sel)
      if (handle) { dragRef.current = { handle, layer: { ...sel }, startMx: mx, startMy: my }; return }
    }
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i]
      if (!l.visible) continue
      if (mx >= l.x && mx <= l.x + l.width && my >= l.y && my <= l.y + l.height) {
        onSelect(l.id); dragRef.current = { handle: 'move', layer: { ...l }, startMx: mx, startMy: my }; return
      }
    }
    onSelect(null)
  }, [layers, selectedId, scale, onSelect])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const d = dragRef.current; if (!d) return
    const rect = containerRef.current!.getBoundingClientRect()
    const mx = (e.clientX - rect.left) / scale
    const my = (e.clientY - rect.top) / scale
    const dx = mx - d.startMx; const dy = my - d.startMy; const l = d.layer
    if (d.handle === 'move')   { onUpdateLayer(l.id, { x: l.x + dx, y: l.y + dy }) }
    else if (d.handle === 'tr') { onUpdateLayer(l.id, { width: Math.max(20, l.width + dx), y: l.y + dy, height: Math.max(20, l.height - dy) }) }
    else if (d.handle === 'tl') { onUpdateLayer(l.id, { x: l.x + dx, y: l.y + dy, width: Math.max(20, l.width - dx), height: Math.max(20, l.height - dy) }) }
    else if (d.handle === 'br') { onUpdateLayer(l.id, { width: Math.max(20, l.width + dx), height: Math.max(20, l.height + dy) }) }
    else if (d.handle === 'bl') { onUpdateLayer(l.id, { x: l.x + dx, width: Math.max(20, l.width - dx), height: Math.max(20, l.height + dy) }) }
    else if (d.handle === 'mr') { onUpdateLayer(l.id, { width: Math.max(20, l.width + dx) }) }
    else if (d.handle === 'ml') { onUpdateLayer(l.id, { x: l.x + dx, width: Math.max(20, l.width - dx) }) }
    else if (d.handle === 'tm') { onUpdateLayer(l.id, { y: l.y + dy, height: Math.max(20, l.height - dy) }) }
    else if (d.handle === 'bm') { onUpdateLayer(l.id, { height: Math.max(20, l.height + dy) }) }
    else if (d.handle === 'rot') {
      const cx = l.x + l.width/2; const cy = l.y + l.height/2
      onUpdateLayer(l.id, { rotation: Math.atan2(my - cy, mx - cx) * 180 / Math.PI + 90 })
    }
  }, [scale, onUpdateLayer])

  const onMouseUp = useCallback(() => { dragRef.current = null }, [])
  const sel = layers.find(l => l.id === selectedId)

  return (
    <div ref={containerRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', overflow: 'hidden' }}>
      <div style={{ position: 'relative', width: CANVAS_W * scale, height: CANVAS_H * scale, cursor: 'crosshair' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H}
          style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, display: 'block', borderRadius: 4 }} />
        {sel && <SelectionOverlay layer={sel} scale={scale} />}
      </div>
    </div>
  )
}

function getHandle(mx: number, my: number, l: WatermarkLayer): Handle {
  const hs = 8
  const handles: { h: Handle; x: number; y: number }[] = [
    { h: 'tl', x: l.x, y: l.y }, { h: 'tm', x: l.x + l.width/2, y: l.y },
    { h: 'tr', x: l.x + l.width, y: l.y }, { h: 'ml', x: l.x, y: l.y + l.height/2 },
    { h: 'mr', x: l.x + l.width, y: l.y + l.height/2 }, { h: 'bl', x: l.x, y: l.y + l.height },
    { h: 'bm', x: l.x + l.width/2, y: l.y + l.height }, { h: 'br', x: l.x + l.width, y: l.y + l.height },
    { h: 'rot', x: l.x + l.width/2, y: l.y - 24 },
  ]
  for (const { h, x, y } of handles) if (Math.abs(mx - x) <= hs && Math.abs(my - y) <= hs) return h
  return null
}

function SelectionOverlay({ layer: l, scale: s }: { layer: WatermarkLayer; scale: number }) {
  const hs = 7
  const handles = [
    { x: l.x, y: l.y }, { x: l.x + l.width/2, y: l.y }, { x: l.x + l.width, y: l.y },
    { x: l.x, y: l.y + l.height/2 }, { x: l.x + l.width, y: l.y + l.height/2 },
    { x: l.x, y: l.y + l.height }, { x: l.x + l.width/2, y: l.y + l.height }, { x: l.x + l.width, y: l.y + l.height },
    { x: l.x + l.width/2, y: l.y - 24 },
  ]
  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
      <rect x={l.x * s} y={l.y * s} width={l.width * s} height={l.height * s} fill="none" stroke="#f4a443" strokeWidth={1.5} strokeDasharray="5,3" />
      <line x1={(l.x + l.width/2) * s} y1={l.y * s} x2={(l.x + l.width/2) * s} y2={(l.y - 24) * s} stroke="#f4a443" strokeWidth={1} />
      {handles.map((h, i) => <circle key={i} cx={h.x * s} cy={h.y * s} r={hs} fill={i === 8 ? '#f4a443' : '#1e2535'} stroke="#f4a443" strokeWidth={1.5} />)}
    </svg>
  )
}
