import { Navigate, useParams } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../auth/auth'
import EmployeeFinder from '../components/EmployeeFinder'
import EmployeeDetail from './EmployeeDetail'

// Frontend/mock restriction for demonstration only — the real backend must enforce this too.

function AccessDenied({ text }) {
  return (
    <section className="panel" role="alert">
      <h1 className="page-title"><ShieldAlert size={30} strokeWidth={1.75} aria-hidden="true" /> ไม่มีสิทธิ์เข้าถึง</h1>
      <p>{text}</p>
    </section>
  )
}

// /employees/history: employees see only their own record, other roles pick from the list.
export function HistoryRoute() {
  const { user, can } = useAuth()
  if (can('employee:selfOnly')) {
    return user.employeeId ? (
      <EmployeeDetail employeeId={user.employeeId} mine />
    ) : (
      <AccessDenied text="บัญชีของคุณยังไม่ได้เชื่อมกับข้อมูลพนักงาน" />
    )
  }
  return (
    <EmployeeFinder
      title="ประวัติพนักงาน"
      description="เลือกพนักงานเพื่อดูรายละเอียดและประวัติการทำงาน"
      showMine
    />
  )
}

// /employees/:id: self-only roles may only open their own record (shown on the history page).
export function EmployeeRoute() {
  const { id } = useParams()
  const { user, can } = useAuth()
  if (can('employee:selfOnly')) {
    if (String(user.employeeId) === id) return <Navigate to="/employees/history" replace />
    return <AccessDenied text="คุณดูได้เฉพาะข้อมูลและประวัติของตนเองเท่านั้น" />
  }
  return <EmployeeDetail />
}
