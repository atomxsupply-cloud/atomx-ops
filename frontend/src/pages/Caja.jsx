import { useEffect, useState } from 'react';
import { Camera, Lock, Sun, Sunset, Unlock } from 'lucide-react';
import api from '../api/client';
import Modal from '../components/Modal';
import PhotoCajaAssistant from '../components/PhotoCajaAssistant';
import { useAuth } from '../context/AuthContext';

const APERTURA_FIJA = 100;

function toNumberInput(value) {
  if (value === null || value === undefined || value === '') return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : '';
}

function parseNullableNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value) {
  return `${Number(value || 0).toFixed(2)} EUR`;
}

function TurnoCircle({ title, subtitle, icon: Icon, active, locked, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      className={`flex min-h-[190px] flex-col items-center justify-center rounded-[2rem] border px-5 text-center transition-all ${
        locked
          ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
          : active
            ? 'border-slate-900 bg-slate-900 text-white shadow-xl'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:shadow-md'
      }`}
    >
      <span className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full ${active ? 'bg-white/10' : 'bg-slate-100'}`}>
        <Icon size={28} />
      </span>
      <p className="text-xl font-bold">{title}</p>
      <p className={`mt-2 max-w-[220px] text-sm leading-5 ${active ? 'text-white/75' : 'text-slate-500'}`}>{subtitle}</p>
      {locked ? <span className="mt-4 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500">Bloqueada</span> : null}
    </button>
  );
}

function QuickHint({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    green: 'border-green-200 bg-green-50 text-green-700',
    red: 'border-red-200 bg-red-50 text-red-700',
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 ${tones[tone] || tones.slate}`}>
      <p className="text-xs font-medium uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function addAmount(value, amount) {
  const base = Number(value || 0);
  return String(Number((base + amount).toFixed(2)));
}

function QuickAmountPad({ title, onAdd, onReset }) {
  const amounts = [5, 10, 20, 50, 100, 200];

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        <button type="button" onClick={onReset} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
          Borrar
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {amounts.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => onAdd(amount)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-4 text-base font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
          >
            +{amount}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Caja() {
  const { user } = useAuth();
  const [caja, setCaja] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');
  const [activeMenu, setActiveMenu] = useState('manana');
  const [showFotoCaja, setShowFotoCaja] = useState(false);
  const [cierreManana, setCierreManana] = useState('');
  const [ajusteFactusol, setAjusteFactusol] = useState('');
  const [cierreTarde, setCierreTarde] = useState('');
  const [activeField, setActiveField] = useState('manana');

  async function load() {
    setLoading(true);
    try {
      const response = await api.get('/caja/hoy');
      const data = response.data;
      setCaja(data);
      setCierreManana(toNumberInput(data?.resumen_turnos?.manana?.cierre));
      setAjusteFactusol(toNumberInput(data?.resumen_turnos?.tarde?.ajuste_factusol));
      setCierreTarde(toNumberInput(data?.resumen_turnos?.tarde?.cierre));
      setActiveField(data?.resumen_turnos?.manana?.cierre != null ? 'factusol' : 'manana');
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'No he podido cargar la caja.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const mananaCerrada = parseNullableNumber(cierreManana) != null || parseNullableNumber(caja?.manana_cierre) != null;
  const efectivoManana = parseNullableNumber(cierreManana) ?? Number(caja?.resumen_turnos?.manana?.generado || 0);
  const factusolTarde = parseNullableNumber(ajusteFactusol) ?? Number(caja?.resumen_turnos?.tarde?.ajuste_factusol || 0);
  const efectivoTarde = parseNullableNumber(cierreTarde) ?? Number(caja?.resumen_turnos?.tarde?.generado || 0);
  const descuadreTarde = Number((efectivoTarde - factusolTarde).toFixed(2));
  const tardeCuadra = Math.abs(descuadreTarde) < 0.01;
  const bloqueoManana = caja?.bloqueos?.manana;
  const mananaLockedByPair = Boolean(bloqueoManana?.locked && bloqueoManana?.ownerId !== user?.id);

  function applyQuickAmount(amount) {
    if (activeField === 'manana') {
      setCierreManana((current) => addAmount(current, amount));
      return;
    }
    if (activeField === 'factusol') {
      setAjusteFactusol((current) => addAmount(current, amount));
      return;
    }
    setCierreTarde((current) => addAmount(current, amount));
  }

  function resetActiveField() {
    if (activeField === 'manana') {
      setCierreManana('');
      return;
    }
    if (activeField === 'factusol') {
      setAjusteFactusol('');
      return;
    }
    setCierreTarde('');
  }

  function applyPhotoToCaja(data) {
    setCierreManana(data.manana_cierre != null ? toNumberInput(data.manana_cierre) : cierreManana);
    setAjusteFactusol(data.ajuste_factusol != null ? toNumberInput(data.ajuste_factusol) : ajusteFactusol);
    setCierreTarde(data.tarde_cierre != null ? toNumberInput(data.tarde_cierre) : cierreTarde);
    setShowFotoCaja(false);
  }

  async function abrirCajaManana() {
    setSaving('abrir-manana');
    try {
      await api.post('/caja/abrir', {});
      await load();
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'No he podido abrir la caja de manana.');
    } finally {
      setSaving('');
    }
  }

  async function guardarManana() {
    setSaving('guardar-manana');
    try {
      await api.post('/caja/turno', {
        turno: 'manana',
        cierre: parseNullableNumber(cierreManana),
      });
      await load();
      setActiveMenu('tarde');
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'No he podido guardar la caja de manana.');
    } finally {
      setSaving('');
    }
  }

  async function guardarTarde() {
    setSaving('guardar-tarde');
    try {
      await api.post('/caja/turno', {
        turno: 'tarde',
        cierre: parseNullableNumber(cierreTarde),
        ajuste_factusol: parseNullableNumber(ajusteFactusol) ?? 0,
      });
      await load();
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'No he podido guardar la caja de tarde.');
    } finally {
      setSaving('');
    }
  }

  if (loading) return <div className="py-8 text-center text-sm text-slate-400">Cargando...</div>;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Caja</h1>
          <p className="text-sm text-slate-500">Siempre empezamos con 100 EUR. Aqui solo contamos el efectivo generado.</p>
        </div>
        <button onClick={() => setShowFotoCaja(true)} className="btn flex items-center gap-2 border border-slate-200 text-slate-700">
          <Camera size={15} /> Leer foto
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TurnoCircle
          title="Caja manana"
          subtitle={caja ? (mananaCerrada ? 'Manana cerrada. El fondo de 100 EUR pasa a la tarde.' : 'Abre con 100 EUR y apunta solo el efectivo hecho.') : 'Abre la caja del dia con el fondo fijo.'}
          icon={Sun}
          active={activeMenu === 'manana'}
          locked={false}
          onClick={() => setActiveMenu('manana')}
        />
        <TurnoCircle
          title="Caja tarde"
          subtitle={mananaCerrada ? 'El mismo fondo de 100 EUR sigue. Lo importante es cuadrar efectivo y Factusol.' : 'Se desbloquea al cerrar la manana.'}
          icon={Sunset}
          active={activeMenu === 'tarde'}
          locked={!mananaCerrada}
          onClick={() => setActiveMenu('tarde')}
        />
      </div>

      {activeMenu === 'manana' ? (
        <div className="card space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Caja de manana</h2>
              <p className="text-sm text-slate-500">Cuenta solo lo que has generado en efectivo, sin sumar los 100 EUR del fondo.</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${mananaCerrada ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
              {mananaCerrada ? 'Guardada' : 'Pendiente'}
            </span>
          </div>

          {mananaLockedByPair ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              La caja de manana la esta llevando <span className="font-semibold">{bloqueoManana?.ownerName}</span>. Mientras siga abierta, el otro cajero de manana la vera bloqueada para no pisaros.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <QuickHint label="Fondo fijo" value={formatMoney(APERTURA_FIJA)} />
            <QuickHint label="Efectivo manana" value={formatMoney(efectivoManana)} tone={efectivoManana > 0 ? 'green' : 'slate'} />
          </div>

          <div>
            <label className="label">Efectivo hecho en la manana</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              className={`input h-16 text-2xl font-semibold ${activeField === 'manana' ? 'border-slate-900 ring-2 ring-slate-900/10' : ''}`}
              value={cierreManana}
              onChange={(e) => setCierreManana(e.target.value)}
              onFocus={() => setActiveField('manana')}
              placeholder="0.00"
            />
            <p className="mt-2 text-xs text-slate-500">No metas aqui los 100 EUR de fondo. Solo lo que realmente ha entrado en efectivo.</p>
          </div>

          <QuickAmountPad
            title="Sumar rapido a manana"
            onAdd={applyQuickAmount}
            onReset={resetActiveField}
          />

          <div className="sticky bottom-3 z-10 flex flex-wrap justify-end gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 backdrop-blur">
            {!caja ? (
              <button onClick={abrirCajaManana} disabled={saving === 'abrir-manana'} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
                <Unlock size={15} /> {saving === 'abrir-manana' ? 'Abriendo...' : 'Abrir manana con 100 EUR'}
              </button>
            ) : (
              <button onClick={guardarManana} disabled={saving === 'guardar-manana' || mananaLockedByPair} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
                <Lock size={15} /> {mananaLockedByPair ? 'Bloqueada por otro cajero' : saving === 'guardar-manana' ? 'Guardando...' : 'Guardar manana'}
              </button>
            )}
          </div>
        </div>
      ) : null}

      {activeMenu === 'tarde' ? (
        <div className="card space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Caja de tarde</h2>
              <p className="text-sm text-slate-500">La tarde vuelve a empezar con 100 EUR. Solo tiene que cuadrar el efectivo contado con Factusol.</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${tardeCuadra ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {tardeCuadra ? 'Cuadra' : `Diferencia ${descuadreTarde > 0 ? '+' : ''}${formatMoney(descuadreTarde)}`}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <QuickHint label="Fondo fijo tarde" value={formatMoney(APERTURA_FIJA)} />
            <QuickHint label="Factusol" value={formatMoney(factusolTarde)} />
            <QuickHint label="Efectivo tarde" value={formatMoney(efectivoTarde)} tone={efectivoTarde > 0 ? 'green' : 'slate'} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-sm text-slate-500">Formula de tarde</p>
            <p className="mt-2 text-lg font-semibold text-slate-800">Efectivo contado - Factusol = diferencia final</p>
            <p className="mt-2 text-sm text-slate-500">Si la diferencia da 0, la caja de tarde esta fina.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="label">Factusol de la tarde</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                className={`input h-16 text-2xl font-semibold ${activeField === 'factusol' ? 'border-slate-900 ring-2 ring-slate-900/10' : ''}`}
                value={ajusteFactusol}
                onChange={(e) => setAjusteFactusol(e.target.value)}
                onFocus={() => setActiveField('factusol')}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="label">Efectivo contado de la tarde</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                className={`input h-16 text-2xl font-semibold ${activeField === 'tarde' ? 'border-slate-900 ring-2 ring-slate-900/10' : ''}`}
                value={cierreTarde}
                onChange={(e) => setCierreTarde(e.target.value)}
                onFocus={() => setActiveField('tarde')}
                placeholder="0.00"
              />
            </div>
          </div>

          <QuickAmountPad
            title={activeField === 'factusol' ? 'Sumar rapido a Factusol' : 'Sumar rapido a efectivo tarde'}
            onAdd={applyQuickAmount}
            onReset={resetActiveField}
          />

          <div className={`rounded-2xl border px-4 py-4 ${tardeCuadra ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <p className={`text-sm ${tardeCuadra ? 'text-green-700' : 'text-red-700'}`}>Resultado final</p>
            <p className={`mt-2 text-3xl font-bold ${tardeCuadra ? 'text-green-700' : 'text-red-700'}`}>
              {descuadreTarde > 0 ? '+' : ''}{formatMoney(descuadreTarde)}
            </p>
          </div>

          <div className="sticky bottom-3 z-10 flex justify-end rounded-2xl border border-slate-200 bg-white/95 p-3 backdrop-blur">
            <button onClick={guardarTarde} disabled={saving === 'guardar-tarde'} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
              <Lock size={15} /> {saving === 'guardar-tarde' ? 'Guardando...' : 'Guardar tarde'}
            </button>
          </div>
        </div>
      ) : null}

      {showFotoCaja ? (
        <Modal title="Leer caja desde foto" onClose={() => setShowFotoCaja(false)} wide>
          <PhotoCajaAssistant onApply={applyPhotoToCaja} />
        </Modal>
      ) : null}
    </div>
  );
}
