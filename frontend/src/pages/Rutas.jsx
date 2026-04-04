import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, MapPinned, Navigation, Search, UserRound } from 'lucide-react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../api/client';

const PERSON_COLORS = {
  Juanfran: '#2563eb',
  Juanje: '#16a34a',
  Papi: '#f97316',
  Maria: '#ec4899',
  Lida: '#d946ef',
};

const DEFAULT_CENTER = [37.9922, -1.1307];
const MURCIA_BOUNDS = [
  [37.35, -2.15],
  [38.85, -0.65],
];

const EMPTY_FORM = {
  estudio: '',
  direccion: '',
  hora: '',
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

export default function Rutas() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [users, setUsers] = useState([]);
  const [pendingRoutes, setPendingRoutes] = useState([]);
  const [paidRoutes, setPaidRoutes] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadAll() {
    setLoading(true);
    try {
      const [usersRes, pendingRes, paidRes] = await Promise.all([
        api.get('/auth/users'),
        api.get('/rutas?estado=pendiente'),
        api.get('/rutas?estado=pagado'),
      ]);
      setUsers(usersRes.data || []);
      setPendingRoutes(pendingRes.data?.rutas || []);
      setPaidRoutes(paidRes.data?.rutas || []);
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
      const hourA = String(a.hora || '99:99');
      const hourB = String(b.hora || '99:99');
      if (hourA !== hourB) return hourA.localeCompare(hourB);
      return String(a.estudio || '').localeCompare(String(b.estudio || ''));
    })
  ), [pendingRoutes]);

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

  async function saveRoute() {
    if (!form.estudio.trim() || saving) return;
    setSaving(true);
    try {
      await api.post('/rutas', {
        estudio: form.estudio.trim(),
        direccion: form.direccion.trim(),
        hora: form.hora || null,
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
            Escribe el estudio, te saco direccion sola, te la pongo en mapa y la asignas a quien la lleve.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-900 text-white px-4 py-3 text-sm font-medium">
          Pendientes: {pendingRoutes.length}
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
                <label className="label" htmlFor="ruta-hora">Hora</label>
                <input
                  id="ruta-hora"
                  name="ruta_hora"
                  type="time"
                  value={form.hora}
                  onChange={(e) => updateForm('hora', e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="ruta-asignado">Quien la lleva</label>
                <select
                  id="ruta-asignado"
                  name="ruta_asignado"
                  value={form.asignado_a}
                  onChange={(e) => updateForm('asignado_a', e.target.value)}
                  className="input"
                >
                  <option value="">Sin asignar</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.nombre}</option>
                  ))}
                </select>
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
                placeholder="Horario, persona de contacto, lo que haya que llevar..."
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
                            <p><strong>Hora:</strong> {route.hora || 'Sin hora'}</p>
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
            <div className="flex items-center gap-2 mb-4">
              <UserRound size={16} className="text-atomx-500" />
              <h2 className="text-sm font-semibold text-slate-800">Planning automatico</h2>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" /> Cargando rutas...
              </div>
            ) : orderedRoutes.length ? (
              <div className="space-y-2">
                {orderedRoutes.map((route) => {
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
                                <span className="text-xs text-slate-500">{route.hora || 'Sin hora'}</span>
                                <span className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-medium text-white" style={{ backgroundColor: badgeColor }}>
                                  {route.asignado_nombre || 'Sin asignar'}
                                </span>
                                <button
                                  onClick={() => markPaid(route.id)}
                                  className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 flex items-center justify-center"
                                  title="Marcar como pagado"
                                >
                                  <CheckCircle2 size={18} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No hay rutas pendientes ahora mismo.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
