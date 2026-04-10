import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, MapPin, Package, Search, UserRound, Boxes } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/client';

function SectionBlock({ title, icon: Icon, children, count }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-slate-700" />
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export default function Buscador() {
  const [query, setQuery] = useState('');
  const [data, setData] = useState({ clientes: [], pedidos: [], tareas: [], rutas: [], productos: [], total: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = String(query || '').trim();
    if (!q) {
      setData({ clientes: [], pedidos: [], tareas: [], rutas: [], productos: [], total: 0 });
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      api.get(`/search/global?q=${encodeURIComponent(q)}&limit=5`)
        .then((response) => setData(response.data))
        .finally(() => setLoading(false));
    }, 180);

    return () => clearTimeout(timer);
  }, [query]);

  const hasResults = useMemo(() => (data.total || 0) > 0, [data]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Buscador global</h1>
        <p className="mt-1 text-sm text-slate-500">Encuentra y abre el registro concreto sin perder tiempo navegando a mano.</p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4">
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busca cliente, pedido, tarea, ruta o producto..."
            className="input h-14 pl-11 text-base font-semibold"
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Busca por nombre, telefono, direccion, numero de pedido, estudio, producto o referencia.
        </p>
      </div>

      {loading ? <div className="text-sm text-slate-500">Buscando...</div> : null}

      {!loading && query.trim() && !hasResults ? (
        <div className="rounded-3xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No veo resultados con esa busqueda.
        </div>
      ) : null}

      {!loading && hasResults ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <SectionBlock title="Clientes" icon={UserRound} count={data.clientes.length}>
            {data.clientes.map((item) => (
              <Link key={item.id} to={`/clientes?id=${item.id}&search=${encodeURIComponent(item.nombre || '')}`} className="block rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-sm font-semibold text-slate-800">{item.nombre}</p>
                <p className="mt-1 text-xs text-slate-500">{[item.telefono, item.direccion, item.zona_reparto].filter(Boolean).join(' · ')}</p>
              </Link>
            ))}
          </SectionBlock>

          <SectionBlock title="Pedidos" icon={Package} count={data.pedidos.length}>
            {data.pedidos.map((item) => (
              <Link key={item.id} to={`/pedidos?id=${item.id}&search=${encodeURIComponent(item.numero || item.cliente_nombre || '')}`} className="block rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800">{item.numero}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{item.estado}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{item.cliente_nombre} · {item.zona_reparto || 'Sin zona'}</p>
              </Link>
            ))}
          </SectionBlock>

          <SectionBlock title="Tareas" icon={CheckSquare} count={data.tareas.length}>
            {data.tareas.map((item) => (
              <Link key={item.id} to={`/tareas?search=${encodeURIComponent(item.titulo || '')}`} className="block rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-sm font-semibold text-slate-800">{item.titulo}</p>
                <p className="mt-1 text-xs text-slate-500">{[item.asignado_nombre, item.prioridad, item.estado].filter(Boolean).join(' · ')}</p>
              </Link>
            ))}
          </SectionBlock>

          <SectionBlock title="Rutas" icon={MapPin} count={data.rutas.length}>
            {data.rutas.map((item) => (
              <Link key={item.id} to={`/rutas?search=${encodeURIComponent(item.estudio || item.direccion || '')}`} className="block rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-sm font-semibold text-slate-800">{item.estudio}</p>
                <p className="mt-1 text-xs text-slate-500">{[item.direccion, item.asignado_nombre, item.estado].filter(Boolean).join(' · ')}</p>
              </Link>
            ))}
          </SectionBlock>

          <div className="xl:col-span-2">
            <SectionBlock title="Catalogo interno" icon={Boxes} count={data.productos.length}>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {data.productos.map((item, index) => (
                  <Link key={`${item.nombre}-${item.referencia || ''}-${index}`} to={`/stock?search=${encodeURIComponent(item.referencia || item.nombre || '')}`} className="block rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-sm font-semibold text-slate-800">{item.nombre}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {[item.referencia, item.categoria, item.proveedor, item.origen].filter(Boolean).join(' · ')}
                    </p>
                  </Link>
                ))}
              </div>
            </SectionBlock>
          </div>
        </div>
      ) : null}
    </div>
  );
}
