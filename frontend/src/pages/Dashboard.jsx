import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BellRing, CalendarDays, History, Megaphone, UserCheck, UserX, Users } from 'lucide-react'
import { ErrorState, Empty } from '../components/States'
import Notice from '../components/Notice'
import StatusBadge from '../components/StatusBadge'
import { useApi } from '../useApi'
import { useAuth } from '../auth/auth'
import { formatDate, fullName } from '../format'
import './Dashboard.css'

function useCountUp(target, duration = 700) {
  const reduce =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [n, setN] = useState(reduce ? target : 0)

  useEffect(() => {
    if (reduce) return undefined
    let raf
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      setN(Math.round(target * (1 - (1 - p) ** 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, reduce])

  return reduce ? target : n
}

function StatCard({ label, value, total, caption, icon: Icon, tone, index }) {
  const n = useCountUp(value)
  const percent = total ? Math.round((value / total) * 100) : 0
  return (
    <article className={`stat-card tone-${tone}`} style={{ animationDelay: `${index * 70}ms` }}>
      <span className="stat-icon">
        <Icon size={34} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <div className="stat-body">
        <h2 className="stat-label">{label}</h2>
        <p className="stat-value" aria-label={`${value} คน`}>
          <span aria-hidden="true">{n}</span> <small aria-hidden="true">คน</small>
        </p>
        <p className="stat-caption">{caption(percent)}</p>
        <div className="stat-bar" aria-hidden="true">
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>
    </article>
  )
}

function DashboardSkeleton({ selfOnly }) {
  return (
    <div className="dashboard" role="status" aria-label="กำลังโหลดข้อมูล">
      <div className="skeleton sk-title" />
      {selfOnly ? (
        <>
          <div className="skeleton sk-card" />
          <div className="skeleton sk-panel sk-gap" />
        </>
      ) : (
        <>
          <div className="stat-grid">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton sk-card" />)}
          </div>
          <div className="dash-grid">
            <div className="skeleton sk-panel" />
            <div className="skeleton sk-panel" />
          </div>
        </>
      )}
    </div>
  )
}

const Fact = ({ label, children }) => (
  <div>
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>
)

// Personal welcome card: only the signed-in employee's own information.
function MyProfileCard({ employeeId }) {
  const { data, loading, error, reload } = useApi(employeeId ? `/employees/${employeeId}` : null)
  if (!employeeId) return null
  if (loading) return <div className="skeleton sk-card" role="status" aria-label="กำลังโหลดข้อมูลของฉัน" />
  if (error) return <ErrorState error={error} onRetry={reload} />
  const e = data.employee
  return (
    <section className="panel welcome-card" aria-labelledby="welcome-title">
      <div className="welcome-top">
        <span className="profile-avatar" aria-hidden="true">{e.firstName.charAt(0)}</span>
        <div>
          <p className="welcome-eyebrow">ยินดีต้อนรับ</p>
          <h2 id="welcome-title" className="welcome-name">{fullName(e)}</h2>
          <StatusBadge status={e.status} />
        </div>
      </div>
      <dl className="welcome-facts">
        <Fact label="รหัสพนักงาน">{e.employeeCode}</Fact>
        <Fact label="ตำแหน่ง">{e.position}</Fact>
        <Fact label="วันที่เริ่มงาน">{formatDate(e.startDate)}</Fact>
      </dl>
      <Link className="btn btn-primary" to="/employees/history">
        <History size={20} strokeWidth={1.75} aria-hidden="true" /> ดูประวัติการทำงานของฉัน
        <ArrowRight size={20} strokeWidth={2} aria-hidden="true" />
      </Link>
    </section>
  )
}

// Important announcements are repeated as notices so employees do not miss them.
function ImportantNotices({ announcements }) {
  const important = announcements.filter((a) => a.important)
  if (important.length === 0) return null
  return (
    <section className="notice-stack" aria-label="การแจ้งเตือนสำคัญ">
      {important.map((a) => (
        <Notice key={a.id} variant="warning" icon={BellRing} title="การแจ้งเตือนสำคัญ">
          {a.title} (ประกาศเมื่อ {formatDate(a.publishedAt)})
        </Notice>
      ))}
    </section>
  )
}

function EmployeeHome({ employeeId, announcements }) {
  return (
    <div className="dashboard employee-home">
      <h1 className="page-title">หน้าหลัก</h1>
      <MyProfileCard employeeId={employeeId} />
      <ImportantNotices announcements={announcements} />
      <AnnouncementPanel announcements={announcements} />
    </div>
  )
}

function RecentEmployees({ employees }) {
  return (
    <section className="panel" aria-labelledby="recent-title">
      <h2 id="recent-title" className="panel-title">พนักงานล่าสุดที่เพิ่มในระบบ</h2>
      <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="recent-title">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">รหัสพนักงาน</th>
              <th scope="col">ชื่อ-นามสกุล</th>
              <th scope="col">ตำแหน่ง</th>
              <th scope="col">วันที่เริ่มงาน</th>
              <th scope="col">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-cell">ยังไม่มีข้อมูลพนักงาน</td>
              </tr>
            ) : (
              employees.map((e) => (
                <tr key={e.id}>
                  <td data-label="รหัสพนักงาน" className="mono">
                    <Link to={`/employees/${e.id}`}>{e.employeeCode}</Link>
                  </td>
                  <td data-label="ชื่อ-นามสกุล">{fullName(e)}</td>
                  <td data-label="ตำแหน่ง">{e.position}</td>
                  <td data-label="วันที่เริ่มงาน">{formatDate(e.startDate)}</td>
                  <td data-label="สถานะ"><StatusBadge status={e.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// Announcements use a soft amber accent so they stand out from the blue-and-white dashboard.
function AnnouncementPanel({ announcements }) {
  return (
    <section className="panel panel-amber" aria-labelledby="news-title">
      <h2 id="news-title" className="panel-title">
        <span className="title-chip">
          <Megaphone size={26} strokeWidth={1.75} aria-hidden="true" />
        </span>
        ข่าวสาร/ประกาศ
      </h2>
      {announcements.length === 0 ? (
        <Empty text="ยังไม่มีประกาศ" />
      ) : (
        <ol className="timeline timeline-amber">
          {announcements.map((a) => (
            <li key={a.id} className={`timeline-item${a.important ? ' is-important' : ''}`}>
              <span className="timeline-dot" aria-hidden="true" />
              <div className="timeline-card">
                {a.important && (
                  <span className="important-tag">
                    <BellRing size={16} strokeWidth={2} aria-hidden="true" /> สำคัญ
                  </span>
                )}
                <p className="timeline-title">{a.title}</p>
                <p className="timeline-date">
                  <CalendarDays size={18} strokeWidth={1.75} aria-hidden="true" />
                  <time dateTime={a.publishedAt}>{formatDate(a.publishedAt)}</time>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function Dashboard() {
  const { data, loading, error, reload } = useApi('/dashboard/summary')
  const { user, can } = useAuth()
  const selfOnly = can('employee:selfOnly')

  if (loading) return <DashboardSkeleton selfOnly={selfOnly} />
  if (error) return <ErrorState error={error} onRetry={reload} />

  // Employees get a personal home page: no organisation-wide statistics or other employees' records
  if (selfOnly) return <EmployeeHome employeeId={user.employeeId} announcements={data.announcements} />

  const { counts, recentEmployees, announcements } = data
  const stats = [
    { key: 'total', label: 'พนักงานทั้งหมด', value: counts.total, icon: Users, tone: 'blue', caption: () => 'รวมพนักงานทุกสถานะในระบบ' },
    { key: 'active', label: 'พนักงานปฏิบัติงาน', value: counts.active, icon: UserCheck, tone: 'green', caption: (p) => `ยังปฏิบัติงานอยู่ ${p}% ของทั้งหมด` },
    { key: 'resigned', label: 'พนักงานลาออก', value: counts.resigned, icon: UserX, tone: 'red', caption: (p) => `ลาออกแล้ว ${p}% ของทั้งหมด` },
  ]

  return (
    <div className="dashboard">
      <h1 className="page-title">หน้าหลัก</h1>

      <section className="stat-grid" aria-label="สรุปจำนวนพนักงาน">
        {stats.map((s, i) => (
          <StatCard key={s.key} {...s} total={counts.total} index={i} />
        ))}
      </section>

      <div className="dash-grid">
        <RecentEmployees employees={recentEmployees} />

        <AnnouncementPanel announcements={announcements} />
      </div>
    </div>
  )
}

export default Dashboard
