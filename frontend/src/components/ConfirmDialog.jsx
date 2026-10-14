import Modal from './Modal'

export default function ConfirmDialog({ title, children, confirmLabel = 'ยืนยัน', danger = false, busy = false, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="confirm-body">{children}</div>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>ยกเลิก</button>
        <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
          {busy ? 'กำลังดำเนินการ...' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
