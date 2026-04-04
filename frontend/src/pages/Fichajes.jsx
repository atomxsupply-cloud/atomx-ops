import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Coffee, PauseCircle, PlayCircle, TimerReset } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

function formatDuration(value, unit = 'minutes') {
  const totalSeconds = unit === 'seconds'
    ? Math.max(Number(value) || 0, 0)
    : Math.max(Number(value) || 0, 0) * 60;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function computeLiveWorkedSeconds(item) {
  if (!item?.started_at) return 0;
  const start = new Date(String(item.started_at).replace(' ', 'T'));
  const end = item.estado === 'pausa' && item.pausa_desde
    ? new Date(String(item.pausa_desde).replace(' ', 'T'))
    : new Date();
  const total = Math.max(Math.round((end.getTime() - start.getTime()) / 1000), 0);
  return Math.max(total - ((item.pausa_total_min || 0) * 60), 0);
}

export default function Fichajes() {
  const { user } = useAuth();
  const [estado, setEstado] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportInfo, setExportInfo] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [canViewAll, setCanViewAll] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());

  async function load() {
    setLoading(true);
    try {
      const [estadoRes, historialRes] = await Promise.all([
        api.get('/fichajes/estado'),
        api.get('/fichajes/historial'),
      ]);
      setEstado(estadoRes.data || []);
      setHistorial(historialRes.data?.items || []);
      setCanViewAll(!!historialRes.data?.canViewAll);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    api.get('/auth/users').then((r) => {
      setUsuarios(r.data || []);
      if (!selectedUserId && user?.id) setSelectedUserId(user.id);
    }).catch(() => {});
  }, [selectedUserId, user]);

  const miFichaje = useMemo(() => estado.find((item) => item.user_id === user?.id), [estado, user]);
  const miTiempoActual = useMemo(() => computeLiveWorkedSeconds(miFichaje), [miFichaje, nowTick]);

  async function accion(path) {
    await api.post(`/fichajes/${path}`);
    load();
  }

  async function exportarTresMeses() {
    const r = await api.get('/fichajes/export-3m');
    setExportInfo(r.data);
  }

  async function cargarHistorialUsuario(userId) {
    const r = await api.get(`/fichajes/historial?user_id=${userId}`);
    setHistorial(r.data?.items || []);
    setCanViewAll(!!r.data?.canViewAll);
    setSelectedUserId(Number(userId));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Fichajes</h1>
          <p className="text-slate-500 text-sm">Control de trabajo en vivo, pausas y descanso restante.</p>
        </div>
        <button onClick={exportarTresMeses} className="btn-primary">
          Exportar 3 meses
        </button>
      </div>

      {exportInfo && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Exportado listo para Excel: <strong>{exportInfo.archivo}</strong>
          <div className="text-xs mt-1 text-emerald-700">
            Carpeta: {exportInfo.carpeta} · Registros: {exportInfo.registros}
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex flex-wrap gap-3">
          {!miFichaje ? (
            <button onClick={() => accion('start')} className="btn-primary inline-flex items-center gap-2">
              <PlayCircle size={16} /> Empezar jornada
            </button>
          ) : miFichaje.estado === 'trabajando' ? (
            <>
              <button onClick={() => accion('pause')} className="btn inline-flex items-center gap-2 border border-slate-200 text-slate-700">
                <PauseCircle size={16} /> Pausa
              </button>
              <button onClick={() => accion('stop')} className="btn-primary inline-flex items-center gap-2">
                <TimerReset size={16} /> Terminar jornada
              </button>
            </>
          ) : (
            <>
              <button onClick={() => accion('resume')} className="btn-primary inline-flex items-center gap-2">
                <PlayCircle size={16} /> Volver al trabajo
              </button>
              <button onClick={() => accion('stop')} className="btn inline-flex items-center gap-2 border border-slate-200 text-slate-700">
                <TimerReset size={16} /> Cerrar jornada
              </button>
            </>
          )}
        </div>

        {miFichaje && (
          <div className="mt-4 space-y-3">
            <div className="rounded-3xl bg-yellow-300 px-5 py-5 text-slate-950">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-700">Tiempo currado</p>
              <p className="text-4xl md:text-5xl font-black mt-2 tabular-nums">
                {formatDuration(miTiempoActual, 'seconds')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Estado</p>
              <p className="text-lg font-semibold text-slate-800 mt-1">{miFichaje.estado === 'pausa' ? 'En pausa' : 'Trabajando'}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Pausa usada</p>
              <p className="text-lg font-semibold text-slate-800 mt-1">{formatDuration(miFichaje.pausa_total_min, 'minutes')}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Descanso restante</p>
              <p className="text-lg font-semibold text-slate-800 mt-1">{formatDuration(miFichaje.descanso_restante_min, 'minutes')}</p>
            </div>
          </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 size={18} className="text-green-600" />
          <h2 className="text-sm font-semibold text-slate-800">Trabajando ahora</h2>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Cargando fichajes...</p>
        ) : estado.length ? (
          <div className="space-y-2">
            {estado.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                  {item.estado === 'pausa' ? (
                    <Coffee size={16} className="text-amber-500" />
                  ) : (
                    <CheckCircle2 size={16} className="text-green-500" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.nombre}</p>
                    <p className="text-xs text-slate-500">{item.estado === 'pausa' ? 'En pausa' : 'Trabajando'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Pausa usada</p>
                  <p className="text-sm font-semibold text-slate-800">{formatDuration(item.pausa_total_min, 'minutes')}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No hay nadie fichado ahora mismo.</p>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Historial de fichajes</h2>
            <p className="text-xs text-slate-500">Guardado por usuario para que cada uno vea sus horas.</p>
          </div>
          {canViewAll ? (
            <select
              value={selectedUserId || user?.id || ''}
              onChange={(e) => cargarHistorialUsuario(e.target.value)}
              className="input max-w-[220px]"
            >
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          ) : null}
        </div>

        {historial.length ? (
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {historial.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.nombre}</p>
                    <p className="text-xs text-slate-500">{item.fecha}</p>
                  </div>
                  <span className="badge bg-slate-100 text-slate-700">{formatDuration(item.seg_trabajados, 'seconds')}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-500">
                  <span>Inicio: {item.started_at?.substring(11, 16) || '-'}</span>
                  <span>Fin: {item.finished_at?.substring(11, 16) || '-'}</span>
                  <span>Pausa: {formatDuration(item.pausa_total_min, 'minutes')}</span>
                  <span>Trabajado: {formatDuration(item.seg_trabajados, 'seconds')}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Todavía no hay fichajes guardados para este usuario.</p>
        )}
      </div>
    </div>
  );
}
