import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

// GET helper with loading / error state. Pass null to skip fetching.
// A result is only "current" when it was fetched for the present path + reload tick.
export function useApi(path) {
  const [tick, setTick] = useState(0)
  const [result, setResult] = useState({ key: null, data: null, error: null })
  const key = path ? `${path}#${tick}` : null

  useEffect(() => {
    if (!key) return undefined
    let cancelled = false
    api(path)
      .then((data) => !cancelled && setResult({ key, data, error: null }))
      .catch((error) => !cancelled && setResult({ key, data: null, error }))
    return () => {
      cancelled = true
    }
  }, [key, path])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  const current = result.key === key
  return {
    // keep the previous data visible while a refetch is in flight (avoids flicker while typing)
    data: result.data,
    error: current ? result.error : null,
    loading: Boolean(key) && !current,
    reload,
  }
}
