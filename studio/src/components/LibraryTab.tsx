import { useState, useMemo } from 'react'
import {
  Search, Copy, ExternalLink, Trash2, MessageSquare,
  CheckCircle, XCircle, Loader, X, Check, RefreshCw, Plus, FolderPlus,
} from 'lucide-react'
import type { LibraryItem, HttpStatus } from './types'
import type { FetchState } from '../hooks/useLibrary'
import type { CategoryDef } from '../hooks/useCategories'
import { TH_LEVELS, makeRawUrl } from './constants'

interface CategoriesHandle {
  all: CategoryDef[]
  addCategory: (def: Omit<CategoryDef, 'builtin'>) => void
  removeCategory: (key: string) => void
  toCategoryRoots: () => Record<string, { label: string; thPath: (th: string) => string; subs: string[] }>
}

interface Props {
  items: LibraryItem[]
  onRemove: (path: string) => void
  onUpdateNote: (path: string, note: string) => void
  onUpdateTags: (path: string, tags: string[]) => void
  fetchState: FetchState
  fetchError: string | null
  lastFetched: string | null
  onRefetch: () => void
  categories: CategoriesHandle
}

// ── Helpers ────────────────────────────────────────────────────────────────
function parsePath(path: string, catKeys: string[]): { category: string; th: string; sub: string } {
  const thMatch = path.match(/TH_(\d+)/)
  const th = thMatch ? `TH_${thMatch[1]}` : ''
  let category = ''
  for (const key of catKeys) {
    if (path.startsWith(key)) { category = key; break }
  }
  const parts = path.split('/')
  const thIdx = parts.findIndex(p => /^TH_\d+$/.test(p))
  const sub = thIdx !== -1 && parts[thIdx + 1] ? parts[thIdx + 1] : ''
  return { category, th, sub }
}

function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
  })
}

function thColor(th: string) {
  const n = parseInt(th.replace('TH_', ''))
  if (n >= 16) return '#ff6b35'
  if (n >= 13) return '#fbbf24'
  if (n >= 10) return '#34d399'
  return 'var(--accent)'
}
function subColor(sub: string) {
  const map: Record<string, string> = {
    War: '#f87171', Farming: '#86efac', Progress: '#93c5fd',
    Art: '#c084fc', Rank: '#fbbf24', Simple: '#67e8f9',
  }
  return map[sub] ?? 'var(--text-mid)'
}

// ── Badge ──────────────────────────────────────────────────────────────────
function Badge({ label, color = 'var(--accent)' }: { label: string; color?: string }) {
  return (
    <span style={{
      background: color + '22', borderWidth: 1, borderStyle: 'solid', borderColor: color + '44',
      color, borderRadius: 4, padding: '1px 7px', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

// ── NoteEditor ─────────────────────────────────────────────────────────────
function NoteEditor({ note, onSave }: { note: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(note)
  const [copied, setCopied] = useState(false)

  function save() { onSave(val); setEditing(false) }
  function cancel() { setVal(note); setEditing(false) }
  function copyNote() { copyText(note); setCopied(true); setTimeout(() => setCopied(false), 1500) }

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <textarea autoFocus value={val} onChange={e => setVal(e.target.value)}
          placeholder="Base description, strategy, creator, source link…"
          style={{ fontSize: 11, height: 70, resize: 'vertical', width: '100%', lineHeight: 1.5 }} />
        <div style={{ display: 'flex', gap: 5 }}>
          <button className="btn-primary" style={{ flex: 1, padding: '5px 0', fontSize: 11 }} onClick={save}>
            <Check size={11} style={{ display: 'inline', marginRight: 4 }} />Save
          </button>
          <button className="btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }} onClick={cancel}>
            <X size={11} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
      <div onClick={() => { setVal(note); setEditing(true) }} style={{
        flex: 1, fontSize: 11, lineHeight: 1.5, cursor: 'pointer', minHeight: 20,
        color: note ? 'var(--text-mid)' : 'var(--text-lo)',
        fontStyle: note ? 'normal' : 'italic',
        borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0,
        borderBottomWidth: 1, borderBottomStyle: 'dashed', borderBottomColor: 'var(--border)',
        paddingBottom: 2,
      }}>
        {note || 'Click to add notes / description…'}
      </div>
      {note && (
        <button className="btn-icon" onClick={copyNote} title="Copy notes"
          style={{ flexShrink: 0, color: copied ? 'var(--ok)' : 'var(--text-lo)' }}>
          {copied ? <Check size={11} /> : <Copy size={11} />}
        </button>
      )}
      <button className="btn-icon" onClick={() => { setVal(note); setEditing(true) }}
        title="Edit notes" style={{ flexShrink: 0, color: 'var(--text-lo)' }}>
        <MessageSquare size={11} />
      </button>
    </div>
  )
}

// ── Pill filter ────────────────────────────────────────────────────────────
function Pill({ label, active, onClick, onClear }: {
  label: string; active: boolean; onClick: () => void; onClear?: () => void
}) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px',
      borderRadius: 20, borderWidth: 1, borderStyle: 'solid',
      borderColor: active ? 'var(--accent)' : 'var(--border)',
      background: active ? 'var(--accent)22' : 'transparent',
      color: active ? 'var(--accent)' : 'var(--text-lo)',
      fontSize: 11, fontWeight: active ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap',
      transition: 'all .15s',
    }}>
      {label}
      {active && onClear && (
        <X size={10} onClick={e => { e.stopPropagation(); onClear() }} style={{ cursor: 'pointer', opacity: .7 }} />
      )}
    </button>
  )
}

// ── Add Category Modal ─────────────────────────────────────────────────────
function AddCategoryModal({ onAdd, onClose }: {
  onAdd: (def: Omit<CategoryDef, 'builtin'>) => void
  onClose: () => void
}) {
  const [label, setLabel]   = useState('')
  const [key, setKey]       = useState('')
  const [thPath, setThPath] = useState('')
  const [subs, setSubs]     = useState('War, Farming, Progress')

  function autoKey(l: string) {
    return l.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_/]/g, '')
  }
  function handleLabelChange(v: string) {
    setLabel(v)
    if (!key) setKey(autoKey(v) + '_img')
    if (!thPath) setThPath(autoKey(v) + '_img/{TH}')
  }

  function submit() {
    if (!label.trim() || !key.trim() || !thPath.trim()) return
    onAdd({
      key: key.trim(),
      label: label.trim(),
      thPath: thPath.trim(),
      subs: subs.split(',').map(s => s.trim()).filter(Boolean),
    })
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#00000088',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-panel)', borderRadius: 10, padding: 24, width: 400,
        borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)',
        display: 'flex', flexDirection: 'column', gap: 14,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-hi)' }}>Add Category</div>
          <button className="btn-icon" onClick={onClose}><X size={14} /></button>
        </div>

        {[
          { label: 'Display Name', value: label, onChange: handleLabelChange, placeholder: 'e.g. Clan Capital Bases' },
          { label: 'Repo Path Key (prefix)', value: key, onChange: setKey, placeholder: 'e.g. clan_capital_img' },
          { label: 'TH Path Template (use {TH})', value: thPath, onChange: setThPath, placeholder: 'e.g. clan_capital_img/{TH}' },
          { label: 'Sub-folders (comma-separated)', value: subs, onChange: setSubs, placeholder: 'e.g. War, Farming, Progress' },
        ].map(f => (
          <div key={f.label}>
            <div style={{ fontSize: 11, color: 'var(--text-lo)', marginBottom: 4 }}>{f.label}</div>
            <input value={f.value} onChange={e => f.onChange(e.target.value)}
              placeholder={f.placeholder} style={{ width: '100%' }} />
          </div>
        ))}

        <div style={{ fontSize: 10, color: 'var(--text-lo)', background: 'var(--bg-card)', borderRadius: 6, padding: 8 }}>
          Preview path: <span style={{ color: 'var(--accent)' }}>{thPath.replace('{TH}', 'TH_18')}/Progress/filename.webp</span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button className="btn-primary" style={{ flex: 1 }} onClick={submit}
            disabled={!label.trim() || !key.trim() || !thPath.trim()}>
            <Plus size={12} style={{ display: 'inline', marginRight: 6 }} />Add Category
          </button>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function LibraryTab({
  items, onRemove, onUpdateNote, onUpdateTags,
  fetchState, fetchError, lastFetched, onRefetch,
  categories,
}: Props) {
  const catRoots       = categories.toCategoryRoots()
  const catKeys        = Object.keys(catRoots)

  const [search, setSearch]           = useState('')
  const [filterCat, setFilterCat]     = useState<string | null>(null)
  const [filterTH, setFilterTH]       = useState<string | null>(null)
  const [filterSub, setFilterSub]     = useState<string | null>(null)
  const [filterHasNote, setFilterHasNote] = useState(false)
  const [statuses, setStatuses]       = useState<Record<string, HttpStatus>>({})
  const [showAddCat, setShowAddCat]   = useState(false)

  // Quick URL state
  const [genRoot, setGenRoot]     = useState(catKeys[0] ?? '')
  const [genTH, setGenTH]         = useState('TH_18')
  const [genSub, setGenSub]       = useState(catRoots[catKeys[0]]?.subs[0] ?? '')
  const [genFile, setGenFile]     = useState('')
  const [genResult, setGenResult] = useState<string | null>(null)
  const [genCopied, setGenCopied] = useState(false)

  const allParsed = useMemo(
    () => items.map(i => ({ item: i, ...parsePath(i.path, catKeys) })),
    [items, catKeys]
  )

  const availCats = useMemo(
    () => [...new Set(allParsed.map(p => p.category).filter(Boolean))],
    [allParsed]
  )
  const availTHs = useMemo(() => {
    const pool = filterCat ? allParsed.filter(p => p.category === filterCat) : allParsed
    return [...new Set(pool.map(p => p.th).filter(Boolean))].sort(
      (a, b) => parseInt(b.replace('TH_', '')) - parseInt(a.replace('TH_', ''))
    )
  }, [allParsed, filterCat])

  const availSubs = useMemo(() => {
    let pool = filterCat ? allParsed.filter(p => p.category === filterCat) : allParsed
    if (filterTH) pool = pool.filter(p => p.th === filterTH)
    return [...new Set(pool.map(p => p.sub).filter(Boolean))]
  }, [allParsed, filterCat, filterTH])

  const filtered = useMemo(() => allParsed.filter(({ item, category, th, sub }) => {
    if (filterCat     && category !== filterCat) return false
    if (filterTH      && th !== filterTH)        return false
    if (filterSub     && sub !== filterSub)      return false
    if (filterHasNote && !item.note)             return false
    if (search) {
      const q = search.toLowerCase()
      return item.path.toLowerCase().includes(q) ||
             item.note.toLowerCase().includes(q) ||
             item.filename.toLowerCase().includes(q)
    }
    return true
  }), [allParsed, filterCat, filterTH, filterSub, filterHasNote, search])

  const isFiltered = !!(filterCat || filterTH || filterSub || filterHasNote || search)

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
    const fname = genFile.trim().replace(/\s+(\.\w+)$/, '$1')
    if (!fname || !genRoot) return
    const url = makeRawUrl(`${catRoots[genRoot].thPath(genTH)}/${genSub}/${fname}`)
    setGenResult(url); copyText(url)
    setGenCopied(true); setTimeout(() => setGenCopied(false), 2000)
  }

  return (
    <>
      {showAddCat && (
        <AddCategoryModal
          onAdd={categories.addCategory}
          onClose={() => setShowAddCat(false)}
        />
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── LEFT: Quick URL + Categories ──────────────────────── */}
        <div className="panel" style={{ width: 250, flexShrink: 0, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>

          {/* Quick URL Generator */}
          <div className="section-label">Quick Raw URL</div>

          {([
            {
              label: 'Category', value: genRoot,
              opts: catKeys.map(k => ({ v: k, l: catRoots[k].label })),
              onChange: (v: string) => { setGenRoot(v); setGenSub(catRoots[v]?.subs[0] ?? ''); setGenResult(null) },
            },
            {
              label: 'TH Level', value: genTH,
              opts: TH_LEVELS.slice().reverse().map(t => ({ v: t, l: t.replace('_', ' ') })),
              onChange: (v: string) => { setGenTH(v); setGenResult(null) },
            },
            {
              label: 'Sub-folder', value: genSub,
              opts: (catRoots[genRoot]?.subs ?? []).map(s => ({ v: s, l: s })),
              onChange: (v: string) => { setGenSub(v); setGenResult(null) },
            },
          ] as const).map(({ label, value, opts, onChange }) => (
            <div key={label}>
              <div style={{ fontSize: 10, color: 'var(--text-lo)', marginBottom: 3 }}>{label}</div>
              <select value={value} onChange={e => (onChange as (v: string) => void)(e.target.value)}
                style={{ background: 'var(--bg-base)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', color: 'var(--text-hi)', borderRadius: 6, padding: '5px 8px', fontSize: 11, width: '100%' }}>
                {(opts as { v: string; l: string }[]).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
          ))}

          <div>
            <div style={{ fontSize: 10, color: 'var(--text-lo)', marginBottom: 3 }}>Filename</div>
            <input value={genFile} onChange={e => { setGenFile(e.target.value); setGenResult(null) }}
              placeholder="th18_progress_name_123.webp" style={{ width: '100%' }}
              onKeyDown={e => e.key === 'Enter' && generateQuickLink()} />
          </div>

          <button className="btn-primary" onClick={generateQuickLink} disabled={!genFile.trim() || !genRoot}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            {genCopied ? <Check size={12} /> : <Copy size={12} />}
            {genCopied ? 'Copied!' : 'Generate & Copy'}
          </button>

          {genResult && (
            <div style={{ background: 'var(--bg-card)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--ok)', borderRadius: 6, padding: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--ok)', marginBottom: 4 }}>✓ Copied to clipboard</div>
              <div style={{ fontSize: 10, color: 'var(--accent)', wordBreak: 'break-all', cursor: 'pointer' }}
                onClick={() => copyText(genResult)}>{genResult}</div>
            </div>
          )}

          {/* Category Manager */}
          <div style={{ marginTop: 10, borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: 'var(--border)', paddingTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="section-label" style={{ margin: 0 }}>Categories</div>
              <button className="btn-icon" onClick={() => setShowAddCat(true)} title="Add category"
                style={{ color: 'var(--accent)' }}>
                <FolderPlus size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {categories.all.map(cat => (
                <div key={cat.key} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
                  background: 'var(--bg-card)', borderRadius: 6,
                  borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-hi)' }}>{cat.label}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-lo)', marginTop: 1 }}>{cat.subs.join(' · ')}</div>
                  </div>
                  {cat.builtin ? (
                    <span style={{ fontSize: 9, color: 'var(--text-lo)', opacity: .6 }}>built-in</span>
                  ) : (
                    <button className="btn-icon danger" onClick={() => categories.removeCategory(cat.key)} title="Remove category">
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button className="btn-ghost" onClick={() => setShowAddCat(true)}
              style={{ width: '100%', marginTop: 6, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Plus size={12} /> Add Category
            </button>
          </div>

          {/* Stats */}
          <div style={{ borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: 'var(--border)', paddingTop: 12 }}>
            <div className="section-label" style={{ marginBottom: 6 }}>Stats</div>
            <div style={{ color: 'var(--text-mid)', fontSize: 11 }}>{items.length} total images</div>
            <div style={{ color: 'var(--text-mid)', fontSize: 11 }}>{filtered.length} showing</div>
            <div style={{ color: 'var(--text-mid)', fontSize: 11, marginTop: 2 }}>{items.filter(i => i.note).length} with notes</div>
            {lastFetched && (
              <div style={{ color: 'var(--text-lo)', fontSize: 9, marginTop: 6 }}>Synced at {lastFetched}</div>
            )}
          </div>
        </div>

        {/* ── RIGHT ────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Fetch status bar */}
          {(fetchState === 'loading' || fetchState === 'error') && (
            <div style={{
              padding: '6px 14px', fontSize: 11,
              background: fetchState === 'error' ? '#f8717122' : 'var(--accent)11',
              borderBottomWidth: 1, borderBottomStyle: 'solid',
              borderBottomColor: fetchState === 'error' ? '#f87171' : 'var(--accent)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {fetchState === 'loading'
                ? <><Loader size={12} className="spin" style={{ color: 'var(--accent)' }} /> Fetching images from GitHub…</>
                : <><XCircle size={12} style={{ color: '#f87171' }} /> {fetchError}
                    <button className="btn-ghost" style={{ marginLeft: 'auto', fontSize: 11 }} onClick={onRefetch}>Retry</button>
                  </>
              }
            </div>
          )}

          {/* Search + filter bar */}
          <div style={{ padding: '10px 14px', borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: 'var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-lo)', pointerEvents: 'none' }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search filename, path, or notes…"
                  style={{ width: '100%', paddingLeft: 30 }} />
              </div>
              <button className="btn-icon" onClick={onRefetch} title="Refresh from GitHub"
                style={{ color: fetchState === 'loading' ? 'var(--accent)' : 'var(--text-lo)' }}>
                <RefreshCw size={14} className={fetchState === 'loading' ? 'spin' : ''} />
              </button>
            </div>

            {/* Filter pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'var(--text-lo)', marginRight: 2 }}>Filter:</span>

              {availCats.map(catKey => (
                <Pill key={catKey}
                  label={catRoots[catKey]?.label ?? catKey}
                  active={filterCat === catKey}
                  onClick={() => { setFilterCat(filterCat === catKey ? null : catKey); setFilterTH(null); setFilterSub(null) }}
                  onClear={() => { setFilterCat(null); setFilterTH(null); setFilterSub(null) }} />
              ))}

              {availTHs.length > 0 && <span style={{ color: 'var(--border)', fontSize: 12 }}>|</span>}
              {availTHs.map(th => (
                <Pill key={th} label={th.replace('_', ' ')} active={filterTH === th}
                  onClick={() => { setFilterTH(filterTH === th ? null : th); setFilterSub(null) }}
                  onClear={() => { setFilterTH(null); setFilterSub(null) }} />
              ))}

              {filterTH && availSubs.length > 0 && <span style={{ color: 'var(--border)', fontSize: 12 }}>|</span>}
              {filterTH && availSubs.map(sub => (
                <Pill key={sub} label={sub} active={filterSub === sub}
                  onClick={() => setFilterSub(filterSub === sub ? null : sub)}
                  onClear={() => setFilterSub(null)} />
              ))}

              <span style={{ color: 'var(--border)', fontSize: 12 }}>|</span>
              <Pill label="Has Notes" active={filterHasNote}
                onClick={() => setFilterHasNote(v => !v)}
                onClear={() => setFilterHasNote(false)} />

              {isFiltered && (
                <button onClick={clearFilters} style={{
                  marginLeft: 'auto', fontSize: 10, color: 'var(--text-lo)',
                  background: 'none', borderWidth: 0, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <X size={10} /> Clear all
                </button>
              )}
            </div>
          </div>

          {/* Grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            {fetchState === 'loading' && items.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-lo)', marginTop: 80 }}>
                <Loader size={28} className="spin" style={{ color: 'var(--accent)', margin: '0 auto 12px', display: 'block' }} />
                <div style={{ fontSize: 13 }}>Loading all images from GitHub…</div>
              </div>
            )}

            {fetchState !== 'loading' && filtered.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-lo)', marginTop: 60, fontSize: 13 }}>
                {items.length === 0
                  ? 'No images found. Click ↻ to refresh from GitHub.'
                  : 'No images match the current filters.'}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {filtered.map(({ item, category, th, sub }) => (
                <div key={item.path} className="card" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>

                  {/* Thumbnail 2:1 */}
                  <div style={{ width: '100%', aspectRatio: '2 / 1', background: 'var(--bg-base)', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
                    <img src={item.rawUrl} alt={item.filename} loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    <div style={{ position: 'absolute', top: 6, right: 6 }}>
                      {statuses[item.path] === 'checking' && <Loader size={12} className="spin" style={{ color: 'var(--accent)' }} />}
                      {statuses[item.path] === 'ok'       && <CheckCircle size={12} style={{ color: 'var(--ok)' }} />}
                      {statuses[item.path] === 'missing'  && <XCircle size={12} style={{ color: 'var(--danger)' }} />}
                    </div>
                    <div style={{ position: 'absolute', bottom: 5, left: 5, background: '#00000088', borderRadius: 4, padding: '1px 6px', fontSize: 9, color: '#ffffffaa' }}>
                      {new Date(item.addedAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Info */}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-hi)', wordBreak: 'break-all' }}>{item.filename}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-lo)', wordBreak: 'break-all', marginTop: 2 }}>{item.path}</div>
                  </div>

                  {/* Badges */}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {category && <Badge label={catRoots[category]?.label ?? category} color="var(--accent)" />}
                    {th        && <Badge label={th.replace('_', ' ')} color={thColor(th)} />}
                    {sub       && <Badge label={sub} color={subColor(sub)} />}
                  </div>

                  {/* Notes */}
                  <NoteEditor note={item.note} onSave={v => onUpdateNote(item.path, v)} />

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 5, marginTop: 'auto', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: 'var(--border)', paddingTop: 8 }}>
                    <button className="btn-ghost"
                      style={{ flex: 1, fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}
                      onClick={() => copyText(item.rawUrl)}>
                      <Copy size={11} /> Copy URL
                    </button>
                    <button className="btn-icon" title="Check CDN" onClick={() => checkStatus(item)}>
                      <ExternalLink size={12} />
                    </button>
                    <button className="btn-icon danger" title="Remove" onClick={() => onRemove(item.path)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
