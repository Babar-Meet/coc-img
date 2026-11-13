import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Download, Image, Loader, RotateCcw, Upload } from 'lucide-react'
import type { CanvasTool, FolderPath, LibraryItem, PhotoTransform, SavedWatermarkLayer, Selection, WatermarkLayer } from './types'
import { ALLOWED_CATEGORIES, CANVAS_H, CANVAS_W, TH_LEVELS, makeRawUrl, randomId, sanitizeFilename } from './constants'
import Canvas from './Canvas'
import LayerPanel from './LayerPanel'
import NumberField from './NumberField'
import PublishCard from './PublishCard'
import { useLayers } from '../hooks/useLayers'
import { useEditorHistory } from '../hooks/useEditorHistory'
import { useWatermarkPreset } from '../hooks/useWatermarkPreset'
import { usePublish } from '../hooks/usePublish'
import { encodeScene, preloadImage } from './scene'
import {
  clampPhotoPosition, containPlacement, coverPlacement,
  PHOTO_SCALE_MAX, PHOTO_SCALE_MIN, photoScalePercent, scalePhotoTo,
} from './canvasMath'

interface Props {
  onExported: (item: LibraryItem) => void
  categories: Record<string, { label: string; thPath: (th: string) => string; subs: string[] }>
}

/** Everything undo/redo restores. */
interface EditorSnapshot {
  photo: PhotoTransform | null
  layers: WatermarkLayer[]
  selectedId: string | null
  photoSelected: boolean
  sourceName: string
  stem: string
}

function sourceStemOf(filename: string): string {
  return sanitizeFilename(filename.replace(/\.[^./\\]+$/, ''))
}

function toSavedWatermark(layer: WatermarkLayer): SavedWatermarkLayer {
  return {
    src: layer.src, label: layer.label,
    x: layer.x, y: layer.y, width: layer.width, height: layer.height,
    rotation: layer.rotation, opacity: layer.opacity,
    flipX: layer.flipX, flipY: layer.flipY, lockAspect: layer.lockAspect,
  }
}

export default function EditorTab({ onExported, categories }: Props) {
  const [photo, setPhoto] = useState<PhotoTransform | null>(null)
  const [sourceName, setSourceName] = useState('')
  const [stem, setStem] = useState('image')
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadInfo, setDownloadInfo] = useState<{ filename: string; rawUrl: string } | null>(null)
  const [photoSelected, setPhotoSelected] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const objectUrlsRef = useRef<string[]>([])
  const publishedRef = useRef<string | null>(null)

  const { layers, selectedId, setSelectedId, addLayer, updateLayer, removeLayer, moveUp, moveDown, clearLayers, replaceLayers } = useLayers()
  const [tool, setTool] = useState<CanvasTool>('select')
  const [folder, setFolder] = useState<FolderPath>({ root: 'Bases_img/home_village_bases', th: 'TH_18', sub: 'Progress' })
  const [exportNote, setExportNote] = useState('')
  const publish = usePublish()
  const { preset, save: saveTemplate, clear: clearTemplate } = useWatermarkPreset()

  const updatePhoto = useCallback((patch: Partial<PhotoTransform>) => {
    setPhoto(prev => {
      if (!prev) return prev
      const merged = { ...prev, ...patch }
      const clamped = clampPhotoPosition(merged)
      return { ...merged, x: clamped.x, y: clamped.y }
    })
  }, [])

  // Undo/redo snapshots (S14)
  const restoreSnapshot = useCallback((snapshot: EditorSnapshot) => {
    setPhoto(snapshot.photo)
    replaceLayers(snapshot.layers)
    const nextSelected = snapshot.selectedId && snapshot.layers.some(layer => layer.id === snapshot.selectedId) ? snapshot.selectedId : null
    setSelectedId(nextSelected)
    setPhotoSelected(Boolean(snapshot.photo && !nextSelected && snapshot.photoSelected))
    setSourceName(snapshot.sourceName)
    setStem(snapshot.stem)
  }, [replaceLayers, setSelectedId])

  const { push: pushHistory, undo, redo, cancelLast, canUndo, canRedo } = useEditorHistory(
    () => ({ photo, layers, selectedId, photoSelected, sourceName, stem }),
    restoreSnapshot,
  )
  const dragHistoryRef = useRef(false)

  const endGesture = useCallback(() => { dragHistoryRef.current = false }, [])
  const beginGesture = useCallback(() => { dragHistoryRef.current = false }, [])
  const cancelGesture = useCallback(() => {
    if (!dragHistoryRef.current) return
    dragHistoryRef.current = false
    cancelLast()
  }, [cancelLast])

  const updateLayerFromCanvas = useCallback((id: string, patch: Partial<WatermarkLayer>) => {
    if (!dragHistoryRef.current) { pushHistory(); dragHistoryRef.current = true }
    updateLayer(id, patch)
  }, [pushHistory, updateLayer])

  const updatePhotoFromCanvas = useCallback((patch: Partial<PhotoTransform>) => {
    if (!dragHistoryRef.current) { pushHistory(); dragHistoryRef.current = true }
    updatePhoto(patch)
  }, [pushHistory, updatePhoto])

  const updateLayerFromPanel = useCallback((id: string, patch: Partial<WatermarkLayer>) => {
    pushHistory()
    updateLayer(id, patch)
  }, [pushHistory, updateLayer])

  const updatePhotoFromPanel = useCallback((patch: Partial<PhotoTransform>) => {
    pushHistory()
    updatePhoto(patch)
  }, [pushHistory, updatePhoto])

  const addWatermark = useCallback((src: string, label: string) => {
    pushHistory()
    setPhotoSelected(false)
    void addLayer(src, label)
  }, [pushHistory, addLayer])

  const removeWatermark = useCallback((id: string) => { pushHistory(); removeLayer(id) }, [pushHistory, removeLayer])
  const moveUpWithHistory = useCallback((id: string) => { pushHistory(); moveUp(id) }, [pushHistory, moveUp])
  const moveDownWithHistory = useCallback((id: string) => { pushHistory(); moveDown(id) }, [pushHistory, moveDown])

  const undoEdit = useCallback(() => { if (!dragHistoryRef.current) undo() }, [undo])
  const redoEdit = useCallback(() => { if (!dragHistoryRef.current) redo() }, [redo])

  // Saved watermark template (S15)
  const canSaveTemplate = layers.some(layer => layer.visible)

  const applyWatermarkTemplate = useCallback(() => {
    if (!preset) return
    pushHistory()
    const next: WatermarkLayer[] = preset.layers.map(saved => {
      const initial = { x: saved.x, y: saved.y, width: saved.width, height: saved.height, rotation: saved.rotation, opacity: saved.opacity }
      return {
        id: randomId(8), src: saved.src, label: saved.label, ...initial,
        visible: true, flipX: saved.flipX, flipY: saved.flipY, lockAspect: saved.lockAspect, initial,
      }
    })
    replaceLayers(next)
    setSelectedId(next.length ? next[next.length - 1].id : null)
    setPhotoSelected(false)
  }, [preset, pushHistory, replaceLayers, setSelectedId])

  const saveWatermarkTemplate = useCallback(() => {
    const visible = layers.filter(layer => layer.visible)
    if (!visible.length) return
    saveTemplate(visible.map(toSavedWatermark))
  }, [layers, saveTemplate])

  const clearWatermarkTemplate = useCallback(() => clearTemplate(), [clearTemplate])

  useEffect(() => () => {
    for (const url of objectUrlsRef.current) URL.revokeObjectURL(url)
    objectUrlsRef.current = []
  }, [])

  // Ctrl+Z / Ctrl+Y (or Cmd), plus V = Select, H = Move (S11, S14)
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (event.target instanceof HTMLElement && event.target.isContentEditable) return
      if (event.ctrlKey || event.metaKey) {
        const key = event.key.toLowerCase()
        if (key === 'z') {
          event.preventDefault()
          if (event.shiftKey) redoEdit()
          else undoEdit()
        } else if (key === 'y') {
          event.preventDefault()
          redoEdit()
        }
        return
      }
      if (event.altKey) return
      if (event.key === 'v' || event.key === 'V') setTool('select')
      if (event.key === 'h' || event.key === 'H') setTool('move')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undoEdit, redoEdit])

  const rootKeys = Object.keys(categories)
  const currentRoot = categories[folder.root] ?? (rootKeys.length ? categories[rootKeys[0]] : undefined)
  const folderPath = currentRoot ? `${currentRoot.thPath(folder.th)}/${folder.sub}` : ''

  const allowedCategory = ALLOWED_CATEGORIES[folder.root]
  const publishDestination = allowedCategory
    && TH_LEVELS.includes(folder.th)
    && allowedCategory.subs.includes(folder.sub)
    ? { category: folder.root, th: folder.th, sub: folder.sub }
    : null

  const selection: Selection = selectedId ? { kind: 'layer', id: selectedId } : photoSelected && photo ? { kind: 'photo' } : null

  const selectLayer = useCallback((id: string) => { setSelectedId(id); setPhotoSelected(false) }, [setSelectedId])
  const selectPhoto = useCallback(() => { setSelectedId(null); setPhotoSelected(true) }, [setSelectedId])
  const deselect = useCallback(() => { setSelectedId(null); setPhotoSelected(false) }, [setSelectedId])

  const finalStem = sanitizeFilename(stem.trim() || sourceStemOf(sourceName))

  const loadFile = useCallback(async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setPhotoError('That file is not an image. Choose a PNG, JPG or WebP screenshot.')
      return
    }
    setLoading(true)
    setPhotoError(null)
    const url = URL.createObjectURL(file)
    const image = await preloadImage(url)
    if (!image || !image.naturalWidth || !image.naturalHeight) {
      URL.revokeObjectURL(url)
      setLoading(false)
      setPhotoError('Could not read that image. Try a PNG or JPG screenshot.')
      return
    }
    pushHistory()
    objectUrlsRef.current.push(url)
    const placement = coverPlacement(image.naturalWidth, image.naturalHeight)
    setPhoto({ src: url, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, ...placement })
    setSourceName(file.name)
    setStem(sourceStemOf(file.name))
    setSelectedId(null)
    setPhotoSelected(true)
    setDownloadInfo(null)
    publishedRef.current = null
    publish.reset()
    setLoading(false)
  }, [publish, pushHistory, setSelectedId])

  const handleFileInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    void loadFile(file)
  }, [loadFile])

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    void loadFile(event.dataTransfer.files[0])
  }, [loadFile])

  function handleFill() {
    if (!photo) return
    pushHistory()
    setPhoto(prev => prev ? { ...prev, ...coverPlacement(prev.naturalWidth, prev.naturalHeight) } : prev)
  }

  function handleFit() {
    if (!photo) return
    pushHistory()
    setPhoto(prev => prev ? { ...prev, ...containPlacement(prev.naturalWidth, prev.naturalHeight) } : prev)
  }

  function handleClear() {
    pushHistory()
    setPhoto(null)
    setSourceName('')
    setStem('image')
    setPhotoSelected(false)
    setSelectedId(null)
    clearLayers()
    setDownloadInfo(null)
    setPhotoError(null)
    publishedRef.current = null
    publish.reset()
  }

  async function handleDownload() {
    if (!photo) return
    setDownloading(true)
    try {
      const blob = await encodeScene({ photo, layers })
      const filename = `${finalStem}_${randomId(6)}.webp`
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
      const relPath = folderPath ? `${folderPath}/${filename}` : filename
      const rawUrl = makeRawUrl(relPath)
      setDownloadInfo({ filename, rawUrl })
      onExported({ path: relPath, filename, rawUrl, note: exportNote, tags: [folder.th, folder.sub], addedAt: new Date().toISOString() })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setPhotoError(`Could not export the WebP. ${message}`)
    } finally {
      setDownloading(false)
    }
  }

  function handleConvertAndPush() {
    if (!photo || !publishDestination) return
    void publish.prepare(publishDestination, finalStem, () => encodeScene({ photo, layers }))
  }

  useEffect(() => {
    const current = publish.state
    if (current.status !== 'success' || !current.result || !current.prepared) return
    const key = `${current.result.relPath}|${current.result.commit}`
    if (publishedRef.current === key) return
    publishedRef.current = key
    onExported({
      path: current.result.relPath,
      filename: current.result.filename,
      rawUrl: current.result.rawUrl,
      note: exportNote,
      tags: [current.prepared.th, current.prepared.sub],
      addedAt: new Date().toISOString(),
    })
  }, [publish.state, exportNote, onExported])

  const busy = publish.state.status === 'preparing' || publish.state.status === 'publishing'
  const canConvert = Boolean(photo) && Boolean(publishDestination) && !busy

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div className="panel" style={{ width: 230, flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <LayerPanel layers={layers} selectedId={selectedId} tool={tool}
          canUndo={canUndo} canRedo={canRedo} onUndo={undoEdit} onRedo={redoEdit}
          preset={preset} canSavePreset={canSaveTemplate}
          onApplyPreset={applyWatermarkTemplate} onSavePreset={saveWatermarkTemplate} onClearPreset={clearWatermarkTemplate}
          onToolChange={setTool} onSelect={selectLayer} onAdd={addWatermark}
          onUpdate={updateLayerFromPanel} onRemove={removeWatermark} onMoveUp={moveUpWithHistory} onMoveDown={moveDownWithHistory} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onDrop={handleDrop} onDragOver={event => event.preventDefault()}>
        {!photo ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'var(--bg-base)', cursor: 'pointer' }}
            onClick={() => fileInputRef.current?.click()}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed var(--border)' }}>
              {loading ? <Loader size={30} className="spin" color="var(--text-lo)" /> : <Image size={36} color="var(--text-lo)" />}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--text-hi)', fontWeight: 600, marginBottom: 4 }}>
                {loading ? 'Reading the screenshot…' : 'Drop your screenshot here'}
              </div>
              <div style={{ color: 'var(--text-lo)', fontSize: 11 }}>or click to browse • PNG, JPG, WEBP • fitted to 1600 × 800</div>
            </div>
            {photoError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)', fontSize: 11 }}>
                <AlertTriangle size={13} /> {photoError}
              </div>
            )}
          </div>
        ) : (
          <Canvas photo={photo} layers={layers} selection={selection} tool={tool}
            onSelectLayer={selectLayer} onSelectPhoto={selectPhoto} onDeselect={deselect}
            onUpdateLayer={updateLayerFromCanvas} onUpdatePhoto={updatePhotoFromCanvas}
            onGestureStart={beginGesture} onGestureEnd={endGesture} onGestureCancel={cancelGesture} canvasRef={canvasRef} />
        )}
        <PublishCard state={publish.state}
          onConfirm={() => { void publish.confirm() }}
          onCancel={publish.cancel}
          onRetryPush={() => { void publish.retryPush() }}
          onDismiss={publish.reset}
          onCopy={() => { void publish.copyResult() }} />
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileInput} />

      <div className="panel" style={{ width: 252, flexShrink: 0, padding: 14, display: 'flex', flexDirection: 'column', gap: 13, borderLeft: '1px solid var(--border)', borderRight: 'none', overflowY: 'auto' }}>
        <div>
          <div className="section-label" style={{ marginBottom: 8 }}>Image</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn-ghost" style={{ display: 'flex', gap: 5, alignItems: 'center', flex: 1 }}
              onClick={() => fileInputRef.current?.click()}>
              <Upload size={12} /> {photo ? 'Load' : 'Browse'}
            </button>
            {photo && (
              <button className="btn-ghost" style={{ display: 'flex', gap: 5, alignItems: 'center' }} onClick={handleClear} title="Remove the screenshot and every watermark">
                <RotateCcw size={12} /> Clear
              </button>
            )}
          </div>
          {sourceName && <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-lo)', wordBreak: 'break-all' }}>{sourceName}</div>}
          {photoError && photo && (
            <div style={{ marginTop: 6, display: 'flex', gap: 5, fontSize: 10, color: 'var(--danger)', lineHeight: 1.4 }}>
              <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: 1 }} /> {photoError}
            </div>
          )}
        </div>

        {photo && (
          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>Photo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <NumberField label="X" value={photo.x} unit="px" step={1}
                onCommit={value => updatePhotoFromPanel({ x: value })}
                onReset={() => updatePhotoFromPanel({ x: (CANVAS_W - photo.width) / 2 })} resetTitle="Center X" />
              <NumberField label="Y" value={photo.y} unit="px" step={1}
                onCommit={value => updatePhotoFromPanel({ y: value })}
                onReset={() => updatePhotoFromPanel({ y: (CANVAS_H - photo.height) / 2 })} resetTitle="Center Y" />
              <NumberField label="Scale" value={photoScalePercent(photo)} unit="%" min={PHOTO_SCALE_MIN} max={PHOTO_SCALE_MAX} step={1}
                onCommit={value => { pushHistory(); setPhoto(prev => prev ? scalePhotoTo(prev, value) : prev) }}
                onReset={() => { pushHistory(); setPhoto(prev => prev ? scalePhotoTo(prev, 100) : prev) }} resetTitle="Reset to fill scale" />
              <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                <button className="btn-ghost" style={{ flex: 1, padding: '5px 0', fontSize: 11 }} onClick={handleFill}>Fill</button>
                <button className="btn-ghost" style={{ flex: 1, padding: '5px 0', fontSize: 11 }} onClick={handleFit}>Fit</button>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-lo)' }}>Fill covers the canvas edge to edge (100%). Fit shows the whole screenshot.</div>
            </div>
          </div>
        )}

        <div>
          <div className="section-label" style={{ marginBottom: 8 }}>Export Destination</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: 'Category', value: folder.root, opts: rootKeys.map(k => ({ v: k, l: categories[k].label })), onChange: (v: string) => setFolder(f => ({ ...f, root: v, sub: categories[v]?.subs[0] || '' })) },
              { label: 'Town Hall', value: folder.th, opts: TH_LEVELS.map(t => ({ v: t, l: t.replace('_', ' ') })), onChange: (v: string) => setFolder(f => ({ ...f, th: v })) },
              { label: 'Type', value: folder.sub, opts: (currentRoot?.subs || []).map(s => ({ v: s, l: s })), onChange: (v: string) => setFolder(f => ({ ...f, sub: v })) },
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
              → {folderPath}/
            </div>
            {!publishDestination && (
              <div style={{ display: 'flex', gap: 5, fontSize: 10, color: 'var(--warn)', lineHeight: 1.4 }}>
                <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: 1 }} />
                Convert &amp; Push supports Home Village Bases and Army Images only. This destination is download-only.
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>Name</div>
          <input value={stem} onChange={event => setStem(event.target.value)}
            placeholder={sourceName ? sourceStemOf(sourceName) : 'th18_progress_my'}
            style={{ width: '100%', fontSize: 11 }} />
          <div style={{ fontSize: 10, color: 'var(--text-lo)', marginTop: 4 }}>
            Final file: {finalStem}_<span style={{ color: 'var(--accent)' }}>######</span>.webp — six random digits are added when you convert.
          </div>
        </div>

        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>Note</div>
          <textarea value={exportNote} onChange={event => setExportNote(event.target.value)}
            placeholder="e.g. anti-3star, strong vs Electro Dragons…"
            style={{ width: '100%', height: 62, resize: 'none', fontSize: 11 }} />
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn-primary" disabled={!canConvert} onClick={handleConvertAndPush}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', padding: '10px 0' }}>
            <Upload size={14} />
            {busy ? 'Working…' : 'Convert & Push'}
          </button>
          <button className="btn-ghost" disabled={!photo || downloading} onClick={() => { void handleDownload() }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', padding: '8px 0' }}>
            <Download size={13} />
            {downloading ? 'Exporting…' : 'Download WebP'}
          </button>
          {!photo && <div style={{ fontSize: 10, color: 'var(--text-lo)', textAlign: 'center' }}>Load a screenshot to enable publishing.</div>}
          {downloadInfo && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--ok)', marginBottom: 4 }}>✓ Downloaded {downloadInfo.filename}</div>
              <div style={{ fontSize: 10, color: 'var(--text-lo)', wordBreak: 'break-all' }}>{downloadInfo.rawUrl}</div>
              <div style={{ fontSize: 10, color: 'var(--text-lo)', marginTop: 4 }}>Download-only: nothing was written or pushed.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
