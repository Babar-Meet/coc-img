import { useState, useRef, useCallback } from 'react'
import { Upload, Image, Download, RotateCcw } from 'lucide-react'
import type { FolderPath, LibraryItem } from './types'
import { TH_LEVELS, makeRawUrl, randomId, sanitizeFilename } from './constants'
import Canvas from './Canvas'
import LayerPanel from './LayerPanel'
import { useLayers } from '../hooks/useLayers'

interface Props {
  onExported: (item: LibraryItem) => void
  categories: Record<string, { label: string; thPath: (th: string) => string; subs: string[] }>
}

export default function EditorTab({ onExported, categories }: Props) {
  const [baseImage, setBaseImage] = useState<string | null>(null)
  const [baseFilename, setBaseFilename] = useState('')
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { layers, selectedId, setSelectedId, addLayer, updateLayer, removeLayer, moveUp, moveDown, clearLayers } = useLayers()
  const [folder, setFolder] = useState<FolderPath>({ root: 'Bases_img/home_village_bases', th: 'TH_18', sub: 'Progress' })
  const [exporting, setExporting] = useState(false)
  const [exportNote, setExportNote] = useState('')
  const [lastExport, setLastExport] = useState<string | null>(null)

  const rootKeys = Object.keys(categories)
  const currentRoot = categories[folder.root] ?? Object.values(categories)[0]

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file || !file.type.startsWith('image/')) return
    setBaseFilename(file.name)
    setBaseImage(URL.createObjectURL(file))
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBaseFilename(file.name)
    setBaseImage(URL.createObjectURL(file))
  }, [])

  async function handleExport() {
    setExporting(true)
    try {
      await new Promise<void>(resolve => {
        const canvas = canvasRef.current!
        const ctx = canvas.getContext('2d')!
        ctx.clearRect(0, 0, 1600, 800)

        const drawBase = () => new Promise<void>(r => {
          if (!baseImage) { r(); return }
          const img = document.createElement('img'); img.src = baseImage
          img.onload = () => { ctx.drawImage(img, 0, 0, 1600, 800); r() }
          img.onerror = () => r()
        })

        drawBase().then(async () => {
          for (const l of layers) {
            if (!l.visible) continue
            await new Promise<void>(r => {
              const img = document.createElement('img'); img.src = l.src
              img.onload = () => {
                ctx.save(); ctx.globalAlpha = l.opacity
                ctx.translate(l.x + l.width/2, l.y + l.height/2)
                ctx.rotate(l.rotation * Math.PI / 180)
                ctx.scale(l.flipX ? -1 : 1, l.flipY ? -1 : 1)
                ctx.drawImage(img, -l.width/2, -l.height/2, l.width, l.height)
                ctx.restore(); r()
              }
              img.onerror = () => r()
            })
          }
          resolve()
        })
      })

      const canvas = canvasRef.current!
      const blob = await new Promise<Blob>(r => canvas.toBlob(b => r(b!), 'image/webp', 0.85))
      const stem = sanitizeFilename(baseFilename.replace(/\.[^.]+$/, '') || 'image')
      const filename = `${stem}_${randomId(6)}.webp`
      const folderPath = `${currentRoot.thPath(folder.th)}/${folder.sub}`
      const repoPath = `${folderPath}/${filename}`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)

      const rawUrl = makeRawUrl(repoPath)
      setLastExport(rawUrl)
      onExported({ path: repoPath, filename, rawUrl, note: exportNote, tags: [folder.th, folder.sub], addedAt: new Date().toISOString() })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Left: Layers */}
      <div className="panel" style={{ width: 230, flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <LayerPanel layers={layers} selectedId={selectedId} onSelect={setSelectedId}
          onAdd={addLayer} onUpdate={updateLayer} onRemove={removeLayer} onMoveUp={moveUp} onMoveDown={moveDown} />
      </div>

      {/* Center: Canvas */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!baseImage ? (
          <div onDrop={handleDrop} onDragOver={e => e.preventDefault()}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'var(--bg-base)', cursor: 'pointer' }}
            onClick={() => document.getElementById('baseFileInput')?.click()}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed var(--border)' }}>
              <Image size={36} color="var(--text-lo)" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--text-hi)', fontWeight: 600, marginBottom: 4 }}>Drop your screenshot here</div>
              <div style={{ color: 'var(--text-lo)', fontSize: 11 }}>or click to browse • PNG, JPG, WEBP</div>
            </div>
            <input id="baseFileInput" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileInput} />
          </div>
        ) : (
          <Canvas baseImage={baseImage} layers={layers} selectedId={selectedId}
            onSelect={setSelectedId} onUpdateLayer={updateLayer} canvasRef={canvasRef} />
        )}
      </div>

      {/* Right: Export */}
      <div className="panel" style={{ width: 220, flexShrink: 0, padding: 14, display: 'flex', flexDirection: 'column', gap: 14, borderLeft: '1px solid var(--border)', borderRight: 'none' }}>
        <div>
          <div className="section-label" style={{ marginBottom: 8 }}>Image</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn-ghost" style={{ display: 'flex', gap: 5, alignItems: 'center', flex: 1 }}
              onClick={() => document.getElementById('baseFileInput2')?.click()}>
              <Upload size={12} /> Load
            </button>
            <input id="baseFileInput2" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileInput} />
            {baseImage && <button className="btn-ghost" style={{ display: 'flex', gap: 5, alignItems: 'center' }}
              onClick={() => { setBaseImage(null); setBaseFilename(''); clearLayers() }}>
              <RotateCcw size={12} /> Reset
            </button>}
          </div>
          {baseFilename && <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-lo)', wordBreak: 'break-all' }}>{baseFilename}</div>}
        </div>

        <div>
          <div className="section-label" style={{ marginBottom: 8 }}>Export Destination</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'Category', value: folder.root, opts: rootKeys.map(k => ({ v: k, l: categories[k].label })), onChange: (v: string) => setFolder(f => ({ ...f, root: v, sub: categories[v]?.subs[0] || '' })) },
              { label: 'Town Hall', value: folder.th, opts: TH_LEVELS.map(t => ({ v: t, l: t.replace('_', ' ') })), onChange: (v: string) => setFolder(f => ({ ...f, th: v })) },
              { label: 'Sub-folder', value: folder.sub, opts: (currentRoot?.subs || []).map(s => ({ v: s, l: s })), onChange: (v: string) => setFolder(f => ({ ...f, sub: v })) },
            ].map(({ label, value, opts, onChange }) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: 'var(--text-mid)', marginBottom: 3 }}>{label}</div>
                <select value={value} onChange={e => onChange(e.target.value)}
                  style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-hi)', borderRadius: 6, padding: '5px 8px', fontSize: 11, width: '100%' }}>
                  {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
            ))}
            <div style={{ fontSize: 10, color: 'var(--text-lo)', wordBreak: 'break-all', marginTop: 2 }}>
              → {currentRoot?.thPath(folder.th)}/{folder.sub}/
            </div>
          </div>
        </div>

        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>Note</div>
          <textarea value={exportNote} onChange={e => setExportNote(e.target.value)}
            placeholder="e.g. anti-3star, strong vs Electro Dragons…"
            style={{ width: '100%', height: 72, resize: 'none', fontSize: 11 }} />
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn-primary" disabled={!baseImage || exporting} onClick={handleExport}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', padding: '10px 0' }}>
            <Download size={14} />
            {exporting ? 'Exporting…' : 'Export WebP'}
          </button>
          {lastExport && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--ok)', marginBottom: 4 }}>✓ Exported! Raw URL:</div>
              <div style={{ fontSize: 10, color: 'var(--accent)', wordBreak: 'break-all', cursor: 'pointer' }}
                onClick={() => navigator.clipboard.writeText(lastExport).catch(() => {})}>
                {lastExport}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-lo)', marginTop: 4 }}>Click to copy • then run push.bat</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
