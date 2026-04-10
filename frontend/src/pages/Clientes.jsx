import { useEffect, useMemo, useState } from 'react';
import { Phone, MapPin, Search, ShieldAlert, UserRound, Save, RefreshCw, Combine } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';

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

function StatCard({ label, value, help }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-800">{value}</p>
      {help ? <p className="mt-1 text-xs text-slate-500">{help}</p> : null}
    </div>
  );
}

export default function Clientes() {
  const [searchParams] = useSearchParams();
  const selectedIdFromUrl = Number(searchParams.get('id') || 0);
  const [overview, setOverview] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [selectedPrimaryIdByGroup, setSelectedPrimaryIdByGroup] = useState({});
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [mergingKey, setMergingKey] = useState('');
  const [message, setMessage] = useState('');
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [history, setHistory] = useState({ pedidos: [], productos: [] });

  async function loadOverview() {
    const { data } = await api.get('/clientes/overview');
    setOverview(data);
  }

  async function loadDuplicates() {
    const { data } = await api.get('/clientes/duplicates');
    setDuplicateGroups(data.groups || []);
  }

  async function loadHistory(clienteId) {
    if (!clienteId) {
      setHistory({ pedidos: [], productos: [] });
      return;
    }
    const { data } = await api.get(`/clientes/${clienteId}/history`);
    setHistory({
      pedidos: data.pedidos || [],
      productos: data.productos || [],
    });
  }

  async function loadClientes(currentSearch = '') {
    const query = currentSearch.trim()
      ? `/clientes?search=${encodeURIComponent(currentSearch.trim())}&limit=30&include_internal=1`
      : '/clientes?limit=30&include_internal=1';
    const { data } = await api.get(query);
    setClientes(data.clientes || []);
    if (selectedCliente?.id) {
      const refreshedSelected = (data.clientes || []).find((item) => item.id === selectedCliente.id);
      if (refreshedSelected) setSelectedCliente(refreshedSelected);
    } else if (data.clientes?.length) {
      setSelectedCliente(data.clientes[0]);
    }
  }

  async function loadAll(initialSearch = '') {
    setLoading(true);
    try {
      await Promise.all([loadOverview(), loadClientes(initialSearch), loadDuplicates()]);
      setMessage('');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!selectedIdFromUrl || !clientes.length) return;
    const match = clientes.find((cliente) => cliente.id === selectedIdFromUrl);
    if (match) setSelectedCliente(match);
  }, [selectedIdFromUrl, clientes]);

  useEffect(() => {
    loadHistory(selectedCliente?.id).catch(() => setHistory({ pedidos: [], productos: [] }));
  }, [selectedCliente?.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadClientes(search).catch(() => {});
    }, 160);
    return () => clearTimeout(timer);
  }, [search]);

  const zoneBreakdown = useMemo(() => overview?.porZona || [], [overview]);

  function patchSelected(key, value) {
    setSelectedCliente((current) => ({ ...current, [key]: value }));
  }

  async function saveCliente() {
    if (!selectedCliente?.id) return;
    setSaving(true);
    try {
      const { data } = await api.patch(`/clientes/${selectedCliente.id}`, selectedCliente);
      setSelectedCliente(data);
      await Promise.all([loadOverview(), loadClientes(search), loadDuplicates()]);
      setMessage('Cliente guardado');
    } finally {
      setSaving(false);
    }
  }

  async function importLocalExcel() {
    setImporting(true);
    try {
      const { data } = await api.post('/clientes/import/factusol-local');
      await Promise.all([loadOverview(), loadClientes(search), loadDuplicates()]);
      setMessage(`Importados ${data.imported || 0} clientes desde Factusol`);
    } finally {
      setImporting(false);
    }
  }

  async function mergeDuplicateGroup(group) {
    if (!group?.clientes?.length || group.clientes.length < 2) return;
    const preferredPrimaryId = selectedPrimaryIdByGroup[group.key];
    const ordered = preferredPrimaryId
      ? [...group.clientes].sort((a, b) => (a.id === preferredPrimaryId ? -1 : b.id === preferredPrimaryId ? 1 : 0))
      : group.clientes;
    const [primary, ...duplicates] = ordered;
    setMergingKey(group.key);
    try {
      await api.post('/clientes/merge', {
        primaryId: primary.id,
        duplicateIds: duplicates.map((item) => item.id),
      });
      await Promise.all([loadOverview(), loadClientes(search), loadDuplicates()]);
      setSelectedCliente(primary);
      setMessage(`Fusionado ${primary.nombre} y eliminados ${duplicates.length} duplicados`);
    } finally {
      setMergingKey('');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Clientes</h1>
          <p className="text-sm text-slate-500">Base viva para pedidos rapidos, zonas correctas y limpieza de duplicados.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button onClick={importLocalExcel} disabled={importing} className="btn flex items-center justify-center gap-2 border border-slate-200 text-slate-700">
            <RefreshCw size={15} className={importing ? 'animate-spin' : ''} />
            {importing ? 'Importando...' : 'Importar Excel Factusol'}
          </button>
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <StatCard label="Clientes activos" value={overview?.total ?? 0} />
        <StatCard label="Internos" value={overview?.internos ?? 0} help="Ventas tienda y similares" />
        <StatCard label="Sin telefono" value={overview?.sinTelefono ?? 0} />
        <StatCard label="Sin zona" value={overview?.sinZona ?? 0} />
        <StatCard label="Duplicados" value={overview?.duplicados ?? 0} help="Mismo nombre repetido" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr,1.05fr]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-3 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar nombre, telefono, nif o direccion..."
                className="input pl-8"
              />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-3">
            <div className="space-y-2">
              {loading ? <p className="px-2 py-3 text-sm text-slate-400">Cargando clientes...</p> : null}
              {!loading && !clientes.length ? <p className="px-2 py-3 text-sm text-slate-400">No veo clientes con ese filtro.</p> : null}
              {clientes.map((cliente) => (
                <button
                  key={cliente.id}
                  onClick={() => setSelectedCliente(cliente)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${selectedCliente?.id === cliente.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{cliente.nombre}</p>
                      <p className={`mt-1 text-xs ${selectedCliente?.id === cliente.id ? 'text-white/70' : 'text-slate-500'}`}>
                        {[cliente.telefono, cliente.poblacion, cliente.zona_reparto].filter(Boolean).join(' · ') || 'Sin datos extra'}
                      </p>
                    </div>
                    {cliente.es_interno ? <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${selectedCliente?.id === cliente.id ? 'bg-white/15 text-white' : 'bg-amber-100 text-amber-700'}`}>Interno</span> : null}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <MapPin size={15} />
              Zonas que mas tienes
            </div>
            <div className="space-y-2">
              {zoneBreakdown.map((item) => (
                <div key={item.zona} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-700">{item.zona}</span>
                  <span className="font-semibold text-slate-900">{item.total}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Combine size={15} />
              Duplicados detectados
            </div>
            <div className="space-y-3">
              {!duplicateGroups.length ? <p className="text-sm text-slate-400">Ahora mismo no veo grupos duplicados serios.</p> : null}
              {duplicateGroups.map((group) => (
                <div key={group.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{group.clientes?.[0]?.nombre || group.key}</p>
                      <p className="mt-1 text-xs text-slate-500">{group.total} fichas repetidas · criterio {group.reason}</p>
                    </div>
                    <button
                      onClick={() => mergeDuplicateGroup(group)}
                      disabled={mergingKey === group.key}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                    >
                      {mergingKey === group.key ? 'Fusionando...' : 'Fusionar'}
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {group.clientes.map((cliente) => (
                      <div key={cliente.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-slate-700">{cliente.nombre}</p>
                          <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                            <input
                              type="radio"
                              name={`primary-${group.key}`}
                              checked={(selectedPrimaryIdByGroup[group.key] || group.clientes[0]?.id) === cliente.id}
                              onChange={() => setSelectedPrimaryIdByGroup((current) => ({ ...current, [group.key]: cliente.id }))}
                            />
                            Principal
                          </label>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{[cliente.telefono, cliente.direccion, cliente.cp].filter(Boolean).join(' · ') || 'Sin datos fuertes'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          {!selectedCliente ? (
            <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-400">Selecciona un cliente para editarlo rapido.</div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <UserRound size={13} />
                    Cliente
                  </div>
                  <h2 className="mt-3 text-2xl font-bold text-slate-800">{selectedCliente.nombre}</h2>
                  <p className="text-sm text-slate-500">Codigo externo: {selectedCliente.codigo_externo || 'manual'} · Origen: {selectedCliente.origen || 'manual'}</p>
                </div>
                {selectedCliente.es_interno ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    Cliente interno
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Nombre</label>
                  <input value={selectedCliente.nombre || ''} onChange={(e) => patchSelected('nombre', e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Telefono</label>
                  <input value={selectedCliente.telefono || ''} onChange={(e) => patchSelected('telefono', e.target.value)} className="input" inputMode="tel" />
                </div>
                <div>
                  <label className="label">NIF</label>
                  <input value={selectedCliente.nif || ''} onChange={(e) => patchSelected('nif', e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input value={selectedCliente.email || ''} onChange={(e) => patchSelected('email', e.target.value)} className="input" inputMode="email" />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Direccion</label>
                  <input value={selectedCliente.direccion || ''} onChange={(e) => patchSelected('direccion', e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Codigo postal</label>
                  <input value={selectedCliente.cp || ''} onChange={(e) => patchSelected('cp', e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Poblacion</label>
                  <input value={selectedCliente.poblacion || ''} onChange={(e) => patchSelected('poblacion', e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Provincia</label>
                  <input value={selectedCliente.provincia || ''} onChange={(e) => patchSelected('provincia', e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Zona de reparto</label>
                  <select value={selectedCliente.zona_reparto || 'ZONA MURCIA'} onChange={(e) => patchSelected('zona_reparto', e.target.value)} className="input">
                    {ZONAS_REPARTO.map((zona) => (
                      <option key={zona} value={zona}>{zona}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Phone size={15} />
                    Telefono listo para pedidos
                  </div>
                  <p className="mt-2 text-sm text-slate-500">Aqui arreglas rapido los datos que luego usan pedidos, rutas y direccion.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <ShieldAlert size={15} />
                    Duplicados y limpieza
                  </div>
                  <p className="mt-2 text-sm text-slate-500">Ya detectamos por nombre, telefono o NIF, y puedes elegir la ficha principal antes de fusionar.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-700">Ultimos pedidos</p>
                  <div className="mt-3 space-y-2">
                    {!history.pedidos.length ? <p className="text-xs text-slate-400">Todavia no tiene pedidos guardados.</p> : null}
                    {history.pedidos.map((pedido) => (
                      <div key={pedido.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-800">{pedido.numero}</p>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{pedido.estado}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{pedido.zona_reparto || 'Sin zona'} · {String(pedido.created_at || '').slice(0, 10)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-700">Productos que mas repite</p>
                  <div className="mt-3 space-y-2">
                    {!history.productos.length ? <p className="text-xs text-slate-400">Todavia no veo repeticion de compra.</p> : null}
                    {history.productos.map((producto) => (
                      <div key={producto.producto_nombre} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-800">{producto.producto_nombre}</p>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{producto.veces} veces</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{producto.total_cantidad} uds registradas</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="sticky bottom-3 z-10 flex justify-end rounded-2xl border border-slate-200 bg-white/95 p-3 backdrop-blur">
                <button onClick={saveCliente} disabled={saving} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
                  <Save size={15} />
                  {saving ? 'Guardando...' : 'Guardar cliente'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
