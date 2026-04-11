import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, Copy, Layers3, Plus, Search, ShoppingBasket, UploadCloud, Users } from 'lucide-react';
import api from '../api/client';

const INTERNAL_LIST_KEY = 'atomx_materiales_lista_interna';

function formatMoney(value) {
  const amount = Number(value || 0);
  if (amount <= 0) return 'Consultar';
  return `${amount.toFixed(2)}€`;
}

function readInternalList() {
  try {
    const raw = window.localStorage.getItem(INTERNAL_LIST_KEY);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeInternalList(items) {
  try {
    window.localStorage.setItem(INTERNAL_LIST_KEY, JSON.stringify(items));
  } catch {
    // ignore local storage issues on purpose
  }
}

function familyLabel(value = '') {
  return String(value || 'otros_materiales')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sortMaterials(items = []) {
  return [...items].sort((a, b) => {
    const familyA = String(a.familia || 'otros_materiales');
    const familyB = String(b.familia || 'otros_materiales');
    if (familyA !== familyB) return familyA.localeCompare(familyB, 'es');
    if (Number(b.cantidad || 0) !== Number(a.cantidad || 0)) return Number(b.cantidad || 0) - Number(a.cantidad || 0);
    return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
  });
}

function buildGroupedText(items = []) {
  const grouped = sortMaterials(items).reduce((acc, item) => {
    const family = String(item.familia || 'otros_materiales');
    if (!acc[family]) acc[family] = [];
    acc[family].push(item);
    return acc;
  }, {});

  const lines = ['Lista compartida de materiales', ''];
  Object.entries(grouped).forEach(([family, familyItems]) => {
    lines.push(familyLabel(family));
    familyItems.forEach((item) => {
      lines.push(`- ${Number(item.cantidad || 1)}x ${item.nombre}${item.referencia ? ` | Ref ${item.referencia}` : ''}`);
    });
    lines.push('');
  });
  return lines.join('\n').trim();
}

export default function QuickMaterialsPanel({ onAddToPedido, compact = false }) {
  const [families, setFamilies] = useState([]);
  const [selectedFamily, setSelectedFamily] = useState('');
  const [search, setSearch] = useState('');
  const [onlyStock, setOnlyStock] = useState(true);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [internalList, setInternalList] = useState(() => readInternalList());
  const [sharing, setSharing] = useState(false);
  const [copying, setCopying] = useState(false);
  const [sharedMeta, setSharedMeta] = useState({ items: [], updated_at: null, autor: null });
  const hydratedRef = useRef(false);

  useEffect(() => {
    writeInternalList(internalList);
  }, [internalList]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCatalog();
    }, 160);
    return () => clearTimeout(timer);
  }, [selectedFamily, search, onlyStock]);

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => {
    loadSharedMaterials();
  }, []);

  useEffect(() => {
    if (hydratedRef.current) return;
    if (sharedMeta.items?.length) {
      setInternalList(sharedMeta.items);
      hydratedRef.current = true;
    }
  }, [sharedMeta.items]);

  async function loadCatalog() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedFamily) params.set('familia', selectedFamily);
      if (search.trim()) params.set('search', search.trim());
      if (onlyStock) params.set('en_stock', '1');
      params.set('limit', compact ? '18' : '30');
      const response = await api.get(`/stock/materiales/catalogo?${params.toString()}`);
      setFamilies(response.data.families || []);
      setItems(response.data.items || []);
    } finally {
      setLoading(false);
    }
  }

  function addToInternalList(item) {
    addToInternalListWithQty(item, 1);
  }

  function addToInternalListWithQty(item, qty) {
    setInternalList((current) => {
      const existing = current.find((entry) => String(entry.id) === String(item.id));
      if (existing) {
        return sortMaterials(current.map((entry) => (
          String(entry.id) === String(item.id)
            ? { ...entry, cantidad: Number(entry.cantidad || 1) + Math.max(Number(qty || 1), 1) }
            : entry
        )));
      }
      return sortMaterials([
        {
          id: item.id,
          nombre: item.nombre,
          referencia: item.referencia,
          familia: item.familia || 'otros_materiales',
          cantidad: Math.max(Number(qty || 1), 1),
        },
        ...current,
      ]).slice(0, 18);
    });
  }

  async function loadSharedMaterials() {
    try {
      const response = await api.get('/notas/materiales-compartidos');
      setSharedMeta({
        items: response.data.items || [],
        updated_at: response.data.updated_at || null,
        autor: response.data.autor || null,
      });
    } catch {
      setSharedMeta({ items: [], updated_at: null, autor: null });
    }
  }

  async function syncToTeamNote() {
    if (!internalList.length) return;
    setSharing(true);
    try {
      await api.post('/notas/materiales-compartidos', { items: internalList });
      await loadSharedMaterials();
    } finally {
      setSharing(false);
    }
  }

  function removeFromInternalList(id) {
    setInternalList((current) => current.filter((entry) => String(entry.id) !== String(id)));
  }

  async function copySharedText() {
    const baseItems = sharedMeta.items?.length ? sharedMeta.items : internalList;
    if (!baseItems.length) return;
    const text = buildGroupedText(baseItems);
    setCopying(true);
    try {
      await navigator.clipboard.writeText(text);
    } finally {
      setTimeout(() => setCopying(false), 1200);
    }
  }

  const topFamilies = useMemo(() => families.slice(0, compact ? 6 : 10), [families, compact]);
  const groupedInternalList = useMemo(() => (
    sortMaterials(internalList).reduce((acc, item) => {
      const family = String(item.familia || 'otros_materiales');
      if (!acc[family]) acc[family] = [];
      acc[family].push(item);
      return acc;
    }, {})
  ), [internalList]);
  const groupedSharedList = useMemo(() => (
    sortMaterials(sharedMeta.items || []).reduce((acc, item) => {
      const family = String(item.familia || 'otros_materiales');
      if (!acc[family]) acc[family] = [];
      acc[family].push(item);
      return acc;
    }, {})
  ), [sharedMeta.items]);

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Materiales rápidos</p>
          <p className="text-xs text-slate-500">Busca por familia, mira stock y añade en un toque.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
          {internalList.length} lista interna
        </span>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-3 text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar aguja, stencil, guantes..."
          className="input pl-8"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedFamily('')}
          className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${!selectedFamily ? 'border-atomx-300 bg-orange-50 text-atomx-700' : 'border-slate-200 bg-white text-slate-600'}`}
        >
          Todas
        </button>
        {topFamilies.map((family) => (
          <button
            key={family.key}
            type="button"
            onClick={() => setSelectedFamily((current) => (current === family.key ? '' : family.key))}
            className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${selectedFamily === family.key ? 'border-atomx-300 bg-orange-50 text-atomx-700' : 'border-slate-200 bg-white text-slate-600'}`}
          >
            {family.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOnlyStock((current) => !current)}
          className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${onlyStock ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`}
        >
          Solo con stock
        </button>
        {selectedFamily ? (
          <span className="text-[11px] font-medium text-slate-400">
            Familia: {selectedFamily.replace(/_/g, ' ')}
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        {loading ? <p className="text-xs text-slate-400">Cargando materiales...</p> : null}

        {!loading && !items.length ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">
            No veo materiales con ese filtro ahora mismo.
          </div>
        ) : null}

        {items.map((item) => (
          <div key={`${item.id}-${item.referencia}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-semibold text-slate-800">{item.nombre}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {item.referencia || 'sin ref'} · {item.familia?.replace(/_/g, ' ') || item.categoria || 'material'}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-xs font-semibold ${Number(item.stock_actual || 0) > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  Stock {Number(item.stock_actual || 0)}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">{formatMoney(item.precio)}</p>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              {onAddToPedido ? (
                <div className="flex flex-1 gap-2">
                  {[1, 3, 5].map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => {
                        for (let index = 0; index < qty; index += 1) onAddToPedido(item);
                      }}
                      className="flex-1 rounded-xl border border-atomx-300 bg-orange-50 px-2 py-2 text-xs font-semibold text-atomx-700"
                    >
                      <span className="inline-flex items-center gap-1">
                        <Plus size={12} />
                        {qty}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-1 gap-2">
                {[1, 3, 5].map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => addToInternalListWithQty(item, qty)}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700"
                  >
                    <span className="inline-flex items-center gap-1">
                      <Archive size={12} />
                      {qty}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {internalList.length ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
            <Layers3 size={14} className="text-slate-400" />
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lista interna rápida</p>
            </div>
            <button
              type="button"
              onClick={syncToTeamNote}
              disabled={sharing || !internalList.length}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-1">
                <UploadCloud size={12} />
                {sharing ? 'Subiendo...' : 'Pasar al equipo'}
              </span>
            </button>
          </div>
          <div className="space-y-2">
            {Object.entries(groupedInternalList).map(([family, familyItems]) => (
              <div key={family} className="space-y-2">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {familyLabel(family)}
                </p>
                {familyItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700">{item.nombre}</p>
                      <p className="text-[11px] text-slate-400">{item.referencia || 'sin ref'} · {item.cantidad} uds</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromInternalList(item.id)}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-500"
                    >
                      quitar
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Se queda guardada en este móvil y la puedes pasar al equipo con un toque.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <ShoppingBasket size={13} />
            Aún no hay lista interna guardada en este móvil.
          </span>
        </div>
      )}

      {sharedMeta.items?.length ? (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-blue-500" />
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Lista compartida del equipo</p>
            </div>
            <button
              type="button"
              onClick={copySharedText}
              className="rounded-xl border border-blue-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-blue-700"
            >
              <span className="inline-flex items-center gap-1">
                <Copy size={12} />
                {copying ? 'Copiado' : 'Copiar'}
              </span>
            </button>
          </div>
          <div className="space-y-2">
            {Object.entries(groupedSharedList).slice(0, compact ? 3 : 6).map(([family, familyItems]) => (
              <div key={`shared-family-${family}`} className="space-y-2">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700/80">
                  {familyLabel(family)}
                </p>
                {familyItems.slice(0, compact ? 3 : 6).map((item) => (
                  <div key={`shared-${item.id}-${item.nombre}`} className="rounded-xl bg-white px-3 py-2">
                    <p className="truncate text-sm font-medium text-slate-700">{item.nombre}</p>
                    <p className="text-[11px] text-slate-400">{item.referencia || 'sin ref'} · {item.cantidad} uds</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-blue-700/80">
            {sharedMeta.autor ? `Ultima subida por ${sharedMeta.autor}. ` : ''}Se ve tambien en Notas.
          </p>
        </div>
      ) : null}
    </section>
  );
}
