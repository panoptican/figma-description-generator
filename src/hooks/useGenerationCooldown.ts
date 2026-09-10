import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

const COOLDOWN_MS = 2_000

// Keep the guard outside row lifetimes so collapsing, filtering, and shortcuts
// cannot immediately repeat a successful request.
export function useGenerationCooldown() {
  const expires = useRef(new Map<string, number>())
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const [ids, setIds] = useState<Set<string>>(new Set())

  const start = useCallback((id: string) => {
    expires.current.set(id, Date.now() + COOLDOWN_MS)
    clearTimeout(timers.current.get(id))
    setIds(previous => new Set(previous).add(id))
    timers.current.set(id, setTimeout(() => {
      expires.current.delete(id)
      timers.current.delete(id)
      setIds(previous => {
        const next = new Set(previous)
        next.delete(id)
        return next
      })
    }, COOLDOWN_MS))
  }, [])

  const includes = useCallback((targets: string[]) => (
    targets.some(id => (expires.current.get(id) || 0) > Date.now())
  ), [])

  useEffect(() => () => {
    timers.current.forEach(timer => clearTimeout(timer))
  }, [])

  return { ids, start, includes }
}
