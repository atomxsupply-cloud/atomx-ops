import { useState } from 'react';
import { MessageCircle, Sparkles, X } from 'lucide-react';
import AssistantPanel from './AssistantPanel';
import AppReportWidget from './AppReportWidget';
import { useFloatingPosition } from '../utils/floating';

export default function FloatingAtomChat() {
  const [open, setOpen] = useState(false);
  const { position, startDrag } = useFloatingPosition('atomx-floating-ia', { x: 16, y: 16 });

  return (
    <>
      {open && (
        <>
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-[1px] z-40" onClick={() => setOpen(false)} />
          <div className="fixed bottom-24 right-4 z-50 w-[calc(100vw-2rem)] max-w-[430px] h-[min(78vh,720px)]">
            <div className="h-full bg-white border border-slate-200 shadow-2xl rounded-3xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-white">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-atomx-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/25">
                    <Sparkles size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">ATOM IA</p>
                    <p className="text-xs text-slate-500 truncate">Historial, pedidos y cerebro de tatuaje</p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 min-h-0 p-3 bg-slate-50/60">
                <AssistantPanel compact onClose={() => setOpen(false)} />
              </div>
            </div>
          </div>
        </>
      )}

      <button
        onClick={() => setOpen((value) => !value)}
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        className="fixed z-50 group touch-none"
        style={{ right: `${position.x}px`, bottom: `${position.y}px` }}
        aria-label="Abrir asistente IA"
      >
        <div className="relative flex items-center justify-center w-16 h-16 rounded-[1.4rem] bg-atomx-500 text-white shadow-xl shadow-orange-500/35 transition-transform duration-200 group-hover:scale-105">
          <span className="absolute inset-0 rounded-[1.4rem] border border-white/20" />
          <Sparkles size={22} className="absolute opacity-95" />
          <MessageCircle size={18} className="absolute bottom-3 right-3 opacity-80" />
        </div>
      </button>

      <AppReportWidget />
    </>
  );
}
