import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth'
import { Home, Search, History, Settings, ClipboardCheck, UserMinus, Wallet, LogOut, ChevronLeft, X } from './icons'

// permission: required RBAC permission (omit = every signed-in user). Server enforces the same rules.
const NAV_ITEMS = [
  { to: '/dashboard', label: 'หน้าหลัก', icon: Home },
  { to: '/employees/search', label: 'ค้นหาข้อมูลพนักงาน', icon: Search, permission: 'employee:search' },
  { to: '/employees/history', label: 'ประวัติพนักงาน', icon: History, permission: 'employee:view' },
  { to: '/employees', label: 'จัดการข้อมูลพนักงาน', icon: Settings, end: true, permission: 'employee:manage' },
  { to: '/resigned', label: 'พนักงานที่ลาออก', icon: UserMinus, permission: 'resignation:manage' },
  { to: '/salaries', label: 'จัดการเงินเดือน', icon: Wallet, permission: 'salary:manage' },
  { to: '/evaluations', label: 'ผลการประเมิน', icon: ClipboardCheck },
]

function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) {
  const { can, logout } = useAuth()
  const navigate = useNavigate()
  const cls = ['sidebar', collapsed ? 'is-collapsed' : '', mobileOpen ? 'is-open' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <aside id="app-sidebar" className={cls} aria-label="เมนูหลัก">
      <div className="sidebar-head">
        <div className="sidebar-brand">
          <span className="brand-badge">HR</span>
          <span className="sidebar-text">ระบบบริหารพนักงาน</span>
        </div>
        <button
          type="button"
          className="icon-btn sidebar-collapse"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
          aria-expanded={!collapsed}
        >
          <ChevronLeft />
        </button>
        <button type="button" className="icon-btn sidebar-close" onClick={onCloseMobile} aria-label="ปิดเมนู">
          <X />
        </button>
      </div>

      <nav aria-label="เมนูนำทาง">
        <ul className="nav-list">
          {NAV_ITEMS.filter((i) => !i.permission || can(i.permission)).map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                title={collapsed ? label : undefined}
                onClick={onCloseMobile}
              >
                <Icon />
                <span className="sidebar-text">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <button
        type="button"
        className="nav-link nav-logout"
        title={collapsed ? 'ออกจากระบบ' : undefined}
        onClick={() => {
          logout()
          navigate('/login')
        }}
      >
        <LogOut />
        <span className="sidebar-text">ออกจากระบบ</span>
      </button>
    </aside>
  )
}

export default Sidebar
