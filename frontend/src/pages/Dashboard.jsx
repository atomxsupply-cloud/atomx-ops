import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { AlertTriangle, CheckSquare, Clock, Coffee, DollarSign, Package, Pin, TimerReset, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { canAccessSection } from '../utils/permissions';

function formatMoney(value) {
  return `${Number(value || 0).toFixed(2)}€`;
}

function StatCard({ label, value, icon: Icon, color, to }) {
  const content = (
    <div className={`card flex items-center gap-4 ${to ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value ?? '-'}</p>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
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

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    api.get('/dashboard').then((r) => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-500 text-sm">Cargando...</div>;

  const hoy = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const canSeePedidos = canAccessSection(user, 'pedidos');
  const canSeePrestashop = canAccessSection(user, 'prestashop');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm capitalize">{hoy}</p>
      </div>

      {data?.pedidos?.urgentes > 0 && (
        <Link
          to="/pedidos?urgente=1"
          className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm font-medium hover:bg-red-100 transition-colors"
        >
          <Zap size={18} />
          {data.pedidos.urgentes} pedido{data.pedidos.urgentes > 1 ? 's' : ''} urgente{data.pedidos.urgentes > 1 ? 's' : ''} pendiente{data.pedidos.urgentes > 1 ? 's' : ''}
        </Link>
      )}

      {canSeePedidos ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Pedidos ATOM X Murcia" value={data?.pedidos?.pendientes} icon={Package} color="bg-yellow-500" to="/pedidos?estado=pendiente" />
          <StatCard label="En preparacion" value={data?.pedidos?.preparando} icon={Package} color="bg-blue-500" to="/pedidos?estado=preparando" />
          <StatCard label="Enviados hoy" value={data?.pedidos?.enviados} icon={Package} color="bg-purple-500" to="/pedidos?estado=enviado" />
          <StatCard label="Incidencias abiertas" value={data?.incidenciasAbiertas} icon={AlertTriangle} color="bg-red-600" />
        </div>
      ) : null}

      {canSeePrestashop && data?.prestashop ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard label="Web pendientes" value={data.prestashop.totalPendientes} icon={Package} color="bg-amber-500" to="/prestashop" />
          <StatCard label="Murcia + Web" value={(data?.pedidos?.pendientes || 0) + (data?.prestashop?.totalPendientes || 0)} icon={Zap} color="bg-slate-900" />
          <StatCard label="Control web" value={data?.prestashop?.error ? '!' : 'OK'} icon={Package} color={data?.prestashop?.error ? 'bg-red-500' : 'bg-green-600'} to="/prestashop" />
        </div>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-2 gap-3">
        <StatCard label="Tareas pendientes" value={data?.tareas?.hoy} icon={CheckSquare} color="bg-atomx-500" to="/tareas" />
        <StatCard label="Tareas atrasadas" value={data?.tareas?.atrasadas} icon={Clock} color="bg-red-500" to="/tareas" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <TimerReset size={16} className="text-emerald-600" />
            <h2 className="font-semibold text-slate-700 text-sm">Fichajes en vivo</h2>
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
                  <p className="text-xs text-slate-500 mt-1 inline-flex items-center gap-1">
                    {f.estado === 'pausa' ? <Coffee size={12} /> : null}
                    Descanso restante: {f.descanso_restante_min} min
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm text-center py-4">No hay fichajes activos ahora mismo.</p>
          )}
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign size={16} className="text-green-600" />
            <h2 className="font-semibold text-slate-700 text-sm">Caja hoy</h2>
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
              <div className="border-t border-slate-100 pt-2 flex justify-between font-bold">
                <span>Saldo actual</span>
                <span className="text-green-700">{formatMoney(data.cajaHoy.saldo)}</span>
              </div>
              <span className={`badge ${data.cajaHoy.estado === 'abierta' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                {data.cajaHoy.estado}
              </span>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-slate-400 text-sm mb-2">Caja no abierta</p>
              <Link to="/caja" className="btn-primary text-xs px-3 py-1.5 inline-block">Abrir caja</Link>
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Pin size={16} className="text-atomx-500" />
            <h2 className="font-semibold text-slate-700 text-sm">Notas fijadas</h2>
          </div>
          {data?.notasPinned?.length > 0 ? (
            <div className="space-y-2">
              {data.notasPinned.map((n) => (
                <div key={n.id} className="bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2">
                  <p className="text-sm text-slate-700 leading-snug">{n.contenido}</p>
                  <p className="text-xs text-slate-400 mt-1">{n.autor}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm text-center py-4">Sin notas fijadas</p>
          )}
        </div>

        {canSeePedidos ? (
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} className="text-red-500" />
              <h2 className="font-semibold text-slate-700 text-sm">Pedidos urgentes</h2>
            </div>
            {data?.pedidosUrgentesDetalle?.length > 0 ? (
              <div className="space-y-2">
                {data.pedidosUrgentesDetalle.map((p) => (
                  <div key={p.id} className="border border-red-100 rounded-lg px-3 py-2 bg-red-50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">{p.cliente_nombre}</span>
                      <Badge estado={p.estado} />
                    </div>
                    <p className="text-xs text-slate-500">{p.numero}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm text-center py-4">Sin urgentes</p>
            )}
          </div>
        ) : null}
      </div>

      {canSeePrestashop && data?.prestashop ? (
        <div className="grid grid-cols-1 gap-4">
          <div className="card">
            <h2 className="font-semibold text-slate-700 text-sm mb-3">Web pendientes</h2>
            <div className="space-y-2">
              {data.prestashop.pendientes?.length ? data.prestashop.pendientes.map((p, index) => (
                <div key={p.id} className={`rounded-xl border border-slate-200 px-3 py-2 ${index === data.prestashop.pendientes.length - 1 ? 'opacity-70' : 'bg-white'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-800">#{p.id} · {p.reference}</span>
                    <span className="badge bg-amber-100 text-amber-700">{p.stateName}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{formatMoney(p.total_paid)} · {p.payment || 'sin pago'}</p>
                </div>
              )) : <p className="text-slate-400 text-sm">No veo pendientes web ahora mismo.</p>}
            </div>
          </div>
        </div>
      ) : null}

      <div className="card">
        <h2 className="font-semibold text-slate-700 text-sm mb-3">Ultimos movimientos</h2>
        <div className="space-y-2">
          {data?.actividadReciente?.length ? data.actividadReciente.map((a) => (
            <div key={a.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-slate-50 last:border-0">
              <div className="w-1.5 h-1.5 rounded-full bg-atomx-500 flex-shrink-0" />
              <span className="text-slate-700 flex-1">{a.mensaje}</span>
              <span className="text-slate-400 text-xs flex-shrink-0">{a.created_at?.substring(11, 16)}</span>
            </div>
          )) : (
            <p className="text-slate-400 text-sm">No hay movimientos recientes.</p>
          )}
        </div>
      </div>
    </div>
  );
}
