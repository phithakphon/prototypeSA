import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, UserMinus, Eye } from '../components/icons'
import Modal from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import { Loading, ErrorState, Empty } from '../components/States'
import { useToast } from '../components/toast'
import { useApi } from '../useApi'
import { api } from '../api'
import { formatDate, fullName, todayIso, STATUS } from '../format'

const EMPTY_FORM = {
  employeeCode: '', firstName: '', lastName: '', department: '', position: '',
  startDate: '', nationalId: '', phone: '', email: '', address: '',
}

function Field({ id, label, required, error, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}{required && <span className="req"> *</span>}</label>
      {children}
      {error && <p className="field-error" id={`${id}-err`}>{error}</p>}
    </div>
  )
}

// UC-04 add / edit form
function EmployeeForm({ employee, onClose, onSaved }) {
  const toast = useToast()
  const editing = Boolean(employee)
  const [form, setForm] = useState(() => {
    if (!employee) return EMPTY_FORM
    return Object.fromEntries(Object.keys(EMPTY_FORM).map((k) => [k, employee[k] ?? '']))
  })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const input = (k, label, opts = {}) => (
    <Field id={`f-${k}`} label={label} required={opts.required} error={errors[k]}>
      <input
        id={`f-${k}`}
        className="input"
        type={opts.type || 'text'}
        value={form[k]}
        onChange={set(k)}
        aria-invalid={errors[k] ? 'true' : undefined}
        aria-describedby={errors[k] ? `f-${k}-err` : undefined}
        max={opts.type === 'date' ? todayIso() : undefined}
        inputMode={opts.inputMode}
      />
    </Field>
  )

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setFormError('')
    try {
      await api(editing ? `/employees/${employee.id}` : '/employees', {
        method: editing ? 'PUT' : 'POST',
        body: form,
      })
      toast(editing ? 'บันทึกการแก้ไขข้อมูลพนักงานแล้ว' : 'เพิ่มพนักงานใหม่เรียบร้อยแล้ว')
      onSaved()
    } catch (err) {
      setErrors(err.errors)
      setFormError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={editing ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'} onClose={onClose} wide>
      <form onSubmit={submit} noValidate>
        {formError && <p className="form-alert" role="alert">{formError}</p>}
        <div className="form-grid">
          {input('employeeCode', 'รหัสพนักงาน', { required: true })}
          {input('startDate', 'วันที่เริ่มงาน', { required: true, type: 'date' })}
          {input('firstName', 'ชื่อ', { required: true })}
          {input('lastName', 'นามสกุล', { required: true })}
          {input('department', 'แผนก', { required: true })}
          {input('position', 'ตำแหน่ง', { required: true })}
        </div>
        <h3 className="form-section">ข้อมูลส่วนบุคคล (ไม่บังคับ)</h3>
        <div className="form-grid">
          {input('nationalId', 'เลขบัตรประชาชน', { inputMode: 'numeric' })}
          {input('phone', 'เบอร์โทรศัพท์', { type: 'tel' })}
          {input('email', 'อีเมล', { type: 'email' })}
          <div className="span-2">
            <Field id="f-address" label="ที่อยู่" error={errors.address}>
              <textarea id="f-address" className="textarea" value={form.address} onChange={set('address')} />
            </Field>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        </div>
      </form>
    </Modal>
  )
}

// UC-06 resignation, with confirmation
function ResignDialog({ employee, onClose, onDone }) {
  const toast = useToast()
  const [date, setDate] = useState(todayIso())
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState({})
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  async function confirm() {
    setBusy(true)
    try {
      await api(`/employees/${employee.id}/resign`, { method: 'POST', body: { resignationDate: date, reason } })
      toast(`บันทึกการลาออกของ ${fullName(employee)} เรียบร้อยแล้ว`)
      onDone()
    } catch (err) {
      setErrors(err.errors)
      toast(err.message, 'error')
      setConfirming(false)
      setBusy(false)
    }
  }

  if (confirming) {
    return (
      <ConfirmDialog
        title="ยืนยันการลาออก"
        danger
        confirmLabel="ยืนยันการลาออก"
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setConfirming(false)}
      >
        <p>ต้องการเปลี่ยนสถานะของ <strong>{fullName(employee)}</strong> ({employee.employeeCode}) เป็น &quot;ลาออก&quot; โดยมีผลวันที่ {formatDate(date)} ใช่หรือไม่?</p>
        <p className="muted">ข้อมูลและประวัติของพนักงานจะยังถูกเก็บไว้ในระบบ ไม่มีการลบข้อมูล</p>
      </ConfirmDialog>
    )
  }

  return (
    <Modal title={`แจ้งลาออก: ${fullName(employee)}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setErrors({})
          setConfirming(true)
        }}
        noValidate
      >
        <div className="stack">
          <Field id="r-date" label="วันที่ลาออก" required error={errors.resignationDate}>
            <input id="r-date" className="input" type="date" min={employee.startDate} max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={errors.resignationDate ? 'true' : undefined} />
          </Field>
          <Field id="r-reason" label="เหตุผล (ไม่บังคับ)" error={errors.reason}>
            <textarea id="r-reason" className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-danger">ดำเนินการต่อ</button>
        </div>
      </form>
    </Modal>
  )
}

// Loads full details (incl. confidential fields) before editing
function EditLoader({ id, onClose, onSaved }) {
  const { data, error, reload } = useApi(`/employees/${id}`)
  if (error) {
    return (
      <Modal title="แก้ไขข้อมูลพนักงาน" onClose={onClose}>
        <ErrorState error={error} onRetry={reload} />
      </Modal>
    )
  }
  if (!data) {
    return (
      <Modal title="แก้ไขข้อมูลพนักงาน" onClose={onClose}>
        <Loading />
      </Modal>
    )
  }
  return <EmployeeForm employee={data.employee} onClose={onClose} onSaved={onSaved} />
}

function EmployeeManage() {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [dialog, setDialog] = useState(null) // { type: 'add' | 'edit' | 'resign', employee? }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300)
    return () => clearTimeout(t)
  }, [q])

  const { data, loading, error, reload } = useApi(`/employees?${new URLSearchParams(debouncedQ ? { q: debouncedQ } : {})}`)

  const close = () => setDialog(null)
  const done = () => {
    setDialog(null)
    reload()
  }

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">จัดการข้อมูลพนักงาน</h1>
        <button type="button" className="btn btn-primary" onClick={() => setDialog({ type: 'add' })}>
          <Plus width={18} height={18} /> เพิ่มพนักงาน
        </button>
      </div>

      <section className="panel">
        <div className="toolbar" role="search">
          <input className="input" type="search" placeholder="ค้นหาด้วยรหัสพนักงาน ชื่อ หรือแผนก" aria-label="ค้นหาพนักงาน" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : data.employees.length === 0 ? (
          <Empty text="ไม่พบพนักงาน" />
        ) : (
          <div className="table-wrap" tabIndex={0} role="region" aria-label="รายชื่อพนักงาน">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">รหัสพนักงาน</th>
                  <th scope="col">ชื่อ-นามสกุล</th>
                  <th scope="col">แผนก</th>
                  <th scope="col">ตำแหน่ง</th>
                  <th scope="col">สถานะ</th>
                  <th scope="col"><span className="sr-only">การดำเนินการ</span></th>
                </tr>
              </thead>
              <tbody>
                {data.employees.map((e) => (
                  <tr key={e.id}>
                    <td data-label="รหัสพนักงาน" className="mono">{e.employeeCode}</td>
                    <td data-label="ชื่อ-นามสกุล">{fullName(e)}</td>
                    <td data-label="แผนก">{e.department}</td>
                    <td data-label="ตำแหน่ง">{e.position}</td>
                    <td data-label="สถานะ"><span className={`badge ${STATUS[e.status].cls}`}>{STATUS[e.status].label}</span></td>
                    <td className="actions-cell">
                      <div className="row-actions">
                        <Link className="btn btn-ghost btn-sm" to={`/employees/${e.id}`} aria-label={`ดูรายละเอียด ${fullName(e)}`}><Eye width={16} height={16} /></Link>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog({ type: 'edit', employee: e })}>
                          <Pencil width={16} height={16} /> แก้ไข
                        </button>
                        {e.status === 'active' && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog({ type: 'resign', employee: e })}>
                            <UserMinus width={16} height={16} /> แจ้งลาออก
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dialog?.type === 'add' && <EmployeeForm onClose={close} onSaved={done} />}
      {dialog?.type === 'edit' && <EditLoader id={dialog.employee.id} onClose={close} onSaved={done} />}
      {dialog?.type === 'resign' && <ResignDialog employee={dialog.employee} onClose={close} onDone={done} />}
    </div>
  )
}

export default EmployeeManage
