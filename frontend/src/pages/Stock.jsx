import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Sparkles } from 'lucide-react';
import api from '../api/client';

function formatMoney(value) {
  const amount = Number(value || 0);
  if (amount <= 0) return 'Consultar';
  return `${amount.toFixed(2)}€`;
}

export default function Stock() {
  const [searchParams] = useSearchParams();
  const [webSearch, setWebSearch] = useState(searchParams.get('search') || '');
  const [webLoading, setWebLoading] = useState(false);
  const [webResults, setWebResults] = useState([]);

  useEffect(() => {
    const value = webSearch.trim();
    if (value.length < 2) {
      setWebResults([]);
      return;
    }
    const timer = setTimeout(() => {
      buscarProductoWeb();
    }, 220);
    return () => clearTimeout(timer);
  }, [webSearch]);

  async function buscarProductoWeb() {
    if (!webSearch.trim()) {
      setWebResults([]);
      return;
    }
    setWebLoading(true);
    try {
      const resp = await api.get(`/prestashop/products?limit=12&search=${encodeURIComponent(webSearch.trim())}`);
      setWebResults(resp.data || []);
    } finally {
      setWebLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Stock</h1>
        <p className="text-slate-500 text-sm">Buscador inteligente de producto para comerciales y tienda.</p>
      </div>

      <section className="rounded-[2rem] border border-yellow-200 bg-gradient-to-br from-yellow-50 via-yellow-100 to-amber-50 p-5">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-yellow-400 text-slate-950 flex items-center justify-center text-2xl font-black shadow-sm">
            A
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">¿Qué producto necesitas buscar?</p>
            <p className="text-xs text-slate-600">Escribe como hablarías normal: marca, nombre o referencia, y te saco la ficha web.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
            <input
              value={webSearch}
              onChange={(e) => setWebSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') buscarProductoWeb(); }}
              placeholder="Ej: emalla 0603, kwadron 1017 rm, proton..."
              className="input pl-8 bg-white"
            />
          </div>
          <button onClick={buscarProductoWeb} className="btn-primary inline-flex items-center gap-2">
            <Sparkles size={15} />
            {webLoading ? 'Buscando...' : 'Buscar en web'}
          </button>
        </div>

        {webResults.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {webResults.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="font-semibold text-slate-800">{item.nombre}</p>
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
        ) : webSearch.trim() && !webLoading ? (
          <p className="mt-4 text-sm text-slate-600">No he encontrado ese producto ahora mismo en la web.</p>
        ) : null}
      </section>
    </div>
  );
}
