import { useState } from 'react'
import { Eye, EyeOff, Trash2, ChevronUp, ChevronDown, ChevronRight, FlipHorizontal, FlipVertical, Lock, Unlock, MousePointer, Hand, Undo2, Redo2, Bookmark, Save } from 'lucide-react'
import type { CanvasTool, WatermarkLayer, WatermarkPreset } from './types'
import { WATERMARK_SOURCES } from './constants'
import NumberField from './NumberField'
import { clampRotation, MIN_LAYER_SIZE, normalizeAngle } from './canvasMath'

interface Props {
  layers: WatermarkLayer[]
  selectedId: string | null
  tool: CanvasTool
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  preset: WatermarkPreset | null
  canSavePreset: boolean
  onApplyPreset: () => void
  onSavePreset: () => void
  onClearPreset: () => void
  onToolChange: (tool: CanvasTool) => void
  onSelect: (id: string) => void
  onAdd: (src: string, label: string) => void
  onUpdate: (id: string, patch: Partial<WatermarkLayer>) => void
  onRemove: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export default function LayerPanel({
  layers, selectedId, tool, canUndo, canRedo, onUndo, onRedo,
  preset, canSavePreset, onApplyPreset, onSavePreset, onClearPreset,
  onToolChange, onSelect, onAdd, onUpdate, onRemove, onMoveUp, onMoveDown,
}: Props) {
  const sel = layers.find(l => l.id === selectedId)
  const [transformOpen, setTransformOpen] = useState(true)

  function commitWidth(v: number) {
    if (!sel) return
    if (sel.lockAspect && sel.width > 0) {
      const ratio = sel.height / sel.width
      onUpdate(sel.id, { width: v, height: Math.max(MIN_LAYER_SIZE, Math.round(v * ratio)) })
    } else {
      onUpdate(sel.id, { width: v })
    }
  }

  function commitHeight(v: number) {
    if (!sel) return
    if (sel.lockAspect && sel.height > 0) {
      const ratio = sel.width / sel.height
      onUpdate(sel.id, { height: v, width: Math.max(MIN_LAYER_SIZE, Math.round(v * ratio)) })
    } else {
      onUpdate(sel.id, { height: v })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Undo / redo — S14 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '5px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button className="btn-icon" disabled={!canUndo} onClick={onUndo}
          title="Undo (Ctrl+Z)" aria-label="Undo"><Undo2 size={14} /></button>
        <button className="btn-icon" disabled={!canRedo} onClick={onRedo}
          title="Redo (Ctrl+Y)" aria-label="Redo"><Redo2 size={14} /></button>
        <span style={{ marginLeft: 'auto', fontSize: 9, letterSpacing: '.4px', color: 'var(--text-lo)', textTransform: 'uppercase' }}>History</span>
      </div>

      {/* Watermarks, tool and the layer list scroll together so none of them is clipped */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Watermarks</div>
          {preset && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
              <button className="btn-primary" onClick={onApplyPreset}
                title="Replace the canvas watermarks with the saved template"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 0', fontSize: 11 }}>
                <Bookmark size={13} /> Apply template ({preset.layers.length})
              </button>
              <div style={{ fontSize: 10, color: 'var(--text-lo)' }}>
                Replaces the canvas watermarks.
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                <button className="btn-ghost" disabled={!canSavePreset} onClick={onSavePreset}
                  title="Save the current watermarks over the template, including anything added since"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '5px 0', fontSize: 11 }}>
                  <Save size={12} /> Save as template
                </button>
                <button className="btn-icon danger" aria-label="Remove saved template" title="Remove saved template"
                  onClick={onClearPreset} style={{ border: '1px solid var(--border)' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          )}

          <div className="section-label" style={{ marginBottom: 6 }}>Add watermark</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {WATERMARK_SOURCES.map(ws => (
              <button key={ws.src} className="btn-ghost" title={ws.label} aria-label={`Add ${ws.label}`}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 0' }}
                onClick={() => onAdd(ws.src, ws.label)}>
                <img src={ws.src} alt="" style={{ width: 24, height: 24, objectFit: 'contain', borderRadius: 3, background: '#0a0e17' }} />
              </button>
            ))}
          </div>
          {!preset && (
            <>
              <button className="btn-ghost" disabled={!canSavePreset} onClick={onSavePreset}
                title="Save the current watermarks as the template used by this button"
                style={{ width: '100%', marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '5px 0', fontSize: 11 }}>
                <Bookmark size={12} /> Save as template
              </button>
              {!canSavePreset && (
                <div style={{ marginTop: 5, fontSize: 10, color: 'var(--text-lo)' }}>Add a watermark first, then save its setup here.</div>
              )}
            </>
          )}
        </div>

        {/* Tool selector — S11 */}
        {layers.length > 0 && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
            <div className="section-label" style={{ marginBottom: 7 }}>Tool</div>
            <div style={{ display: 'flex', gap: 5 }}>
              <button
                className={tool === 'select' ? 'btn-primary' : 'btn-ghost'}
                title="Select (V) — drag layer body to move; drag handles to resize/rotate"
                onClick={() => onToolChange('select')}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '5px 0', fontSize: 11 }}>
                <MousePointer size={12} /> Select
              </button>
              <button
                className={tool === 'move' ? 'btn-primary' : 'btn-ghost'}
                title="Move (H) — drag always moves the layer under the pointer; no resize handles"
                onClick={() => onToolChange('move')}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '5px 0', fontSize: 11 }}>
                <Hand size={12} /> Move
              </button>
            </div>
            <div style={{ marginTop: 5, fontSize: 10, color: 'var(--text-lo)' }}>
              V = Select · H = Move · Shift+drag inverts aspect lock
            </div>
          </div>
        )}

        <div style={{ padding: '10px 14px' }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Layers ({layers.length})</div>
          {layers.length === 0 && <div style={{ color: 'var(--text-lo)', fontSize: 11, fontStyle: 'italic' }}>No watermark layers yet. Add one above, then drag it on the canvas.</div>}
          {[...layers].reverse().map(l => (
            <div key={l.id} onClick={() => onSelect(l.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 6, marginBottom: 3, background: l.id === selectedId ? 'var(--bg-hover)' : 'transparent', border: l.id === selectedId ? '1px solid var(--accent)' : '1px solid transparent', cursor: 'pointer' }}>
              <img src={l.src} alt="" style={{ width: 20, height: 20, objectFit: 'contain', background: '#0a0e17', borderRadius: 3, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 11, color: 'var(--text-mid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.label}</span>
              <div style={{ display: 'flex', gap: 2 }}>
                <button className="btn-icon" onClick={e => { e.stopPropagation(); onMoveUp(l.id) }} aria-label="Move layer up"><ChevronUp size={12} /></button>
                <button className="btn-icon" onClick={e => { e.stopPropagation(); onMoveDown(l.id) }} aria-label="Move layer down"><ChevronDown size={12} /></button>
                <button className="btn-icon" onClick={e => { e.stopPropagation(); onUpdate(l.id, { visible: !l.visible }) }} aria-label={l.visible ? 'Hide layer' : 'Show layer'}>
                  {l.visible ? <Eye size={12} /> : <EyeOff size={12} style={{ color: 'var(--text-lo)' }} />}
                </button>
                <button className="btn-icon danger" onClick={e => { e.stopPropagation(); onRemove(l.id) }} aria-label="Remove layer"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {sel && (
        <div style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 12px 8px 8px' }}>
            <button className="btn-icon" onClick={() => setTransformOpen(open => !open)}
              aria-expanded={transformOpen} aria-label={transformOpen ? 'Collapse transform' : 'Expand transform'}
              title={transformOpen ? 'Collapse the transform fields' : 'Expand the transform fields'}>
              <ChevronRight size={13} style={{ transform: transformOpen ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }} />
            </button>
            <div className="section-label">Transform</div>
            <button className="btn-ghost" style={{ marginLeft: 'auto', padding: '2px 7px', fontSize: 10 }}
              onClick={() => onUpdate(sel.id, { ...sel.initial })}>
              Reset all
            </button>
          </div>
          {transformOpen && (
            <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <NumberField label="X" value={sel.x} unit="px" step={1}
                onCommit={v => onUpdate(sel.id, { x: v })} onReset={() => onUpdate(sel.id, { x: sel.initial.x })} />
              <NumberField label="Y" value={sel.y} unit="px" step={1}
                onCommit={v => onUpdate(sel.id, { y: v })} onReset={() => onUpdate(sel.id, { y: sel.initial.y })} />

              {/* Width / Height with lock-aspect toggle — S12 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ flex: 1 }}>
                  <NumberField label="W" value={sel.width} unit="px" min={MIN_LAYER_SIZE} step={1}
                    onCommit={commitWidth} onReset={() => onUpdate(sel.id, { width: sel.initial.width, height: sel.lockAspect ? Math.max(MIN_LAYER_SIZE, Math.round(sel.initial.width * sel.height / sel.width)) : sel.initial.height })} />
                </div>
                <button
                  className="btn-icon"
                  title={sel.lockAspect ? 'Aspect locked — click to unlock (free stretch)' : 'Aspect unlocked — click to lock'}
                  aria-label={sel.lockAspect ? 'Lock aspect ratio' : 'Unlock aspect ratio'}
                  onClick={() => onUpdate(sel.id, { lockAspect: !sel.lockAspect })}
                  style={{ padding: 3, flexShrink: 0, color: sel.lockAspect ? 'var(--accent)' : 'var(--text-lo)' }}>
                  {sel.lockAspect ? <Lock size={12} /> : <Unlock size={12} />}
                </button>
              </div>
              <NumberField label="H" value={sel.height} unit="px" min={MIN_LAYER_SIZE} step={1}
                onCommit={commitHeight} onReset={() => onUpdate(sel.id, { height: sel.initial.height, width: sel.lockAspect ? Math.max(MIN_LAYER_SIZE, Math.round(sel.initial.height * sel.width / sel.height)) : sel.initial.width })} />

              <NumberField label="Rotation" value={sel.rotation} unit="°" step={1}
                sanitize={clampRotation}
                onCommit={v => onUpdate(sel.id, { rotation: normalizeAngle(v) })} onReset={() => onUpdate(sel.id, { rotation: sel.initial.rotation })} />
              <NumberField label="Opacity" value={sel.opacity * 100} unit="%" min={0} max={100} step={1}
                onCommit={v => onUpdate(sel.id, { opacity: v / 100 })} onReset={() => onUpdate(sel.id, { opacity: sel.initial.opacity })} />
              <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                <button className="btn-ghost" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }} onClick={() => onUpdate(sel.id, { flipX: !sel.flipX })}>
                  <FlipHorizontal size={13} /> Flip H
                </button>
                <button className="btn-ghost" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }} onClick={() => onUpdate(sel.id, { flipY: !sel.flipY })}>
                  <FlipVertical size={13} /> Flip V
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
