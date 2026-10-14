import { createContext, useContext } from 'react'

export const ToastContext = createContext(() => {})

// const toast = useToast(); toast('บันทึกสำเร็จ'); toast('ผิดพลาด', 'error')
export const useToast = () => useContext(ToastContext)
