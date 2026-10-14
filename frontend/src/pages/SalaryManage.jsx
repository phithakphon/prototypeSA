import { useState } from 'react'
import { Wallet } from '../components/icons'
import Modal from '../components/Modal'
import Notice from '../components/Notice'
import { Loading, ErrorState, Empty } from '../components/States'
import { useToast } from '../components/toast'
import { useApi } from '../useApi'
import { api } from '../api'
import { formatDate, formatMoney, fullName, todayIso, STATUS } from '../format'

// Salary records of one employee: list + add / edit form
function SalaryDialog({ employee, onClose, onChanged }) {
  const toast = useToast()
  const { data, loading, error, reload } = useApi(`/employees/${employee.id}/salaries`)
  const [editing, setEditing] = useState(null) // salary record or null (= adding)
  const [form, setForm] = useState({ amount: '', effectiveDate: todayIso(), note: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const resigned = employee.status === 'resigned'

  const startEdit = (s) => {
    setEditing(s)
    setForm({ amount: String(s.amount), effectiveDate: s.effectiveDate, note: s.note || '' })
    setErrors({})
  }
  const startAdd = () => {
    setEditing(null)
    setForm({ amount: '', effectiveDate: todayIso(), note: '' })
    setErrors({})
  }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      await api(editing ? `/salaries/${editing.id}` : `/employees/${employee.id}/salaries`, {
        method: editing ? 'PUT' : 'POST',
        body: form,
      })
      toast(editing ? 'แก้ไขข้อมูลเงินเดือนแล้ว' : 'เพิ่มข้อมูลเงินเดือนแล้ว')
      startAdd()
      reload()
      onChanged()
    } catch (err) {
      setErrors(err.errors)
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`เงินเดือน: ${fullName(employee)} (${employee.employeeCode})`} onClose={onClose} wide>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <div className="stack">
          {data.salaries.length === 0 ? (
            <Empty text="ยังไม่มีข้อมูลเงินเดือน" />
          ) : (
            <div className="table-wrap" tabIndex={0} role="region" aria-label="ประวัติเงินเดือน">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">วันที่มีผล</th>
                    <th scope="col">เงินเดือน</th>
                    <th scope="col">หมายเหตุ</th>
                    <th scope="col"><span className="sr-only">แก้ไข</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data.salaries.map((s) => (
                    <tr key={s.id}>
                      <td data-label="วันที่มีผล">{formatDate(s.effectiveDate)}</td>
                      <td data-label="เงินเดือน">{formatMoney(s.amount)}</td>
                      <td data-label="หมายเหตุ">{s.note || '-'}</td>
                      <td className="actions-cell">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(s)}>แก้ไข</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {resigned && !editing ? (
            <Notice variant="warning">พนักงานคนนี้ลาออกแล้ว จึงไม่สามารถเพิ่มเงินเดือนใหม่ได้</Notice>
          ) : (
            <form onSubmit={submit} noValidate>
              <h3 className="form-section">{editing ? 'แก้ไขรายการเงินเดือน' : 'เพิ่มรายการเงินเดือนใหม่'}</h3>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="s-amount">เงินเดือน (บาท) <span className="req">*</span></label>
                  <input id="s-amount" className="input" type="number" min="0" step="0.01" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} aria-invalid={errors.amount ? 'true' : undefined} />
                  {errors.amount && <p className="field-error">{errors.amount}</p>}
                </div>
                <div className="field">
                  <label htmlFor="s-date">วันที่มีผล <span className="req">*</span></label>
                  <input id="s-date" className="input" type="date" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} aria-invalid={errors.effectiveDate ? 'true' : undefined} />
                  {errors.effectiveDate && <p className="field-error">{errors.effectiveDate}</p>}
                </div>
                <div className="field span-2">
                  <label htmlFor="s-note">หมายเหตุ</label>
                  <input id="s-note" className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                  {errors.note && <p className="field-error">{errors.note}</p>}
                </div>
              </div>
              <div className="modal-actions">
                {editing && <button type="button" className="btn btn-ghost" onClick={startAdd} disabled={saving}>ยกเลิกการแก้ไข</button>}
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'กำลังบันทึก...' : editing ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ'}</button>
              </div>
            </form>
          )}
        </div>
      )}
    </Modal>
  )
}

// UC-05
function SalaryManage() {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(null)
  const { data, loading, error, reload } = useApi('/salaries')

  const term = q.trim().toLowerCase()
  const rows = (data?.employees || []).filter(
    (e) => !term || `${e.employeeCode} ${e.firstName} ${e.lastName}`.toLowerCase().includes(term),
  )

  const amounts = (data?.employees || []).filter((e) => e.status === 'active' && e.currentAmount != null).map((e) => e.currentAmount)
  const stats = {
    total: amounts.reduce((a, b) => a + b, 0),
    avg: amounts.length ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0,
    max: amounts.length ? Math.max(...amounts) : 0,
  }

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">จัดการเงินเดือน</h1>
      </div>
      <p className="page-desc">ข้อมูลเงินเดือนเป็นความลับ เข้าถึงได้เฉพาะฝ่ายการเงิน</p>
      {data && (
        <section className="summary-grid" aria-label="สรุปเงินเดือน">
          <article className="summary-card">
            <p className="summary-label">เงินเดือนรวมต่อเดือน (พนักงานปฏิบัติงาน)</p>
            <p className="summary-value">{formatMoney(stats.total)}</p>
          </article>
          <article className="summary-card">
            <p className="summary-label">เงินเดือนเฉลี่ย</p>
            <p className="summary-value">{formatMoney(stats.avg)}</p>
          </article>
          <article className="summary-card">
            <p className="summary-label">เงินเดือนสูงสุด</p>
            <p className="summary-value">{formatMoney(stats.max)}</p>
          </article>
        </section>
      )}
      <section className="panel">
        <div className="toolbar" role="search">
          <input className="input" type="search" placeholder="ค้นหาด้วยรหัสพนักงานหรือชื่อ" aria-label="ค้นหาพนักงาน" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : rows.length === 0 ? (
          <Empty text="ไม่พบพนักงาน" />
        ) : (
          <div className="table-wrap" tabIndex={0} role="region" aria-label="เงินเดือนพนักงาน">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">รหัสพนักงาน</th>
                  <th scope="col">ชื่อ-นามสกุล</th>
                  <th scope="col">สถานะ</th>
                  <th scope="col">เงินเดือนปัจจุบัน</th>
                  <th scope="col"><span className="sr-only">การดำเนินการ</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td data-label="รหัสพนักงาน" className="mono">{e.employeeCode}</td>
                    <td data-label="ชื่อ-นามสกุล">{fullName(e)}</td>
                    <td data-label="สถานะ"><span className={`badge ${STATUS[e.status].cls}`}>{STATUS[e.status].label}</span></td>
                    <td data-label="เงินเดือนปัจจุบัน">{formatMoney(e.currentAmount)}</td>
                    <td className="actions-cell">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(e)}>
                        <Wallet width={16} height={16} /> จัดการ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {selected && <SalaryDialog employee={selected} onClose={() => setSelected(null)} onChanged={reload} />}
    </div>
  )
}

export default SalaryManage
