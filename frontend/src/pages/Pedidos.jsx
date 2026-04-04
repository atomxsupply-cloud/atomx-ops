import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { Camera, Plus, Search, Zap, X, Package, Sparkles } from 'lucide-react';
import Modal from '../components/Modal';
import InputIA from '../components/InputIA';
import PhotoOrderAssistant from '../components/PhotoOrderAssistant';

const ESTADOS = ['pendiente', 'preparando', 'listo', 'enviado', 'entregado', 'incidencia', 'cancelado'];
const ZONAS_REPARTO = ['ZONA PLAYA', 'ZONA CARTAGENA', 'ZONA NORTE', 'ZONA MURCIA'];
const ESTADO_COLORS = {
  pendiente: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  preparando: 'bg-blue-100 text-blue-700 border-blue-200',
  listo: 'bg-green-100 text-green-700 border-green-200',
  enviado: 'bg-purple-100 text-purple-700 border-purple-200',
  entregado: 'bg-slate-100 text-slate-600 border-slate-200',
  incidencia: 'bg-red-100 text-red-700 border-red-200',
  cancelado: 'bg-slate-100 text-slate-400 border-slate-100',
};

function Badge({ estado }) {
  return <span className={`badge border ${ESTADO_COLORS[estado] || 'bg-slate-100 text-slate-600'}`}>{estado}</span>;
}

const FORM_DEFAULT = {
  cliente_nombre: '', cliente_dni: '', cliente_email: '', cliente_telefono: '',
  cliente_direccion: '', cliente_cp: '', zona_reparto: 'ZONA MURCIA', tipo_documento: 'factura',
  descuento: 0, metodo_envio: 'envio', urgente: false, notas: '', responsable_id: '',
  items: [{ producto_nombre: '', cantidad: 1 }]
};

export default function Pedidos() {
  const [searchParams] = useSearchParams();
  const [pedidos, setPedidos] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState(searchParams.get('estado') || '');
  const [zona, setZona] = useState(searchParams.get('zona_reparto') || '');
  const [urgente, setUrgente] = useState(searchParams.get('urgente') || '');
  const [showForm, setShowForm] = useState(false);
  const [showIA, setShowIA] = useState(false);
  const [showFoto, setShowFoto] = useState(false);
  const [form, setForm] = useState(FORM_DEFAULT);
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (estado) params.set('estado', estado);
    if (zona) params.set('zona_reparto', zona);
    if (urgente) params.set('urgente', urgente);
    if (search) params.set('search', search);
    api.get(`/pedidos?${params}`).then(r => { setPedidos(r.data.pedidos); setTotal(r.data.total); }).finally(() => setLoading(false));
  }, [estado, zona, urgente, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/auth/users').then(r => setUsers(r.data)); }, []);

  function addItem() { setForm(f => ({ ...f, items: [...f.items, { producto_nombre: '', cantidad: 1 }] })); }
  function removeItem(i) { setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) })); }
  function updateItem(i, field, val) { setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, [field]: val } : it) })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/pedidos', { ...form, items: form.items.filter(i => i.producto_nombre) });
      setShowForm(false);
      setForm(FORM_DEFAULT);
      load();
    } finally {
      setSaving(false);
    }
  }

  function aplicarResultadoIA(resultado) {
    if (!resultado?.pedido) return;
    const p = resultado.pedido;
    setForm(prev => ({
      ...prev,
      cliente_nombre: p.cliente_nombre || prev.cliente_nombre,
      cliente_dni: p.cliente_dni || prev.cliente_dni,
      cliente_email: p.cliente_email || prev.cliente_email,
      cliente_telefono: p.cliente_telefono || prev.cliente_telefono,
      cliente_direccion: p.cliente_direccion || prev.cliente_direccion,
      cliente_cp: p.cliente_cp || prev.cliente_cp,
      zona_reparto: p.zona_reparto || prev.zona_reparto,
      tipo_documento: p.tipo_documento || prev.tipo_documento,
      descuento: p.descuento ?? prev.descuento,
      metodo_envio: p.metodo_envio || prev.metodo_envio,
      urgente: p.urgente ?? prev.urgente,
      notas: p.notas || prev.notas,
      items: p.items?.length > 0 ? p.items : prev.items,
    }));
    setShowIA(false);
    setShowForm(true);
  }

  async function cambiarEstado(id, nuevoEstado) {
    await api.patch(`/pedidos/${id}/estado`, { estado: nuevoEstado });
    load();
    if (selectedPedido?.id === id) setSelectedPedido(p => ({ ...p, estado: nuevoEstado }));
  }

  const zoneCounts = ZONAS_REPARTO.map((nombre) => ({
    nombre,
    total: pedidos.filter((p) => p.zona_reparto === nombre).length,
  }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pedidos</h1>
          <p className="text-slate-500 text-sm">{total} total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFoto(true)} className="btn flex items-center gap-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm">
            <Camera size={15} /> Foto a pedido
          </button>
          <button onClick={() => setShowIA(true)} className="btn flex items-center gap-1.5 border border-atomx-500 text-atomx-500 hover:bg-atomx-50 text-sm">
            <Sparkles size={15} /> Pegar WhatsApp
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nuevo pedido
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente, número..." className="input pl-8" />
        </div>
        <select value={estado} onChange={e => setEstado(e.target.value)} className="input w-auto">
          <option value="">Todos los estados</option>
          {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={zona} onChange={e => setZona(e.target.value)} className="input w-auto">
          <option value="">Todas las zonas</option>
          {ZONAS_REPARTO.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
        <button onClick={() => setUrgente(u => u ? '' : '1')} className={`btn flex items-center gap-1.5 border ${urgente ? 'bg-red-500 text-white border-red-500' : 'border-slate-200 text-slate-600'}`}>
          <Zap size={14} /> Urgentes
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {zoneCounts.map((item) => (
          <button
            key={item.nombre}
            onClick={() => setZona((prev) => prev === item.nombre ? '' : item.nombre)}
            className={`card text-left transition-all ${zona === item.nombre ? 'ring-2 ring-atomx-500 border-atomx-200 bg-orange-50/50' : ''}`}
          >
            <p className="text-xs font-semibold tracking-wide text-slate-500">{item.nombre}</p>
            <p className="text-2xl font-bold text-slate-800 mt-2">{item.total}</p>
            <p className="text-xs text-slate-400 mt-1">Pedidos en esta zona</p>
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-slate-400 text-sm py-8 text-center">Cargando...</div>
      ) : pedidos.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay pedidos</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pedidos.map(p => (
            <div key={p.id} onClick={() => setSelectedPedido(p)}
              className={`card cursor-pointer hover:shadow-md transition-all ${p.urgente ? 'border-l-4 border-l-red-500' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800">{p.cliente_nombre}</span>
                    {p.urgente ? <span className="badge bg-red-100 text-red-600 flex items-center gap-1"><Zap size={10} />Urgente</span> : null}
                    <Badge estado={p.estado} />
                    {p.zona_reparto ? <span className="badge bg-blue-50 text-blue-700">{p.zona_reparto}</span> : null}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{p.numero} · {p.tipo_documento} · {p.descuento}% dto · {p.metodo_envio}</p>
                  {p.items?.length > 0 && (
                    <p className="text-sm text-slate-600 mt-1 truncate">{p.items.map(i => `${i.cantidad}x ${i.producto_nombre}`).join(', ')}</p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs text-slate-400">{p.created_at?.substring(0, 10)}</p>
                  {p.responsable_nombre && <p className="text-xs text-slate-500 mt-0.5">{p.responsable_nombre}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal detalle */}
      {selectedPedido && (
        <Modal title={`${selectedPedido.numero} — ${selectedPedido.cliente_nombre}`} onClose={() => setSelectedPedido(null)}>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge estado={selectedPedido.estado} />
              {selectedPedido.urgente ? <span className="badge bg-red-100 text-red-600"><Zap size={10} className="inline mr-1" />Urgente</span> : null}
              <span className="badge bg-slate-100 text-slate-600">{selectedPedido.tipo_documento}</span>
              <span className="badge bg-slate-100 text-slate-600">{selectedPedido.descuento}% dto</span>
              <span className="badge bg-slate-100 text-slate-600">{selectedPedido.metodo_envio}</span>
              {selectedPedido.zona_reparto ? <span className="badge bg-blue-50 text-blue-700">{selectedPedido.zona_reparto}</span> : null}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-400">DNI:</span> {selectedPedido.cliente_dni || '—'}</div>
              <div><span className="text-slate-400">Tel:</span> {selectedPedido.cliente_telefono || '—'}</div>
              <div className="col-span-2"><span className="text-slate-400">Email:</span> {selectedPedido.cliente_email || '—'}</div>
              <div className="col-span-2"><span className="text-slate-400">Dirección:</span> {selectedPedido.cliente_direccion || '—'} {selectedPedido.cliente_cp}</div>
            </div>

            {selectedPedido.items?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">PRODUCTOS</p>
                <div className="space-y-1">
                  {selectedPedido.items.map(i => (
                    <div key={i.id} className="flex justify-between text-sm bg-slate-50 rounded px-3 py-1.5">
                      <span>{i.producto_nombre}</span>
                      <span className="text-slate-500">x{i.cantidad}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedPedido.notas && (
              <div className="bg-yellow-50 rounded-lg px-3 py-2 text-sm text-slate-700">
                <span className="text-slate-400 text-xs block mb-0.5">Notas:</span>
                {selectedPedido.notas}
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">CAMBIAR ESTADO</p>
              <div className="flex flex-wrap gap-1.5">
                {ESTADOS.map(s => (
                  <button key={s} onClick={() => cambiarEstado(selectedPedido.id, s)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${selectedPedido.estado === s ? ESTADO_COLORS[s] : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal IA */}
      {showIA && (
        <Modal title="Pegar mensaje de WhatsApp" onClose={() => setShowIA(false)} wide>
          <p className="text-sm text-slate-500 mb-4">
            Pega el texto tal como lo mandáis — la IA detecta productos, cliente, descuento y tipo de documento automáticamente.
          </p>
          <InputIA onResultado={aplicarResultadoIA} />
        </Modal>
      )}

      {showFoto && (
        <Modal title="Foto a pedido" onClose={() => setShowFoto(false)} wide>
          <PhotoOrderAssistant
            onResultado={(resultado) => {
              aplicarResultadoIA(resultado);
              setShowFoto(false);
            }}
          />
        </Modal>
      )}

      {/* Modal nuevo pedido */}
      {showForm && (
        <Modal title="Nuevo pedido" onClose={() => setShowForm(false)} wide>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Cliente *</label>
                <input value={form.cliente_nombre} onChange={e => setForm(f => ({ ...f, cliente_nombre: e.target.value }))} className="input" required placeholder="Nombre y apellidos" />
              </div>
              <div>
                <label className="label">DNI</label>
                <input value={form.cliente_dni} onChange={e => setForm(f => ({ ...f, cliente_dni: e.target.value }))} className="input" placeholder="12345678A" />
              </div>
              <div>
                <label className="label">Teléfono</label>
                <input value={form.cliente_telefono} onChange={e => setForm(f => ({ ...f, cliente_telefono: e.target.value }))} className="input" placeholder="600000000" />
              </div>
              <div className="col-span-2">
                <label className="label">Email</label>
                <input type="email" value={form.cliente_email} onChange={e => setForm(f => ({ ...f, cliente_email: e.target.value }))} className="input" placeholder="cliente@email.com" />
              </div>
              <div>
                <label className="label">Dirección</label>
                <input value={form.cliente_direccion} onChange={e => setForm(f => ({ ...f, cliente_direccion: e.target.value }))} className="input" placeholder="Calle y número" />
              </div>
              <div>
                <label className="label">Código postal</label>
                <input value={form.cliente_cp} onChange={e => setForm(f => ({ ...f, cliente_cp: e.target.value }))} className="input" placeholder="30000" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Zona reparto</label>
                <select value={form.zona_reparto} onChange={e => setForm(f => ({ ...f, zona_reparto: e.target.value }))} className="input">
                  {ZONAS_REPARTO.map((z) => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Documento</label>
                <select value={form.tipo_documento} onChange={e => setForm(f => ({ ...f, tipo_documento: e.target.value }))} className="input">
                  <option value="factura">Factura</option>
                  <option value="albaran">Albarán</option>
                </select>
              </div>
              <div>
                <label className="label">Descuento %</label>
                <input type="number" min="0" max="100" value={form.descuento} onChange={e => setForm(f => ({ ...f, descuento: parseInt(e.target.value) || 0 }))} className="input" />
              </div>
              <div>
                <label className="label">Envío</label>
                <select value={form.metodo_envio} onChange={e => setForm(f => ({ ...f, metodo_envio: e.target.value }))} className="input">
                  <option value="envio">Envío</option>
                  <option value="recogida">Recogida</option>
                  <option value="contrareembolso">Contrareembolso</option>
                  <option value="mano">En mano</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Responsable</label>
                <select value={form.responsable_id} onChange={e => setForm(f => ({ ...f, responsable_id: e.target.value }))} className="input">
                  <option value="">Sin asignar</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 mt-5">
                <input type="checkbox" id="urgente" checked={form.urgente} onChange={e => setForm(f => ({ ...f, urgente: e.target.checked }))} className="rounded" />
                <label htmlFor="urgente" className="text-sm text-slate-700 flex items-center gap-1"><Zap size={14} className="text-red-500" /> Urgente</label>
              </div>
            </div>

            {/* Items */}
            <div>
              <label className="label">Productos</label>
              <div className="space-y-2">
                {form.items.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={item.producto_nombre} onChange={e => updateItem(i, 'producto_nombre', e.target.value)} className="input flex-1" placeholder="Nombre del producto" />
                    <input type="number" min="1" value={item.cantidad} onChange={e => updateItem(i, 'cantidad', parseInt(e.target.value))} className="input w-20" placeholder="Qty" />
                    <button type="button" onClick={() => removeItem(i)} className="text-slate-400 hover:text-red-500"><X size={16} /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addItem} className="btn-ghost text-xs mt-2 flex items-center gap-1"><Plus size={14} /> Añadir producto</button>
            </div>

            <div>
              <label className="label">Notas internas</label>
              <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} className="input h-20 resize-none" placeholder="Notas, instrucciones especiales..." />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Crear pedido'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
