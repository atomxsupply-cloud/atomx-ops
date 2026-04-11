import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { AlertTriangle, CheckSquare, Clock, Coffee, DollarSign, LogOut, Package, Pin, TimerReset, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { canAccessSection } from '../utils/permissions';

function formatMoney(value) {
  return `${Number(value || 0).toFixed(2)} EUR`;
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function StatCard({ label, value, icon: Icon, color, to }) {
  const content = (
    <div className={`card flex items-center gap-4 ${to ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}`}>
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value ?? '-'}</p>
        <p className="text-xs font-medium text-slate-500">{label}</p>
      </div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

function Badge({ estado }) {
  const map = {
    pendiente: 'bg-yellow-100 text-yellow-700',
    preparando: 'bg-blue-100 text-blue-700',
    listo: 'bg-green-100 text-green-700',
    enviado: 'bg-purple-100 text-purple-700',
    entregado: 'bg-slate-100 text-slate-600',
    incidencia: 'bg-red-100 text-red-700',
  };
  return <span className={`badge ${map[estado] || 'bg-slate-100 text-slate-600'}`}>{estado}</span>;
}

function AtomControlBadge() {
  return (
    <button
      type="button"
      className="group inline-flex items-center gap-3 rounded-2xl border border-atomx-200 bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
        <span className="absolute h-7 w-7 rounded-full border border-white/50 animate-pulse" />
        <Zap size={16} className="relative z-10" />
      </span>
      <span>
        <span className="block text-sm font-semibold text-slate-800">ATOM</span>
        <span className="block text-xs text-slate-500">Panel vivo</span>
      </span>
    </button>
  );
}

function PrestashopStatus({ prestashop }) {
  if (!prestashop) return null;
  const ok = !prestashop.error;
  return (
    <Link
      to="/prestashop"
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm"
    >
      <span className={`h-2.5 w-2.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
      Prestashop
    </Link>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/dashboard').then((r) => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-slate-500">Cargando...</div>;

  const hoy = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const canSeePedidos = canAccessSection(user, 'pedidos');
  const canSeePrestashop = canAccessSection(user, 'prestashop');
  const isJuanfran = normalizeName(user?.nombre) === 'juanfran';
  const tareasPendingLink = isJuanfran ? '/tareas?vista=equipo&estado=pendiente' : '/tareas';
  const tareasLateLink = isJuanfran ? '/tareas?vista=equipo&estado=atrasadas' : '/tareas';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Panel de control atomico</h1>
          <p className="text-sm capitalize text-slate-500">{hoy}</p>
        </div>
        <div className="flex items-center gap-2">
          {canSeePrestashop ? <PrestashopStatus prestashop={data?.prestashop} /> : null}
          <AtomControlBadge />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:hidden">
        {canSeePedidos ? (
          <Link to="/pedidos?estado=pendiente" className="card">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pedidos</p>
            <p className="mt-2 text-2xl font-bold text-slate-800">{data?.pedidos?.pendientes ?? 0}</p>
            <p className="mt-1 text-xs text-slate-500">Pendientes ahora</p>
          </Link>
        ) : null}
        <Link to={tareasPendingLink} className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Equipo</p>
          <p className="mt-2 text-2xl font-bold text-slate-800">{data?.tareas?.hoy ?? 0}</p>
          <p className="mt-1 text-xs text-slate-500">Tareas pendientes</p>
        </Link>
        <Link to="/caja" className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Caja</p>
          <p className="mt-2 text-lg font-bold text-slate-800">{data?.cajaHoy ? formatMoney(data.cajaHoy.saldo) : 'Sin abrir'}</p>
          <p className="mt-1 text-xs text-slate-500">Saldo o apertura</p>
        </Link>
        <Link to="/buscador" className="card">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Buscador PRO</p>
          <p className="mt-2 text-lg font-bold text-slate-800">Abrir</p>
          <p className="mt-1 text-xs text-slate-500">Productos y app</p>
        </Link>
      </div>

      <div className="lg:hidden">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm"
        >
          <LogOut size={16} />
          Cerrar sesion
        </button>
      </div>

      {data?.pedidos?.urgentes > 0 && (
        <Link
          to="/pedidos?urgente=1"
          className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
        >
          <Zap size={18} />
          {data.pedidos.urgentes} pedido{data.pedidos.urgentes > 1 ? 's' : ''} urgente{data.pedidos.urgentes > 1 ? 's' : ''} pendiente{data.pedidos.urgentes > 1 ? 's' : ''}
        </Link>
      )}

      {canSeePedidos ? (
        <div className="hidden lg:grid grid-cols-2 gap-3">
          <StatCard label="Pedidos ATOM X Murcia" value={data?.pedidos?.pendientes} icon={Package} color="bg-yellow-500" to="/pedidos?estado=pendiente" />
          <StatCard label="Incidencias abiertas" value={data?.incidenciasAbiertas} icon={AlertTriangle} color="bg-red-600" />
        </div>
      ) : null}

      <div className="hidden lg:grid grid-cols-2 gap-3">
        <StatCard label="Tareas pendientes" value={data?.tareas?.hoy} icon={CheckSquare} color="bg-atomx-500" to={tareasPendingLink} />
        <StatCard label="Tareas atrasadas" value={data?.tareas?.atrasadas} icon={Clock} color="bg-red-500" to={tareasLateLink} />
      </div>

      <div className="hidden lg:grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card">
          <div className="mb-3 flex items-center gap-2">
            <TimerReset size={16} className="text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-700">Fichajes en vivo</h2>
          </div>
          {data?.fichajesActivos?.length ? (
            <div className="space-y-2">
              {data.fichajesActivos.map((f) => (
                <div key={f.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-800">{f.nombre}</span>
                    <span className={`badge ${f.estado === 'pausa' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                      {f.estado === 'pausa' ? 'pausa' : 'trabajando'}
                    </span>
                  </div>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                    {f.estado === 'pausa' ? <Coffee size={12} /> : null}
                    Descanso restante: {f.descanso_restante_min} min
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-slate-400">No hay fichajes activos ahora mismo.</p>
          )}
        </div>

        <div className="card">
          <div className="mb-3 flex items-center gap-2">
            <DollarSign size={16} className="text-green-600" />
            <h2 className="text-sm font-semibold text-slate-700">Caja hoy</h2>
          </div>
          {data?.cajaHoy ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Apertura</span>
                <span className="font-medium">{formatMoney(data.cajaHoy.apertura)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-green-600">+ Ingresos</span>
                <span className="font-medium text-green-600">+{formatMoney(data.cajaHoy.ingresos)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-red-500">- Gastos</span>
                <span className="font-medium text-red-500">-{formatMoney(data.cajaHoy.gastos)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2 font-bold">
                <span>Saldo actual</span>
                <span className="text-green-700">{formatMoney(data.cajaHoy.saldo)}</span>
              </div>
              <span className={`badge ${data.cajaHoy.estado === 'abierta' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                {data.cajaHoy.estado}
              </span>
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="mb-2 text-sm text-slate-400">Caja no abierta</p>
              <Link to="/caja" className="btn-primary inline-block px-3 py-1.5 text-xs">Abrir caja</Link>
            </div>
          )}
        </div>

        <div className="card">
          <div className="mb-3 flex items-center gap-2">
            <Pin size={16} className="text-atomx-500" />
            <h2 className="text-sm font-semibold text-slate-700">Notas fijadas</h2>
          </div>
          {data?.notasPinned?.length > 0 ? (
            <div className="space-y-2">
              {data.notasPinned.map((n) => (
                <div key={n.id} className="rounded-lg border border-yellow-100 bg-yellow-50 px-3 py-2">
                  <p className="text-sm leading-snug text-slate-700">{n.contenido}</p>
                  <p className="mt-1 text-xs text-slate-400">{n.autor}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-slate-400">Sin notas fijadas</p>
          )}
        </div>

        {canSeePedidos ? (
          <div className="card lg:col-span-2">
            <div className="mb-3 flex items-center gap-2">
              <Zap size={16} className="text-red-500" />
              <h2 className="text-sm font-semibold text-slate-700">Pedidos urgentes</h2>
            </div>
            {data?.pedidosUrgentesDetalle?.length > 0 ? (
              <div className="space-y-2">
                {data.pedidosUrgentesDetalle.map((p) => (
                  <div key={p.id} className="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">{p.cliente_nombre}</span>
                      <Badge estado={p.estado} />
                    </div>
                    <p className="text-xs text-slate-500">{p.numero}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-slate-400">Sin urgentes</p>
            )}
          </div>
        ) : null}
      </div>

      {canSeePrestashop && data?.prestashop ? (
        <div className="card">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-700">Web pendientes</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {data.prestashop.totalPendientes}
            </span>
          </div>
          <div className="space-y-2">
            {data.prestashop.pendientes?.length ? data.prestashop.pendientes.map((p, index) => (
              <div key={p.id} className={`rounded-xl border border-slate-200 px-3 py-2 ${index === data.prestashop.pendientes.length - 1 ? 'opacity-70' : 'bg-white'}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-800">#{p.id} - {p.reference}</span>
                  <span className="badge bg-amber-100 text-amber-700">{p.stateName}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{formatMoney(p.total_paid)} - {p.payment || 'sin pago'}</p>
              </div>
            )) : <p className="text-sm text-slate-400">No veo pendientes web ahora mismo.</p>}
          </div>
        </div>
      ) : null}

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Ultimos movimientos</h2>
        <div className="space-y-2">
          {data?.actividadReciente?.length ? data.actividadReciente.map((a) => (
            <div key={a.id} className="flex items-center gap-3 border-b border-slate-50 py-1.5 text-sm last:border-0">
              <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-atomx-500" />
              <span className="flex-1 text-slate-700">{a.mensaje}</span>
              <span className="flex-shrink-0 text-xs text-slate-400">{a.created_at?.substring(11, 16)}</span>
            </div>
          )) : (
            <p className="text-sm text-slate-400">No hay movimientos recientes.</p>
          )}
        </div>
      </div>
    </div>
  );
}
