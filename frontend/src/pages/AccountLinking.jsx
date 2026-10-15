import { useEffect, useState } from 'react'
import { Link2, Save, Unlink, X } from 'lucide-react'
import Modal from '../components/Modal'
import Notice from '../components/Notice'
import ConfirmDialog from '../components/ConfirmDialog'
import { Loading, ErrorState, Empty } from '../components/States'
import { useToast } from '../components/toast'
import { useApi } from '../useApi'
import { api } from '../api'
import { formatDate, fullName } from '../format'

// HR workflow: verify a self-registered account and link it to an existing employee record.
// The server enforces everything (HR only, unclaimed active employee, code re-typed); this page is only the form.
function LinkDialog({ account, onClose, onLinked }) {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [selected, setSelected] = useState(null)
  const [code, setCode] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250)
    return () => clearTimeout(t)
  }, [q])
  const { data, loading, error, reload } = useApi(`/accounts/linkable-employees?${new URLSearchParams(debounced ? { q: debounced } : {})}`)
  const candidates = data?.employees || []

  async function submit(e) {
    e.preventDefault()
    setErrors({})
    setFormError('')
    if (!selected) return setFormError('กรุณาเลือกพนักงานที่ต้องการผูกกับบัญชีนี้')
    setSaving(true)
    try {
      await api(`/accounts/${account.id}/link`, { method: 'POST', body: { employeeId: selected.id, employeeCode: code } })
      toast(`ผูกบัญชี ${account.username} กับ ${fullName(selected)} แล้ว`)
      onLinked()
    } catch (err) {
      setErrors(err.errors || {})
      setFormError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`ผูกบัญชี ${account.username} กับพนักงาน`}
      icon={Link2}
      onClose={onClose}
      closeOnBackdrop={false}
      wide
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            <X size={20} strokeWidth={1.75} aria-hidden="true" /> ยกเลิก
          </button>
          <button type="submit" form="link-form" className="btn btn-primary" disabled={saving || !selected}>
            <Save size={20} strokeWidth={1.75} aria-hidden="true" /> {saving ? 'กำลังบันทึก...' : 'ยืนยันการผูกบัญชี'}
          </button>
        </>
      }
    >
      <form id="link-form" onSubmit={submit} noValidate>
        {formError && <Notice variant="error" className="form-alert">{formError}</Notice>}
        <Notice variant="info" title="ตรวจสอบตัวตนก่อนผูกบัญชี">
          ผู้ใช้จะเห็นข้อมูลส่วนตัวและเงินเดือนของพนักงานที่เลือกทันที กรุณายืนยันตัวตนเจ้าของบัญชีกับพนักงานคนนั้นก่อน
          บทบาทของบัญชีจะไม่เปลี่ยน (ยังเป็นพนักงาน) และระบบจะบันทึกว่าใครเป็นผู้ผูกบัญชี
        </Notice>
        <div className="field">
          <label htmlFor="f-employeeSearch">ค้นหาพนักงาน (รหัสหรือชื่อ)</label>
          <input id="f-employeeSearch" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : candidates.length === 0 ? (
          <Empty text="ไม่พบพนักงานที่ผูกบัญชีได้ (ต้องยังปฏิบัติงานและยังไม่มีบัญชี)" />
        ) : (
          <fieldset className="field">
            <legend>เลือกพนักงาน</legend>
            {candidates.map((c) => (
              <label key={c.id} className="radio-row">
                <input
                  type="radio"
                  name="employee"
                  checked={selected?.id === c.id}
                  onChange={() => {
                    setSelected(c)
                    setCode('')
                    setErrors({})
                  }}
                />{' '}
                <span className="mono">{c.employeeCode}</span> {fullName(c)} — {c.position}
              </label>
            ))}
          </fieldset>
        )}
        {errors.employeeId && <p className="field-error">{errors.employeeId}</p>}
        {selected && (
          <div className="field">
            <label htmlFor="f-employeeCode">พิมพ์รหัสพนักงาน <span className="mono">{selected.employeeCode}</span> เพื่อยืนยัน<span className="req"> *</span></label>
            <input
              id="f-employeeCode"
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              aria-invalid={errors.employeeCode ? 'true' : undefined}
              aria-describedby={errors.employeeCode ? 'f-employeeCode-err' : undefined}
            />
            {errors.employeeCode && <p className="field-error" id="f-employeeCode-err">{errors.employeeCode}</p>}
          </div>
        )}
      </form>
    </Modal>
  )
}

function AccountLinking() {
  const toast = useToast()
  const pending = useApi('/accounts/pending')
  const linked = useApi('/accounts/linked')
  const [linking, setLinking] = useState(null)
  const [unlinking, setUnlinking] = useState(null)
  const [busy, setBusy] = useState(false)
  const [unlinkError, setUnlinkError] = useState('')
  const accounts = pending.data?.accounts || []
  const linkedAccounts = linked.data?.accounts || []

  async function unlink() {
    setBusy(true)
    setUnlinkError('')
    try {
      await api(`/accounts/${unlinking.id}/unlink`, { method: 'POST' })
      toast(`ยกเลิกการผูกบัญชี ${unlinking.username} แล้ว`)
      setUnlinking(null)
      pending.reload()
      linked.reload()
    } catch (err) {
      // keep the dialog open so the person can read the reason and retry or cancel
      setUnlinkError(err.message)
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">ผูกบัญชีผู้ใช้กับพนักงาน</h1>
      </div>
      <p className="page-desc">บัญชีที่สมัครเองจะยังไม่เห็นข้อมูลใด ๆ จนกว่าฝ่ายบุคคลจะตรวจสอบและผูกกับระเบียนพนักงาน</p>

      <section className="panel" aria-labelledby="pending-title">
        <h2 id="pending-title" className="panel-title">บัญชีที่รอตรวจสอบ</h2>
        {pending.loading && !pending.data ? (
          <Loading />
        ) : pending.error ? (
          <ErrorState error={pending.error} onRetry={pending.reload} />
        ) : accounts.length === 0 ? (
          <Empty text="ไม่มีบัญชีที่รอตรวจสอบ" />
        ) : (
          <div className="table-wrap" tabIndex={0} role="region" aria-label="บัญชีที่รอผูกกับพนักงาน">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">ชื่อผู้ใช้</th>
                  <th scope="col">สมัครเมื่อ</th>
                  <th scope="col"><span className="sr-only">การดำเนินการ</span></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td data-label="ชื่อผู้ใช้" className="mono">{a.username}</td>
                    <td data-label="สมัครเมื่อ">{a.createdAt ? formatDate(a.createdAt.slice(0, 10)) : '-'}</td>
                    <td className="actions-cell">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLinking(a)}>
                        <Link2 size={16} strokeWidth={1.75} aria-hidden="true" /> ผูกกับพนักงาน
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="linked-title">
        <h2 id="linked-title" className="panel-title">บัญชีที่ผูกแล้ว</h2>
        {linked.loading && !linked.data ? (
          <Loading />
        ) : linked.error ? (
          <ErrorState error={linked.error} onRetry={linked.reload} />
        ) : linkedAccounts.length === 0 ? (
          <Empty text="ยังไม่มีบัญชีที่ผูกกับพนักงาน" />
        ) : (
          <div className="table-wrap" tabIndex={0} role="region" aria-label="บัญชีที่ผูกกับพนักงานแล้ว">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">ชื่อผู้ใช้</th>
                  <th scope="col">พนักงาน</th>
                  <th scope="col"><span className="sr-only">การดำเนินการ</span></th>
                </tr>
              </thead>
              <tbody>
                {linkedAccounts.map((a) => (
                  <tr key={a.id}>
                    <td data-label="ชื่อผู้ใช้" className="mono">{a.username}</td>
                    <td data-label="พนักงาน"><span className="mono">{a.employeeCode}</span> {fullName(a)}</td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setUnlinkError('')
                          setUnlinking(a)
                        }}
                        aria-label={`ยกเลิกการผูกบัญชี ${a.username}`}
                      >
                        <Unlink size={16} strokeWidth={1.75} aria-hidden="true" /> ยกเลิกการผูก
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {linking && (
        <LinkDialog
          account={linking}
          onClose={() => setLinking(null)}
          onLinked={() => {
            setLinking(null)
            pending.reload()
            linked.reload()
          }}
        />
      )}

      {unlinking && (
        <ConfirmDialog
          title="ยืนยันการยกเลิกการผูกบัญชี"
          confirmLabel="ยกเลิกการผูก"
          danger
          busy={busy}
          onConfirm={unlink}
          onCancel={() => setUnlinking(null)}
        >
          <p>
            ต้องการยกเลิกการผูกบัญชี <strong>{unlinking.username}</strong> กับ <strong>{fullName(unlinking)}</strong> ({unlinking.employeeCode}) ใช่หรือไม่?
          </p>
          <p className="muted">ผู้ใช้จะมองไม่เห็นข้อมูลของพนักงานคนนี้อีกทันที และบัญชีจะกลับไปรอการตรวจสอบ ระบบจะบันทึกการดำเนินการนี้ไว้</p>
          {unlinkError && <Notice variant="error" role="alert">{unlinkError}</Notice>}
        </ConfirmDialog>
      )}
    </div>
  )
}

export default AccountLinking
