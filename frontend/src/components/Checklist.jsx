import { useEffect, useState } from 'react';
import api from '../api/client';
import { CheckCircle2, Circle } from 'lucide-react';

export default function Checklist({ tipo }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.get(`/checklist/${tipo}`).then(r => setItems(r.data));
  }, [tipo]);

  async function toggle(id) {
    await api.post(`/checklist/${id}/toggle`);
    setItems(prev => prev.map(i => i.id === id ? { ...i, completado: i.completado ? 0 : 1 } : i));
  }

  const completados = items.filter(i => i.completado).length;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 bg-slate-100 rounded-full h-1.5">
          <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: items.length ? `${(completados / items.length) * 100}%` : '0%' }} />
        </div>
        <span className="text-xs text-slate-500">{completados}/{items.length}</span>
      </div>
      <div className="space-y-1.5">
        {items.map(item => (
          <button key={item.id} onClick={() => toggle(item.id)} className="flex items-center gap-3 w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
            {item.completado ? <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" /> : <Circle size={18} className="text-slate-300 flex-shrink-0" />}
            <span className={`text-sm ${item.completado ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.texto}</span>
            {item.hora && <span className="ml-auto text-xs text-slate-400">{item.hora}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
