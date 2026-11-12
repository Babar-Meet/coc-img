import { useState, useEffect, useCallback } from 'react'
import type { LibraryItem } from '../components/types'
import { REPO_OWNER, REPO_NAME, BRANCH, makeRawUrl } from '../components/constants'

const LOCAL_KEY = 'coc-studio-library-notes' // stores { [path]: { note, tags } }
const IMAGE_EXTS = ['.webp', '.png', '.jpg', '.jpeg', '.gif']

interface NotesMap {
  [path: string]: { note: string; tags: string[]; addedAt?: string }
}

function loadNotes(): NotesMap {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') } catch { return {} }
}

function saveNotes(map: NotesMap) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(map))
}

export type FetchState = 'idle' | 'loading' | 'done' | 'error'

export function useLibrary() {
  const [remoteItems, setRemoteItems] = useState<LibraryItem[]>([])
  const [notes, setNotes]             = useState<NotesMap>(loadNotes)
  const [fetchState, setFetchState]   = useState<FetchState>('idle')
  const [fetchError, setFetchError]   = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<string | null>(null)

  // Persist notes map whenever it changes
  useEffect(() => { saveNotes(notes) }, [notes])

  // Merge remote list with local notes to produce final items
  const items: LibraryItem[] = remoteItems.map(item => {
    const local = notes[item.path]
    return {
      ...item,
      note:    local?.note    ?? '',
      tags:    local?.tags    ?? [],
      addedAt: local?.addedAt ?? item.addedAt,
    }
  })

  // Fetch full tree from GitHub API
  const fetchFromGitHub = useCallback(async () => {
    setFetchState('loading')
    setFetchError(null)
    try {
      const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${BRANCH}?recursive=1`
      const res = await fetch(url, {
        headers: { 'Accept': 'application/vnd.github+json' },
      })
      if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`)
      const data = await res.json()

      const imageFiles: LibraryItem[] = (data.tree as { path: string; type: string }[])
        .filter(node =>
          node.type === 'blob' &&
          IMAGE_EXTS.some(ext => node.path.toLowerCase().endsWith(ext)) &&
          // skip root-level logos / icons, only repo image folders
          (node.path.startsWith('Bases_img/') || node.path.startsWith('army_img/'))
        )
        .map(node => ({
          path:     node.path,
          filename: node.path.split('/').pop() ?? node.path,
          rawUrl:   makeRawUrl(node.path),
          note:     '',
          tags:     [],
          addedAt:  new Date().toISOString(),
        }))
        // newest TH first (simple lexicographic on TH_xx segment)
        .sort((a, b) => b.path.localeCompare(a.path))

      setRemoteItems(imageFiles)
      setLastFetched(new Date().toLocaleTimeString())
      setFetchState('done')
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : String(e))
      setFetchState('error')
    }
  }, [])

  // Auto-fetch on mount
  useEffect(() => { fetchFromGitHub() }, [fetchFromGitHub])

  // Add a locally-exported item (keeps it in remoteItems too)
  function addItem(item: LibraryItem) {
    setRemoteItems(prev => [item, ...prev.filter(i => i.path !== item.path)])
    setNotes(prev => ({
      ...prev,
      [item.path]: { note: item.note, tags: item.tags, addedAt: item.addedAt },
    }))
  }

  function removeItem(path: string) {
    setRemoteItems(prev => prev.filter(i => i.path !== path))
    setNotes(prev => { const n = { ...prev }; delete n[path]; return n })
  }

  function updateNote(path: string, note: string) {
    setNotes(prev => ({
      ...prev,
      [path]: { ...(prev[path] ?? { tags: [] }), note },
    }))
  }

  function updateTags(path: string, tags: string[]) {
    setNotes(prev => ({
      ...prev,
      [path]: { ...(prev[path] ?? { note: '' }), tags },
    }))
  }

  return {
    items,
    addItem,
    removeItem,
    updateNote,
    updateTags,
    fetchState,
    fetchError,
    lastFetched,
    refetch: fetchFromGitHub,
  }
}
