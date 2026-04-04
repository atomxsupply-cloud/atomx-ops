import { useState, useEffect } from 'react';
import { X, Copy, Check } from 'lucide-react';

let _setError = null;
export function showError(err) {
  if (_setError) _setError(err);
}

export default function ErrorOverlay() {
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { _setError = setError; return () => { _setError = null; }; }, []);

  if (!error) return null;

  const texto = typeof error === 'string' ? error
    : error?.stack || error?.message || JSON.stringify(error, null, 2);

  function copiar() {
    navigator.clipboard.writeText(texto);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-slate-900 border border-red-500/50 rounded-2xl w-full max-w-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white font-semibold">Error</span>
          </div>
          <div className="flex gap-2">
            <button onClick={copiar} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-lg px-3 py-1.5 transition-colors">
              {copied ? <><Check size={12} className="text-green-400" /> Copiado</> : <><Copy size={12} /> Copiar</>}
            </button>
            <button onClick={() => setError(null)} className="text-slate-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="p-5 overflow-auto max-h-[60vh]">
          <pre className="text-red-300 text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">{texto}</pre>
        </div>
        <div className="px-5 py-3 border-t border-slate-700 text-xs text-slate-500 text-center">
          Copia este error y pásaselo a Claude
        </div>
      </div>
    </div>
  );
}
