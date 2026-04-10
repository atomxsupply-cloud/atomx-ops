import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, CheckCircle2, ExternalLink, Loader2, MapPinned, Navigation, Search, UserRound } from 'lucide-react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api/client';
import ChipSelect from '../components/ui/ChipSelect';

const PERSON_COLORS = {
  Juanfran: '#2563eb',
  Papi: '#f97316',
  Maria: '#ec4899',
};

const RUTA_PEOPLE = ['Juanfran', 'Maria', 'Papi'];

const DEFAULT_CENTER = [37.9922, -1.1307];
const MURCIA_BOUNDS = [
  [37.35, -2.15],
  [38.85, -0.65],
];

const EMPTY_FORM = {
  estudio: '',
  direccion: '',
  turno: 'manana',
  nota: '',
  lat: null,
  lng: null,
  asignado_a: '',
};

function createMarkerIcon(nombre = 'Ruta') {
  const color = PERSON_COLORS[nombre] || '#0f172a';
  const letter = String(nombre || 'R').charAt(0).toUpperCase();
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 999px;
        background: ${color};
        color: white;
        display:flex;
        align-items:center;
        justify-content:center;
        font-weight:700;
        border:3px solid white;
        box-shadow:0 10px 20px rgba(15,23,42,.22);
      ">${letter}</div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

function buildGoogleMapsUrl(route) {
  if (route?.lat && route?.lng) {
    return `https://www.google.com/maps/search/?api=1&query=${route.lat},${route.lng}`;
  }
  if (route?.direccion) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(route.direccion)}`;
  }
  return '#';
}

function buildQuery(text) {
  const q = String(text || '').trim();
  if (!q) return '';
  const lower = q.toLowerCase();
  if (/(tattoo|tatuaje|micropig|micro|belleza|estetica|beauty)/.test(lower)) {
    return q;
  }
  return `${q} tattoo studio tatuaje micropigmentacion belleza`;
}

function getTurnoValue(route) {
  return String(route?.turno || route?.hora || '').trim().toLowerCase();
}

function getTurnoLabel(route) {
  const turno = getTurnoValue(route);
  if (turno === 'manana') return 'Manana';
  if (turno === 'tarde') return 'Tarde';
  return 'Sin turno';
}

export default function Rutas() {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState(EMPTY_FORM);
  const [users, setUsers] = useState([]);
  const [pendingRoutes, setPendingRoutes] = useState([]);
  const [paidRoutes, setPaidRoutes] = useState([]);
  const [turnoView, setTurnoView] = useState('todos');
  const [manualOrder, setManualOrder] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(searchParams.get('search') || '');

  async function loadAll() {
    setLoading(true);
    try {
      const [usersRes, pendingRes, paidRes] = await Promise.all([
        api.get('/auth/users'),
        api.get('/rutas?estado=pendiente'),
        api.get('/rutas?estado=pagado'),
      ]);
      setUsers((usersRes.data || []).filter((user) => RUTA_PEOPLE.includes(user.nombre)));
      setPendingRoutes(pendingRes.data?.rutas || []);
      setPaidRoutes(paidRes.data?.rutas || []);
      setManualOrder((pendingRes.data?.rutas || []).map((route) => route.id));
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'No he podido cargar rutas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!form.estudio || form.estudio.trim().length < 3 || form.lat || form.direccion) {
      if (!form.estudio.trim()) setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.post('/maps/places-search', { query: buildQuery(form.estudio) });
        setSuggestions(data.places || []);
        setError('');
      } catch (err) {
        setSuggestions([]);
        setError(err.response?.data?.error || 'No he podido buscar estudios');
      } finally {
        setSearching(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [form.estudio]);

  const mapCenter = useMemo(() => DEFAULT_CENTER, []);

  const orderedRoutes = useMemo(() => (
    [...pendingRoutes].sort((a, b) => {
      const turnoOrder = { manana: 0, tarde: 1 };
      const turnoA = getTurnoValue(a);
      const turnoB = getTurnoValue(b);
      const orderA = turnoOrder[turnoA] ?? 9;
      const orderB = turnoOrder[turnoB] ?? 9;
      if (orderA !== orderB) return orderA - orderB;
      return String(a.estudio || '').localeCompare(String(b.estudio || ''));
    })
  ), [pendingRoutes]);

  const visibleRoutes = useMemo(() => {
    const normalizedSearch = String(search || '').trim().toLowerCase();
    const base = orderedRoutes.filter((route) => {
      if (turnoView !== 'todos' && getTurnoValue(route) !== turnoView) return false;
      if (!normalizedSearch) return true;
      return [route.estudio, route.direccion, route.nota, route.asignado_nombre]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    });
    const orderMap = new Map(manualOrder.map((id, index) => [id, index]));
    return [...base].sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
  }, [orderedRoutes, turnoView, manualOrder, search]);

  const resumenTurnos = useMemo(() => ({
    manana: pendingRoutes.filter((route) => getTurnoValue(route) === 'manana').length,
    tarde: pendingRoutes.filter((route) => getTurnoValue(route) === 'tarde').length,
  }), [pendingRoutes]);

  function updateForm(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'estudio' ? { direccion: '', lat: null, lng: null } : {}),
    }));
  }

  function selectSuggestion(place) {
    setForm((current) => ({
      ...current,
      estudio: place.nombre,
      direccion: place.direccion,
      lat: place.lat,
      lng: place.lng,
    }));
    setSuggestions([]);
    setError('');
  }

  function moveRoute(routeId, direction) {
    setManualOrder((current) => {
      const copy = [...current];
      const index = copy.indexOf(routeId);
      if (index === -1) return current;
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= copy.length) return current;
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
  }

  function exportVisibleRoutes() {
    const routable = visibleRoutes.filter((route) => route?.direccion || (route?.lat && route?.lng));
    if (!routable.length) return;

    const points = routable.map((route) => (
      route.lat && route.lng
        ? `${route.lat},${route.lng}`
        : encodeURIComponent(route.direccion)
    ));

    let url = '';
    if (points.length === 1) {
      url = `https://www.google.com/maps/search/?api=1&query=${points[0]}`;
    } else {
      const origin = points[0];
      const destination = points[points.length - 1];
      const waypoints = points.slice(1, -1).join('|');
      url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=driving`;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function saveRoute() {
    if (!form.estudio.trim() || saving) return;
    setSaving(true);
    try {
      await api.post('/rutas', {
        estudio: form.estudio.trim(),
        direccion: form.direccion.trim(),
        turno: form.turno || null,
        nota: form.nota.trim(),
        lat: form.lat,
        lng: form.lng,
        asignado_a: form.asignado_a ? Number(form.asignado_a) : null,
      });
      setForm(EMPTY_FORM);
      setSuggestions([]);
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'No he podido guardar la parada');
    } finally {
      setSaving(false);
    }
  }

  async function markPaid(routeId) {
    try {
      await api.patch(`/rutas/${routeId}/estado`, { estado: 'pagado' });
      await loadAll();
    } catch (err) {
      setError(err.response?.data?.error || 'No he podido mover la parada a pagadas');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Rutas comerciales</h1>
          <p className="text-slate-500 text-sm">
            Todo va por turnos. Escribe el estudio, te saco la direccion y lo dejas asignado en dos toques.
          </p>
        </div>
        <div className="grid min-w-[250px] grid-cols-3 gap-2 rounded-2xl bg-slate-900 p-2 text-center text-white">
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-white/70">Total</p>
            <p className="text-base font-semibold">{pendingRoutes.length}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-white/70">Manana</p>
            <p className="text-base font-semibold">{resumenTurnos.manana}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-white/70">Tarde</p>
            <p className="text-base font-semibold">{resumenTurnos.tarde}</p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[360px,1fr] gap-5">
        <div className="space-y-5">
          <div className="card space-y-4">
            <div className="flex items-center gap-2">
              <Navigation size={16} className="text-atomx-500" />
              <h2 className="text-sm font-semibold text-slate-800">Nueva parada</h2>
            </div>

            <div>
              <label className="label" htmlFor="ruta-estudio">Estudio</label>
              <div className="relative">
                <input
                  id="ruta-estudio"
                  name="ruta_estudio"
                  value={form.estudio}
                  onChange={(e) => updateForm('estudio', e.target.value)}
                  className="input pr-10"
                  placeholder="Ej. Benidorm Tattoo"
                  autoComplete="off"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                </span>
                {suggestions.length > 0 ? (
                  <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                    {suggestions.map((place) => (
                      <button
                        key={place.id}
                        type="button"
                        onClick={() => selectSuggestion(place)}
                        className="w-full border-b last:border-b-0 border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
                      >
                        <p className="text-sm font-semibold text-slate-800">{place.nombre}</p>
                        <p className="text-xs text-slate-500 mt-1">{place.direccion}</p>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="ruta-direccion">Direccion</label>
              <input
                id="ruta-direccion"
                name="ruta_direccion"
                value={form.direccion}
                onChange={(e) => updateForm('direccion', e.target.value)}
                className="input"
                placeholder="Se rellena sola o la puedes tocar"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Turno</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateForm('turno', 'manana')}
                    className={`btn ${form.turno === 'manana' ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    Manana
                  </button>
                  <button
                    type="button"
                    onClick={() => updateForm('turno', 'tarde')}
                    className={`btn ${form.turno === 'tarde' ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    Tarde
                  </button>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="ruta-asignado">Quien la lleva</label>
                <ChipSelect
                  value={form.asignado_a}
                  onChange={(v) => updateForm('asignado_a', v)}
                  allowEmpty
                  options={users.map((u) => ({ value: u.id, label: u.nombre }))}
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="ruta-nota">Nota</label>
              <textarea
                id="ruta-nota"
                name="ruta_nota"
                value={form.nota}
                onChange={(e) => updateForm('nota', e.target.value)}
                className="input h-24 resize-none"
                placeholder="Persona, material o detalle importante..."
              />
            </div>

            <button onClick={saveRoute} disabled={saving || !form.estudio.trim()} className="btn-primary w-full inline-flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <MapPinned size={16} />}
              Guardar parada
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card overflow-hidden p-0">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Mapa interactivo</h2>
                <p className="text-xs text-slate-500">Vista limpia de Murcia. Las paradas siguen con color por persona y al pagar desaparecen de activas.</p>
              </div>
            </div>

            <div className="h-[560px]">
              <MapContainer center={mapCenter} zoom={9} maxBounds={MURCIA_BOUNDS} maxBoundsViscosity={1} scrollWheelZoom className="h-full w-full z-0">
                <TileLayer
                  attribution='&copy; CARTO, OpenStreetMap contributors'
                  url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
                />
                {pendingRoutes
                  .filter((route) => Number.isFinite(route.lat) && Number.isFinite(route.lng))
                  .map((route) => (
                    <Marker
                      key={route.id}
                      position={[route.lat, route.lng]}
                      icon={createMarkerIcon(route.asignado_nombre || route.creador_nombre || 'Ruta')}
                    >
                      <Popup>
                        <div className="space-y-2 min-w-[220px]">
                          <div>
                            <p className="font-semibold text-slate-800">{route.estudio}</p>
                            <p className="text-xs text-slate-500">{route.direccion || 'Sin direccion'}</p>
                          </div>
                          <div className="text-xs text-slate-600 space-y-1">
                            <p><strong>Turno:</strong> {getTurnoLabel(route)}</p>
                            <p><strong>Lleva:</strong> {route.asignado_nombre || 'Sin asignar'}</p>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <a
                              href={buildGoogleMapsUrl(route)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white"
                            >
                              <ExternalLink size={13} /> Abrir
                            </a>
                            <button
                              onClick={() => markPaid(route.id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white"
                            >
                              <CheckCircle2 size={13} /> Pagado
                            </button>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
              </MapContainer>
            </div>
          </div>

          <div className="card">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <UserRound size={16} className="text-atomx-500" />
                <h2 className="text-sm font-semibold text-slate-800">Planning automatico</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input min-w-[220px]"
                  placeholder="Buscar parada concreta..."
                />
                {[
                  { value: 'todos', label: 'Todos' },
                  { value: 'manana', label: 'Manana' },
                  { value: 'tarde', label: 'Tarde' },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setTurnoView(item.value)}
                    className={`rounded-xl border px-3 py-2 text-xs font-medium ${
                      turnoView === item.value
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={exportVisibleRoutes}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700"
                >
                  Exportar a Maps
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" /> Cargando rutas...
              </div>
            ) : visibleRoutes.length ? (
              <div className="space-y-2">
                {visibleRoutes.map((route) => {
                        const badgeColor = PERSON_COLORS[route.asignado_nombre] || '#0f172a';
                        return (
                          <div key={route.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-800">{route.estudio}</p>
                                <p className="text-xs text-slate-500 mt-1">{route.direccion || 'Sin direccion'}</p>
                                {route.nota ? <p className="text-xs text-slate-500 mt-2">{route.nota}</p> : null}
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <span className="text-xs text-slate-500">{getTurnoLabel(route)}</span>
                                <span className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-medium text-white" style={{ backgroundColor: badgeColor }}>
                                  {route.asignado_nombre || 'Sin asignar'}
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => moveRoute(route.id, 'up')}
                                    className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300"
                                    title="Subir"
                                  >
                                    <ArrowUp size={16} />
                                  </button>
                                  <button
                                    onClick={() => moveRoute(route.id, 'down')}
                                    className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300"
                                    title="Bajar"
                                  >
                                    <ArrowDown size={16} />
                                  </button>
                                  <button
                                    onClick={() => markPaid(route.id)}
                                    className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                    title="Marcar como pagado"
                                  >
                                    <CheckCircle2 size={18} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                {turnoView === 'todos' ? 'No hay rutas pendientes ahora mismo.' : `No hay rutas de ${turnoView === 'manana' ? 'manana' : 'tarde'} ahora mismo.`}
              </p>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Pagadas hoy</h2>
                <p className="text-xs text-slate-500">Para tener controlado lo ya hecho sin ensuciar las activas.</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                {paidRoutes.length}
              </span>
            </div>

            {paidRoutes.length ? (
              <div className="mt-4 space-y-2">
                {paidRoutes.slice(0, 6).map((route) => (
                  <div key={route.id} className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{route.estudio}</p>
                        <p className="mt-1 text-xs text-slate-500">{route.direccion || 'Sin direccion'}</p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                        {getTurnoLabel(route)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Todavia no hay ninguna parada pasada a pagada.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
