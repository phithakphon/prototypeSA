import { Navigate, Route, Routes } from 'react-router-dom'
import App from './App.jsx'
import Register from './pages/Register.jsx'
import AuthProvider from './auth/AuthProvider.jsx'
import { RequireAuth, RequirePermission } from './auth/RequireAuth.jsx'
import ToastProvider from './components/ToastProvider.jsx'
import AppLayout from './components/AppLayout.jsx'
import EmployeeFinder from './components/EmployeeFinder.jsx'
import Dashboard from './pages/Dashboard.jsx'
import { EmployeeRoute, HistoryRoute } from './pages/EmployeeAccess.jsx'
import EmployeeManage from './pages/EmployeeManage.jsx'
import ResignedEmployees from './pages/ResignedEmployees.jsx'
import SalaryManage from './pages/SalaryManage.jsx'
import ComingSoon from './pages/ComingSoon.jsx'

const guard = (permission, element) => (
  <RequirePermission permission={permission}>{element}</RequirePermission>
)

export default function AppRoutes() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<App />} />
          <Route path="/register" element={<Register />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route
                path="/employees/search"
                element={guard(
                  'employee:search',
                  <EmployeeFinder title="ค้นหาข้อมูลพนักงาน" description="ค้นหาด้วยรหัสพนักงาน ชื่อ หรือแผนก" />,
                )}
              />
              <Route path="/employees/history" element={guard('employee:view', <HistoryRoute />)} />
              <Route path="/employees/:id" element={guard('employee:view', <EmployeeRoute />)} />
              <Route path="/employees" element={guard('employee:manage', <EmployeeManage />)} />
              <Route path="/resigned" element={guard('resignation:manage', <ResignedEmployees />)} />
              <Route path="/salaries" element={guard('salary:manage', <SalaryManage />)} />
              <Route path="/evaluations" element={<ComingSoon title="ผลการประเมิน" />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}
