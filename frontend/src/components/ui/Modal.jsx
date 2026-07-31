export default function Modal({ open, title, onClose, children, wide = false, className = '' }) {
  if (!open) return null;
  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm ${
        className || 'z-50'
      }`}
    >
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-display text-xl text-wine">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-ink/50 hover:bg-blush">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
