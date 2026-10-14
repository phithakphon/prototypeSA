import { useState } from 'react'
import { Link } from 'react-router-dom'
import { RotateCcw } from '../components/icons'
import ConfirmDialog from '../components/ConfirmDialog'
import { Loading, ErrorState, Empty } from '../components/States'
import { useToast } from '../components/toast'
import { useApi } from '../useApi'
import { api } from '../api'
import { formatDate, fullName } from '../format'

// UC-06: review resigned employees (records are preserved, never deleted) and manage their status
function ResignedEmployees() {
  const toast = useToast()
  const { data, loading, error, reload } = useApi('/employees/resigned')
  const [q, setQ] = useState('')
  const [department, setDepartment] = useState('')
  const [reinstating, setReinstating] = useState(null)
  const [busy, setBusy] = useState(false)

  const all = data?.employees || []
  const departments = [...new Set(all.map((e) => e.department))]
  const term = q.trim().toLowerCase()
  const rows = all.filter(
    (e) =>
      (!department || e.department === department) &&
      (!term || `${e.employeeCode} ${fullName(e)} ${e.department} ${e.resignationReason || ''}`.toLowerCase().includes(term)),
  )

  async function reinstate() {
    setBusy(true)
    try {
      await api(`/employees/${reinstating.id}/reinstate`, { method: 'POST' })
      toast(`${fullName(reinstating)} กลับเข้าปฏิบัติงานแล้ว`)
      setReinstating(null)
      reload()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">พนักงานที่ลาออก</h1>
      </div>
      <p className="page-desc">ข้อมูลและประวัติของพนักงานที่ลาออกยังคงถูกเก็บไว้ในระบบ</p>
      <section className="panel">
        <div className="toolbar" role="search">
          <input className="input" type="search" placeholder="ค้นหาด้วยรหัส ชื่อ แผนก หรือเหตุผล" aria-label="ค้นหาพนักงานที่ลาออก" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="select" aria-label="กรองตามแผนก" value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">ทุกแผนก</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : rows.length === 0 ? (
          <Empty text={all.length === 0 ? 'ยังไม่มีพนักงานที่ลาออก' : 'ไม่พบข้อมูลที่ตรงกับเงื่อนไข'} />
        ) : (
          <div className="table-wrap" tabIndex={0} role="region" aria-label="รายชื่อพนักงานที่ลาออก">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">รหัสพนักงาน</th>
                  <th scope="col">ชื่อ-นามสกุล</th>
                  <th scope="col">แผนก / ตำแหน่ง</th>
                  <th scope="col">วันที่ลาออก</th>
                  <th scope="col">เหตุผล</th>
                  <th scope="col"><span className="sr-only">การดำเนินการ</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td data-label="รหัสพนักงาน" className="mono"><Link to={`/employees/${e.id}`}>{e.employeeCode}</Link></td>
                    <td data-label="ชื่อ-นามสกุล">{fullName(e)}</td>
                    <td data-label="แผนก / ตำแหน่ง">{e.department} / {e.position}</td>
                    <td data-label="วันที่ลาออก">{formatDate(e.resignationDate)}</td>
                    <td data-label="เหตุผล">{e.resignationReason || '-'}</td>
                    <td className="actions-cell">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReinstating(e)}>
                        <RotateCcw width={16} height={16} /> กลับเข้าทำงาน
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {reinstating && (
        <ConfirmDialog
          title="ยืนยันการกลับเข้าทำงาน"
          confirmLabel="ยืนยัน"
          busy={busy}
          onConfirm={reinstate}
          onCancel={() => setReinstating(null)}
        >
          <p>ต้องการเปลี่ยนสถานะของ <strong>{fullName(reinstating)}</strong> ({reinstating.employeeCode}) กลับเป็น &quot;ปฏิบัติงาน&quot; ใช่หรือไม่?</p>
          <p className="muted">ระบบจะบันทึกเหตุการณ์นี้ไว้ในประวัติพนักงาน</p>
        </ConfirmDialog>
      )}
    </div>
  )
}

export default ResignedEmployees
