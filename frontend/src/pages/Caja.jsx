import { useEffect, useState } from 'react';
import api from '../api/client';
import { DollarSign, Plus, Lock, Unlock, TrendingUp, TrendingDown, AlertCircle, RotateCcw } from 'lucide-react';
import Modal from '../components/Modal';

const METODOS = ['efectivo', 'tarjeta', 'bizum', 'transferencia'];

export default function Caja() {
  const [caja, setCaja] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAbrir, setShowAbrir] = useState(false);
  const [showCerrar, setShowCerrar] = useState(false);
  const [showMovimiento, setShowMovimiento] = useState(false);
  const [apertura, setApertura] = useState('');
  const [cierre, setCierre] = useState('');
  const [obsCierre, setObsCierre] = useState('');
  const [movForm, setMovForm] = useState({ tipo: 'ingreso', concepto: '', importe: '', metodo_pago: 'efectivo' });
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [turnos, setTurnos] = useState({
    manana_cierre: '',
    tarde_apertura: '',
    tarde_cierre: '',
    ajuste_factusol: '',
  });

  const load = () => api.get('/caja/hoy').then(r => {
    setCaja(r.data);
    setTurnos({
      manana_cierre: r.data?.resumen_turnos?.manana?.cierre ?? '',
      tarde_apertura: r.data?.resumen_turnos?.tarde?.apertura ?? '',
      tarde_cierre: r.data?.resumen_turnos?.tarde?.cierre ?? '',
      ajuste_factusol: r.data?.resumen_turnos?.tarde?.ajuste_factusol ?? '',
    });
  }).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  async function guardarTurno(turno) {
    setSaving(true);
    try {
      if (turno === 'manana') {
        await api.post('/caja/turno', { turno, cierre: parseFloat(turnos.manana_cierre) || 0 });
      } else {
        await api.post('/caja/turno', {
          turno,
          apertura: parseFloat(turnos.tarde_apertura) || 0,
          cierre: turnos.tarde_cierre !== '' ? parseFloat(turnos.tarde_cierre) : null,
          ajuste_factusol: parseFloat(turnos.ajuste_factusol) || 0,
        });
      }
      load();
    } finally {
      setSaving(false);
    }
  }

  async function abrirCaja(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/caja/abrir', { apertura_importe: parseFloat(apertura) || 0 });
      setShowAbrir(false);
      setApertura('');
      load();
    } finally { setSaving(false); }
  }

  async function cerrarCaja(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api.post('/caja/cerrar', { cierre_importe: parseFloat(cierre), observaciones: obsCierre });
      setResultado(r.data);
      setShowCerrar(false);
      load();
    } finally { setSaving(false); }
  }

  async function addMovimiento(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/caja/movimiento', { ...movForm, importe: parseFloat(movForm.importe) });
      setShowMovimiento(false);
      setMovForm({ tipo: 'ingreso', concepto: '', importe: '', metodo_pago: 'efectivo' });
      load();
    } finally { setSaving(false); }
  }

  async function resetCaja() {
    if (!confirm('Esto reinicia la caja de hoy a cero y borra los movimientos del dia. ¿Seguimos?')) return;
    setSaving(true);
    try {
      await api.post('/caja/reset');
      setResultado(null);
      setTurnos({
        manana_cierre: '',
        tarde_apertura: '',
        tarde_cierre: '',
        ajuste_factusol: '',
      });
      load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-slate-400 text-sm text-center py-8">Cargando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Caja</h1>
          <p className="text-slate-500 text-sm">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        {caja ? (
          <div className="flex gap-2">
            {caja.estado === 'abierta' && <>
              <button onClick={resetCaja} className="btn flex items-center gap-1.5 border border-slate-200 text-slate-600 text-sm">
                <RotateCcw size={15} /> Reiniciar caja
              </button>
              <button onClick={() => setShowMovimiento(true)} className="btn-primary flex items-center gap-1.5 text-sm"><Plus size={15} /> Movimiento</button>
              <button onClick={() => setShowCerrar(true)} className="btn flex items-center gap-1.5 border border-slate-200 text-slate-600 text-sm"><Lock size={15} /> Cerrar caja</button>
            </>}
          </div>
        ) : (
          <button onClick={() => setShowAbrir(true)} className="btn-primary flex items-center gap-1.5"><Unlock size={15} /> Abrir caja</button>
        )}
      </div>

      {resultado && (
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${Math.abs(resultado.descuadre) < 0.01 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <AlertCircle size={20} />
          <div>
            <p className="font-medium">Caja cerrada</p>
            <p className="text-sm">Esperado: {resultado.esperado.toFixed(2)}€ · Descuadre: {resultado.descuadre > 0 ? '+' : ''}{resultado.descuadre.toFixed(2)}€</p>
          </div>
          <button onClick={() => setResultado(null)} className="ml-auto opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {!caja ? (
        <div className="card text-center py-12">
          <DollarSign size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-medium">La caja no está abierta</p>
          <p className="text-slate-400 text-sm mb-4">Abre la caja para empezar a registrar movimientos</p>
          <button onClick={() => setShowAbrir(true)} className="btn-primary inline-flex items-center gap-2"><Unlock size={16} /> Abrir caja</button>
        </div>
      ) : (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card text-center">
              <p className="text-xs text-slate-400 mb-1">Apertura</p>
              <p className="text-xl font-bold text-slate-700">{caja.apertura_importe.toFixed(2)}€</p>
            </div>
            <div className="card text-center">
              <p className="text-xs text-green-600 mb-1 flex items-center justify-center gap-1"><TrendingUp size={12} /> Ingresos</p>
              <p className="text-xl font-bold text-green-600">+{caja.ingresos.toFixed(2)}€</p>
            </div>
            <div className="card text-center">
              <p className="text-xs text-red-500 mb-1 flex items-center justify-center gap-1"><TrendingDown size={12} /> Gastos</p>
              <p className="text-xl font-bold text-red-500">-{caja.gastos.toFixed(2)}€</p>
            </div>
            <div className={`card text-center ${caja.estado === 'cerrada' ? 'bg-slate-50' : 'bg-atomx-50 border-atomx-200'}`}>
              <p className="text-xs text-slate-500 mb-1">Saldo actual</p>
              <p className="text-xl font-bold text-atomx-600">{caja.saldo_real.toFixed(2)}€</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="card">
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-3">Caja de mañana</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Apertura</span><span>{Number(caja.resumen_turnos?.manana?.apertura || 0).toFixed(2)}€</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Esperado</span><span>{Number(caja.resumen_turnos?.manana?.esperado || 0).toFixed(2)}€</span></div>
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={turnos.manana_cierre}
                  onChange={(e) => setTurnos((t) => ({ ...t, manana_cierre: e.target.value }))}
                  placeholder="Cierre mañana"
                />
                <button onClick={() => guardarTurno('manana')} disabled={saving} className="btn-primary whitespace-nowrap">
                  Guardar
                </button>
              </div>
            </div>

            <div className="card">
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-3">Caja de tarde</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={turnos.ajuste_factusol}
                  onChange={(e) => setTurnos((t) => ({ ...t, ajuste_factusol: e.target.value }))}
                  placeholder="Resta Factusol"
                />
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={turnos.tarde_apertura}
                  onChange={(e) => setTurnos((t) => ({ ...t, tarde_apertura: e.target.value }))}
                  placeholder="Apertura tarde"
                />
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={turnos.tarde_cierre}
                  onChange={(e) => setTurnos((t) => ({ ...t, tarde_cierre: e.target.value }))}
                  placeholder="Cierre tarde"
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                La apertura de tarde debe cuadrar con la mañana menos la operación final de Factusol.
              </p>
              <div className="mt-3">
                <button onClick={() => guardarTurno('tarde')} disabled={saving} className="btn-primary">
                  Guardar tarde
                </button>
              </div>
            </div>
          </div>

          {/* Estado */}
          <div className="flex items-center gap-2">
            <span className={`badge ${caja.estado === 'abierta' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
              {caja.estado === 'abierta' ? '🟢 Caja abierta' : '🔒 Caja cerrada'}
            </span>
          </div>

          {/* Movimientos */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-700 text-sm">Movimientos del día</h2>
              <span className="text-xs text-slate-400">{caja.movimientos?.length || 0} movimientos</span>
            </div>
            {caja.movimientos?.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">Sin movimientos</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {caja.movimientos?.map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${m.tipo === 'ingreso' ? 'bg-green-100' : 'bg-red-100'}`}>
                      {m.tipo === 'ingreso' ? <TrendingUp size={14} className="text-green-600" /> : <TrendingDown size={14} className="text-red-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700">{m.concepto}</p>
                      <p className="text-xs text-slate-400">{m.metodo_pago} · {m.usuario} · {m.created_at?.substring(11, 16)}</p>
                    </div>
                    <p className={`text-sm font-bold flex-shrink-0 ${m.tipo === 'ingreso' ? 'text-green-600' : 'text-red-500'}`}>
                      {m.tipo === 'ingreso' ? '+' : '-'}{m.importe.toFixed(2)}€
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal abrir */}
      {showAbrir && (
        <Modal title="Abrir caja" onClose={() => setShowAbrir(false)}>
          <form onSubmit={abrirCaja} className="space-y-4">
            <div>
              <label className="label">Importe de apertura (€)</label>
              <input type="number" step="0.01" min="0" value={apertura} onChange={e => setApertura(e.target.value)} className="input text-lg" placeholder="0.00" autoFocus />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAbrir(false)} className="btn-ghost">Cancelar</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Abriendo...' : 'Abrir caja'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal cerrar */}
      {showCerrar && (
        <Modal title="Cerrar caja" onClose={() => setShowCerrar(false)}>
          <form onSubmit={cerrarCaja} className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">Apertura</span><span>{caja?.apertura_importe.toFixed(2)}€</span></div>
              <div className="flex justify-between"><span className="text-green-600">+ Ingresos</span><span className="text-green-600">+{caja?.ingresos.toFixed(2)}€</span></div>
              <div className="flex justify-between"><span className="text-red-500">- Gastos</span><span className="text-red-500">-{caja?.gastos.toFixed(2)}€</span></div>
              <div className="flex justify-between font-bold border-t border-slate-200 pt-1"><span>Esperado</span><span>{caja?.saldo_real.toFixed(2)}€</span></div>
            </div>
            <div>
              <label className="label">Importe real en caja (€)</label>
              <input type="number" step="0.01" min="0" value={cierre} onChange={e => setCierre(e.target.value)} className="input text-lg" placeholder="0.00" required autoFocus />
            </div>
            <div>
              <label className="label">Observaciones</label>
              <textarea value={obsCierre} onChange={e => setObsCierre(e.target.value)} className="input h-16 resize-none" placeholder="Notas del cierre..." />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCerrar(false)} className="btn-ghost">Cancelar</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Cerrando...' : 'Cerrar caja'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal movimiento */}
      {showMovimiento && (
        <Modal title="Nuevo movimiento" onClose={() => setShowMovimiento(false)}>
          <form onSubmit={addMovimiento} className="space-y-3">
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              <button type="button" onClick={() => setMovForm(f => ({ ...f, tipo: 'ingreso' }))} className={`flex-1 py-2.5 text-sm font-medium transition-colors ${movForm.tipo === 'ingreso' ? 'bg-green-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                <TrendingUp size={14} className="inline mr-1.5" />Ingreso
              </button>
              <button type="button" onClick={() => setMovForm(f => ({ ...f, tipo: 'gasto' }))} className={`flex-1 py-2.5 text-sm font-medium transition-colors ${movForm.tipo === 'gasto' ? 'bg-red-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                <TrendingDown size={14} className="inline mr-1.5" />Gasto
              </button>
            </div>
            <div>
              <label className="label">Concepto *</label>
              <input value={movForm.concepto} onChange={e => setMovForm(f => ({ ...f, concepto: e.target.value }))} className="input" required placeholder="Ej: Venta Kwadron, Reposición guantes..." autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Importe (€) *</label>
                <input type="number" step="0.01" min="0" value={movForm.importe} onChange={e => setMovForm(f => ({ ...f, importe: e.target.value }))} className="input" required placeholder="0.00" />
              </div>
              <div>
                <label className="label">Método de pago</label>
                <select value={movForm.metodo_pago} onChange={e => setMovForm(f => ({ ...f, metodo_pago: e.target.value }))} className="input">
                  {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowMovimiento(false)} className="btn-ghost">Cancelar</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Añadir'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
