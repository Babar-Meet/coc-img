import { useState, useEffect } from 'react'

export interface CategoryDef {
  key: string        // repo path prefix, e.g. "clan_capital_img"
  label: string      // display name, e.g. "Clan Capital"
  thPath: string     // path template: use "{TH}" as placeholder, e.g. "clan_capital_img/{TH}"
  subs: string[]     // sub-folder names, comma-separated on entry
  builtin?: boolean  // built-in categories can't be deleted
}

const STORAGE_KEY = 'coc-studio-categories'

const BUILT_IN: CategoryDef[] = [
  {
    key: 'Bases_img/home_village_bases',
    label: 'Home Village Bases',
    thPath: 'Bases_img/home_village_bases/{TH}',
    subs: ['War', 'Farming', 'Progress', 'Art', 'Rank'],
    builtin: true,
  },
  {
    key: 'army_img',
    label: 'Army Images',
    thPath: 'army_img/{TH}',
    subs: ['War', 'Farming', 'Rank', 'Simple'],
    builtin: true,
  },
]

function loadCustom(): CategoryDef[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

export function useCategories() {
  const [custom, setCustom] = useState<CategoryDef[]>(loadCustom)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom))
  }, [custom])

  const all: CategoryDef[] = [...BUILT_IN, ...custom]

  function addCategory(def: Omit<CategoryDef, 'builtin'>) {
    if (all.find(c => c.key === def.key)) return // no duplicate keys
    setCustom(prev => [...prev, def])
  }

  function removeCategory(key: string) {
    setCustom(prev => prev.filter(c => c.key !== key))
  }

  // Convert to the shape CATEGORY_ROOTS uses (for backward compat)
  function toCategoryRoots(): Record<string, { label: string; thPath: (th: string) => string; subs: string[] }> {
    const result: Record<string, { label: string; thPath: (th: string) => string; subs: string[] }> = {}
    for (const c of all) {
      result[c.key] = {
        label: c.label,
        thPath: (th: string) => c.thPath.replace('{TH}', th),
        subs: c.subs,
      }
    }
    return result
  }

  return { all, addCategory, removeCategory, toCategoryRoots }
}
