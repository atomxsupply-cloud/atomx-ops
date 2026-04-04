import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

function timeAgo(value) {
  if (!value) return '';
  const date = new Date(value.replace(' ', 'T'));
  const diff = Math.max(0, Date.now() - date.getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();

  async function load() {
    try {
      const r = await api.get('/notificaciones');
      setItems(r.data.items || []);
      setUnread(r.data.unread || 0);
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  async function openItem(item) {
    if (!item.leida) {
      await api.patch(`/notificaciones/${item.id}/leida`);
      await load();
    }
    setOpen(false);
    if (item.link) navigate(item.link);
  }

  async function markAll() {
    await api.patch('/notificaciones/leer-todas');
    await load();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-10 h-10 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-600 flex items-center justify-center transition-colors"
        aria-label="Notificaciones"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-40 w-[min(92vw,360px)] bg-white border border-slate-200 shadow-xl rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div>
              <p className="text-sm font-semibold text-slate-800">Avisos</p>
              <p className="text-xs text-slate-500">Tareas y movimientos para ti</p>
            </div>
            {items.length > 0 && (
              <button onClick={markAll} className="text-xs text-atomx-600 font-medium hover:text-atomx-700">
                Marcar todo
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-sm text-slate-400 text-center">Sin avisos</div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => openItem(item)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${item.leida ? 'bg-white' : 'bg-orange-50/60'}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${item.leida ? 'bg-slate-200' : 'bg-atomx-500'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">{item.titulo}</p>
                      {item.mensaje && <p className="text-sm text-slate-600 mt-0.5">{item.mensaje}</p>}
                      <p className="text-xs text-slate-400 mt-1">{timeAgo(item.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
