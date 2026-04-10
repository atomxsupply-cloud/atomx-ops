import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { Plus, Pin, Trash2, StickyNote, Search, BellRing, AlertTriangle, CheckCircle2, Pencil } from 'lucide-react';

const PRIORIDADES = [
  { value: '', label: 'Todas' },
  { value: 'alta', label: 'Alta' },
  { value: 'normal', label: 'Normal' },
  { value: 'baja', label: 'Baja' },
];

const CATEGORIAS = [
  { value: '', label: 'Todas' },
  { value: 'general', label: 'General' },
  { value: 'pedidos', label: 'Pedidos' },
  { value: 'stock', label: 'Stock' },
  { value: 'clientes', label: 'Clientes' },
  { value: 'web', label: 'Web' },
  { value: 'direccion', label: 'Direccion' },
  { value: 'equipo', label: 'Equipo' },
];

const ESTADOS = [
  { value: '', label: 'Todas' },
  { value: 'abierta', label: 'Abiertas' },
  { value: 'hecha', label: 'Hechas' },
];

const EMPTY_FORM = {
  contenido: '',
  categoria: 'general',
  prioridad: 'normal',
  estado: 'abierta',
  pinned: false,
};

function PriorityBadge({ value }) {
  const styles = {
    alta: 'bg-red-100 text-red-700 border-red-200',
    normal: 'bg-blue-100 text-blue-700 border-blue-200',
    baja: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${styles[value] || styles.normal}`}>{value}</span>;
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

export default function Notas() {
  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [categoria, setCategoria] = useState('');
  const [prioridad, setPrioridad] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('abierta');
  const [soloPinned, setSoloPinned] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (categoria) params.set('categoria', categoria);
      if (prioridad) params.set('prioridad', prioridad);
      if (estadoFiltro) params.set('estado', estadoFiltro);
      if (soloPinned) params.set('pinned', '1');
      const response = await api.get(`/notas?${params.toString()}`);
      setNotas(response.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      load().catch(() => setNotas([]));
    }, 160);
    return () => clearTimeout(timer);
  }, [search, categoria, prioridad, estadoFiltro, soloPinned]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.contenido.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/notas/${editingId}`, {
          contenido: form.contenido.trim(),
          categoria: form.categoria,
          prioridad: form.prioridad,
          estado: form.estado,
        });
      } else {
        await api.post('/notas', {
          contenido: form.contenido.trim(),
          categoria: form.categoria,
          prioridad: form.prioridad,
          estado: form.estado,
          pinned: form.pinned,
        });
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(nota) {
    setEditingId(nota.id);
    setForm({
      contenido: nota.contenido || '',
      categoria: nota.categoria || 'general',
      prioridad: nota.prioridad || 'normal',
      estado: nota.estado || 'abierta',
      pinned: Boolean(nota.pinned),
    });
  }

  async function togglePin(id) {
    await api.patch(`/notas/${id}/pin`);
    load();
  }

  async function markDone(nota) {
    await api.patch(`/notas/${nota.id}`, {
      contenido: nota.contenido,
      categoria: nota.categoria,
      prioridad: nota.prioridad,
      estado: nota.estado === 'hecha' ? 'abierta' : 'hecha',
    });
    load();
  }

  async function deleteNota(id) {
    if (!confirm('Eliminar nota?')) return;
    await api.delete(`/notas/${id}`);
    load();
  }

  const stats = useMemo(() => ({
    abiertas: notas.filter((n) => n.estado !== 'hecha').length,
    fijadas: notas.filter((n) => Number(n.pinned) === 1).length,
    urgentes: notas.filter((n) => n.prioridad === 'alta' && n.estado !== 'hecha').length,
  }), [notas]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Centro de notas y avisos</h1>
        <p className="text-sm text-slate-500">Avisos del equipo, prioridades, cosas hechas y busqueda rapida sin perderse.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Abiertas" value={stats.abiertas} />
        <Stat label="Fijadas" value={stats.fijadas} />
        <Stat label="Urgentes" value={stats.urgentes} />
        <Stat label="Mostradas" value={notas.length} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr,1.15fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <BellRing size={15} />
              {editingId ? 'Editar aviso' : 'Nuevo aviso'}
            </div>

            <textarea
              value={form.contenido}
              onChange={(e) => setForm((current) => ({ ...current, contenido: e.target.value }))}
              className="input h-28 resize-none text-sm"
              placeholder="Escribe algo realmente util para el equipo..."
            />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="label">Categoria</label>
                <select value={form.categoria} onChange={(e) => setForm((current) => ({ ...current, categoria: e.target.value }))} className="input">
                  {CATEGORIAS.filter((item) => item.value).map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Prioridad</label>
                <select value={form.prioridad} onChange={(e) => setForm((current) => ({ ...current, prioridad: e.target.value }))} className="input">
                  {PRIORIDADES.filter((item) => item.value).map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Estado</label>
                <select value={form.estado} onChange={(e) => setForm((current) => ({ ...current, estado: e.target.value }))} className="input">
                  {ESTADOS.filter((item) => item.value).map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {!editingId ? (
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
                <input type="checkbox" checked={form.pinned} onChange={(e) => setForm((current) => ({ ...current, pinned: e.target.checked }))} className="rounded" />
                <Pin size={14} /> Fijar aviso en paneles importantes
              </label>
            ) : null}

            <div className="flex justify-end gap-2">
              {editingId ? (
                <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }} className="btn-ghost">Cancelar</button>
              ) : null}
              <button type="submit" disabled={saving || !form.contenido.trim()} className="btn-primary flex items-center gap-2">
                <Plus size={15} />
                {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear aviso'}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-3 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-8"
                placeholder="Buscar por texto o autor..."
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="input">
                {CATEGORIAS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className="input">
                {PRIORIDADES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} className="input">
                {ESTADOS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <button type="button" onClick={() => setSoloPinned((current) => !current)} className={`rounded-2xl border px-3 py-2 text-sm font-medium ${soloPinned ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                Solo fijadas
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {loading ? <div className="rounded-3xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">Cargando avisos...</div> : null}
            {!loading && notas.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-12 text-center text-slate-400">
                <StickyNote size={38} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No veo avisos con este filtro.</p>
              </div>
            ) : null}
            {notas.map((nota) => (
              <div key={nota.id} className={`rounded-3xl border p-4 ${Number(nota.pinned) === 1 ? 'border-amber-200 bg-amber-50/70' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {Number(nota.pinned) === 1 ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">Fijada</span> : null}
                      <PriorityBadge value={nota.prioridad || 'normal'} />
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase text-slate-600">{nota.categoria || 'general'}</span>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${nota.estado === 'hecha' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                        {nota.estado || 'abierta'}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{nota.contenido}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span>{nota.autor || 'Sin autor'}</span>
                      <span>{String(nota.created_at || '').replace('T', ' ').slice(0, 16)}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => togglePin(nota.id)} className={`rounded-xl p-2 ${Number(nota.pinned) === 1 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                      <Pin size={14} />
                    </button>
                    <button onClick={() => startEdit(nota)} className="rounded-xl bg-slate-100 p-2 text-slate-600">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => markDone(nota)} className={`rounded-xl p-2 ${nota.estado === 'hecha' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {nota.estado === 'hecha' ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                    </button>
                    <button onClick={() => deleteNota(nota.id)} className="rounded-xl bg-red-50 p-2 text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
