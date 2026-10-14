
import { Link } from 'react-router-dom'

function Dashboard() {
  return (
    <main style={{ padding: '32px', fontFamily: 'Tahoma, sans-serif' }}>
      <h1>ระบบบริหารจัดการข้อมูลพนักงาน</h1>
      <p>ยินดีต้อนรับเข้าสู่ระบบ</p>

      <nav style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
        <Link to="/employees">จัดการข้อมูลพนักงาน</Link>
        <Link to="/login">ออกจากหน้า Dashboard</Link>
      </nav>

      <section
        style={{
          marginTop: '32px',
          padding: '24px',
          background: '#f1f5f9',
          borderRadius: '12px',
        }}
      >
        <h2>ภาพรวมระบบ</h2>
        <p>ระบบจัดการข้อมูลประวัติพนักงาน</p>
        <p>เลือกเมนูจัดการข้อมูลพนักงานเพื่อดูรายชื่อ</p>
      </section>
    </main>
  )
}

export default Dashboard
