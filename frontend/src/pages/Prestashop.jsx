import { useEffect, useMemo, useState } from 'react';
import { Database, Layers3, PackageSearch, RefreshCcw, Search, ShoppingBag } from 'lucide-react';
import api from '../api/client';

const STATE_MAP = {
  2: 'Pago aceptado',
  3: 'Preparacion en curso',
  4: 'Enviado',
  5: 'Entregado',
  33: 'Pago fraccionado',
};

function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isDoneState(name) {
  const lower = normalize(name);
  return ['enviado', 'expedido', 'entregado', 'completado'].some((token) => lower.includes(token));
}

function formatMoney(value) {
  const amount = Number(value || 0);
  if (amount <= 0) return 'Consultar';
  return `${amount.toFixed(2)}€`;
}

function detectBrand(name, reference = '') {
  const text = normalize(`${name} ${reference}`);
  const brands = [
    ['kwadron', 'Kwadron'],
    ['emalla', 'Emalla'],
    ['elite', 'Elite'],
    ['dynamic', 'Dynamic'],
    ['proton', 'Proton'],
    ['hype', 'Hype'],
    ['bishop', 'Bishop'],
    ['evolution', 'Evolution'],
    ['spirit', 'Spirit'],
    ['panthera', 'Panthera'],
    ['world famous', 'World Famous'],
    ['intenze', 'Intenze'],
    ['critical', 'Critical'],
  ];
  return brands.find(([token]) => text.includes(token))?.[1] || 'Otras marcas';
}

function detectCategory(name, reference = '') {
  const text = normalize(`${name} ${reference}`);
  if (['rl', 'rs', 'rm', 'magnum', 'liner', 'shader', 'cartucho', 'aguja', 'needle', 'kwadron', 'emalla', 'elite'].some((token) => text.includes(token))) {
    return 'Agujas y cartuchos';
  }
  if (['ink', 'tinta', 'dynamic', 'panthera', 'black', 'greywash', 'hype'].some((token) => text.includes(token))) {
    return 'Tintas';
  }
  if (['stencil', 'blue soap', 'butter', 'foam', 'remover', 'proton', 'green soap'].some((token) => text.includes(token))) {
    return 'Preparacion y cuidado';
  }
  if (['machine', 'maquina', 'pen', 'bishop', 'critical'].some((token) => text.includes(token))) {
    return 'Maquinas y electronica';
  }
  return 'Otros';
}

export default function Prestashop() {
  const [health, setHealth] = useState({ ok: false, error: '' });
  const [orders, setOrders] = useState([]);
  const [details, setDetails] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [statesMap, setStatesMap] = useState({});
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [scanningDuplicates, setScanningDuplicates] = useState(false);
  const [warning, setWarning] = useState('');

  async function loadAll() {
    setLoading(true);
    setWarning('');
    try {
      const [healthResp, orderResp, stateResp] = await Promise.all([
        api.get('/prestashop/health'),
        api.get('/prestashop/orders?limit=20'),
        api.get('/prestashop/order-states'),
      ]);
      const dynamicMap = Object.fromEntries((stateResp.data || []).map((item) => [item.id, item.nombre]));
      const webOrders = orderResp.data || [];
      const pendingIds = webOrders
        .map((item) => ({
          ...item,
          stateName: dynamicMap[item.current_state] || STATE_MAP[item.current_state] || `Estado ${item.current_state}`,
        }))
        .filter((item) => !isDoneState(item.stateName))
        .map((item) => item.id)
        .slice(0, 12);

      setStatesMap(dynamicMap);
      setHealth({ ok: !!healthResp.data?.ok, error: '' });
      setOrders(webOrders);

      if (pendingIds.length) {
        const detailsResp = await api.get(`/prestashop/order-details?order_ids=${pendingIds.join(',')}`);
        setDetails(detailsResp.data || []);
      } else {
        setDetails([]);
      }
    } catch (error) {
      setHealth({
        ok: false,
        error: error.response?.data?.error || 'No he podido leer PrestaShop ahora mismo.',
      });
      setOrders([]);
      setStatesMap({});
      setDetails([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const resp = await api.get('/prestashop/poll-nuevos');
        if (resp.data?.nuevos > 0) {
          await loadAll();
        }
      } catch {}
    }, 2 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const value = search.trim();
    if (value.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      handleSearch();
    }, 220);
    return () => clearTimeout(timer);
  }, [search]);

  async function reload() {
    setSyncing(true);
    try {
      await loadAll();
    } finally {
      setSyncing(false);
    }
  }

  async function handleSearch() {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setWarning('');
    try {
      const resp = await api.get(`/prestashop/products?limit=12&search=${encodeURIComponent(search.trim())}`);
      setSearchResults(resp.data || []);
    } catch (error) {
      setWarning(error.response?.data?.error || 'No he podido buscar productos en la web.');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function loadDuplicates() {
    setScanningDuplicates(true);
    setWarning('');
    try {
      const resp = await api.get('/prestashop/duplicates?limit=12');
      setDuplicates(resp.data || []);
    } catch (error) {
      setWarning(error.response?.data?.error || 'No he podido escanear duplicados ahora mismo.');
      setDuplicates([]);
    } finally {
      setScanningDuplicates(false);
    }
  }

  function getStateName(item) {
    return statesMap[item.current_state] || STATE_MAP[item.current_state] || `Estado ${item.current_state}`;
  }

  const pendientes = useMemo(() => {
    const withState = orders.map((item) => ({ ...item, stateName: getStateName(item) }));
    return withState.filter((item) => !isDoneState(item.stateName)).slice(0, 10);
  }, [orders, statesMap]);

  const resumenPendientes = useMemo(() => {
    const detailMap = new Map();
    details.forEach((item) => {
      if (!detailMap.has(item.id_order)) detailMap.set(item.id_order, []);
      detailMap.get(item.id_order).push(item);
    });
    return pendientes.map((pedido) => ({
      ...pedido,
      lineas: detailMap.get(Number(pedido.id)) || [],
    }));
  }, [details, pendientes]);

  const resumenCompra = useMemo(() => {
    const byCategory = new Map();

    resumenPendientes.forEach((pedido) => {
      pedido.lineas.forEach((linea) => {
        const category = detectCategory(linea.product_name, linea.product_reference);
        const brand = detectBrand(linea.product_name, linea.product_reference);
        if (!byCategory.has(category)) byCategory.set(category, new Map());
        const brandMap = byCategory.get(category);
        if (!brandMap.has(brand)) brandMap.set(brand, []);
        brandMap.get(brand).push(linea);
      });
    });

    return [...byCategory.entries()].map(([category, brands]) => ({
      category,
      brands: [...brands.entries()].map(([brand, items]) => ({
        brand,
        totalQuantity: items.reduce((sum, item) => sum + Number(item.product_quantity || 0), 0),
        items,
      })),
    }));
  }, [resumenPendientes]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">PrestaShop</h1>
          <p className="text-slate-500 text-sm">Control rapido de pedidos web y buscador de producto para comerciales.</p>
        </div>
        <button onClick={reload} disabled={syncing} className="btn-primary inline-flex items-center gap-2">
          <RefreshCcw size={15} className={syncing ? 'animate-spin' : ''} />
          Refrescar
        </button>
      </div>

      <div className={`rounded-2xl border px-4 py-3 text-sm ${health.ok ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
        {health.ok ? 'Conectado con la web real de PrestaShop.' : (health.error || 'Aun no tengo confirmacion de la conexion.')}
      </div>

      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Cuidado: cualquier cambio que toque la web real siempre tiene que avisar antes.
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 inline-flex items-center gap-2">
        <Database size={15} className="text-slate-900" />
        Voy guardando pedidos, lineas y productos de PrestaShop en la base local para historico y analitica.
      </div>

      {warning ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {warning}
        </div>
      ) : null}

      <section className="rounded-[2rem] border border-yellow-200 bg-gradient-to-br from-yellow-50 via-yellow-100 to-amber-50 p-5">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-yellow-400 text-slate-950 flex items-center justify-center text-2xl font-black shadow-sm">
            A
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Busca tu producto rapido</p>
            <p className="text-xs text-slate-600">Dime nombre, marca o referencia y te saco lo que haya en la web sin llenarte la pantalla.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="Ej: kwadron 1017 rm, emalla 0603, dynamic..."
              className="input pl-8 bg-white"
            />
          </div>
          <button onClick={handleSearch} disabled={searching} className="btn-primary inline-flex items-center gap-2">
            <PackageSearch size={15} />
            {searching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {searchResults.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {searchResults.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="font-semibold text-slate-800">{item.nombre || `Producto ${item.id}`}</p>
                <p className="text-xs text-slate-400 mt-1">Ref {item.referencia || 'sin ref'} · ID {item.id}</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Sin IVA</p>
                    <p className="text-lg font-black text-slate-900">{formatMoney(item.precio_sin_iva ?? item.precio)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Con IVA</p>
                    <p className="text-lg font-black text-amber-700">{formatMoney(item.precio_con_iva)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : search.trim() && !searching ? (
          <p className="mt-4 text-sm text-slate-600">No veo coincidencias ahora mismo para esa busqueda.</p>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-5">
        <section className="card space-y-3">
          <div className="flex items-center gap-2">
            <ShoppingBag size={16} className="text-amber-600" />
            <h2 className="font-semibold text-slate-800">Pendientes</h2>
          </div>
          {loading ? <p className="text-sm text-slate-400">Cargando pedidos...</p> : (
            <div className="space-y-2">
              {pendientes.map((item, index) => (
                <div key={item.id} className={`rounded-2xl border border-slate-200 bg-white px-4 py-3 ${index === pendientes.length - 1 ? 'opacity-70' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800">Pedido #{item.id}</p>
                      <p className="text-xs text-slate-400 mt-1">Ref: {item.reference || 'sin ref'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-slate-900">{Number(item.total_paid || 0).toFixed(2)}€</p>
                      <p className="text-[11px] text-slate-400">{item.payment || 'sin pago'}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">{item.stateName}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">cliente {item.id_customer || '-'}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">{String(item.date_add || '').slice(0, 16)}</span>
                  </div>
                </div>
              ))}
              {!pendientes.length ? <p className="text-sm text-slate-400">No veo pendientes ahora mismo.</p> : null}
            </div>
          )}
        </section>
      </div>

      <section className="card space-y-3">
        <div className="flex items-center gap-2">
          <ShoppingBag size={16} className="text-slate-900" />
          <h2 className="font-semibold text-slate-800">Esta noche tienes que comprar esto</h2>
          <span className="text-xs text-slate-400">agrupado por categoria y marca</span>
        </div>
        {loading ? <p className="text-sm text-slate-400">Cargando resumen...</p> : (
          <div className="space-y-3">
            {resumenCompra.map((group) => (
              <div key={group.category} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-800">{group.category}</p>
                  <span className="badge bg-amber-100 text-amber-700">
                    {group.brands.reduce((sum, brand) => sum + brand.totalQuantity, 0)} uds
                  </span>
                </div>
                <div className="mt-3 space-y-3">
                  {group.brands.map((brandGroup) => (
                    <div key={brandGroup.brand} className="rounded-xl bg-slate-50 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-800">{brandGroup.brand}</p>
                        <span className="text-xs font-bold text-slate-500">{brandGroup.totalQuantity} uds</span>
                      </div>
                      <div className="mt-2 space-y-2">
                        {brandGroup.items.map((linea) => (
                          <div key={`${brandGroup.brand}-${linea.id}-${linea.product_reference}`} className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm text-slate-800">{linea.product_name}</p>
                              <p className="text-xs text-slate-400">Ref {linea.product_reference || 'sin ref'}</p>
                              {Number(linea.stock_actual) <= 0 ? (
                                <p className="text-xs font-semibold text-red-600 mt-1">Sin stock ahora mismo</p>
                              ) : null}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-slate-900">x{linea.product_quantity}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!resumenCompra.length ? <p className="text-sm text-slate-400">No veo pedidos pendientes para repasar esta noche.</p> : null}
          </div>
        )}
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers3 size={16} className="text-slate-900" />
            <h2 className="font-semibold text-slate-800">Duplicados detectados</h2>
            <span className="text-xs text-slate-400">me quedo con la ficha mas completa</span>
          </div>
          <button onClick={loadDuplicates} disabled={scanningDuplicates} className="btn-ghost text-sm">
            {scanningDuplicates ? 'Escaneando...' : 'Escanear'}
          </button>
        </div>
        {duplicates.length ? (
          <div className="space-y-3">
            {duplicates.map((group) => (
              <div key={group.key} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">{group.keep.referencia || group.keep.nombre}</p>
                    <p className="text-xs text-slate-400 mt-1">{group.total} fichas repetidas</p>
                  </div>
                  <span className="badge bg-green-100 text-green-700">Me quedaria con #{group.keep.id}</span>
                </div>
                <div className="mt-3 rounded-xl bg-green-50 px-3 py-3">
                  <p className="text-sm font-semibold text-slate-800">{group.keep.nombre}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    score {group.keep.score} · campos {group.keep.filled_fields} · corta {group.keep.description_short_chars} · larga {group.keep.description_chars}
                  </p>
                </div>
                <div className="mt-3 space-y-2">
                  {group.duplicates.map((item) => (
                    <div key={item.id} className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-sm text-slate-800">#{item.id} · {item.nombre}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        score {item.score} · campos {item.filled_fields} · corta {item.description_short_chars} · larga {item.description_chars}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Todavia no he escaneado duplicados en la web.</p>
        )}
      </section>
    </div>
  );
}
