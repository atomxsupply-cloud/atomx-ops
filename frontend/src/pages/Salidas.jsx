import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, ReceiptText, Trash2 } from 'lucide-react';
import api from '../api/client';

export default function Salidas() {
  const [importe, setImporte] = useState(10);
  const [concepto, setConcepto] = useState('');
  const [hoy, setHoy] = useState({ total: 0, items: [] });
  const [historial, setHistorial] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [hoyResp, histResp] = await Promise.all([
        api.get('/salidas/hoy'),
        api.get('/salidas/historial'),
      ]);
      setHoy(hoyResp.data || { total: 0, items: [] });
      setHistorial(histResp.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'No he podido cargar salidas. Comprueba que el backend nuevo este subido.');
      setHoy({ total: 0, items: [] });
      setHistorial([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function crearSalida() {
    if (!concepto.trim() || importe <= 0 || saving) return;
    setSaving(true);
    try {
      await api.post('/salidas', { concepto, importe });
      setConcepto('');
      setImporte(10);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'No he podido guardar la salida.');
    } finally {
      setSaving(false);
    }
  }

  async function eliminarSalida(id) {
    if (!confirm('Eliminar salida?')) return;
    try {
      await api.delete(`/salidas/${id}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'No he podido eliminar la salida.');
    }
  }

  const totalHoy = useMemo(() => Number(hoy.total || 0), [hoy.total]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Salidas</h1>
        <p className="text-slate-500 text-sm">Control diario de dinero que sale y baja de la caja del dia</p>
      </div>

      {error && (
        <div className="card border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[420px,1fr] gap-5">
        <section className="rounded-[2rem] border border-yellow-200 bg-yellow-50 p-5 shadow-sm">
          <p className="text-sm font-semibold text-yellow-800">Salida nueva</p>
          <p className="mt-2 text-xs uppercase tracking-wide text-yellow-700">Total del dia</p>
          <p className="text-5xl font-black text-slate-900 mt-2">{totalHoy.toFixed(2)}€</p>

          <div className="mt-6 rounded-[1.5rem] bg-white border border-yellow-200 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Importe</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setImporte((v) => Math.max(0, Number((v - 1).toFixed(2))))} className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                <Minus size={18} />
              </button>
              <div className="flex-1 text-center">
                <p className="text-4xl font-black text-slate-900">{Number(importe).toFixed(2)}€</p>
              </div>
              <button onClick={() => setImporte((v) => Number((v + 1).toFixed(2)))} className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                <Plus size={18} />
              </button>
            </div>
          </div>

          <div className="mt-4">
            <label className="label">De que es la salida</label>
            <textarea
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              className="input h-28 resize-none bg-white"
              placeholder="Ej: dinero para proveedor, gasolina, recogida, pago urgente..."
            />
          </div>

          <button onClick={crearSalida} disabled={saving || !concepto.trim() || importe <= 0} className="btn-primary w-full mt-4 text-base py-3 disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar salida'}
          </button>
        </section>

        <section className="space-y-5">
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <ReceiptText size={16} className="text-yellow-600" />
              <h2 className="font-semibold text-slate-800">Salidas del dia</h2>
            </div>

            {loading ? (
              <p className="text-sm text-slate-400">Cargando salidas...</p>
            ) : hoy.items?.length ? (
              <div className="space-y-2">
                {hoy.items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{item.concepto}</p>
                      <p className="text-xs text-slate-400 mt-1">{item.usuario || 'Sistema'} · {item.created_at?.slice(11, 16)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-yellow-700">-{Number(item.importe).toFixed(2)}€</p>
                      <button onClick={() => eliminarSalida(item.id)} className="text-slate-300 hover:text-red-500 mt-2">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Todavia no hay salidas registradas hoy.</p>
            )}
          </div>

          <div className="card">
            <h2 className="font-semibold text-slate-800 mb-3">Historial por dia</h2>
            {loading ? (
              <p className="text-sm text-slate-400">Cargando historial...</p>
            ) : historial.length ? (
              <div className="space-y-2">
                {historial.map((dia) => (
                  <div key={dia.fecha} className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{dia.fecha}</p>
                      <p className="text-xs text-slate-400">{dia.movimientos} movimientos</p>
                    </div>
                    <p className="text-lg font-bold text-slate-900">{Number(dia.total).toFixed(2)}€</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Sin historial todavia.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
