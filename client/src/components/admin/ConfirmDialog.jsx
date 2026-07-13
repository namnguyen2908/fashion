import { IconSpinner } from "./Icons";

export default function ConfirmDialog({ open, title, message, submitting, blocked, confirmLabel = "Xóa", onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="bg-white shadow-2xl rounded-lg border border-neutral-100 p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        <h3 className="text-base font-medium text-neutral-900 mb-2">{title}</h3>
        <p className="text-sm text-neutral-600 leading-relaxed mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          {!blocked && (
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900 disabled:opacity-50"
            >
              Hủy
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md disabled:opacity-60 ${
              blocked
                ? "bg-neutral-900 text-white hover:bg-neutral-800"
                : "bg-black text-white hover:bg-neutral-800"
            }`}
          >
            {submitting && <IconSpinner />}
            {blocked ? "Đã hiểu" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
