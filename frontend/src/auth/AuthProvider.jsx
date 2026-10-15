import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler } from '../api'
import { AuthContext } from './auth'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(getToken()))
  const [sessionError, setSessionError] = useState(null)

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    setSessionError(null)
  }, [])

  // Restores the session from the stored token. Only a definitive 401 (invalid/expired token) signs the user out;
  // network failures and server errors keep the token and expose `sessionError` so the UI can offer a retry.
  const restore = useCallback(() => {
    if (!getToken()) return undefined
    let cancelled = false
    api('/auth/me')
      .then((d) => !cancelled && setUser(d.user))
      .catch((err) => {
        if (cancelled) return
        if (err?.status === 401) logout()
        else setSessionError(err)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [logout])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    return restore()
  }, [logout, restore])

  const retrySession = useCallback(() => {
    setSessionError(null)
    setLoading(true)
    restore()
  }, [restore])

  const login = useCallback(async (username, password) => {
    const d = await api('/auth/login', { method: 'POST', body: { username, password } })
    setToken(d.token)
    setUser(d.user)
    return d.user
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      sessionError,
      retrySession,
      login,
      logout,
      can: (permission) => Boolean(user?.permissions.includes(permission)),
    }),
    [user, loading, sessionError, retrySession, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
