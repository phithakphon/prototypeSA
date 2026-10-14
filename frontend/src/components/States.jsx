export function Loading({ text = 'กำลังโหลดข้อมูล...' }) {
  return (
    <div className="center-state" role="status">
      <span className="spinner" aria-hidden="true" /> {text}
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="center-state state-error" role="alert">
      <p>{error?.message || 'เกิดข้อผิดพลาด'}</p>
      {onRetry && <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>ลองอีกครั้ง</button>}
    </div>
  )
}

export function Empty({ text }) {
  return <div className="center-state">{text}</div>
}
