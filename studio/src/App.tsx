import { useState } from 'react'
import { Layers, Image, Library, GitBranch, Sword } from 'lucide-react'
import type { TabId } from './types'
import EditorTab from './components/EditorTab'
import LibraryTab from './components/LibraryTab'
import PublishTab from './components/PublishTab'
import { useLibrary } from './hooks/useLibrary'
import './index.css'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'editor',  label: 'Editor',  icon: <Image size={15} /> },
  { id: 'library', label: 'Library', icon: <Library size={15} /> },
  { id: 'publish', label: 'Publish', icon: <GitBranch size={15} /> },
]

export default function App() {
  const [tab, setTab] = useState<TabId>('editor')
  const { items, addItem, removeItem, updateNote, updateTags } = useLibrary()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* Top bar */}
      <header style={{
        height: 46, flexShrink: 0,
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 14px',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sword size={15} color="#0f1117" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1, color: 'var(--text-hi)', letterSpacing: '.2px' }}>CoC Studio</div>
            <div style={{ fontSize: 9, color: 'var(--text-lo)', letterSpacing: '.5px', textTransform: 'uppercase' }}>Babar-Meet / coc-img</div>
          </div>
        </div>

        <nav style={{ display: 'flex', gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 14px',
                background: tab === t.id ? 'var(--bg-hover)' : 'transparent',
                color: tab === t.id ? 'var(--text-hi)' : 'var(--text-lo)',
                fontWeight: tab === t.id ? 600 : 400,
                fontSize: 12,
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                borderRadius: '6px 6px 0 0',
                border: 'none',
                transition: 'all .12s',
              }}>
              {t.icon}{t.label}
            </button>
          ))}
        </nav>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Layers size={12} style={{ color: 'var(--text-lo)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-lo)' }}>{items.length} images</span>
          </div>
          <img src="/splash_logo_padded.png" alt="logo" style={{ height: 28, objectFit: 'contain', opacity: .85 }} />
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {tab === 'editor'  && <EditorTab onExported={addItem} />}
        {tab === 'library' && <LibraryTab items={items} onRemove={removeItem} onUpdateNote={updateNote} onUpdateTags={updateTags} />}
        {tab === 'publish' && <PublishTab />}
      </main>

      <footer style={{
        height: 24, flexShrink: 0,
        background: 'var(--bg-panel)',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 14px', gap: 16,
      }}>
        <span style={{ fontSize: 10, color: 'var(--text-lo)' }}>Canvas: 1600 × 800 (2:1)</span>
        <span style={{ fontSize: 10, color: 'var(--text-lo)' }}>Export: WebP Q85</span>
        <span style={{ fontSize: 10, color: 'var(--text-lo)' }}>Repo: Babar-Meet/coc-img</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>● LIVE</span>
      </footer>
    </div>
  )
}
