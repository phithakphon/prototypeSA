import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye } from './icons'
import { Loading, ErrorState, Empty } from './States'
import { useApi } from '../useApi'
import { useAuth } from '../auth/auth'
import { formatDate, fullName, STATUS } from '../format'

// UC-02 / UC-03 entry point: search by code, name or department with filters.
export default function EmployeeFinder({ title, description, showMine = false }) {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  const params = new URLSearchParams()
  if (debouncedQ) params.set('q', debouncedQ)
  if (status) params.set('status', status)

  const { data, loading, error, reload } = useApi(`/employees?${params}`)

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">{title}</h1>
        {showMine && user.employeeId && (
          <Link className="btn btn-ghost" to={`/employees/${user.employeeId}`}>
            <Eye width={18} height={18} /> ประวัติของฉัน
          </Link>
        )}
      </div>
      <p className="page-desc">{description}</p>

      <section className="panel">
        <div className="toolbar" role="search">
          <input
            className="input"
            type="search"
            placeholder="ค้นหาด้วยรหัสพนักงานหรือชื่อ"
            aria-label="ค้นหาพนักงาน"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="select" aria-label="กรองตามสถานะ" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">ทุกสถานะ</option>
            <option value="active">ปฏิบัติงาน</option>
            <option value="resigned">ลาออก</option>
          </select>
        </div>

        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : data.employees.length === 0 ? (
          <Empty text="ไม่พบพนักงานที่ตรงกับเงื่อนไขการค้นหา" />
        ) : (
          <>
            <p className="muted" aria-live="polite">พบ {data.total} รายการ{data.total > data.employees.length ? ` (แสดง ${data.employees.length} รายการแรก)` : ''}</p>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="ผลการค้นหา">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">รหัสพนักงาน</th>
                    <th scope="col">ชื่อ-นามสกุล</th>
                    <th scope="col">ตำแหน่ง</th>
                    <th scope="col">วันที่เริ่มงาน</th>
                    <th scope="col">สถานะ</th>
                    <th scope="col"><span className="sr-only">ดูรายละเอียด</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data.employees.map((e) => (
                    <tr key={e.id}>
                      <td data-label="รหัสพนักงาน" className="mono">{e.employeeCode}</td>
                      <td data-label="ชื่อ-นามสกุล">{fullName(e)}</td>
                      <td data-label="ตำแหน่ง">{e.position}</td>
                      <td data-label="วันที่เริ่มงาน">{formatDate(e.startDate)}</td>
                      <td data-label="สถานะ">
                        <span className={`badge ${STATUS[e.status].cls}`}>{STATUS[e.status].label}</span>
                      </td>
                      <td className="actions-cell">
                        <Link className="btn btn-ghost btn-sm" to={`/employees/${e.id}`}>
                          <Eye width={16} height={16} /> ดูรายละเอียด
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
