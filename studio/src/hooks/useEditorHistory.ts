import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Snapshot undo/redo. Call `push()` before a change; `undo()` and `redo()` restore whole
 * snapshots. One drag is one push, not one per pointer move.
 */
export function useEditorHistory<T>(read: () => T, restore: (snapshot: T) => void, limit = 100) {
  const pastRef = useRef<T[]>([])
  const futureRef = useRef<T[]>([])
  const readRef = useRef(read)
  const restoreRef = useRef(restore)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  useEffect(() => {
    readRef.current = read
    restoreRef.current = restore
  })

  const sync = useCallback(() => {
    setCanUndo(pastRef.current.length > 0)
    setCanRedo(futureRef.current.length > 0)
  }, [])

  const push = useCallback(() => {
    pastRef.current.push(readRef.current())
    if (pastRef.current.length > limit) pastRef.current.splice(0, pastRef.current.length - limit)
    futureRef.current = []
    sync()
  }, [limit, sync])

  const undo = useCallback(() => {
    const previous = pastRef.current.pop()
    if (previous === undefined) return false
    futureRef.current.push(readRef.current())
    restoreRef.current(previous)
    sync()
    return true
  }, [sync])

  const redo = useCallback(() => {
    const next = futureRef.current.pop()
    if (next === undefined) return false
    pastRef.current.push(readRef.current())
    if (pastRef.current.length > limit) pastRef.current.splice(0, pastRef.current.length - limit)
    restoreRef.current(next)
    sync()
    return true
  }, [limit, sync])

  /** Drop the last pushed snapshot, for a drag cancelled with Escape. */
  const cancelLast = useCallback(() => {
    if (!pastRef.current.length) return
    pastRef.current.pop()
    sync()
  }, [sync])

  return { push, undo, redo, cancelLast, canUndo, canRedo }
}
