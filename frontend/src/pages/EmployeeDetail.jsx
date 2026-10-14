import { Link, useParams } from 'react-router-dom'
import { Lock } from '../components/icons'
import { Loading, ErrorState, Empty } from '../components/States'
import { useApi } from '../useApi'
import { useAuth } from '../auth/auth'
import { formatDate, formatMoney, fullName, STATUS } from '../format'

const Item = ({ label, children }) => (
  <div>
    <dt>{label}</dt>
    <dd>{children || '-'}</dd>
  </div>
)

function SalarySection({ id }) {
  const { data, loading, error, reload } = useApi(`/employees/${id}/salaries`)
  return (
    <section className="panel" aria-labelledby="salary-title">
      <h2 id="salary-title" className="panel-title">ข้อมูลเงินเดือน</h2>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : data.salaries.length === 0 ? (
        <Empty text="ยังไม่มีข้อมูลเงินเดือน" />
      ) : (
        <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="salary-title">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">วันที่มีผล</th>
                <th scope="col">เงินเดือน</th>
                <th scope="col">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {data.salaries.map((s) => (
                <tr key={s.id}>
                  <td data-label="วันที่มีผล">{formatDate(s.effectiveDate)}</td>
                  <td data-label="เงินเดือน">{formatMoney(s.amount)}</td>
                  <td data-label="หมายเหตุ">{s.note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function EmployeeDetail() {
  const { id } = useParams()
  const { can } = useAuth()
  const { data, loading, error, reload } = useApi(`/employees/${id}`)

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { employee: e, confidentialVisible, isSelf, history } = data
  const showSalary = isSelf || can('salary:manage')

  return (
    <div className="stack">
      <div>
        <Link className="back-link" to="/employees/search">← กลับไปค้นหาพนักงาน</Link>
        <div className="profile-head">
          <span className="profile-avatar" aria-hidden="true">{e.firstName.charAt(0)}</span>
          <div>
            <h1>{fullName(e)}</h1>
            <span className={`badge ${STATUS[e.status].cls}`}>{STATUS[e.status].label}</span>
          </div>
        </div>
      </div>

      <section className="panel" aria-labelledby="info-title">
        <h2 id="info-title" className="panel-title">ข้อมูลพนักงาน</h2>
        <dl className="detail-grid">
          <Item label="รหัสพนักงาน">{e.employeeCode}</Item>
          <Item label="ชื่อ-นามสกุล">{fullName(e)}</Item>
          <Item label="แผนก">{e.department}</Item>
          <Item label="ตำแหน่ง">{e.position}</Item>
          <Item label="วันที่เริ่มงาน">{formatDate(e.startDate)}</Item>
          <Item label="สถานะการทำงาน">{STATUS[e.status].label}</Item>
          {e.status === 'resigned' && <Item label="วันที่ลาออก">{formatDate(e.resignationDate)}</Item>}
        </dl>
      </section>

      <section className="panel" aria-labelledby="personal-title">
        <h2 id="personal-title" className="panel-title">ข้อมูลส่วนบุคคล</h2>
        {confidentialVisible ? (
          <dl className="detail-grid">
            <Item label="เลขบัตรประชาชน">{e.nationalId}</Item>
            <Item label="เบอร์โทรศัพท์">{e.phone}</Item>
            <Item label="อีเมล">{e.email}</Item>
            <Item label="ที่อยู่">{e.address}</Item>
            {e.status === 'resigned' && <Item label="เหตุผลการลาออก">{e.resignationReason}</Item>}
          </dl>
        ) : (
          <p className="notice">
            <Lock width={18} height={18} /> ข้อมูลส่วนบุคคลเป็นความลับ ดูได้เฉพาะเจ้าของข้อมูลและผู้จัดการแผนกตรวจสอบบัญชี
          </p>
        )}
      </section>

      {showSalary ? (
        <SalarySection id={e.id} />
      ) : (
        <section className="panel" aria-labelledby="salary-title">
          <h2 id="salary-title" className="panel-title">ข้อมูลเงินเดือน</h2>
          <p className="masked-value" aria-label="ข้อมูลถูกปกปิด">฿ ••,•••.••</p>
          <p className="notice">
            <Lock width={18} height={18} /> ข้อมูลเงินเดือนเป็นความลับ ดูได้เฉพาะเจ้าของข้อมูลและฝ่ายการเงิน
          </p>
        </section>
      )}

      <section className="panel" aria-labelledby="history-title">
        <h2 id="history-title" className="panel-title">ประวัติพนักงาน</h2>
        {history.length === 0 ? (
          <Empty text="ยังไม่มีประวัติ" />
        ) : (
          <ol className="timeline">
            {history.map((h) => (
              <li key={h.id} className="timeline-item">
                <span className="timeline-dot" aria-hidden="true" />
                <div className="timeline-card">
                  <p className="timeline-title">{h.description}</p>
                  <time className="timeline-date">{formatDate(h.eventDate)}</time>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

export default EmployeeDetail
