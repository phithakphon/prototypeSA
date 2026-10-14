import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BriefcaseBusiness, History, Lock, UserRound, Wallet } from 'lucide-react'
import Notice from '../components/Notice'
import { Loading, ErrorState, Empty } from '../components/States'
import StatusBadge from '../components/StatusBadge'
import { useApi } from '../useApi'
import { useAuth } from '../auth/auth'
import { formatDate, formatMoney, fullName, STATUS } from '../format'

const Item = ({ label, children }) => (
  <div>
    <dt>{label}</dt>
    <dd>{children || '-'}</dd>
  </div>
)

const TitleIcon = ({ icon: Icon }) => <Icon size={26} strokeWidth={1.75} aria-hidden="true" />

function SalarySection({ id }) {
  const { data, loading, error, reload } = useApi(`/employees/${id}/salaries`)
  return (
    <section className="panel" aria-labelledby="salary-title">
      <h2 id="salary-title" className="panel-title"><TitleIcon icon={Wallet} /> ข้อมูลเงินเดือน</h2>
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

// `mine`: the signed-in employee's own history page (/employees/history for self-only roles).
// It shows only their own record: no back link to the search page and no salary section.
function EmployeeDetail({ employeeId, mine = false }) {
  const params = useParams()
  const id = employeeId ?? params.id
  const { can } = useAuth()
  const { data, loading, error, reload } = useApi(`/employees/${id}`)

  if (loading) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />

  const { employee: e, confidentialVisible, isSelf, history } = data
  // finance manages salaries; HR may view them (read-only); owners see their own on other pages
  const showSalary = !mine && (isSelf || can('salary:manage') || can('salary:view'))

  return (
    <div className="stack">
      <div>
        {mine ? (
          <p className="eyebrow-label">ประวัติของฉัน</p>
        ) : (
          <Link className="back-link" to="/employees/search">
            <ArrowLeft size={20} strokeWidth={1.75} aria-hidden="true" /> กลับไปค้นหาพนักงาน
          </Link>
        )}
        <div className="profile-head">
          <span className="profile-avatar" aria-hidden="true">{e.firstName.charAt(0)}</span>
          <div>
            <h1>{fullName(e)}</h1>
            <StatusBadge status={e.status} />
          </div>
        </div>
      </div>

      <section className="panel" aria-labelledby="info-title">
        <h2 id="info-title" className="panel-title"><TitleIcon icon={BriefcaseBusiness} /> ข้อมูลพนักงาน</h2>
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
        <h2 id="personal-title" className="panel-title"><TitleIcon icon={UserRound} /> ข้อมูลส่วนบุคคล</h2>
        {confidentialVisible ? (
          <dl className="detail-grid">
            <Item label="เลขบัตรประชาชน">{e.nationalId}</Item>
            <Item label="เบอร์โทรศัพท์">{e.phone}</Item>
            <Item label="อีเมล">{e.email}</Item>
            <Item label="ที่อยู่">{e.address}</Item>
            {e.status === 'resigned' && <Item label="เหตุผลการลาออก">{e.resignationReason}</Item>}
          </dl>
        ) : (
          <Notice icon={Lock}>
            ข้อมูลส่วนบุคคลเป็นความลับ ดูได้เฉพาะเจ้าของข้อมูล ผู้จัดการ ฝ่ายบุคคล และผู้บริหาร
          </Notice>
        )}
      </section>

      {showSalary ? (
        <SalarySection id={e.id} />
      ) : (
        !mine && (
          <section className="panel" aria-labelledby="salary-title">
            <h2 id="salary-title" className="panel-title"><TitleIcon icon={Wallet} /> ข้อมูลเงินเดือน</h2>
            <p className="masked-value" aria-label="ข้อมูลถูกปกปิด">฿ ••,•••.••</p>
            <Notice icon={Lock}>
              ข้อมูลเงินเดือนเป็นความลับ ดูได้เฉพาะเจ้าของข้อมูล ฝ่ายการเงิน และฝ่ายบุคคล
            </Notice>
          </section>
        )
      )}

      <section className="panel" aria-labelledby="history-title">
        <h2 id="history-title" className="panel-title">
          <TitleIcon icon={History} /> {mine ? 'ประวัติการทำงาน' : 'ประวัติพนักงาน'}
        </h2>
        {history.length === 0 ? (
          <Empty text="ยังไม่มีประวัติ" />
        ) : (
          <ol className="timeline">
            {history.map((h) => (
              <li key={h.id} className="timeline-item">
                <span className="timeline-dot" aria-hidden="true" />
                <div className="timeline-card">
                  <p className="timeline-title">{h.description}</p>
                  <time className="timeline-date" dateTime={h.eventDate}>{formatDate(h.eventDate)}</time>
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
