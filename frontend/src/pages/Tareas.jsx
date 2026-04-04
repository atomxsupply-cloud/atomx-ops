import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, Flag, Orbit, Plus, RefreshCw, Trash2 } from 'lucide-react';
import api from '../api/client';
import Modal from '../components/Modal';

const PRIORIDAD_STYLES = {
  alta: 'bg-red-50 text-red-700 border-red-200',
  normal: 'bg-blue-50 text-blue-700 border-blue-200',
  baja: 'bg-slate-100 text-slate-600 border-slate-200',
};

const CATEGORIAS = [
  { value: 'general', label: 'General' },
  { value: 'tienda', label: 'Tienda' },
  { value: 'reparto', label: 'Reparto' },
  { value: 'pedidos', label: 'Pedidos' },
  { value: 'stock', label: 'Stock' },
  { value: 'admin', label: 'Admin' },
];

const ATOM_COLORS = {
  juanje: 'from-sky-500 to-cyan-400',
  papi: 'from-orange-500 to-amber-400',
  juanfran: 'from-emerald-500 to-lime-400',
  lida: 'from-fuchsia-500 to-pink-400',
  default: 'from-slate-500 to-slate-400',
};

const FORM_DEFAULT = {
  titulo: '',
  descripcion: '',
  asignado_a: '',
  categoria: 'general',
  prioridad: 'normal',
  fecha_limite: '',
  recurrente: false,
};

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function formatRemaining(expiraAt) {
  if (!expiraAt) return '';
  const diff = new Date(expiraAt).getTime() - Date.now();
  if (diff <= 0) return 'Caducada';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function AtomAvatar({ name, count, active, onClick }) {
  const key = normalizeName(name);
  const gradient = ATOM_COLORS[key] || ATOM_COLORS.default;

  return (
    <button
      onClick={onClick}
      className={`relative rounded-3xl border p-4 text-left transition-all ${active ? 'border-atomx-500 bg-orange-50 shadow-lg shadow-orange-100' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'}`}
    >
      <span className="absolute right-3 top-3 min-w-8 h-8 px-2 rounded-full bg-slate-900 text-white text-sm font-semibold flex items-center justify-center">
        {count}
      </span>

      <div className="flex items-center gap-4">
        <div className={`relative w-16 h-16 rounded-[1.4rem] bg-gradient-to-br ${gradient} text-white flex items-center justify-center shadow-lg`}>
          <Orbit size={22} />
          <span className="absolute -top-1 left-6 w-2.5 h-2.5 rounded-full bg-white/90" />
          <span className="absolute right-1 top-5 w-2 h-2 rounded-full bg-white/80" />
          <span className="absolute left-2 bottom-3 w-2 h-2 rounded-full bg-white/70" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-semibold text-slate-800">{name}</p>
          <p className="text-sm text-slate-500">{count === 0 ? 'Sin carga pendiente' : `${count} tarea${count > 1 ? 's' : ''} pendiente${count > 1 ? 's' : ''}`}</p>
        </div>
      </div>
    </button>
  );
}

function TareaCard({ tarea, onToggle, onDelete, onPromote }) {
  const hoy = new Date().toISOString().split('T')[0];
  const atrasada = tarea.fecha_limite && tarea.fecha_limite < hoy && tarea.estado === 'pendiente';

  return (
    <div className={`rounded-2xl border p-4 bg-white ${atrasada ? 'border-red-200 shadow-sm shadow-red-50' : 'border-slate-200'}`}>
      <div className="flex items-start gap-3">
        <button onClick={() => onToggle(tarea.id, tarea.estado)} className="mt-0.5 flex-shrink-0">
          {tarea.estado === 'completada' ? <CheckCircle2 size={20} className="text-green-500" /> : <Circle size={20} className="text-slate-300 hover:text-slate-400" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${tarea.estado === 'completada' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{tarea.titulo}</span>
            <span className={`badge border ${PRIORIDAD_STYLES[tarea.prioridad] || PRIORIDAD_STYLES.normal}`}>
              <Flag size={10} className="mr-1" /> {tarea.prioridad}
            </span>
            <span className="badge bg-slate-100 text-slate-600 capitalize">{tarea.categoria || 'general'}</span>
            {tarea.origen === 'asistente' ? <span className="badge bg-amber-100 text-amber-700">Asistente</span> : null}
            {tarea.recurrente ? <span className="badge bg-slate-100 text-slate-500"><RefreshCw size={10} className="mr-1" /> recurrente</span> : null}
            {atrasada ? <span className="badge bg-red-100 text-red-600"><AlertTriangle size={10} className="mr-1" /> atrasada</span> : null}
            {tarea.origen === 'asistente' && tarea.expira_at ? <span className="badge bg-orange-100 text-orange-700">Caduca en {formatRemaining(tarea.expira_at)}</span> : null}
          </div>

          {tarea.descripcion && <p className="text-sm text-slate-600 mt-2 leading-relaxed">{tarea.descripcion}</p>}

          <div className="flex items-center gap-3 mt-3 text-xs text-slate-400 flex-wrap">
            {tarea.fecha_limite && <span>{tarea.fecha_limite}</span>}
            {tarea.creador_nombre && <span>creada por {tarea.creador_nombre}</span>}
          </div>
        </div>

        <button onClick={() => onDelete(tarea.id)} className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0">
          <Trash2 size={15} />
        </button>
      </div>

      {tarea.origen === 'asistente' && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => onPromote?.(tarea.id)}
            className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            Pasar a tarea fija
          </button>
        </div>
      )}
    </div>
  );
}

export default function Tareas() {
  const [tareas, setTareas] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(FORM_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [estadoVista, setEstadoVista] = useState('pendiente');

  useEffect(() => {
    api.get('/auth/users').then((r) => {
      const ordered = [...r.data].sort((a, b) => a.nombre.localeCompare(b.nombre));
      setUsers(ordered);
      if (!selectedUserId && ordered[0]?.id) setSelectedUserId(ordered[0].id);
    });
  }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get('/tareas?todas=1');
      setTareas(r.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleTarea(id, estadoActual) {
    const nuevoEstado = estadoActual === 'completada' ? 'pendiente' : 'completada';
    await api.patch(`/tareas/${id}/estado`, { estado: nuevoEstado });
    load();
  }

  async function deleteTarea(id) {
    if (!confirm('Eliminar tarea?')) return;
    await api.delete(`/tareas/${id}`);
    load();
  }

  async function promoteTarea(id) {
    await api.patch(`/tareas/${id}/promote`);
    load();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/tareas', form);
      setShowForm(false);
      setForm(FORM_DEFAULT);
      load();
    } finally {
      setSaving(false);
    }
  }

  const usersWithCounts = useMemo(() => {
    return users.map((user) => {
      const assigned = tareas.filter((t) => t.asignado_a === user.id);
      const pending = assigned.filter((t) => t.estado !== 'completada');
      return { ...user, pendingCount: pending.length, allTasks: assigned };
    });
  }, [users, tareas]);

  const selectedUser = usersWithCounts.find((u) => u.id === selectedUserId) || usersWithCounts[0];
  const assistantDetectedTasks = (selectedUser?.allTasks || []).filter((t) => t.origen === 'asistente' && t.estado !== 'completada');
  const selectedTasks = (selectedUser?.allTasks || []).filter((t) => t.origen !== 'asistente' && (estadoVista === 'todas' ? true : t.estado === estadoVista));

  const categoriasResumen = CATEGORIAS.map((cat) => ({
    ...cat,
    total: selectedTasks.filter((t) => (t.categoria || 'general') === cat.value).length,
  })).filter((cat) => cat.total > 0);

  const altas = selectedTasks.filter((t) => t.prioridad === 'alta');
  const normales = selectedTasks.filter((t) => t.prioridad === 'normal');
  const bajas = selectedTasks.filter((t) => t.prioridad === 'baja');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Centro de tareas</h1>
          <p className="text-slate-500 text-sm">Carga visual por persona, prioridad y categoria</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nueva tarea
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {usersWithCounts.map((user) => (
          <AtomAvatar
            key={user.id}
            name={user.nombre}
            count={user.pendingCount}
            active={selectedUser?.id === user.id}
            onClick={() => setSelectedUserId(user.id)}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px,1fr] gap-5">
        <div className="space-y-4">
          <div className="card">
            <p className="text-sm font-semibold text-slate-800">{selectedUser?.nombre || 'Sin persona seleccionada'}</p>
            <p className="text-sm text-slate-500 mt-1">
              {selectedUser ? `${selectedUser.pendingCount} pendientes activas` : 'Selecciona un atomo'}
            </p>

            <div className="flex flex-wrap gap-2 mt-4">
              {[
                ['pendiente', 'Pendientes'],
                ['completada', 'Completadas'],
                ['todas', 'Todas'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setEstadoVista(value)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${estadoVista === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Categorias</p>
            <div className="space-y-2">
              {categoriasResumen.length === 0 ? (
                <p className="text-sm text-slate-400">No hay tareas en esta vista.</p>
              ) : (
                categoriasResumen.map((cat) => (
                  <div key={cat.value} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                    <span className="text-sm text-slate-700">{cat.label}</span>
                    <span className="text-sm font-semibold text-slate-900">{cat.total}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Prioridades</p>
            <div className="space-y-2">
              {[
                ['Alta', altas.length, 'bg-red-500'],
                ['Normal', normales.length, 'bg-blue-500'],
                ['Baja', bajas.length, 'bg-slate-400'],
              ].map(([label, total, color]) => (
                <div key={label} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                  <span className="text-sm text-slate-700 flex-1">{label}</span>
                  <span className="text-sm font-semibold text-slate-900">{total}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {assistantDetectedTasks.length > 0 && (
            <section className="space-y-3">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Detectadas por el asistente</p>
                <p className="text-sm text-amber-800 mt-1">
                  Estas salen del chat y si no se hacen en 6 horas se limpian solas para no ocupar espacio.
                </p>
              </div>
              {assistantDetectedTasks.map((tarea) => (
                <TareaCard key={`assistant-${tarea.id}`} tarea={tarea} onToggle={toggleTarea} onDelete={deleteTarea} onPromote={promoteTarea} />
              ))}
            </section>
          )}

          {loading ? (
            <div className="card text-slate-400 text-sm text-center py-10">Cargando tareas...</div>
          ) : selectedTasks.length === 0 ? (
            <div className="card text-center py-12">
              <Orbit size={36} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No hay tareas para esta persona en la vista actual.</p>
            </div>
          ) : (
            <>
              {altas.length > 0 && (
                <section className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Alta prioridad</p>
                  {altas.map((tarea) => <TareaCard key={tarea.id} tarea={tarea} onToggle={toggleTarea} onDelete={deleteTarea} onPromote={promoteTarea} />)}
                </section>
              )}

              {normales.length > 0 && (
                <section className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Normal</p>
                  {normales.map((tarea) => <TareaCard key={tarea.id} tarea={tarea} onToggle={toggleTarea} onDelete={deleteTarea} onPromote={promoteTarea} />)}
                </section>
              )}

              {bajas.length > 0 && (
                <section className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Baja</p>
                  {bajas.map((tarea) => <TareaCard key={tarea.id} tarea={tarea} onToggle={toggleTarea} onDelete={deleteTarea} onPromote={promoteTarea} />)}
                </section>
              )}
            </>
          )}
        </div>
      </div>

      {showForm && (
        <Modal title="Nueva tarea" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="label">Titulo *</label>
              <input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} className="input" required placeholder="Que hay que hacer?" />
            </div>
            <div>
              <label className="label">Descripcion</label>
              <textarea value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} className="input h-20 resize-none" placeholder="Detalles utiles para tienda o reparto..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Asignar a</label>
                <select value={form.asignado_a} onChange={(e) => setForm((f) => ({ ...f, asignado_a: e.target.value }))} className="input">
                  <option value="">Sin asignar</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Categoria</label>
                <select value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))} className="input">
                  {CATEGORIAS.map((cat) => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Prioridad</label>
                <select value={form.prioridad} onChange={(e) => setForm((f) => ({ ...f, prioridad: e.target.value }))} className="input">
                  <option value="alta">Alta</option>
                  <option value="normal">Normal</option>
                  <option value="baja">Baja</option>
                </select>
              </div>
              <div>
                <label className="label">Fecha limite</label>
                <input type="date" value={form.fecha_limite} onChange={(e) => setForm((f) => ({ ...f, fecha_limite: e.target.value }))} className="input" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="recurrente" checked={form.recurrente} onChange={(e) => setForm((f) => ({ ...f, recurrente: e.target.checked }))} />
              <label htmlFor="recurrente" className="text-sm text-slate-700 flex items-center gap-1"><RefreshCw size={13} /> Recurrente</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Crear tarea'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
