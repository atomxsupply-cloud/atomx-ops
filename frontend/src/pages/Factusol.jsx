import { useEffect, useState } from 'react';
import { CheckCircle2, Cloud, Database, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import api from '../api/client';

function formatBytes(value) {
  const size = Number(value || 0);
  if (!size) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function StatCard({ label, value, help }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-800">{value}</p>
      {help ? <p className="mt-1 text-xs text-slate-500">{help}</p> : null}
    </div>
  );
}

export default function Factusol() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/factusol/overview');
      setData(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function importLocalClientes() {
    setSyncing(true);
    try {
      const { data } = await api.post('/factusol/sync/clientes-local');
      setMessage(`Importados ${data.imported || 0} clientes desde el Excel local`);
      await load();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Factusol</h1>
          <p className="text-sm text-slate-500">Panel de preparacion total para cuando DELSOL confirme las credenciales oficiales.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button onClick={load} disabled={loading} className="btn flex items-center gap-2 border border-slate-200 text-slate-700">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refrescar
          </button>
          <button onClick={importLocalClientes} disabled={syncing} className="btn flex items-center gap-2 border border-slate-200 text-slate-700">
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Importando...' : 'Importar clientes desde Excel'}
          </button>
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>
      ) : null}

      {loading ? <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-sm text-slate-400">Cargando Factusol...</div> : null}

      {!loading && data ? (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard label="Clientes internos ATOM X" value={data.metrics?.clientes ?? 0} />
            <StatCard label="Articulos cacheados" value={data.metrics?.articulos ?? 0} />
            <StatCard label="Pedidos en sistema" value={data.metrics?.pedidos ?? 0} />
            <StatCard label="Excel local" value={data.excel?.ready ? 'OK' : 'Falta'} help={data.excel?.ready ? formatBytes(data.excel.size) : 'Subelo a datos/'} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr,1.1fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <Cloud size={18} className={data.status?.ready ? 'text-emerald-600' : 'text-amber-600'} />
                <h2 className="text-lg font-semibold text-slate-800">Estado del conector nube</h2>
              </div>
              <div className={`mt-4 rounded-2xl border px-4 py-4 ${data.status?.ready ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide ${data.status?.ready ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {data.status?.ready ? 'Listo para probar token real' : 'Pendiente de credenciales oficiales'}
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  {data.status?.ready
                    ? 'Ya estan todos los campos minimos. En cuanto DELSOL confirme, podemos enchufar autenticacion real y sincronizacion.'
                    : 'La app ya esta preparada. Solo falta que DELSOL te confirme manufacturer code, client id, secret y database id.'}
                </p>
              </div>

              <div className="mt-4 space-y-2">
                {Object.entries(data.status?.fields || {}).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                    <span className="font-medium text-slate-600">{key}</span>
                    <span className="font-mono text-xs text-slate-800">{value || 'pendiente'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-slate-700" />
                <h2 className="text-lg font-semibold text-slate-800">Checklist real para terminarlo</h2>
              </div>

              <div className="mt-4 space-y-3">
                {(data.checklist || []).map((item) => (
                  <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    {item.done ? <CheckCircle2 size={18} className="text-emerald-500" /> : <XCircle size={18} className="text-amber-500" />}
                    <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Database size={16} />
                  Lo que ya queda preparado dentro de ATOM X
                </div>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li>Clientes de Factusol importables desde Excel</li>
                  <li>Conector nube base ya creado</li>
                  <li>Panel de estado y validacion de credenciales</li>
                  <li>Pedido rapido listo para usar esta base de clientes</li>
                </ul>
              </div>

              {data.excel?.ready ? (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-700">Excel detectado</p>
                  <p className="mt-1 break-all">{data.excel.path}</p>
                  <p className="mt-1">Ultima actualizacion: {String(data.excel.updatedAt || '').replace('T', ' ').replace('Z', '')}</p>
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
