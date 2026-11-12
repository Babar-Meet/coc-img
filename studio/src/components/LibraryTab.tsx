import { useState } from 'react'
import { Search, Copy, ExternalLink, Trash2, MessageSquare, CheckCircle, XCircle, Loader } from 'lucide-react'
import type { LibraryItem, HttpStatus } from './types'
import { CATEGORY_ROOTS, TH_LEVELS, makeRawUrl } from './constants'

interface Props {
  items: LibraryItem[]
  onRemove: (path: string) => void
  onUpdateNote: (path: string, note: string) => void
  onUpdateTags: (path: string, tags: string[]) => void
}

export default function LibraryTab({ items, onRemove, onUpdateNote }: Props) {
  const [search, setSearch] = useState('')
  const [editNote, setEditNote] = useState<string | null>(null)
  const [noteVal, setNoteVal] = useState('')
  const [statuses, setStatuses] = useState<Record<string, HttpStatus>>({})
  const [genRoot, setGenRoot] = useState(Object.keys(CATEGORY_ROOTS)[0])
  const [genTH, setGenTH] = useState('TH_18')
  const [genSub, setGenSub] = useState(CATEGORY_ROOTS[Object.keys(CATEGORY_ROOTS)[0]].subs[0])
  const [genFile, setGenFile] = useState('')
  const [genResult, setGenResult] = useState<string | null>(null)

  const filtered = items.filter(i => !search || i.path.toLowerCase().includes(search.toLowerCase()) || i.note.toLowerCase().includes(search.toLowerCase()))

  async function checkStatus(item: LibraryItem) {
    setStatuses(s => ({ ...s, [item.path]: 'checking' }))
    try {
      const r = await fetch(item.rawUrl, { method: 'HEAD' })
      setStatuses(s => ({ ...s, [item.path]: r.ok ? 'ok' : 'missing' }))
    } catch {
      setStatuses(s => ({ ...s, [item.path]: 'missing' }))
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url).catch(() => {
      const el = document.createElement('textarea'); el.value = url
      document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
    })
  }

  function generateQuickLink() {
    const root = CATEGORY_ROOTS[genRoot]
    const fname = genFile.trim().replace(/\s+(\.\w+)$/, '$1')
    if (!fname) return
    const url = makeRawUrl(`${root.thPath(genTH)}/${genSub}/${fname}`)
    setGenResult(url); copyUrl(url)
  }

  const StatusIcon = ({ path }: { path: string }) => {
    const s = statuses[path] || 'unchecked'
    if (s === 'checking') return <Loader size={12} style={{ color: 'var(--accent)' }} />
    if (s === 'ok')       return <CheckCircle size={12} style={{ color: 'var(--ok)' }} />
    if (s === 'missing')  return <XCircle size={12} style={{ color: 'var(--danger)' }} />
    return null
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Left: Quick URL */}
      <div className="panel" style={{ width: 240, flexShrink: 0, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="section-label">Quick Raw URL</div>

        {[
          { label: 'Category', value: genRoot, opts: Object.keys(CATEGORY_ROOTS).map(k => ({ v: k, l: CATEGORY_ROOTS[k].label })), onChange: (v: string) => { setGenRoot(v); setGenSub(CATEGORY_ROOTS[v].subs[0]); setGenResult(null) } },
          { label: 'TH Level', value: genTH, opts: TH_LEVELS.map(t => ({ v: t, l: t.replace('_', ' ') })), onChange: (v: string) => { setGenTH(v); setGenResult(null) } },
          { label: 'Sub-folder', value: genSub, opts: CATEGORY_ROOTS[genRoot].subs.map(s => ({ v: s, l: s })), onChange: (v: string) => { setGenSub(v); setGenResult(null) } },
        ].map(({ label, value, opts, onChange }) => (
          <div key={label}>
            <div style={{ fontSize: 10, color: 'var(--text-lo)', marginBottom: 3 }}>{label}</div>
            <select value={value} onChange={e => onChange(e.target.value)}
              style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-hi)', borderRadius: 6, padding: '5px 8px', fontSize: 11, width: '100%' }}>
              {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
        ))}

        <input value={genFile} onChange={e => { setGenFile(e.target.value); setGenResult(null) }}
          placeholder="filename.webp" style={{ width: '100%' }}
          onKeyDown={e => e.key === 'Enter' && generateQuickLink()} />

        <button className="btn-primary" onClick={generateQuickLink} disabled={!genFile.trim()}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <Copy size={12} /> Generate & Copy
        </button>

        {genResult && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--ok)', borderRadius: 6, padding: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--ok)', marginBottom: 4 }}>✓ Copied!</div>
            <div style={{ fontSize: 10, color: 'var(--accent)', wordBreak: 'break-all', cursor: 'pointer' }} onClick={() => copyUrl(genResult)}>{genResult}</div>
          </div>
        )}

        <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div className="section-label" style={{ marginBottom: 6 }}>Stats</div>
          <div style={{ color: 'var(--text-mid)', fontSize: 11 }}>{items.length} tracked images</div>
          <div style={{ color: 'var(--text-mid)', fontSize: 11 }}>{items.filter(i => i.note).length} with notes</div>
        </div>
      </div>

      {/* Right: Grid */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-lo)', pointerEvents: 'none' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search paths or notes…" style={{ width: '100%', paddingLeft: 30 }} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-lo)', marginTop: 60, fontSize: 13 }}>
              {items.length === 0 ? 'Export images from the Editor tab to track them here.' : 'No results.'}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {filtered.map(item => (
              <div key={item.path} className="card" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ width: '100%', height: 90, background: 'var(--bg-base)', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
                  <img src={item.rawUrl} alt={item.filename} loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  <div style={{ position: 'absolute', top: 5, right: 5 }}><StatusIcon path={item.path} /></div>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-hi)', wordBreak: 'break-all' }}>{item.filename}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-lo)', wordBreak: 'break-all', marginTop: 2 }}>{item.path}</div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {item.tags.map(t => <span key={t} className="tag">{t}</span>)}
                </div>

                {editNote === item.path ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <textarea value={noteVal} onChange={e => setNoteVal(e.target.value)} style={{ fontSize: 11, height: 56, resize: 'none', width: '100%' }} />
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button className="btn-primary" style={{ flex: 1, padding: '5px 0', fontSize: 11 }} onClick={() => { onUpdateNote(item.path, noteVal); setEditNote(null) }}>Save</button>
                      <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => setEditNote(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: item.note ? 'var(--text-mid)' : 'var(--text-lo)', fontStyle: item.note ? 'normal' : 'italic', cursor: 'pointer', minHeight: 18 }}
                    onClick={() => { setEditNote(item.path); setNoteVal(item.note) }}>
                    {item.note || 'Add note…'}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 5, marginTop: 'auto' }}>
                  <button className="btn-ghost" style={{ flex: 1, fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }} onClick={() => copyUrl(item.rawUrl)}>
                    <Copy size={11} /> Copy URL
                  </button>
                  <button className="btn-icon" onClick={() => checkStatus(item)}><ExternalLink size={12} /></button>
                  <button className="btn-icon" onClick={() => { setEditNote(item.path); setNoteVal(item.note) }}><MessageSquare size={12} /></button>
                  <button className="btn-icon danger" onClick={() => onRemove(item.path)}><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
