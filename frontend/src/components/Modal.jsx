import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, children, onClose, wide }) {
  useEffect(() => {
    const handler = e => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4 backdrop-blur-sm">
      <div className={`w-full overflow-y-auto bg-white shadow-xl max-h-[92dvh] ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-t-3xl sm:rounded-2xl`}>
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 rounded-t-3xl sm:px-5 sm:py-4 sm:rounded-t-2xl">
          <h2 className="font-semibold text-slate-800 text-base">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="px-4 py-3 sm:px-5 sm:py-4">{children}</div>
      </div>
    </div>
  );
}
