import { useState, useEffect } from 'react'
import type { LibraryItem } from '../components/types'

const KEY = 'coc-studio-library'

export function useLibrary() {
  const [items, setItems] = useState<LibraryItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
  })

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items))
  }, [items])

  function addItem(item: LibraryItem) {
    setItems(prev => [item, ...prev.filter(i => i.path !== item.path)])
  }
  function removeItem(path: string) { setItems(prev => prev.filter(i => i.path !== path)) }
  function updateNote(path: string, note: string) { setItems(prev => prev.map(i => i.path === path ? { ...i, note } : i)) }
  function updateTags(path: string, tags: string[]) { setItems(prev => prev.map(i => i.path === path ? { ...i, tags } : i)) }

  return { items, addItem, removeItem, updateNote, updateTags }
}
