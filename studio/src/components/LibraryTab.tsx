import { useState, useMemo } from 'react'
import {
  Search, Copy, ExternalLink, Trash2, MessageSquare,
  CheckCircle, XCircle, Loader, X, Check, ChevronDown,
} from 'lucide-react'
import type { LibraryItem, HttpStatus } from './types'
import { CATEGORY_ROOTS, TH_LEVELS, makeRawUrl } from './constants'

interface Props {
  items: LibraryItem[]
  onRemove: (path: string) => void
  onUpdateNote: (path: string, note: string) => void
  onUpdateTags: (path: string, tags: string[]) => void
}

// ── helpers ────────────────────────────────────────────────────────────────
function parsePath(path: string): { category: string; th: string; sub: string } {
  // e.g. "Bases_img/home_village_bases/TH_18/Progress/file.webp"
  const thMatch = path.match(/TH_(\d+)/)
  const th = thMatch ? `TH_${thMatch[1]}` : ''

  let category = ''
  for (const key of Object.keys(CATEGORY_ROOTS)) {
    if (path.startsWith(key)) {
      category = CATEGORY_ROOTS[key].label
      break
    }
  }

  // sub = segment after TH_xx
  const parts = path.split('/')
  const thIdx = parts.findIndex(p => /^TH_\d+$/.test(p))
  const sub = thIdx !== -1 && parts[thIdx + 1] ? parts[thIdx + 1] : ''

  return { category, th, sub }
}

function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  })
}

// ── small components ───────────────────────────────────────────────────────
function Badge({ label, color = 'var(--accent)' }: { label: string; color?: string }) {
  return (
    <span style={{
      background: color + '22', border: `1px solid ${color}44`,
      color, borderRadius: 4, padding: '1px 7px', fontSize: 10, fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function CopyFlash({ onCopy }: { onCopy: () => void }) {
  const [copied, setCopied] = useState(false)
  function handle() {
    onCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button className="btn-icon" onClick={handle} title="Copy" style={{ color: copied ? 'var(--ok)' : undefined }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  )
}

function StatusDot({ status }: { status: HttpStatus }) {
  if (status === 'checking') return <Loader size={11} style={{ color: 'var(--accent)' }} className="spin" />
  if (status === 'ok')       return <CheckCircle size={11} style={{ color: 'var(--ok)' }} />
  if (status === 'missing')  return <XCircle size={11} style={{ color: 'var(--danger)' }} />
  return null
}

// ── NoteEditor ─────────────────────────────────────────────────────────────
function NoteEditor({
  note, onSave,
}: { note: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(note)
  const [copied, setCopied] = useState(false)

  function save() { onSave(val); setEditing(false) }
  function cancel() { setVal(note); setEditing(false) }

  function copyNote() {
    copyText(note)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {editing ? (
        <>
          <textarea
            autoFocus
            value={val}
            onChange={e => setVal(e.target.value)}
            placeholder="Describe this base — creator, strategy, TH level, link…"
            style={{ fontSize: 11, height: 70, resize: 'vertical', width: '100%', lineHeight: 1.5 }}
          />
          <div style={{ display: 'flex', gap: 5 }}>
            <button className="btn-primary" style={{ flex: 1, padding: '5px 0', fontSize: 11 }} onClick={save}>
              <Check size={11} style={{ display: 'inline', marginRight: 4 }} />Save
            </button>
            <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }} onClick={cancel}>
              <X size={11} />
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
          <div
            onClick={() => { setVal(note); setEditing(true) }}
            style={{
              flex: 1, fontSize: 11, lineHeight: 1.5, cursor: 'pointer',
              color: note ? 'var(--text-mid)' : 'var(--text-lo)',
              fontStyle: note ? 'normal' : 'italic',
              minHeight: 20,
              borderBottom: '1px dashed var(--border)',
              paddingBottom: 2,
            }}
          >
            {note || 'Click to add description / notes…'}
          </div>
          {note && (
            <button
              className="btn-icon"
              onClick={copyNote}
              title="Copy description"
              style={{ flexShrink: 0, color: copied ? 'var(--ok)' : 'var(--text-lo)' }}
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </button>
          )}
          <button
            className="btn-icon"
            onClick={() => { setVal(note); setEditing(true) }}
            title="Edit description"
            style={{ flexShrink: 0, color: 'var(--text-lo)' }}
          >
            <MessageSquare size={11} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── FilterPill ─────────────────────────────────────────────────────────────
function Pill({
  label, active, onClick, onClear,
}: { label: string; active: boolean; onClick: () => void; onClear?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px',
        borderRadius: 20, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'var(--accent)22' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-lo)',
        fontSize: 11, fontWeight: active ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap',
        transition: 'all .15s',
      }}
    >
      {label}
      {active && onClear && (
        <X size={10} onClick={e => { e.stopPropagation(); onClear() }} style={{ cursor: 'pointer', opacity: 0.7 }} />
      )}
    </button>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function LibraryTab({ items, onRemove, onUpdateNote }: Props) {
  const [search, setSearch]           = useState('')
  const [filterCat, setFilterCat]     = useState<string | null>(null)
  const [filterTH, setFilterTH]       = useState<string | null>(null)
  const [filterSub, setFilterSub]     = useState<string | null>(null)
  const [filterHasNote, setFilterHasNote] = useState(false)
  const [statuses, setStatuses]       = useState<Record<string, HttpStatus>>({})

  // Quick URL generator state
  const [genRoot, setGenRoot]   = useState(Object.keys(CATEGORY_ROOTS)[0])
  const [genTH, setGenTH]       = useState('TH_18')
  const [genSub, setGenSub]     = useState(CATEGORY_ROOTS[Object.keys(CATEGORY_ROOTS)[0]].subs[0])
  const [genFile, setGenFile]   = useState('')
  const [genResult, setGenResult] = useState<string | null>(null)
  const [genCopied, setGenCopied] = useState(false)

  // Derive available filter options from actual data
  const allParsed = useMemo(() => items.map(i => ({ item: i, ...parsePath(i.path) })), [items])

  const availCats = useMemo(() => [...new Set(allParsed.map(p => p.category).filter(Boolean))], [allParsed])
  const availTHs  = useMemo(() => {
    const pool = filterCat ? allParsed.filter(p => p.category === filterCat) : allParsed
    return [...new Set(pool.map(p => p.th).filter(Boolean))].sort((a, b) => {
      const na = parseInt(a.replace('TH_', '')), nb = parseInt(b.replace('TH_', ''))
      return nb - na // newest TH first
    })
  }, [allParsed, filterCat])

  const availSubs = useMemo(() => {
    let pool = filterCat ? allParsed.filter(p => p.category === filterCat) : allParsed
    if (filterTH) pool = pool.filter(p => p.th === filterTH)
    return [...new Set(pool.map(p => p.sub).filter(Boolean))]
  }, [allParsed, filterCat, filterTH])

  // Apply all filters
  const filtered = useMemo(() => {
    return allParsed.filter(({ item, category, th, sub }) => {
      if (filterCat && category !== filterCat) return false
      if (filterTH  && th !== filterTH)        return false
      if (filterSub && sub !== filterSub)       return false
      if (filterHasNote && !item.note)          return false
      if (search) {
        const q = search.toLowerCase()
        if (!item.path.toLowerCase().includes(q) &&
            !item.note.toLowerCase().includes(q) &&
            !item.filename.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [allParsed, filterCat, filterTH, filterSub, filterHasNote, search])

  function clearFilters() {
    setFilterCat(null); setFilterTH(null); setFilterSub(null); setFilterHasNote(false); setSearch('')
  }

  async function checkStatus(item: LibraryItem) {
    setStatuses(s => ({ ...s, [item.path]: 'checking' }))
    try {
      const r = await fetch(item.rawUrl, { method: 'HEAD' })
      setStatuses(s => ({ ...s, [item.path]: r.ok ? 'ok' : 'missing' }))
    } catch {
      setStatuses(s => ({ ...s, [item.path]: 'missing' }))
    }
  }

  function generateQuickLink() {
    const root  = CATEGORY_ROOTS[genRoot]
    const fname = genFile.trim().replace(/\s+(\.\w+)$/, '$1')
    if (!fname) return
    const url = makeRawUrl(`${root.thPath(genTH)}/${genSub}/${fname}`)
    setGenResult(url)
    copyText(url)
    setGenCopied(true)
    setTimeout(() => setGenCopied(false), 2000)
  }

  const isFiltered = !!(filterCat || filterTH || filterSub || filterHasNote || search)

  // TH badge colour: higher TH = warmer
  function thColor(th: string): string {
    const n = parseInt(th.replace('TH_', ''))
    if (n >= 16) return '#ff6b35'
    if (n >= 13) return '#fbbf24'
    if (n >= 10) return '#34d399'
    return 'var(--accent)'
  }

  function subColor(sub: string): string {
    const map: Record<string, string> = {
      War: '#f87171', Farming: '#86efac', Progress: '#93c5fd',
      Art: '#c084fc', Rank: '#fbbf24', Simple: '#67e8f9',
    }
    return map[sub] ?? 'var(--text-mid)'
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

      {/* ── LEFT: Quick URL + Stats ───────────────────────────────── */}
      <div className="panel" style={{ width: 240, flexShrink: 0, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
        <div className="section-label">Quick Raw URL</div>

        {[
          {
            label: 'Category', value: genRoot,
            opts: Object.keys(CATEGORY_ROOTS).map(k => ({ v: k, l: CATEGORY_ROOTS[k].label })),
            onChange: (v: string) => { setGenRoot(v); setGenSub(CATEGORY_ROOTS[v].subs[0]); setGenResult(null) },
          },
          {
            label: 'TH Level', value: genTH,
            opts: TH_LEVELS.slice().reverse().map(t => ({ v: t, l: t.replace('_', ' ') })),
            onChange: (v: string) => { setGenTH(v); setGenResult(null) },
          },
          {
            label: 'Sub-folder', value: genSub,
            opts: CATEGORY_ROOTS[genRoot].subs.map(s => ({ v: s, l: s })),
            onChange: (v: string) => { setGenSub(v); setGenResult(null) },
          },
        ].map(({ label, value, opts, onChange }) => (
          <div key={label}>
            <div style={{ fontSize: 10, color: 'var(--text-lo)', marginBottom: 3 }}>{label}</div>
            <select value={value} onChange={e => onChange(e.target.value)}
              style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-hi)', borderRadius: 6, padding: '5px 8px', fontSize: 11, width: '100%' }}>
              {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
        ))}

        <div>
          <div style={{ fontSize: 10, color: 'var(--text-lo)', marginBottom: 3 }}>Filename</div>
          <input
            value={genFile} onChange={e => { setGenFile(e.target.value); setGenResult(null) }}
            placeholder="th18_progress_name_123.webp"
            style={{ width: '100%' }}
            onKeyDown={e => e.key === 'Enter' && generateQuickLink()}
          />
        </div>

        <button className="btn-primary" onClick={generateQuickLink} disabled={!genFile.trim()}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          {genCopied ? <Check size={12} /> : <Copy size={12} />}
          {genCopied ? 'Copied!' : 'Generate & Copy'}
        </button>

        {genResult && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--ok)', borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--ok)' }}>✓ Copied to clipboard</div>
            <div
              style={{ fontSize: 10, color: 'var(--accent)', wordBreak: 'break-all', cursor: 'pointer' }}
              onClick={() => copyText(genResult)}
            >
              {genResult}
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="section-label" style={{ marginBottom: 4 }}>Stats</div>
          <div style={{ color: 'var(--text-mid)', fontSize: 11 }}>{items.length} total images</div>
          <div style={{ color: 'var(--text-mid)', fontSize: 11 }}>{filtered.length} showing</div>
          <div style={{ color: 'var(--text-mid)', fontSize: 11 }}>{items.filter(i => i.note).length} with notes</div>
          {availCats.map(cat => (
            <div key={cat} style={{ color: 'var(--text-lo)', fontSize: 10 }}>
              {cat}: {allParsed.filter(p => p.category === cat).length}
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT: Filter bar + Grid ──────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Search + filter bar */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Search input */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-lo)', pointerEvents: 'none' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search filename, path, or notes…"
              style={{ width: '100%', paddingLeft: 30 }}
            />
          </div>

          {/* Filter pills row */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--text-lo)', marginRight: 2 }}>Filter:</span>

            {/* Category pills */}
            {availCats.map(cat => (
              <Pill key={cat}
                label={cat}
                active={filterCat === cat}
                onClick={() => { setFilterCat(filterCat === cat ? null : cat); setFilterTH(null); setFilterSub(null) }}
                onClear={() => { setFilterCat(null); setFilterTH(null); setFilterSub(null) }}
              />
            ))}

            {/* TH pills (only show if a category is chosen or items exist) */}
            {availTHs.length > 0 && (
              <span style={{ color: 'var(--border)', fontSize: 12 }}>|</span>
            )}
            {availTHs.map(th => (
              <Pill key={th}
                label={th.replace('_', ' ')}
                active={filterTH === th}
                onClick={() => { setFilterTH(filterTH === th ? null : th); setFilterSub(null) }}
                onClear={() => { setFilterTH(null); setFilterSub(null) }}
              />
            ))}

            {/* Sub-folder pills */}
            {availSubs.length > 0 && filterTH && (
              <span style={{ color: 'var(--border)', fontSize: 12 }}>|</span>
            )}
            {filterTH && availSubs.map(sub => (
              <Pill key={sub}
                label={sub}
                active={filterSub === sub}
                onClick={() => setFilterSub(filterSub === sub ? null : sub)}
                onClear={() => setFilterSub(null)}
              />
            ))}

            {/* Has note toggle */}
            <span style={{ color: 'var(--border)', fontSize: 12 }}>|</span>
            <Pill
              label="Has Notes"
              active={filterHasNote}
              onClick={() => setFilterHasNote(v => !v)}
              onClear={() => setFilterHasNote(false)}
            />

            {/* Clear all */}
            {isFiltered && (
              <button onClick={clearFilters} style={{
                marginLeft: 'auto', fontSize: 10, color: 'var(--text-lo)', background: 'none',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <X size={10} /> Clear all
              </button>
            )}
          </div>
        </div>

        {/* Image grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-lo)', marginTop: 60, fontSize: 13 }}>
              {items.length === 0
                ? 'No images yet. Export from the Editor tab to track them here.'
                : 'No images match the current filters.'}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {filtered.map(({ item, category, th, sub }) => (
              <div key={item.path} className="card" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>

                {/* Thumbnail */}
                <div style={{ width: '100%', aspectRatio: '2/1', background: 'var(--bg-base)', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
                  <img
                    src={item.rawUrl} alt={item.filename} loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  {/* Status dot top-right */}
                  <div style={{ position: 'absolute', top: 6, right: 6 }}>
                    <StatusDot status={statuses[item.path] ?? 'unchecked'} />
                  </div>
                  {/* Date badge bottom-left */}
                  <div style={{
                    position: 'absolute', bottom: 5, left: 5,
                    background: '#00000088', borderRadius: 4, padding: '2px 6px',
                    fontSize: 9, color: '#ffffffaa',
                  }}>
                    {new Date(item.addedAt).toLocaleDateString()}
                  </div>
                </div>

                {/* Filename + path */}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-hi)', wordBreak: 'break-all' }}>
                    {item.filename}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-lo)', wordBreak: 'break-all', marginTop: 2 }}>
                    {item.path}
                  </div>
                </div>

                {/* Info badges */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {category && <Badge label={category} color="var(--accent)" />}
                  {th        && <Badge label={th.replace('_', ' ')} color={thColor(th)} />}
                  {sub       && <Badge label={sub} color={subColor(sub)} />}
                  {item.tags.filter(t => !['war','farming','progress','art','rank','simple'].includes(t.toLowerCase()))
                    .map(t => <Badge key={t} label={t} color="var(--text-mid)" />)}
                </div>

                {/* Note / description editor */}
                <NoteEditor note={item.note} onSave={v => onUpdateNote(item.path, v)} />

                {/* Action bar */}
                <div style={{ display: 'flex', gap: 5, marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  <button
                    className="btn-ghost"
                    style={{ flex: 1, fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}
                    onClick={() => copyText(item.rawUrl)}
                  >
                    <Copy size={11} /> Copy URL
                  </button>
                  <button className="btn-icon" title="Check CDN status" onClick={() => checkStatus(item)}>
                    <ExternalLink size={12} />
                  </button>
                  <button className="btn-icon danger" title="Remove from library" onClick={() => onRemove(item.path)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
