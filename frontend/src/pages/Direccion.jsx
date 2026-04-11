import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownRight, BriefcaseBusiness, CircleDollarSign, Package, Route, TimerReset, TrendingUp, Wallet, Activity, BarChart3, ShieldCheck, Link2 } from 'lucide-react';
import api from '../api/client';

const ROLE_OPTIONS = [
  { value: 'admin_full', label: 'Juanfran total' },
  { value: 'ops_core', label: 'Nucleo operaciones' },
  { value: 'store_commercial', label: 'Tienda y comercial' },
  { value: 'commercial_only', label: 'Solo comercial' },
  { value: 'mallorca_store', label: 'Mallorca tienda' },
  { value: 'store_default', label: 'Tienda basica' },
];

function formatMoney(value) {
  return `${Number(value || 0).toFixed(2)} EUR`;
}

function MetricCard({ label, value, help, icon: Icon, tone = 'slate' }) {
  const toneMap = {
    slate: 'bg-slate-900 text-white',
    green: 'bg-emerald-500 text-white',
    amber: 'bg-amber-500 text-white',
    red: 'bg-red-500 text-white',
    blue: 'bg-sky-500 text-white',
  };

  return (
    <div className="card flex items-start gap-4">
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${toneMap[tone] || toneMap.slate}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        {help ? <p className="mt-1 text-xs text-slate-500">{help}</p> : null}
      </div>
    </div>
  );
}

function MiniBarChart({ items, colorClass, formatter = (item) => item.total, emptyLabel = 'Sin datos aun' }) {
  if (!items?.length) {
    return <p className="text-sm text-slate-400">{emptyLabel}</p>;
  }

  const max = Math.max(...items.map((item) => Number(item.total || 0)), 1);
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const width = `${Math.max((Number(item.total || 0) / max) * 100, 8)}%`;
        return (
          <div key={item.fecha || item.estado || item.zona} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{item.fecha || item.estado || item.zona}</span>
              <span>{formatter(item)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className={`h-2 rounded-full ${colorClass}`} style={{ width }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Sparkline({ items, color = '#0f172a' }) {
  if (!items?.length) {
    return <div className="h-28 rounded-2xl border border-dashed border-slate-200 bg-slate-50" />;
  }
  const values = items.map((item) => Number(item.total || 0));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * 100;
    const y = 90 - (((value - min) / Math.max(max - min, 1)) * 70);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 100" className="h-28 w-full overflow-visible rounded-2xl bg-slate-50">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {values.map((value, index) => {
        const x = (index / Math.max(values.length - 1, 1)) * 100;
        const y = 90 - (((value - min) / Math.max(max - min, 1)) * 70);
        return <circle key={`${value}-${index}`} cx={x} cy={y} r="2.8" fill={color} />;
      })}
    </svg>
  );
}

function RadarBars({ items }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {(items || []).map((item) => (
        <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-700">{item.label}</p>
            <span className="text-sm font-bold text-slate-900">{item.value}/100</span>
          </div>
          <div className="mt-3 h-3 rounded-full bg-white">
            <div
              className={`h-3 rounded-full ${item.value >= 75 ? 'bg-emerald-500' : item.value >= 55 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${Math.max(Math.min(item.value, 100), 6)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Direccion() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [savingUserId, setSavingUserId] = useState(null);
  const [designFeedback, setDesignFeedback] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [feedbackCode, setFeedbackCode] = useState('');
  const [feedbackLookup, setFeedbackLookup] = useState(null);
  const [checkingCode, setCheckingCode] = useState(false);
  const [redeemingId, setRedeemingId] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/direccion/overview'),
      api.get('/auth/users/manage'),
      api.get('/direccion/design-feedback?limit=100'),
    ])
      .then(([overviewResponse, usersResponse, feedbackResponse]) => {
        setData(overviewResponse.data);
        setUsers(usersResponse.data || []);
        setDesignFeedback(feedbackResponse.data.items || []);
      })
      .finally(() => {
        setLoading(false);
        setFeedbackLoading(false);
      });
  }, []);

  async function updateUser(userId, patch) {
    setSavingUserId(userId);
    try {
      const { data: updated } = await api.patch(`/auth/users/${userId}`, patch);
      setUsers((current) => current.map((item) => (item.id === userId ? updated : item)));
    } finally {
      setSavingUserId(null);
    }
  }

  async function checkFeedbackCode() {
    const code = String(feedbackCode || '').trim();
    if (!code) return;
    setCheckingCode(true);
    try {
      const { data: result } = await api.get(`/direccion/design-feedback?code=${encodeURIComponent(code)}`);
      setFeedbackLookup(result);
    } finally {
      setCheckingCode(false);
    }
  }

  async function toggleRedeem(item) {
    setRedeemingId(item.id);
    try {
      const { data: result } = await api.patch(`/direccion/design-feedback/${item.id}/redeem`);
      setDesignFeedback((current) => current.map((entry) => (entry.id === item.id ? result.item : entry)));
      if (feedbackLookup?.item?.id === item.id) {
        setFeedbackLookup((current) => ({ ...current, item: result.item, valid: result.item.reward_status === 'valid' }));
      }
    } finally {
      setRedeemingId(null);
    }
  }

  const pulso = data?.resumen;
  const topCliente = useMemo(() => data?.top_clientes?.[0] || null, [data]);
  const factusolReady = Boolean(data?.factusol?.ready);

  if (loading) return <div className="text-sm text-slate-500">Cargando panel de direccion...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
            <BriefcaseBusiness size={14} />
            Solo Juanfran
          </div>
          <h1 className="mt-3 text-3xl font-bold text-slate-800">Direccion ATOM X</h1>
          <p className="mt-1 text-sm text-slate-500">Panel de CEO con foco en caja, carga, rutas, salud operativa y conexion futura con Factusol.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Cliente mas recurrente</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{topCliente?.cliente_nombre || 'Todavia sin datos suficientes'}</p>
          {topCliente ? <p className="text-xs text-slate-500">{topCliente.pedidos_total} pedidos registrados</p> : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <MetricCard label="Pedidos hoy" value={pulso?.pedidos_hoy ?? 0} help={`${pulso?.urgentes_hoy ?? 0} urgentes`} icon={Package} tone="amber" />
        <MetricCard label="Salidas hoy" value={formatMoney(pulso?.salidas_hoy)} help={`Mes: ${formatMoney(pulso?.salidas_mes)}`} icon={ArrowDownRight} tone="red" />
        <MetricCard label="Caja hoy" value={pulso?.caja_abierta ? formatMoney(pulso?.saldo_caja_hoy) : 'Cerrada'} help={pulso?.caja_abierta ? 'Saldo acumulado del dia' : 'No hay caja abierta'} icon={CircleDollarSign} tone="green" />
        <MetricCard label="Rutas pendientes" value={pulso?.rutas_pendientes ?? 0} help={`Pagadas hoy: ${pulso?.rutas_pagadas_hoy ?? 0}`} icon={Route} tone="blue" />
        <MetricCard label="Tendencia 7 dias" value={`${pulso?.tendencia_pedidos_7d > 0 ? '+' : ''}${pulso?.tendencia_pedidos_7d || 0}`} help="Comparado con la semana anterior" icon={TrendingUp} tone="slate" />
      </div>

      <div className="card">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Link2 size={16} className="text-orange-600" />
            <h2 className="text-sm font-semibold text-slate-700">Feedback real de tatuadores en Design</h2>
          </div>
          <div className="text-xs text-slate-500">
            {feedbackLoading ? 'Cargando...' : `${designFeedback.length} feedbacks visibles`}
          </div>
        </div>

        {feedbackLoading ? (
          <p className="text-sm text-slate-400">Cargando feedback de Design...</p>
        ) : !designFeedback.length ? (
          <p className="text-sm text-slate-400">Todavia no ha entrado ninguna opinion desde Design.</p>
        ) : (
          <div className="space-y-3">
            {designFeedback.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{item.autor || 'Tatuador'}</p>
                    <p className="text-xs text-slate-500">
                      {item.selected_brand || 'Marca libre'}{item.estilo_detectado ? ` · ${item.estilo_detectado}` : ''}{item.skin_tone ? ` · ${item.skin_tone}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {item.reward_code ? (
                      <span className={`rounded-full px-3 py-1 font-semibold ${item.reward_status === 'used' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {item.reward_amount} EUR · {item.reward_code} · {item.reward_status === 'used' ? 'usado' : 'valido'}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-200 px-3 py-1 font-semibold text-slate-600">Sin premio</span>
                    )}
                    <span className="text-slate-400">{item.created_at}</span>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">{String(item.feedback || '').slice(0, 320)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <Activity size={16} className="text-slate-700" />
            <h2 className="text-sm font-semibold text-slate-700">Radar de salud operativa</h2>
          </div>
          <RadarBars items={data?.health || []} />
          <p className="mt-4 text-xs text-slate-500">Inspirado en cuadros de mando CEO con leading indicators: caja, carga del equipo, rutas y empuje comercial.</p>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck size={16} className={factusolReady ? 'text-emerald-600' : 'text-amber-600'} />
            <h2 className="text-sm font-semibold text-slate-700">Factusol dentro de ATOM X</h2>
          </div>
          <div className={`rounded-2xl border px-4 py-4 ${factusolReady ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${factusolReady ? 'text-emerald-700' : 'text-amber-700'}`}>
              {factusolReady ? 'Conector listo' : 'Pendiente de credenciales'}
            </p>
            <p className="mt-2 text-sm text-slate-700">
              {factusolReady
                ? 'La conexion base ya esta preparada para enchufar la nube de Factusol.'
                : 'La app ya esta preparada. Solo falta que Factusol confirme manufacturer code y credenciales.'}
            </p>
          </div>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">1. Manufacturer code de DELSOL</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">2. Client ID y Client Secret</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">3. Database ID y prueba de token</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">4. Sincronizacion de clientes, articulos y documentos dentro de la app</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <Package size={16} className="text-sky-600" />
            <h2 className="text-sm font-semibold text-slate-700">Pedidos ultimos 7 dias</h2>
          </div>
          <Sparkline items={data?.series?.pedidos || []} color="#0ea5e9" />
          <div className="mt-3">
            <MiniBarChart items={data?.series?.pedidos || []} colorClass="bg-sky-500" />
          </div>
        </div>
        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <Wallet size={16} className="text-red-600" />
            <h2 className="text-sm font-semibold text-slate-700">Salidas ultimos 7 dias</h2>
          </div>
          <Sparkline items={data?.series?.salidas || []} color="#ef4444" />
          <div className="mt-3">
            <MiniBarChart items={data?.series?.salidas || []} colorClass="bg-red-500" formatter={(item) => formatMoney(item.total)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-violet-600" />
            <h2 className="text-sm font-semibold text-slate-700">Pedidos por estado este mes</h2>
          </div>
          <MiniBarChart items={data?.series?.pedidos_estado || []} colorClass="bg-violet-500" emptyLabel="Aun no hay estados suficientes" />
        </div>

        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <Route size={16} className="text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-700">Zonas que mas tiran</h2>
          </div>
          <MiniBarChart items={data?.series?.pedidos_zona || []} colorClass="bg-emerald-500" emptyLabel="Aun no hay zonas suficientes" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <TimerReset size={16} className="text-violet-600" />
            <h2 className="text-sm font-semibold text-slate-700">Carga por trabajador</h2>
          </div>
          <div className="space-y-2">
            {(data?.equipo || []).map((persona) => (
              <div key={persona.nombre} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{persona.nombre}</p>
                  <p className="text-xs text-slate-500">{persona.pendientes || 0} pendientes · {persona.atrasadas || 0} atrasadas</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${(persona.atrasadas || 0) > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {(persona.atrasadas || 0) > 0 ? 'Revisar' : 'Estable'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <Package size={16} className="text-amber-600" />
            <h2 className="text-sm font-semibold text-slate-700">Clientes mas repetidos</h2>
          </div>
          <div className="space-y-2">
            {(data?.top_clientes || []).map((cliente) => (
              <div key={`${cliente.cliente_nombre}-${cliente.ultimo_pedido}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{cliente.cliente_nombre}</p>
                    <p className="text-xs text-slate-500">{cliente.zona || 'Sin zona'} · {cliente.telefono || 'Sin telefono'}</p>
                  </div>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">{cliente.pedidos_total}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr,1.1fr]">
        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <h2 className="text-sm font-semibold text-slate-700">Acciones recomendadas</h2>
          </div>
          <div className="space-y-2">
            {(data?.recomendaciones || []).map((item, index) => (
              <div key={index} className="rounded-2xl border border-amber-100 bg-amber-50 px-3 py-3 text-sm text-slate-700">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Idea clave de CEO</p>
            <p className="mt-2 text-sm text-slate-700">No solo mires ventas cerradas. Mira tambien urgencias, atasco del equipo, salud de caja y zonas que tiran. Eso te dice antes dónde actuar.</p>
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <Link2 size={16} className="text-slate-700" />
            <h2 className="text-sm font-semibold text-slate-700">Ultimos movimientos del negocio</h2>
          </div>
          <div className="space-y-2">
            {(data?.actividad || []).map((item, index) => (
              <div key={`${item.created_at}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{item.usuario || 'Sistema'}</p>
                  <p className="text-xs text-slate-500">{item.tabla} · {item.accion}</p>
                </div>
                <span className="text-xs text-slate-400">{String(item.created_at || '').replace('T', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.78fr,1.22fr]">
        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-700">Validar codigo Design</h2>
          </div>
          <div className="space-y-3">
            <input
              value={feedbackCode}
              onChange={(event) => setFeedbackCode(event.target.value.replace(/\D/g, '').slice(0, 5))}
              className="input"
              placeholder="Codigo de 5 digitos"
              inputMode="numeric"
            />
            <button
              type="button"
              onClick={checkFeedbackCode}
              disabled={checkingCode || feedbackCode.length < 5}
              className="btn-primary w-full disabled:opacity-50"
            >
              {checkingCode ? 'Comprobando...' : 'Comprobar codigo'}
            </button>

            {feedbackLookup ? (
              <div className={`rounded-2xl border px-4 py-4 ${feedbackLookup.valid ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                <p className={`text-sm font-semibold ${feedbackLookup.valid ? 'text-emerald-700' : 'text-red-700'}`}>
                  {feedbackLookup.valid ? 'Codigo valido' : 'Codigo no valido o ya usado'}
                </p>
                {feedbackLookup.item ? (
                  <>
                    <p className="mt-2 text-sm text-slate-700">{feedbackLookup.item.autor || 'tatuador'} · {feedbackLookup.item.selected_brand || 'sin marca'}</p>
                    <p className="mt-1 text-xs text-slate-500">{String(feedbackLookup.item.feedback || '').slice(0, 220)}</p>
                    <p className="mt-2 text-xs text-slate-500">Estado: {feedbackLookup.item.reward_status} · {Number(feedbackLookup.item.reward_amount || 0).toFixed(2)} EUR</p>
                    {feedbackLookup.item.reward_code ? (
                      <button
                        type="button"
                        onClick={() => toggleRedeem(feedbackLookup.item)}
                        disabled={redeemingId === feedbackLookup.item.id}
                        className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                      >
                        {redeemingId === feedbackLookup.item.id
                          ? 'Guardando...'
                          : feedbackLookup.item.reward_status === 'used'
                            ? 'Marcar como valido otra vez'
                            : 'Marcar como canjeado'}
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Aquí compruebas si una captura con código vale o ya se ha usado.</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <Link2 size={16} className="text-slate-700" />
            <h2 className="text-sm font-semibold text-slate-700">Feedback de Design IA</h2>
          </div>
          {feedbackLoading ? (
            <p className="text-sm text-slate-400">Cargando feedback...</p>
          ) : !designFeedback.length ? (
            <p className="text-sm text-slate-400">Aun no hay feedback guardado.</p>
          ) : (
            <div className="space-y-3">
              {designFeedback.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{item.autor || 'tatuador'}</p>
                      <p className="text-xs text-slate-500">{item.selected_brand || 'sin marca'} · {item.skin_tone || 'sin piel'} · {item.estilo_detectado || 'sin estilo'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {item.reward_code ? (
                        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">{item.reward_code}</span>
                      ) : null}
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.reward_status === 'used' ? 'bg-red-100 text-red-700' : item.reward_status === 'valid' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {item.reward_status === 'used' ? 'Canjeado' : item.reward_status === 'valid' ? 'Valido' : 'Sin premio'}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{item.feedback}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-400">{String(item.created_at || '').replace('T', ' ')}</p>
                    {item.reward_code ? (
                      <button
                        type="button"
                        onClick={() => toggleRedeem(item)}
                        disabled={redeemingId === item.id}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                      >
                        {redeemingId === item.id
                          ? 'Guardando...'
                          : item.reward_status === 'used'
                            ? 'Volver a valido'
                            : 'Marcar canjeado'}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck size={16} className="text-slate-700" />
          <h2 className="text-sm font-semibold text-slate-700">Permisos y acceso del equipo</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {users.map((person) => (
            <div key={person.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{person.nombre}</p>
                  <p className="text-xs text-slate-500">{person.email}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{person.perfil}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${Number(person.activo) === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {Number(person.activo) === 1 ? 'Activo' : 'Bloqueado'}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr,140px]">
                <select
                  value={person.rol}
                  onChange={(e) => updateUser(person.id, { rol: e.target.value })}
                  disabled={savingUserId === person.id}
                  className="input"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => updateUser(person.id, { activo: Number(person.activo) !== 1 })}
                  disabled={savingUserId === person.id || person.nombre === 'Juanfran'}
                  className={`rounded-2xl border px-3 py-2 text-sm font-medium ${Number(person.activo) === 1 ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'} disabled:opacity-50`}
                >
                  {savingUserId === person.id ? 'Guardando...' : Number(person.activo) === 1 ? 'Bloquear' : 'Activar'}
                </button>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Ultima actividad: {person.last_seen ? String(person.last_seen).replace('T', ' ') : 'sin registro'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
