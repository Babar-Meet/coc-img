import { Eye, EyeOff, Trash2, ChevronUp, ChevronDown, FlipHorizontal, FlipVertical } from 'lucide-react'
import type { WatermarkLayer } from './types'
import { WATERMARK_SOURCES } from './constants'

interface Props {
  layers: WatermarkLayer[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: (src: string, label: string) => void
  onUpdate: (id: string, patch: Partial<WatermarkLayer>) => void
  onRemove: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export default function LayerPanel({ layers, selectedId, onSelect, onAdd, onUpdate, onRemove, onMoveUp, onMoveDown }: Props) {
  const sel = layers.find(l => l.id === selectedId)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <div className="section-label" style={{ marginBottom: 8 }}>Add Watermark</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {WATERMARK_SOURCES.map(ws => (
            <button key={ws.src} className="btn-ghost" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
              onClick={() => onAdd(ws.src, ws.label)}>
              <img src={ws.src} alt="" style={{ width: 22, height: 22, objectFit: 'contain', borderRadius: 3, background: '#0a0e17' }} />
              <span style={{ color: 'var(--text-mid)', fontSize: 11 }}>{ws.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
        <div className="section-label" style={{ marginBottom: 8 }}>Layers ({layers.length})</div>
        {layers.length === 0 && <div style={{ color: 'var(--text-lo)', fontSize: 11, fontStyle: 'italic' }}>No watermark layers yet.</div>}
        {[...layers].reverse().map(l => (
          <div key={l.id} onClick={() => onSelect(l.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 6, marginBottom: 3, background: l.id === selectedId ? 'var(--bg-hover)' : 'transparent', border: l.id === selectedId ? '1px solid var(--accent)' : '1px solid transparent', cursor: 'pointer' }}>
            <img src={l.src} alt="" style={{ width: 20, height: 20, objectFit: 'contain', background: '#0a0e17', borderRadius: 3, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 11, color: 'var(--text-mid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.label}</span>
            <div style={{ display: 'flex', gap: 2 }}>
              <button className="btn-icon" onClick={e => { e.stopPropagation(); onMoveUp(l.id) }}><ChevronUp size={12} /></button>
              <button className="btn-icon" onClick={e => { e.stopPropagation(); onMoveDown(l.id) }}><ChevronDown size={12} /></button>
              <button className="btn-icon" onClick={e => { e.stopPropagation(); onUpdate(l.id, { visible: !l.visible }) }}>
                {l.visible ? <Eye size={12} /> : <EyeOff size={12} style={{ color: 'var(--text-lo)' }} />}
              </button>
              <button className="btn-icon danger" onClick={e => { e.stopPropagation(); onRemove(l.id) }}><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
      </div>

      {sel && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="section-label">Transform</div>
          <LabelSlider label="Opacity" value={Math.round(sel.opacity * 100)} min={0} max={100} onChange={v => onUpdate(sel.id, { opacity: v / 100 })} unit="%" />
          <LabelSlider label="Rotation" value={Math.round(sel.rotation)} min={-180} max={180} onChange={v => onUpdate(sel.id, { rotation: v })} unit="°" />
          <LabelSlider label="Width" value={Math.round(sel.width)} min={20} max={1600} onChange={v => onUpdate(sel.id, { width: v })} unit="px" />
          <LabelSlider label="Height" value={Math.round(sel.height)} min={20} max={800} onChange={v => onUpdate(sel.id, { height: v })} unit="px" />
          <div style={{ display: 'flex', gap: 6 }}>
            <XYInput label="X" value={Math.round(sel.x)} onChange={v => onUpdate(sel.id, { x: v })} />
            <XYInput label="Y" value={Math.round(sel.y)} onChange={v => onUpdate(sel.id, { y: v })} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
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
  )
}

function LabelSlider({ label, value, min, max, onChange, unit }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 58, fontSize: 11, color: 'var(--text-mid)', flexShrink: 0 }}>{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer', background: 'transparent' }} />
      <span style={{ width: 38, fontSize: 11, color: 'var(--accent)', textAlign: 'right' }}>{value}{unit}</span>
    </div>
  )
}

function XYInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
      <span style={{ fontSize: 11, color: 'var(--text-mid)', width: 14 }}>{label}</span>
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} style={{ width: '100%', textAlign: 'center' }} />
    </div>
  )
}
