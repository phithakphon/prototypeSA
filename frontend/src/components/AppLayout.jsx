import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import { ChevronDown, Info } from './icons'
import { USE_MOCK } from '../api'
import { useAuth } from '../auth/auth'
import './ui.css'
import './AppLayout.css'

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { user } = useAuth()
  const firstName = user.displayName.split(' ')[0]

  useEffect(() => {
    if (!mobileOpen) return undefined
    const onKey = (e) => e.key === 'Escape' && setMobileOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  return (
    <div className={`app-shell${collapsed ? ' sidebar-collapsed' : ''}`}>
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div
        className={`scrim${mobileOpen ? ' show' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <div className="app-main">
        <header className="topbar">
          <button
            type="button"
            className={`icon-btn hamburger${mobileOpen ? ' is-open' : ''}`}
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
            aria-expanded={mobileOpen}
            aria-controls="app-sidebar"
          >
            <span /><span /><span />
          </button>
          <div className="profile">
            <span className="avatar" aria-hidden="true">{firstName.charAt(0)}</span>
            <div className="profile-text">
              <strong>สวัสดี, คุณ{firstName}</strong>
              <span>{user.roleLabel}</span>
            </div>
            <ChevronDown className="profile-chevron" width={16} height={16} />
          </div>
        </header>
        {USE_MOCK && (
          <div className="demo-banner" role="note">
            <Info width={16} height={16} />
            <span>โหมดสาธิต: ข้อมูลทั้งหมดเป็นข้อมูลจำลองและจะรีเซ็ตเมื่อรีเฟรชหน้า การจำกัดสิทธิ์ในโหมดนี้ใช้แสดงตัวอย่างเท่านั้น ไม่ใช่ระบบความปลอดภัยจริง</span>
          </div>
        )}
        <div className="page" key={location.pathname}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default AppLayout
