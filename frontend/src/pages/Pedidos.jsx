import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { Camera, Package, Plus, Search, X, Zap, UserRound, Clock3, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import Modal from '../components/Modal';
import PhotoOrderAssistant from '../components/PhotoOrderAssistant';
import QuickMaterialsPanel from '../components/QuickMaterialsPanel';
import ChipSelect from '../components/ui/ChipSelect';
import NumberStepper from '../components/ui/NumberStepper';

const ESTADOS = ['pendiente', 'preparando', 'listo', 'enviado', 'entregado', 'incidencia', 'cancelado'];
const ZONAS_REPARTO = [
  'ZONA MURCIA',
  'ZONA PLAYA',
  'ZONA CARTAGENA',
  'ZONA NORTE',
  'ZONA ALICANTE',
  'ZONA ELCHE',
  'ZONA BENIDORM',
  'ZONA VALENCIA',
];
const ESTADO_COLORS = {
  pendiente: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  preparando: 'bg-blue-100 text-blue-700 border-blue-200',
  listo: 'bg-green-100 text-green-700 border-green-200',
  enviado: 'bg-purple-100 text-purple-700 border-purple-200',
  entregado: 'bg-slate-100 text-slate-600 border-slate-200',
  incidencia: 'bg-red-100 text-red-700 border-red-200',
  cancelado: 'bg-slate-100 text-slate-400 border-slate-100',
};

const QUICK_PRODUCT_TEMPLATES = [
  {
    id: 'dynamic-black',
    name: 'Dynamic Black',
    lines: [
      { cantidad: 2, producto_nombre: 'DYNAMIC BLACK 10' },
    ],
  },
  {
    id: 'emalla-1003rl',
    name: 'Emalla 1003 RL',
    lines: [
      { cantidad: 1, producto_nombre: '1003 RL EMALLA' },
    ],
  },
  {
    id: 'kwadron-1207rl',
    name: 'Kwadron 1207 RL',
    lines: [
      { cantidad: 1, producto_nombre: '1207 RL KWADRON' },
    ],
  },
  {
    id: 'cartuchos-mixtos',
    name: 'Pack cartuchos',
    lines: [
      { cantidad: 1, producto_nombre: '1003 RL EMALLA' },
      { cantidad: 1, producto_nombre: '1205 RL KWADRON' },
      { cantidad: 1, producto_nombre: '1207 RS KWADRON' },
    ],
  },
  {
    id: 'consumibles-basicos',
    name: 'Consumibles basicos',
    lines: [
      { cantidad: 1, producto_nombre: 'VASOS DE TINTA' },
      { cantidad: 1, producto_nombre: 'GUANTES NEGROS M' },
      { cantidad: 1, producto_nombre: 'PAPEL CAMILLA' },
    ],
  },
];

const FORM_DEFAULT = {
  cliente_nombre: '',
  cliente_dni: '',
  cliente_email: '',
  cliente_telefono: '',
  cliente_direccion: '',
  cliente_cp: '',
  zona_reparto: 'ZONA MURCIA',
  tipo_documento: 'factura',
  metodo_envio: 'envio',
  urgente: false,
  notas: '',
  responsable_id: '',
  items: [{ producto_nombre: '', cantidad: 1 }],
};

function Badge({ estado }) {
  return <span className={`badge border ${ESTADO_COLORS[estado] || 'bg-slate-100 text-slate-600'}`}>{estado}</span>;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function inferZone(text) {
  const value = normalizeText(text);
  if (!value) return 'ZONA MURCIA';
  if (/(cartagena|la union|mazarron)/.test(value)) return 'ZONA CARTAGENA';
  if (/(san pedro|san javier|torre pacheco|los alcazares|aguilas)/.test(value)) return 'ZONA PLAYA';
  if (/(alicante|san vicente|campello|mutxamel)/.test(value)) return 'ZONA ALICANTE';
  if (/(elche|crevillente|santa pola)/.test(value)) return 'ZONA ELCHE';
  if (/(benidorm|altea|calpe|villajoyosa|finestrat)/.test(value)) return 'ZONA BENIDORM';
  if (/(valencia|gandia|sagunto|torrent)/.test(value)) return 'ZONA VALENCIA';
  if (/(yecla|jumilla|villena|albacete)/.test(value)) return 'ZONA NORTE';
  return 'ZONA MURCIA';
}

function parseBulkItems(text) {
  return String(text || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(.*)$/);
      if (match) {
        return {
          cantidad: Math.max(parseInt(match[1], 10) || 1, 1),
          producto_nombre: match[2].trim(),
        };
      }
      return { cantidad: 1, producto_nombre: line };
    })
    .filter((item) => item.producto_nombre);
}

function QuickInfo({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon size={14} />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

export default function Pedidos() {
  const swipeStateRef = useRef({ startX: 0, startY: 0, lock: null });
  const [searchParams] = useSearchParams();
  const selectedPedidoIdFromUrl = Number(searchParams.get('id') || 0);
  const [pedidos, setPedidos] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [estado, setEstado] = useState(searchParams.get('estado') || '');
  const [zona, setZona] = useState(searchParams.get('zona_reparto') || '');
  const [urgente, setUrgente] = useState(searchParams.get('urgente') || '');
  const [showForm, setShowForm] = useState(false);
  const [showFoto, setShowFoto] = useState(false);
  const [form, setForm] = useState(FORM_DEFAULT);
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [bulkItemsText, setBulkItemsText] = useState('');
  const [clienteMatches, setClienteMatches] = useState([]);
  const [clienteLoading, setClienteLoading] = useState(false);
  const [showExtraFields, setShowExtraFields] = useState(false);
  const [clienteSuggestionsOpen, setClienteSuggestionsOpen] = useState(false);
  const [showProductSection, setShowProductSection] = useState(true);
  const [showMaterialsSection, setShowMaterialsSection] = useState(false);
  const [showDeliverySection, setShowDeliverySection] = useState(true);
  const [swipePedidoId, setSwipePedidoId] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [deletingPedidoId, setDeletingPedidoId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (estado) params.set('estado', estado);
    if (zona) params.set('zona_reparto', zona);
    if (urgente) params.set('urgente', urgente);
    if (search) params.set('search', search);
    api.get(`/pedidos?${params}`)
      .then((response) => {
        setPedidos(response.data.pedidos);
        setTotal(response.data.total);
        if (selectedPedidoIdFromUrl) {
          const matched = (response.data.pedidos || []).find((pedido) => pedido.id === selectedPedidoIdFromUrl);
          if (matched) setSelectedPedido(matched);
        }
      })
      .finally(() => setLoading(false));
  }, [estado, zona, urgente, search, selectedPedidoIdFromUrl]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.get('/auth/users').then((response) => setUsers(response.data));
  }, []);

  useEffect(() => {
    if (!showForm) return;
    const nombre = String(form.cliente_nombre || '').trim();

    if (!clienteSuggestionsOpen || nombre.length < 1) {
      setClienteMatches([]);
      return;
    }

    const timer = setTimeout(() => {
      setClienteLoading(true);
      api.get(`/clientes?search=${encodeURIComponent(nombre)}&limit=5`)
        .then((response) => setClienteMatches(response.data.clientes || []))
        .catch(() => setClienteMatches([]))
        .finally(() => setClienteLoading(false));
    }, 140);

    return () => clearTimeout(timer);
  }, [form.cliente_nombre, showForm, clienteSuggestionsOpen]);

  const trimmedClienteNombre = String(form.cliente_nombre || '').trim();
  const hasExactClienteMatch = clienteMatches.some(
    (cliente) => normalizeText(cliente.nombre) === normalizeText(trimmedClienteNombre)
  );
  const bulkItemsPreview = useMemo(() => parseBulkItems(bulkItemsText), [bulkItemsText]);
  const productoResumen = useMemo(() => (
    form.items.filter((item) => item.producto_nombre).reduce((sum, item) => sum + Number(item.cantidad || 0), 0)
  ), [form.items]);

  function resetForm() {
    setForm(FORM_DEFAULT);
    setBulkItemsText('');
    setClienteMatches([]);
    setShowExtraFields(false);
    setClienteSuggestionsOpen(false);
    setShowProductSection(true);
    setShowMaterialsSection(false);
    setShowDeliverySection(true);
  }

  function addItem() {
    setForm((current) => ({ ...current, items: [...current.items, { producto_nombre: '', cantidad: 1 }] }));
  }

  function removeItem(index) {
    setForm((current) => ({
      ...current,
      items: current.items.length === 1
        ? [{ producto_nombre: '', cantidad: 1 }]
        : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function updateItem(index, field, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }));
  }

  function applyBulkItems() {
    const parsed = parseBulkItems(bulkItemsText);
    if (!parsed.length) return;
    setForm((current) => ({ ...current, items: parsed }));
  }

  function applyTemplate(template) {
    if (!template?.lines?.length) return;
    setForm((current) => {
      const currentItems = current.items.filter((item) => item.producto_nombre);
      const nextItems = [...currentItems, ...template.lines];
      return {
        ...current,
        items: nextItems.length ? nextItems : [{ producto_nombre: '', cantidad: 1 }],
      };
    });
  }

  function clearItems() {
    setForm((current) => ({
      ...current,
      items: [{ producto_nombre: '', cantidad: 1 }],
    }));
    setBulkItemsText('');
  }

  function addCatalogItemToPedido(item) {
    if (!item?.nombre) return;
    setForm((current) => {
      const currentItems = Array.isArray(current.items) ? [...current.items] : [];
      const existingIndex = currentItems.findIndex(
        (entry) => normalizeText(entry.producto_nombre) === normalizeText(item.nombre)
      );

      if (existingIndex >= 0) {
        currentItems[existingIndex] = {
          ...currentItems[existingIndex],
          cantidad: Number(currentItems[existingIndex].cantidad || 1) + 1,
        };
      } else if (currentItems.length === 1 && !currentItems[0]?.producto_nombre) {
        currentItems[0] = { producto_nombre: item.nombre, cantidad: 1 };
      } else {
        currentItems.unshift({ producto_nombre: item.nombre, cantidad: 1 });
      }

      return { ...current, items: currentItems };
    });
  }

  function applyCliente(cliente) {
    setForm((current) => ({
      ...current,
      cliente_nombre: cliente.nombre || current.cliente_nombre,
      cliente_dni: cliente.nif || current.cliente_dni,
      cliente_telefono: cliente.telefono || current.cliente_telefono,
      cliente_email: cliente.email || current.cliente_email,
      cliente_direccion: cliente.direccion || current.cliente_direccion,
      cliente_cp: cliente.cp || current.cliente_cp,
      zona_reparto: cliente.zona_reparto || inferZone(`${cliente.direccion || ''} ${cliente.cp || ''} ${cliente.poblacion || ''}`),
    }));
    setClienteMatches([]);
    setClienteSuggestionsOpen(false);
  }

  function keepManualCliente() {
    setForm((current) => ({
      ...current,
      cliente_nombre: trimmedClienteNombre,
    }));
    setClienteMatches([]);
    setClienteSuggestionsOpen(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const items = form.items.filter((item) => item.producto_nombre);
      await api.post('/pedidos', { ...form, items });
      setShowForm(false);
      resetForm();
      load();
    } finally {
      setSaving(false);
    }
  }

  function aplicarResultadoIA(resultado) {
    if (!resultado?.pedido) return;
    const pedido = resultado.pedido;
    setForm((current) => ({
      ...current,
      cliente_nombre: pedido.cliente_nombre || current.cliente_nombre,
      cliente_dni: pedido.cliente_dni || current.cliente_dni,
      cliente_email: pedido.cliente_email || current.cliente_email,
      cliente_telefono: pedido.cliente_telefono || current.cliente_telefono,
      cliente_direccion: pedido.cliente_direccion || current.cliente_direccion,
      cliente_cp: pedido.cliente_cp || current.cliente_cp,
      zona_reparto: pedido.zona_reparto || inferZone(`${pedido.cliente_direccion || ''} ${pedido.cliente_cp || ''}`),
      tipo_documento: pedido.tipo_documento || current.tipo_documento,
      metodo_envio: pedido.metodo_envio || current.metodo_envio,
      urgente: pedido.urgente ?? current.urgente,
      notas: pedido.notas || current.notas,
      items: pedido.items?.length > 0 ? pedido.items : current.items,
    }));
    setShowForm(true);
  }

  async function cambiarEstado(id, nuevoEstado) {
    await api.patch(`/pedidos/${id}/estado`, { estado: nuevoEstado });
    load();
    if (selectedPedido?.id === id) {
      setSelectedPedido((current) => ({ ...current, estado: nuevoEstado }));
    }
  }

  async function borrarPedido(id) {
    const pedido = pedidos.find((item) => item.id === id);
    const ok = window.confirm(`Vas a borrar ${pedido?.numero || 'este pedido'}. Esta accion no se puede deshacer.`);
    if (!ok) return;

    setDeletingPedidoId(id);
    try {
      await api.delete(`/pedidos/${id}`);
      if (selectedPedido?.id === id) setSelectedPedido(null);
      setSwipePedidoId(null);
      setSwipeOffset(0);
      load();
    } finally {
      setDeletingPedidoId(null);
    }
  }

  function handleTouchStart(id, event) {
    const touch = event.touches[0];
    swipeStateRef.current = {
      startX: touch?.clientX || 0,
      startY: touch?.clientY || 0,
      lock: null,
    };
    setSwipePedidoId(id);
    setSwipeOffset((current) => (swipePedidoId === id ? current : 0));
  }

  function handleTouchMove(id, event) {
    if (swipePedidoId !== id) return;
    const touch = event.touches[0];
    const deltaX = (touch?.clientX || 0) - swipeStateRef.current.startX;
    const deltaY = (touch?.clientY || 0) - swipeStateRef.current.startY;

    if (!swipeStateRef.current.lock) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      swipeStateRef.current.lock = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y';
    }

    if (swipeStateRef.current.lock !== 'x') return;

    event.preventDefault();

    const nextOffset = swipeOffset === -96 && deltaX > 0
      ? Math.min(0, -96 + deltaX)
      : Math.min(0, deltaX * 0.92);

    setSwipeOffset(Math.max(nextOffset, -96));
  }

  function handleTouchEnd(id) {
    if (swipePedidoId !== id) return;
    if (swipeStateRef.current.lock === 'y') {
      swipeStateRef.current = { startX: 0, startY: 0, lock: null };
      return;
    }

    if (swipeOffset <= -64) {
      setSwipeOffset(-96);
    } else {
      setSwipePedidoId(null);
      setSwipeOffset(0);
    }

    swipeStateRef.current = { startX: 0, startY: 0, lock: null };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pedidos</h1>
          <p className="text-sm text-slate-500">{total} total</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button onClick={() => setShowFoto(true)} className="btn flex items-center justify-center gap-1.5 border border-slate-200 text-sm text-slate-700 hover:bg-slate-50">
            <Camera size={15} /> Foto a pedido
          </button>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary flex items-center justify-center gap-2">
            <Plus size={16} /> Nuevo pedido
          </button>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="relative min-w-48">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente, numero, telefono o producto..." className="input pl-8" />
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setUrgente((current) => (current ? '' : '1'))} className={`btn flex items-center gap-1.5 border ${urgente ? 'border-red-500 bg-red-500 text-white' : 'border-slate-200 text-slate-600'}`}>
            <Zap size={14} /> Urgentes
          </button>
          {(estado || zona || urgente || search) ? (
            <button onClick={() => { setEstado(''); setZona(''); setUrgente(''); setSearch(''); }} className="btn border border-slate-200 text-slate-600">
              Limpiar filtros
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">Cargando...</div>
      ) : pedidos.length === 0 ? (
        <div className="py-12 text-center text-slate-400">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay pedidos</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-medium text-slate-400">Desliza un pedido a la izquierda para borrarlo.</p>
          {pedidos.map((pedido) => (
            <div key={pedido.id} className="relative overflow-hidden rounded-2xl">
              <div className="absolute inset-y-0 right-0 flex items-center justify-end bg-red-500 px-3">
                <button
                  type="button"
                  onClick={() => borrarPedido(pedido.id)}
                  disabled={deletingPedidoId === pedido.id}
                  className="flex h-11 items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-red-600 shadow-sm disabled:opacity-60"
                >
                  <Trash2 size={15} />
                  {deletingPedidoId === pedido.id ? 'Borrando...' : 'Borrar'}
                </button>
              </div>

              <div
                onClick={() => {
                  if (swipePedidoId === pedido.id && swipeOffset === -96) return;
                  setSelectedPedido(pedido);
                }}
                onTouchStart={(event) => handleTouchStart(pedido.id, event)}
                onTouchMove={(event) => handleTouchMove(pedido.id, event)}
                onTouchEnd={() => handleTouchEnd(pedido.id)}
                style={{
                  transform: `translateX(${swipePedidoId === pedido.id ? swipeOffset : 0}px)`,
                  touchAction: 'pan-y',
                }}
                onTouchCancel={() => handleTouchEnd(pedido.id)}
                className={`card relative cursor-pointer transition-all duration-150 hover:shadow-md ${pedido.urgente ? 'border-l-4 border-l-red-500' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-800">{pedido.cliente_nombre}</span>
                      {pedido.urgente ? <span className="badge flex items-center gap-1 bg-red-100 text-red-600"><Zap size={10} />Urgente</span> : null}
                      <Badge estado={pedido.estado} />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">{pedido.numero} - {pedido.tipo_documento} - {pedido.metodo_envio}</p>
                    {pedido.items?.length > 0 ? (
                      <p className="mt-1 truncate text-sm text-slate-600">{pedido.items.map((item) => `${item.cantidad}x ${item.producto_nombre}`).join(', ')}</p>
                    ) : null}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-slate-400">{pedido.created_at?.substring(0, 10)}</p>
                    {pedido.responsable_nombre ? <p className="mt-0.5 text-xs text-slate-500">{pedido.responsable_nombre}</p> : null}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedPedido ? (
        <Modal title={`${selectedPedido.numero} - ${selectedPedido.cliente_nombre}`} onClose={() => setSelectedPedido(null)}>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge estado={selectedPedido.estado} />
              {selectedPedido.urgente ? <span className="badge bg-red-100 text-red-600"><Zap size={10} className="mr-1 inline" />Urgente</span> : null}
              <span className="badge bg-slate-100 text-slate-600">{selectedPedido.tipo_documento}</span>
              <span className="badge bg-slate-100 text-slate-600">{selectedPedido.metodo_envio}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-400">DNI:</span> {selectedPedido.cliente_dni || '-'}</div>
              <div><span className="text-slate-400">Tel:</span> {selectedPedido.cliente_telefono || '-'}</div>
              <div className="col-span-2"><span className="text-slate-400">Email:</span> {selectedPedido.cliente_email || '-'}</div>
              <div className="col-span-2"><span className="text-slate-400">Direccion:</span> {selectedPedido.cliente_direccion || '-'} {selectedPedido.cliente_cp}</div>
            </div>

            {selectedPedido.items?.length > 0 ? (
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">PRODUCTOS</p>
                <div className="space-y-1">
                  {selectedPedido.items.map((item) => (
                    <div key={item.id} className="flex justify-between rounded bg-slate-50 px-3 py-1.5 text-sm">
                      <span>{item.producto_nombre}</span>
                      <span className="text-slate-500">x{item.cantidad}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {selectedPedido.notas ? (
              <div className="rounded-lg bg-yellow-50 px-3 py-2 text-sm text-slate-700">
                <span className="mb-0.5 block text-xs text-slate-400">Notas:</span>
                {selectedPedido.notas}
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">CAMBIAR ESTADO</p>
              <div className="flex flex-wrap gap-1.5">
                {ESTADOS.map((item) => (
                  <button
                    key={item}
                    onClick={() => cambiarEstado(selectedPedido.id, item)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${selectedPedido.estado === item ? ESTADO_COLORS[item] : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      ) : null}

      {showFoto ? (
        <Modal title="Foto a pedido" onClose={() => setShowFoto(false)} wide>
          <PhotoOrderAssistant
            onResultado={(resultado) => {
              aplicarResultadoIA(resultado);
              setShowFoto(false);
            }}
          />
        </Modal>
      ) : null}

      {showForm ? (
        <Modal title="Nuevo pedido" onClose={() => setShowForm(false)} wide>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-2xl border border-atomx-200 bg-orange-50/60 p-4">
              <p className="text-sm font-semibold text-slate-800">Modo rapido</p>
              <p className="mt-1 text-xs text-slate-500">Cliente, productos y guardar. Lo demas solo si hace falta.</p>
            </div>

            <div className="hidden grid-cols-1 gap-3 sm:grid md:grid-cols-3">
              <QuickInfo icon={UserRound} label="Cliente" value={trimmedClienteNombre || 'Sin elegir'} />
              <QuickInfo icon={Package} label="Productos" value={`${form.items.filter((item) => item.producto_nombre).length} lineas · ${productoResumen} uds`} />
              <QuickInfo icon={Clock3} label="Zona" value={form.zona_reparto.replace('ZONA ', '')} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Cliente *</label>
                <input
                  value={form.cliente_nombre}
                  autoFocus
                  onBlur={() => setTimeout(() => setClienteSuggestionsOpen(false), 120)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && clienteMatches.length > 0) {
                      event.preventDefault();
                      applyCliente(clienteMatches[0]);
                    }
                  }}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm((current) => ({ ...current, cliente_nombre: value }));
                    setClienteSuggestionsOpen(value.trim().length >= 1);
                  }}
                  className="input h-14 text-lg font-semibold"
                  required
                  placeholder="Nombre y apellidos"
                />

                {clienteSuggestionsOpen && (trimmedClienteNombre.length >= 1 || clienteLoading || clienteMatches.length > 0) ? (
                <div className="mt-2 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
                  {clienteLoading ? <p className="px-2 py-1 text-xs text-slate-400">Buscando clientes...</p> : null}

                  {clienteMatches.map((cliente) => (
                    <button
                      key={`${cliente.id}-${cliente.nombre}`}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applyCliente(cliente)}
                      className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition-colors hover:border-atomx-200 hover:bg-orange-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{cliente.nombre}</p>
                        <p className="truncate text-xs text-slate-500">
                          {[cliente.telefono, cliente.direccion, cliente.cp, cliente.poblacion].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">
                        {String(cliente.zona_reparto || '').replace('ZONA ', '')}
                      </span>
                    </button>
                  ))}

                  {trimmedClienteNombre.length >= 1 && !hasExactClienteMatch ? (
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={keepManualCliente}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-atomx-300 bg-orange-50 px-3 py-3 text-left transition-colors hover:bg-orange-100"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">Crear rapido con este nombre</p>
                        <p className="truncate text-xs text-slate-500">{trimmedClienteNombre}</p>
                      </div>
                      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-500">manual</span>
                    </button>
                  ) : null}

                  {trimmedClienteNombre.length < 1 && !clienteMatches.length ? (
                    <p className="px-2 py-1 text-xs text-slate-400">Desde la primera letra te saco hasta 5 coincidencias. Si no existe, lo creas solo con el nombre.</p>
                  ) : null}
                </div>
                ) : null}
              </div>

              <div>
                <label className="label">Telefono</label>
                <input value={form.cliente_telefono} onChange={(event) => setForm((current) => ({ ...current, cliente_telefono: event.target.value }))} className="input" placeholder="600000000" inputMode="tel" />
              </div>
              <div>
                <label className="label">Codigo postal</label>
                <input value={form.cliente_cp} onChange={(event) => setForm((current) => {
                  const cp = event.target.value;
                  return { ...current, cliente_cp: cp, zona_reparto: inferZone(`${current.cliente_direccion} ${cp}`) };
                })} className="input" placeholder="30000" />
              </div>

              <div className="col-span-2">
                <label className="label">Direccion</label>
                <input value={form.cliente_direccion} onChange={(event) => setForm((current) => {
                  const direccion = event.target.value;
                  return { ...current, cliente_direccion: direccion, zona_reparto: inferZone(`${direccion} ${current.cliente_cp}`) };
                })} className="input" placeholder="Calle y numero" />
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowProductSection((current) => !current)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">Productos</p>
                  <p className="text-xs text-slate-500">Plantillas, pegado rapido y lineas del pedido.</p>
                </div>
                {showProductSection ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
              </button>

              {showProductSection ? (
                <div className="space-y-4 border-t border-slate-200 px-4 py-4">
                  <div>
                    <label className="label">Plantillas rapidas</label>
                    <div className="flex flex-wrap gap-2">
                      {QUICK_PRODUCT_TEMPLATES.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => applyTemplate(template)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-atomx-300 hover:bg-orange-50"
                        >
                          {template.name}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={clearItems}
                        className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      >
                        Limpiar productos
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="label">Meter productos de golpe</label>
                    <textarea
                      value={bulkItemsText}
                      onChange={(event) => setBulkItemsText(event.target.value)}
                      className="input h-28 resize-none bg-white"
                      placeholder={`Ejemplo:\n2 DYNAMIC BLACK 10\n1003 RL EMALLA\n3 CARTUCHOS 9RL KWADRON`}
                    />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-slate-500">
                        {bulkItemsPreview.length > 0
                          ? `${bulkItemsPreview.length} productos detectados`
                          : 'Una linea por producto. Si empiezas por un numero, lo tomo como cantidad.'}
                      </p>
                      <button type="button" onClick={applyBulkItems} disabled={!bulkItemsPreview.length} className="btn border border-slate-200 text-slate-700 disabled:opacity-50">
                        Usar listado
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="label">Productos</label>
                    <div className="space-y-2">
                      {form.items.map((item, index) => (
                        <div key={index} className="rounded-2xl border border-slate-200 bg-white p-3">
                          <input
                            value={item.producto_nombre}
                            onChange={(event) => updateItem(index, 'producto_nombre', event.target.value)}
                            className="input h-12 bg-slate-50 text-base"
                            placeholder="Nombre del producto"
                          />
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <NumberStepper value={item.cantidad} min={1} onChange={(value) => updateItem(index, 'cantidad', value)} />
                            <button type="button" onClick={() => removeItem(index)} className="btn flex h-10 w-10 items-center justify-center border border-slate-200 text-slate-600 hover:border-red-200 hover:text-red-600">
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={addItem} className="btn-ghost mt-2 flex items-center gap-1 text-xs"><Plus size={14} /> Anadir producto</button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowMaterialsSection((current) => !current)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">Materiales rapidos</p>
                  <p className="text-xs text-slate-500">Buscar por familia, stock y anadir al pedido sin salir.</p>
                </div>
                {showMaterialsSection ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
              </button>

              {showMaterialsSection ? (
                <div className="border-t border-slate-200 px-4 py-4">
                  <QuickMaterialsPanel onAddToPedido={addCatalogItemToPedido} compact />
                </div>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowDeliverySection((current) => !current)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">Entrega y extras</p>
                  <p className="text-xs text-slate-500">Urgencia, responsable y datos que no hacen falta siempre.</p>
                </div>
                {showDeliverySection ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
              </button>

              {showDeliverySection ? (
                <div className="space-y-3 border-t border-slate-200 px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowExtraFields((current) => !current)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                      {showExtraFields ? 'Ocultar extras' : 'Mostrar extras'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, urgente: !current.urgente }))}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium ${form.urgente ? 'border-red-500 bg-red-500 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      <span className="inline-flex items-center gap-1"><Zap size={14} /> Urgente</span>
                    </button>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                      Zona automatica: {form.zona_reparto.replace('ZONA ', '')}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {showDeliverySection && showExtraFields ? (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">DNI</label>
                    <input value={form.cliente_dni} onChange={(event) => setForm((current) => ({ ...current, cliente_dni: event.target.value }))} className="input" placeholder="12345678A" />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input type="email" value={form.cliente_email} onChange={(event) => setForm((current) => ({ ...current, cliente_email: event.target.value }))} className="input" placeholder="cliente@email.com" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Documento</label>
                    <ChipSelect
                      value={form.tipo_documento}
                      onChange={(value) => setForm((current) => ({ ...current, tipo_documento: value }))}
                      options={[
                        { value: 'factura', label: 'Factura' },
                        { value: 'albaran', label: 'Albaran' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="label">Envio</label>
                    <ChipSelect
                      value={form.metodo_envio}
                      onChange={(value) => setForm((current) => ({ ...current, metodo_envio: value }))}
                      options={[
                        { value: 'envio', label: 'Envio' },
                        { value: 'recogida', label: 'Recogida' },
                        { value: 'contrareembolso', label: 'Contra' },
                        { value: 'mano', label: 'En mano' },
                      ]}
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Responsable</label>
                  <ChipSelect
                    value={form.responsable_id}
                    onChange={(value) => setForm((current) => ({ ...current, responsable_id: value }))}
                    allowEmpty
                    options={users.map((user) => ({ value: user.id, label: user.nombre }))}
                  />
                </div>

                <div>
                  <label className="label">Notas internas</label>
                  <textarea value={form.notas} onChange={(event) => setForm((current) => ({ ...current, notas: event.target.value }))} className="input h-20 resize-none" placeholder="Notas, instrucciones especiales..." />
                </div>
              </div>
            ) : null}

            <div className="sticky bottom-3 z-10 flex justify-end gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 pt-2 backdrop-blur">
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">Cancelar</button>
              <button type="submit" disabled={saving || !trimmedClienteNombre} className="btn-primary">{saving ? 'Guardando...' : 'Crear pedido'}</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
