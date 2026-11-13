import { useState } from 'react'
import { GitMerge, Shield, CheckCircle, XCircle, Loader } from 'lucide-react'

interface PublishResult {
  ok: boolean
  message: string
}

export default function PublishTab() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<PublishResult | null>(null)
  const [log, setLog] = useState<string[]>([])

  function appendLog(msg: string) {
    setLog(prev => [...prev, msg])
  }

  async function runPublish() {
    setRunning(true); setResult(null); setLog([])
    appendLog('▶ Convert & Push is the primary publish flow')
    appendLog('')
    appendLog('In the Editor tab:')
    appendLog('  1. Drop a phone screenshot. It is fitted to the 1600 × 800 canvas.')
    appendLog('  2. Move/scale the photo and place your watermark layers.')
    appendLog('  3. Choose Category, Town Hall and Type, then type a name stem.')
    appendLog('  4. Press Convert & Push and confirm the card.')
    appendLog('')
    appendLog('The local studio server then:')
    appendLog('  • writes the .webp into the exact folder (creating it if needed)')
    appendLog('  • runs scripts/verify-secrets.mjs --staged against a temporary git index')
    appendLog('  • commits ONLY that new image')
    appendLog('  • pushes origin/main and returns the raw URL')
    appendLog('  • copies the raw URL to your clipboard')
    appendLog('')
    appendLog('push.bat remains available for CLI batches of files you add outside the studio.')
    appendLog('It stages everything in the working tree, so review git status before running it.')
    setResult({ ok: true, message: 'Instructions ready — Convert & Push in the Editor publishes in one step.' })
    setRunning(false)
  }

  async function checkSecurity() {
    setRunning(true); setLog([]); setResult(null)
    appendLog('▶ Publish safeguards')
    appendLog('')
    await new Promise(r => setTimeout(r, 300))
    appendLog('✓ Publish API requires the X-Studio-Request header and same-origin JSON requests')
    appendLog('✓ Destination is allowlisted (Base/Army → TH_1..TH_18 → type); client paths are ignored')
    appendLog('✓ Filenames match <stem>_<six digits>.webp and existing files are never overwritten')
    appendLog('✓ The commit uses a temporary git index, so unrelated work cannot ride along')
    appendLog('✓ scripts/verify-secrets.mjs --staged runs before every commit')
    appendLog('✓ git runs with GIT_TERMINAL_PROMPT=0 and per-step timeouts: no credential-prompt hangs')
    appendLog('✓ Download WebP writes nothing and needs no server')
    appendLog('')
    appendLog('Pre-commit and pre-push hooks in .githooks/ still run on top of these checks.')
    setResult({ ok: true, message: 'These are the checks the local publish server performs.' })
    setRunning(false)
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Left: Actions */}
      <div className="panel" style={{ width: 300, flexShrink: 0, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>Publishing</div>
          <div style={{ color: 'var(--text-mid)', fontSize: 12, lineHeight: 1.6, marginBottom: 14 }}>
            <strong style={{ color: 'var(--accent)' }}>Convert &amp; Push</strong> in the Editor tab is the primary flow: it writes the WebP, commits only that file and pushes origin/main. <strong style={{ color: 'var(--accent)' }}>push.bat</strong> stays available for CLI batches.
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-hi)', marginBottom: 8 }}>Editor flow</div>
            {[
              'Drop a screenshot — it fits the 1600 × 800 canvas',
              'Move/scale the photo, place watermark layers',
              'Pick Category, Town Hall, Type and type a name',
              'Convert & Push → confirm → raw URL is copied',
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{ background: 'var(--accent)', color: '#0f1117', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 11, color: 'var(--text-mid)', lineHeight: 1.5 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn-primary" disabled={running} onClick={runPublish}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0' }}>
            {running ? <Loader size={14} /> : <GitMerge size={14} />}
            Show Publish Instructions
          </button>
          <button className="btn-ghost" disabled={running} onClick={checkSecurity}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px 0' }}>
            <Shield size={14} /> What Publish Enforces
          </button>
        </div>

        {result && (
          <div style={{ background: result.ok ? '#0d2015' : '#1a0d0d', border: `1px solid ${result.ok ? 'var(--ok)' : 'var(--danger)'}`, borderRadius: 8, padding: 10, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {result.ok ? <CheckCircle size={14} style={{ color: 'var(--ok)', flexShrink: 0 }} /> : <XCircle size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} />}
            <div style={{ fontSize: 11, color: result.ok ? 'var(--ok)' : 'var(--danger)' }}>{result.message}</div>
          </div>
        )}

        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Runtime</div>
          {['Local Vite dev server only', 'Allowlisted folders and TH levels', 'One new file per commit', 'Secret scan before commit', 'Download WebP needs no server'].map(label => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
              <CheckCircle size={12} style={{ color: 'var(--ok)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-mid)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Log */}
      <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="section-label">Output Log</div>
        <div style={{ flex: 1, background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, overflowY: 'auto', fontFamily: '"Cascadia Code", "Consolas", monospace', fontSize: 12, lineHeight: 1.7 }}>
          {log.length === 0 ? (
            <div style={{ color: 'var(--text-lo)', fontStyle: 'italic' }}>Run an action to see output here.</div>
          ) : log.map((line, i) => (
            <div key={i} style={{ color: line.startsWith('✓') ? 'var(--ok)' : line.startsWith('✗') ? 'var(--danger)' : line.startsWith('▶') ? 'var(--accent)' : 'var(--text-mid)' }}>
              {line || '\u00A0'}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
