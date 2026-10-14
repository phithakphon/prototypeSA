import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'

export const NOTICE_TYPES = {
  info: { icon: Info, label: 'ข้อมูล' },
  success: { icon: CircleCheck, label: 'สำเร็จ' },
  warning: { icon: TriangleAlert, label: 'คำเตือน' },
  error: { icon: CircleAlert, label: 'ข้อผิดพลาด' },
}
