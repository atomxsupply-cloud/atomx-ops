import { Minus, Plus } from 'lucide-react';

export default function NumberStepper({
  value,
  onChange,
  min = 0,
  max = null,
  step = 1,
  className = '',
}) {
  const current = Number.isFinite(Number(value)) ? Number(value) : 0;

  function set(next) {
    let v = next;
    if (v < min) v = min;
    if (max != null && v > max) v = max;
    onChange(v);
  }

  return (
    <div className={`inline-flex items-center rounded-2xl border border-slate-200 bg-white overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => set(current - step)}
        className="w-10 h-10 flex items-center justify-center text-slate-700 hover:bg-slate-50 active:bg-slate-100"
        aria-label="Bajar"
      >
        <Minus size={16} />
      </button>
      <div className="min-w-12 px-3 text-center font-semibold text-slate-800 select-none">
        {current}
      </div>
      <button
        type="button"
        onClick={() => set(current + step)}
        className="w-10 h-10 flex items-center justify-center text-slate-700 hover:bg-slate-50 active:bg-slate-100"
        aria-label="Subir"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

