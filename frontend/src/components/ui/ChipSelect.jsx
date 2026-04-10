export default function ChipSelect({ value, onChange, options, className = '', allowEmpty = false }) {
  const normalizedValue = value == null ? '' : String(value);

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {allowEmpty ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-pressed={normalizedValue === ''}
          className={`px-3 py-2 rounded-2xl border text-sm font-medium transition-colors ${
            normalizedValue === ''
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
        >
          Sin asignar
        </button>
      ) : null}

      {options.map((opt) => {
        const optValue = String(opt.value);
        const active = optValue === normalizedValue;
        return (
          <button
            key={optValue}
            type="button"
            onClick={() => onChange(optValue)}
            aria-pressed={active}
            className={`px-3 py-2 rounded-2xl border text-sm font-medium transition-colors ${
              active
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

