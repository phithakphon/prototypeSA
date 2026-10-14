import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler } from '../api'
import { AuthContext } from './auth'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(getToken()))

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    if (!getToken()) return undefined
    let cancelled = false
    api('/auth/me')
      .then((d) => !cancelled && setUser(d.user))
      .catch(() => !cancelled && logout())
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [logout])

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
      login,
      logout,
      can: (permission) => Boolean(user?.permissions.includes(permission)),
    }),
    [user, loading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
