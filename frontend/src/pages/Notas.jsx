import { useEffect, useState } from 'react';
import api from '../api/client';
import { Plus, Pin, Trash2, StickyNote } from 'lucide-react';

export default function Notas() {
  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState('');
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/notas').then(r => setNotas(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!texto.trim()) return;
    setSaving(true);
    try {
      await api.post('/notas', { contenido: texto.trim(), pinned });
      setTexto('');
      setPinned(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function togglePin(id) {
    await api.patch(`/notas/${id}/pin`);
    load();
  }

  async function deleteNota(id) {
    if (!confirm('¿Eliminar nota?')) return;
    await api.delete(`/notas/${id}`);
    load();
  }

  const fijadas = notas.filter(n => n.pinned);
  const normales = notas.filter(n => !n.pinned);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Notas</h1>
        <p className="text-slate-500 text-sm">Pizarra del equipo</p>
      </div>

      {/* Formulario rápido */}
      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            className="input h-24 resize-none text-sm"
            placeholder="Escribe una nota para el equipo... (aviso urgente, falta de material, recordatorio...)"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
              <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} className="rounded" />
              <Pin size={14} /> Fijar nota (aparece en Dashboard)
            </label>
            <button type="submit" disabled={saving || !texto.trim()} className="btn-primary flex items-center gap-1.5 text-sm">
              <Plus size={15} /> Añadir nota
            </button>
          </div>
        </form>
      </div>

      {loading ? <div className="text-slate-400 text-sm text-center py-8">Cargando...</div> : (
        <>
          {fijadas.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Fijadas</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {fijadas.map(n => <NotaCard key={n.id} nota={n} onPin={togglePin} onDelete={deleteNota} />)}
              </div>
            </div>
          )}

          {normales.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Recientes</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {normales.map(n => <NotaCard key={n.id} nota={n} onPin={togglePin} onDelete={deleteNota} />)}
              </div>
            </div>
          )}

          {notas.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <StickyNote size={40} className="mx-auto mb-3 opacity-30" />
              <p>No hay notas todavía</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NotaCard({ nota, onPin, onDelete }) {
  const hora = nota.created_at ? nota.created_at.substring(0, 16).replace('T', ' ') : '';
  return (
    <div className={`rounded-xl border p-4 relative ${nota.pinned ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-slate-100'}`}>
      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{nota.contenido}</p>
      <div className="flex items-center justify-between mt-3">
        <div>
          <span className="text-xs font-medium text-slate-500">{nota.autor}</span>
          <span className="text-xs text-slate-400 ml-2">{hora}</span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => onPin(nota.id)} className={`p-1.5 rounded-lg transition-colors ${nota.pinned ? 'text-yellow-600 bg-yellow-100' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'}`}>
            <Pin size={14} />
          </button>
          <button onClick={() => onDelete(nota.id)} className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
