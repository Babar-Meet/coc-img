import { useCallback, useRef, useState } from 'react'
import { copyText } from '../lib/clipboard'

export interface PublishDestination {
  category: string
  th: string
  sub: string
}

export interface PrepareInfo extends PublishDestination {
  filename: string
  relPath: string
  rawUrl: string
  dirExists: boolean
  ahead: number
  branch: string
  canPush: boolean
}

export interface PublishResult {
  ok: true
  pushed: true
  filename: string
  relPath: string
  rawUrl: string
  commit: string
  bytes: number
}

export type PublishStatus = 'idle' | 'preparing' | 'confirm' | 'publishing' | 'success' | 'error'

export interface PublishState {
  status: PublishStatus
  blob: Blob | null
  previewUrl: string | null
  prepared: PrepareInfo | null
  result: PublishResult | null
  error: string | null
  /** true when the file and commit exist locally but the push failed. */
  committed: boolean
  autoCopied: boolean
  copyBlocked: boolean
}

const IDLE: PublishState = {
  status: 'idle', blob: null, previewUrl: null, prepared: null, result: null,
  error: null, committed: false, autoCopied: false, copyBlocked: false,
}

const OFFLINE_MESSAGE = 'Could not reach the studio publish server. Convert & Push works only while the studio runs locally through studio.bat (the Vite dev server). Download WebP still works.'

interface ApiFailurePayload {
  error?: unknown
  committed?: unknown
}

type PostResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; payload: ApiFailurePayload | null }

async function postJson<T>(path: string, payload: unknown): Promise<PostResult<T>> {
  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Studio-Request': 'publish' },
      body: JSON.stringify(payload),
    })
  } catch {
    return { ok: false, error: OFFLINE_MESSAGE, payload: null }
  }

  let text = ''
  try { text = await response.text() } catch { text = '' }
  let data: unknown = null
  if (text) {
    try { data = JSON.parse(text) } catch { data = null }
  }
  const record = typeof data === 'object' && data !== null ? data as Record<string, unknown> : null

  if (!response.ok || !record || record.ok !== true) {
    if (!record) {
      if (response.ok) {
        return { ok: false, error: 'The publish server returned an unexpected response. Convert & Push works only while the studio runs through studio.bat (the Vite dev server).', payload: null }
      }
      return { ok: false, error: `The publish server rejected the request (HTTP ${response.status}). Nothing was written.`, payload: null }
    }
    const message = typeof record.error === 'string' && record.error.trim() ? record.error : `The publish server rejected the request (HTTP ${response.status}).`
    return { ok: false, error: message, payload: record as ApiFailurePayload }
  }

  return { ok: true, data: record as T }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => { window.setTimeout(resolve, ms) })
}

function isPrepareInfo(value: unknown): value is PrepareInfo {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.filename === 'string'
    && typeof record.relPath === 'string'
    && typeof record.rawUrl === 'string'
    && typeof record.category === 'string'
    && typeof record.th === 'string'
    && typeof record.sub === 'string'
    && typeof record.canPush === 'boolean'
}

function isPublishResult(value: unknown): value is PublishResult {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return record.ok === true
    && typeof record.filename === 'string'
    && typeof record.relPath === 'string'
    && typeof record.rawUrl === 'string'
    && typeof record.commit === 'string'
    && typeof record.bytes === 'number'
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const comma = result.indexOf(',')
      if (comma === -1) reject(new Error('Could not read the encoded image.'))
      else resolve(result.slice(comma + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the encoded image.'))
    reader.readAsDataURL(blob)
  })
}

export function usePublish() {
  const [state, setState] = useState<PublishState>(IDLE)
  const previewRef = useRef<string | null>(null)
  const operationRef = useRef(0)

  const dropPreview = useCallback(() => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = null
  }, [])

  const reset = useCallback(() => {
    operationRef.current += 1
    dropPreview()
    setState(IDLE)
  }, [dropPreview])

  const prepare = useCallback(async (destination: PublishDestination, stem: string, makeBlob: () => Promise<Blob>) => {
    operationRef.current += 1
    const token = operationRef.current
    dropPreview()
    setState({ ...IDLE, status: 'preparing' })

    let blob: Blob
    try {
      blob = await makeBlob()
    } catch (error) {
      if (operationRef.current !== token) return
      const message = error instanceof Error ? error.message : String(error)
      setState({ ...IDLE, status: 'error', error: `Could not encode the canvas as WebP. ${message}` })
      return
    }
    if (operationRef.current !== token) return

    const previewUrl = URL.createObjectURL(blob)
    previewRef.current = previewUrl

    const response = await postJson<PrepareInfo>('/api/publish/prepare', {
      category: destination.category,
      th: destination.th,
      sub: destination.sub,
      stem,
    })
    if (operationRef.current !== token) return

    if (!response.ok) {
      dropPreview()
      setState({ ...IDLE, status: 'error', error: response.error })
      return
    }
    if (!isPrepareInfo(response.data)) {
      dropPreview()
      setState({ ...IDLE, status: 'error', error: 'The publish server returned an incomplete prepare response. Nothing was written.' })
      return
    }

    setState({
      ...IDLE,
      status: 'confirm',
      blob,
      previewUrl,
      prepared: response.data,
    })
  }, [dropPreview])

  const send = useCallback(async (prepared: PrepareInfo, blob: Blob, previewUrl: string | null) => {
    operationRef.current += 1
    const token = operationRef.current
    setState({
      status: 'publishing', blob, previewUrl, prepared, result: null,
      error: null, committed: false, autoCopied: false, copyBlocked: false,
    })

    let data: string
    try {
      data = await blobToBase64(blob)
    } catch (error) {
      if (operationRef.current !== token) return
      const message = error instanceof Error ? error.message : String(error)
      setState({
        status: 'error', blob, previewUrl, prepared, result: null,
        error: message, committed: false, autoCopied: false, copyBlocked: false,
      })
      return
    }

    const response = await postJson<PublishResult>('/api/publish', {
      category: prepared.category,
      th: prepared.th,
      sub: prepared.sub,
      filename: prepared.filename,
      data,
    })
    if (operationRef.current !== token) return

    if (!response.ok) {
      const committed = response.payload?.committed === true
      setState({
        status: 'error', blob, previewUrl, prepared, result: null,
        error: response.error, committed, autoCopied: false, copyBlocked: false,
      })
      return
    }
    if (!isPublishResult(response.data)) {
      setState({
        status: 'error', blob, previewUrl, prepared, result: null,
        error: 'The publish server returned an incomplete publish response. Check the repository before retrying.',
        committed: false, autoCopied: false, copyBlocked: false,
      })
      return
    }

    setState({
      status: 'success', blob, previewUrl, prepared, result: response.data,
      error: null, committed: false, autoCopied: false, copyBlocked: false,
    })

    // Let the success card paint before asking for the clipboard.
    await delay(0)
    if (operationRef.current !== token) return
    const copied = await copyText(response.data.rawUrl)
    if (operationRef.current !== token) return
    setState(prev => prev.status === 'success' ? { ...prev, autoCopied: copied, copyBlocked: !copied } : prev)
  }, [])

  const confirm = useCallback(async () => {
    if (state.status !== 'confirm' || !state.prepared || !state.blob) return
    await send(state.prepared, state.blob, state.previewUrl)
  }, [state, send])

  const retryPush = useCallback(async () => {
    if (state.status !== 'error' || !state.prepared || !state.blob) return
    await send(state.prepared, state.blob, state.previewUrl)
  }, [state, send])

  const cancel = useCallback(() => {
    operationRef.current += 1
    dropPreview()
    setState(IDLE)
  }, [dropPreview])

  const copyResult = useCallback(async () => {
    if (state.status !== 'success' || !state.result) return
    const copied = await copyText(state.result.rawUrl)
    setState(prev => prev.status === 'success' ? { ...prev, autoCopied: copied, copyBlocked: !copied } : prev)
  }, [state])

  return { state, prepare, confirm, retryPush, cancel, reset, copyResult }
}
