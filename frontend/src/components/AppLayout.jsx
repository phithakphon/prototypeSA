import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Info } from 'lucide-react'
import Notice from './Notice'
import Sidebar from './Sidebar'
import ProfileMenu from './ProfileMenu'
import { useAuth } from '../auth/auth'
import { USE_MOCK } from '../api'
import usePointerEffects from '../hooks/usePointerEffects'
import './ui.css'
import './AppLayout.css'

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const shellRef = useRef(null)
  usePointerEffects(shellRef, null, { viewport: true })

  useEffect(() => {
    if (!mobileOpen) return undefined
    const onKey = (e) => e.key === 'Escape' && setMobileOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  return (
    <div className={`app-shell${collapsed ? ' sidebar-collapsed' : ''}`} ref={shellRef}>
      {/* decorative background (pointer-events: none) */}
      <div className="app-deco" aria-hidden="true">
        <span className="deco-dots" />
        <span className="deco-blob" />
        <span className="deco-waves" />
        <span className="deco-glow" />
      </div>

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
          <p className="topbar-title">
            <strong>บริษัท ศุภชัยสอบบัญชี</strong>
            <span>ระบบบริหารจัดการข้อมูลพนักงาน</span>
          </p>
          <ProfileMenu
            user={user}
            onLogout={() => {
              logout()
              navigate('/login')
            }}
          />
        </header>

        {USE_MOCK && (
          <Notice variant="warning" icon={Info} title="โหมดสาธิต" className="demo-notice">
            ข้อมูลทั้งหมดเป็นข้อมูลจำลองและจะรีเซ็ตเมื่อรีเฟรชหน้า การจำกัดสิทธิ์ในโหมดนี้ใช้แสดงตัวอย่างเท่านั้น ไม่ใช่ระบบความปลอดภัยจริง
          </Notice>
        )}

        <div className="page" key={location.pathname}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default AppLayout
