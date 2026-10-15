import { NavLink, useNavigate } from 'react-router-dom'
import {
  ClipboardCheck, History, House, LogOut, PanelLeftClose, PanelLeftOpen, Search, SlidersHorizontal, UserMinus, UserCheck, Wallet, X,
} from 'lucide-react'
import { useAuth } from '../auth/auth'

const ICON = { size: 24, strokeWidth: 1.75, 'aria-hidden': true }

// permission: required RBAC permission (omit = every signed-in user). Server enforces the same rules.
const NAV_ITEMS = [
  { to: '/dashboard', label: 'หน้าหลัก', icon: House },
  { to: '/employees/search', label: 'ค้นหาข้อมูลพนักงาน', icon: Search, permission: 'employee:search' },
  { to: '/employees/history', label: 'ประวัติพนักงาน', icon: History, permission: 'employee:view' },
  { to: '/employees', label: 'จัดการข้อมูลพนักงาน', icon: SlidersHorizontal, end: true, permission: 'employee:manage' },
  { to: '/resigned', label: 'พนักงานที่ลาออก', icon: UserMinus, permission: 'resignation:manage' },
  { to: '/salaries', label: 'จัดการเงินเดือน', icon: Wallet, permission: 'salary:manage' },
  { to: '/accounts', label: 'ผูกบัญชีผู้ใช้', icon: UserCheck, permission: 'account:link' },
  { to: '/evaluations', label: 'ผลการประเมิน', icon: ClipboardCheck },
]

function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) {
  const { can, logout } = useAuth()
  const navigate = useNavigate()
  const cls = ['sidebar', collapsed ? 'is-collapsed' : '', mobileOpen ? 'is-open' : '']
    .filter(Boolean)
    .join(' ')
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose

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
          <CollapseIcon size={22} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button type="button" className="icon-btn sidebar-close" onClick={onCloseMobile} aria-label="ปิดเมนู">
          <X size={22} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="เมนูนำทาง">
        <ul className="nav-list">
          {NAV_ITEMS.filter((i) => !i.permission || can(i.permission)).map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                data-tip={label}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                onClick={onCloseMobile}
              >
                <Icon {...ICON} />
                <span className="sidebar-text">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <button
        type="button"
        className="nav-link nav-logout"
        data-tip="ออกจากระบบ"
        onClick={() => {
          logout()
          navigate('/login')
        }}
      >
        <LogOut {...ICON} />
        <span className="sidebar-text">ออกจากระบบ</span>
      </button>
    </aside>
  )
}

export default Sidebar
