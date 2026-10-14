import { useState } from 'react'
import { api, USE_MOCK } from '../api'
import { useApi } from '../useApi'
import { useAuth } from '../auth/auth'
import Modal from '../components/Modal'
import Notice from '../components/Notice'
import { Loading, ErrorState, Empty } from '../components/States'
import { fullName, todayIso } from '../format'
import { CRITERIA, SCALE, RATING_LABELS, summarize, evaluationErrors } from '../../../shared/evaluations.js'
import './Evaluations.css'

function EmployeeSearch({ onSelect, selecting = false }) {
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function search(event) {
    event.preventDefault()
    if (!code.trim() || loading) return
    setLoading(true); setError(''); setResult(null)
    try {
      const data = await api(`/evaluations/employee?employeeCode=${encodeURIComponent(code.trim())}`)
      setResult(data.employee)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }
  return <div className="stack">
    <form className="toolbar" onSubmit={search}>
      <label className="field">รหัสพนักงาน<input className="input" placeholder="เช่น E100" maxLength={20} disabled={loading} value={code} onChange={e => { setCode(e.target.value); setResult(null); setError('') }} /></label>
      <button className="btn btn-primary" disabled={!code.trim() || loading}>ค้นหา</button>
      <button className="btn btn-ghost" type="button" disabled={loading} onClick={() => { setCode(''); setResult(null); setError('') }}>ล้างข้อมูล</button>
    </form>
    {loading && <Loading />}
    {error && <Notice variant="error">{error}</Notice>}
    {result && <div className="evaluation-employee"><p><strong>{result.employeeCode} · {fullName(result)}</strong><br />{result.department}</p><button type="button" className="btn btn-primary" onClick={() => onSelect(result)}>{selecting ? 'เลือกพนักงาน' : 'ดูผลการประเมิน'}</button></div>}
  </div>
}

function EvaluationDetails({ employee, onClose }) {
  const { data, loading, error, reload } = useApi(`/evaluations?employeeCode=${encodeURIComponent(employee.employeeCode)}`)
  return <Modal title="รายละเอียดผลการประเมิน" onClose={onClose} wide>
    <p><strong>รหัสพนักงาน: {employee.employeeCode} · ชื่อ-นามสกุล: {fullName(employee)}</strong><br />แผนก: {employee.department}</p>
    {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : !data?.evaluations.length ? <Empty text="ยังไม่มีผลการประเมินสำหรับพนักงานรายนี้" /> : <div className="stack"><h3>ประวัติการประเมิน</h3>{data.evaluations.map((record, index) => <article className="evaluation-record" key={record.id}>
      <h3>{index === 0 ? 'ผลการประเมินล่าสุด' : 'ผลการประเมินครั้งก่อน'} · รอบการประเมิน: {record.evaluationPeriod}</h3>
      <p>วันที่ประเมิน: {record.evaluationDate}<br />ผู้ประเมิน: {record.evaluatorName}</p>
      <dl className="evaluation-scores">{CRITERIA.map((criterion, i) => <div key={criterion}><dt>{criterion}</dt><dd>{record.scores[i]} / 5 · {SCALE[record.scores[i] - 1]}</dd></div>)}</dl>
      <p className="evaluation-total"><strong>คะแนนรวม: {record.totalScore} / 30 · ระดับผลการประเมิน: {RATING_LABELS[record.rating] || record.rating}</strong></p>
      <h4>ข้อบกพร่องในการทำงาน</h4><p className="evaluation-text">{record.deficiencies || 'ไม่ได้ระบุ'}</p>
      <h4>ข้อเสนอแนะและแนวทางปรับปรุง</h4><p className="evaluation-text">{record.recommendations || 'ไม่ได้ระบุ'}</p>
    </article>)}</div>}
  </Modal>
}

function AddEvaluation({ onClose, onSaved }) {
  const { user } = useAuth()
  const [employee, setEmployee] = useState(null)
  const [form, setForm] = useState({ evaluationPeriod: '', evaluationDate: todayIso(), evaluatorName: user.displayName || '', scores: Array(6).fill(3), deficiencies: '', recommendations: '' })
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const change = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const summary = summarize(form.scores)
  async function save(event) {
    event.preventDefault()
    const validation = evaluationErrors(form)
    if (!employee) validation.employeeCode = 'กรุณาเลือกพนักงานที่มีข้อมูลในระบบก่อนบันทึก'
    setErrors(validation); setError('')
    if (Object.keys(validation).length || saving) return
    setSaving(true)
    try {
      await api('/evaluations', { method: 'POST', body: { ...form, employeeCode: employee.employeeCode } })
      onSaved()
    } catch (err) { setError(err.message); setErrors(err.errors || {}) }
    finally { setSaving(false) }
  }
  return <Modal title="เพิ่มการประเมิน" onClose={onClose} closeOnBackdrop={!saving} wide>
    <div className="stack">
      <EmployeeSearch onSelect={setEmployee} selecting />
      {employee && <Notice>{employee.employeeCode} · {fullName(employee)} · {employee.department}<button type="button" className="btn btn-ghost btn-sm" disabled={saving} onClick={() => setEmployee(null)}>เปลี่ยนพนักงาน</button></Notice>}
      <form className="stack" onSubmit={save} noValidate>
        <fieldset disabled={saving} className="evaluation-fields">
          <div className="form-grid">{[['evaluationPeriod', 'รอบการประเมิน', 'text'], ['evaluationDate', 'วันที่ประเมิน', 'date'], ['evaluatorName', 'ผู้ประเมิน', 'text']].map(([key, label, type]) => <label className="field" key={key}>{label}<input className="input" type={type} required maxLength={200} value={form[key]} onChange={e => change(key, e.target.value)} /></label>)}</div>
          <p>ระดับคะแนน: 5 = ดีเยี่ยม · 4 = ดี · 3 = พอใช้ · 2 = ต้องปรับปรุง · 1 = ต้องปรับปรุงเร่งด่วน</p>
          <div className="form-grid">{CRITERIA.map((criterion, i) => <label className="field" key={criterion}>{criterion}<select className="select" value={form.scores[i]} onChange={e => change('scores', form.scores.map((score, j) => j === i ? Number(e.target.value) : score))}>{SCALE.map((label, j) => <option key={label} value={j + 1}>{j + 1} — {label}</option>)}</select></label>)}</div>
          <label className="field">ข้อบกพร่องในการทำงาน<textarea className="input" maxLength={5000} rows={3} value={form.deficiencies} onChange={e => change('deficiencies', e.target.value)} /></label>
          <label className="field">ข้อเสนอแนะและแนวทางปรับปรุง<textarea className="input" maxLength={5000} rows={3} value={form.recommendations} onChange={e => change('recommendations', e.target.value)} /></label>
          <p className="evaluation-total" aria-live="polite"><strong>คะแนนรวม: {summary.totalScore} / 30 · ระดับผลการประเมิน: {RATING_LABELS[summary.rating]}</strong></p>
          {Object.entries(errors).map(([key, message]) => <p className="field-error" role="alert" key={key}>{message}</p>)}
          {error && <Notice variant="error">{error}</Notice>}
          <div className="toolbar"><button className="btn btn-primary" disabled={!employee || saving || USE_MOCK}>{saving ? 'กำลังบันทึก…' : 'บันทึกผลการประเมิน'}</button><button type="button" className="btn btn-ghost" disabled={saving} onClick={onClose}>ยกเลิก</button></div>
        </fieldset>
      </form>
    </div>
  </Modal>
}

export default function Evaluations() {
  const { can } = useAuth()
  const [selected, setSelected] = useState(null)
  const [adding, setAdding] = useState(false)
  const [success, setSuccess] = useState(false)
  return <div className="stack">
    <div className="page-head"><h1 className="page-title">ผลการประเมินพนักงาน</h1>{can('evaluation:manage') && <button className="btn btn-primary" onClick={() => { setSuccess(false); setAdding(true) }}>+ เพิ่มการประเมิน</button>}</div>
    <p className="page-desc">ค้นหาด้วยรหัสพนักงานเพื่อดูผลและประวัติการประเมิน</p>
    {USE_MOCK && <Notice>โหมดข้อมูลตัวอย่าง: พนักงานและผลการประเมินเป็นข้อมูลสมมติสำหรับทดสอบ การบันทึกผลการประเมินใหม่ต้องเชื่อมต่อระบบฐานข้อมูลจริง</Notice>}
    {success && <Notice variant="success" role="status">บันทึกผลการประเมินสำเร็จ</Notice>}
    <section className="panel"><EmployeeSearch onSelect={setSelected} /></section>
    {selected && <EvaluationDetails employee={selected} onClose={() => setSelected(null)} />}
    {adding && <AddEvaluation onClose={() => setAdding(false)} onSaved={() => { setAdding(false); setSuccess(true) }} />}
  </div>
}
