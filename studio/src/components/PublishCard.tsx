import { AlertTriangle, Check, CheckCircle, Copy, GitMerge, Loader, X } from 'lucide-react'
import type { PublishState } from '../hooks/usePublish'
import { BRANCH } from '../shared/studioConfig'

interface Props {
  state: PublishState
  onConfirm: () => void
  onCancel: () => void
  onRetryPush: () => void
  onDismiss: () => void
  onCopy: () => void
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      margin: '0 16px 16px', background: 'var(--bg-panel)', border: '1px solid var(--border)',
      borderRadius: 8, padding: 14, maxWidth: 680, width: 'calc(100% - 32px)', alignSelf: 'center',
      boxShadow: '0 10px 30px rgba(0, 0, 0, .35)',
    }}>
      {children}
    </div>
  )
}

function Header({ icon, title, tone }: { icon: React.ReactNode; title: string; tone?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
      {icon}
      <span style={{ fontSize: 12, fontWeight: 600, color: tone ?? 'var(--text-hi)' }}>{title}</span>
    </div>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 11, lineHeight: 1.5 }}>
      <span style={{ color: 'var(--text-lo)', width: 62, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text-mid)', wordBreak: 'break-all' }}>{children}</span>
    </div>
  )
}

export default function PublishCard({ state, onConfirm, onCancel, onRetryPush, onDismiss, onCopy }: Props) {
  if (state.status === 'idle') return null

  if (state.status === 'preparing') {
    return (
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-mid)', fontSize: 11 }}>
          <Loader size={13} className="spin" /> Encoding the 1600 × 800 canvas as WebP…
        </div>
      </Card>
    )
  }

  if (state.status === 'publishing') {
    return (
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-mid)', fontSize: 11 }}>
          <Loader size={13} className="spin" /> Writing the image, running the secret scan, committing one file and pushing origin/main…
        </div>
      </Card>
    )
  }

  if (state.status === 'success' && state.result) {
    const result = state.result
    return (
      <Card>
        <Header icon={<CheckCircle size={14} style={{ color: 'var(--ok)' }} />} title="Pushed to origin/main" tone="var(--ok)" />
        <Detail label="Raw URL">
          <span style={{ color: 'var(--accent)' }}>{result.rawUrl}</span>
        </Detail>
        <Detail label="Commit">{result.commit || '(unknown)'} · {formatBytes(result.bytes)}</Detail>
        <Detail label="Path">{result.relPath}</Detail>
        <div style={{ fontSize: 10, color: 'var(--text-lo)', margin: '6px 0 10px' }}>
          {state.autoCopied
            ? 'The raw URL was copied to your clipboard automatically.'
            : state.copyBlocked
              ? 'The browser blocked clipboard access. Use Copy URL.'
              : 'Copy the raw URL to share it.'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary" onClick={onCopy} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px' }}>
            {state.autoCopied ? <Check size={13} /> : <Copy size={13} />} {state.autoCopied ? 'Copied' : 'Copy URL'}
          </button>
          <button className="btn-ghost" onClick={onDismiss} style={{ padding: '7px 12px' }}>Done</button>
        </div>
      </Card>
    )
  }

  if (state.status === 'error') {
    return (
      <Card>
        <Header icon={<AlertTriangle size={14} style={{ color: 'var(--danger)' }} />} title="Publish failed" tone="var(--danger)" />
        <div style={{ fontSize: 11, color: 'var(--text-mid)', lineHeight: 1.6, marginBottom: 8 }}>{state.error}</div>
        {state.committed && (
          <div style={{ fontSize: 11, color: 'var(--warn)', lineHeight: 1.6, marginBottom: 8 }}>
            The image is committed locally but is not on origin/main yet. Retry push sends the same commit; it will not create a second file or commit.
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {state.committed && (
            <button className="btn-primary" onClick={onRetryPush} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px' }}>
              <GitMerge size={13} /> Retry push
            </button>
          )}
          <button className="btn-ghost" onClick={onDismiss} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px' }}>
            <X size={13} /> Dismiss
          </button>
        </div>
        {!state.committed && (
          <div style={{ fontSize: 10, color: 'var(--text-lo)', marginTop: 8 }}>
            Nothing was written to the repository. Download WebP still works.
          </div>
        )}
      </Card>
    )
  }

  const prepared = state.prepared
  if (!prepared) return null
  const blockReasons: string[] = []
  if (prepared.ahead === -1) blockReasons.push(`Could not compare with origin/${BRANCH}. Run "git fetch", then press Convert & Push again.`)
  if (prepared.branch !== BRANCH) blockReasons.push(`The local branch is "${prepared.branch || '(detached)'}", not ${BRANCH}. Switch to ${BRANCH} before publishing.`)
  if (prepared.ahead > 0) blockReasons.push(`Local ${BRANCH} is ${prepared.ahead} commit(s) ahead of origin/${BRANCH}. Push those first (push.bat), then press Convert & Push again. Convert & Push never deploys unrelated commits.`)

  return (
    <Card>
      <Header icon={<GitMerge size={14} style={{ color: 'var(--accent)' }} />} title="Confirm publish" />
      <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
        {state.previewUrl && (
          <img src={state.previewUrl} alt="WebP preview"
            style={{ width: 176, height: 88, objectFit: 'contain', background: '#fff', border: '1px solid var(--border)', borderRadius: 4, flexShrink: 0 }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <Detail label="File name">{prepared.filename}</Detail>
          <Detail label="Folder">{prepared.relPath.slice(0, prepared.relPath.length - prepared.filename.length)}</Detail>
          <Detail label="Size">{state.blob ? formatBytes(state.blob.size) : ''}</Detail>
          <Detail label="Target">origin/main</Detail>
        </div>
      </div>

      {!prepared.dirExists && (
        <div style={{ display: 'flex', gap: 7, fontSize: 11, color: 'var(--warn)', lineHeight: 1.5, marginBottom: 6 }}>
          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          That folder does not exist yet. It will be created when you confirm.
        </div>
      )}

      {blockReasons.map(reason => (
        <div key={reason} style={{ display: 'flex', gap: 7, fontSize: 11, color: 'var(--danger)', lineHeight: 1.5, marginBottom: 6 }}>
          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          {reason}
        </div>
      ))}

      {blockReasons.length === 0 && (
        <div style={{ fontSize: 10, color: 'var(--text-lo)', marginBottom: 8 }}>
          This writes one new .webp, commits only that file, and pushes origin/main. Nothing is written until you confirm.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn-primary" onClick={onConfirm} disabled={blockReasons.length > 0}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px' }}>
          <GitMerge size={13} /> Confirm &amp; Push
        </button>
        <button className="btn-ghost" onClick={onCancel} style={{ padding: '7px 12px' }}>Cancel</button>
      </div>
    </Card>
  )
}
