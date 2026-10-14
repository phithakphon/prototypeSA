import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, UserCheck, UserX, Megaphone } from '../components/icons'
import { Loading, ErrorState, Empty } from '../components/States'
import { useApi } from '../useApi'
import { formatDate, fullName, STATUS } from '../format'
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

function StatCard({ label, value, icon: Icon, tone, index }) {
  const n = useCountUp(value)
  return (
    <article className={`stat-card tone-${tone}`} style={{ animationDelay: `${index * 70}ms` }}>
      <span className="stat-icon">
        <Icon width={26} height={26} />
      </span>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value" aria-label={`${value} คน`}>
          <span aria-hidden="true">{n}</span> <small aria-hidden="true">คน</small>
        </p>
      </div>
    </article>
  )
}

function Dashboard() {
  const { data, loading, error, reload } = useApi('/dashboard/summary')

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { counts, recentEmployees, announcements } = data
  const stats = [
    { key: 'total', label: 'พนักงานทั้งหมด', value: counts.total, icon: Users, tone: 'blue' },
    { key: 'active', label: 'พนักงานปฏิบัติงาน', value: counts.active, icon: UserCheck, tone: 'green' },
    { key: 'resigned', label: 'พนักงานลาออก', value: counts.resigned, icon: UserX, tone: 'red' },
  ]

  return (
    <div className="dashboard">
      <h1 className="page-title">หน้าหลัก</h1>

      <section className="stat-grid" aria-label="สรุปจำนวนพนักงาน">
        {stats.map((s, i) => (
          <StatCard key={s.key} {...s} index={i} />
        ))}
      </section>

      <div className="dash-grid">
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
                {recentEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-cell">ยังไม่มีข้อมูลพนักงาน</td>
                  </tr>
                ) : (
                  recentEmployees.map((e) => (
                    <tr key={e.id}>
                      <td data-label="รหัสพนักงาน" className="mono">
                        <Link to={`/employees/${e.id}`}>{e.employeeCode}</Link>
                      </td>
                      <td data-label="ชื่อ-นามสกุล">{fullName(e)}</td>
                      <td data-label="ตำแหน่ง">{e.position}</td>
                      <td data-label="วันที่เริ่มงาน">{formatDate(e.startDate)}</td>
                      <td data-label="สถานะ">
                        <span className={`badge ${STATUS[e.status].cls}`}>{STATUS[e.status].label}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel" aria-labelledby="news-title">
          <h2 id="news-title" className="panel-title">
            <Megaphone width={20} height={20} /> ข่าวสาร/ประกาศ
          </h2>
          {announcements.length === 0 ? (
            <Empty text="ยังไม่มีประกาศ" />
          ) : (
            <ol className="timeline">
              {announcements.map((a) => (
                <li key={a.id} className="timeline-item">
                  <span className="timeline-dot" aria-hidden="true" />
                  <div className="timeline-card">
                    <p className="timeline-title">{a.title}</p>
                    <time className="timeline-date">{formatDate(a.publishedAt)}</time>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}

export default Dashboard
