import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './auth'

// Redirects to /login when not signed in.
export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="center-state" role="status">กำลังโหลด...</div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

// Blocks a page unless the user holds the permission (the server enforces this too).
export function RequirePermission({ permission, children }) {
  const { can } = useAuth()
  if (can(permission)) return children
  return (
    <section className="panel">
      <h1 className="page-title">ไม่มีสิทธิ์เข้าถึง</h1>
      <p>บัญชีของคุณไม่ได้รับอนุญาตให้ใช้งานหน้านี้</p>
    </section>
  )
}
