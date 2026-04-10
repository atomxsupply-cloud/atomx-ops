import { useState } from 'react';
import { AlertTriangle, Bug, Camera, Loader2, Mic, MicOff, Wrench, X } from 'lucide-react';
import html2canvas from 'html2canvas';
import api from '../api/client';
import { useFloatingPosition } from '../utils/floating.js';
import { useAuth } from '../context/AuthContext';

const WORKERS = [
  { value: 'Juanfran', label: 'Juanfran', classes: 'bg-emerald-500 text-white' },
  { value: 'Juanje', label: 'Juanje', classes: 'bg-sky-500 text-white' },
  { value: 'Papi', label: 'Papi', classes: 'bg-orange-500 text-white' },
  { value: 'Maria', label: 'Maria', classes: 'bg-pink-500 text-white' },
  { value: 'Lida', label: 'Lida', classes: 'bg-fuchsia-500 text-white' },
];

export default function AppReportWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [trabajador, setTrabajador] = useState('Juanfran');
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [captura, setCaptura] = useState('');
  const { position, startDrag } = useFloatingPosition('atomx-floating-report', { x: 96, y: 18 });
  const isJuanfran = String(user?.nombre || '').toLowerCase().includes('juanfran');

  function toggleMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('Tu navegador no soporta dictado por voz. Usa Chrome.');
      return;
    }

    if (grabando) {
      setGrabando(false);
      return;
    }

    const r = new SR();
    r.lang = 'es-ES';
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setTexto((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    r.onerror = () => setGrabando(false);
    r.onend = () => setGrabando(false);
    r.start();
    setGrabando(true);
  }

  async function guardar() {
    if (!texto.trim() || loading) return;
    setLoading(true);
    try {
      const r = await api.post('/ia/reporte-app', { trabajador, texto: texto.trim(), screenshot: captura || null });
      setResultado(r.data);
      setTexto('');
      setCaptura('');
    } catch (err) {
      setResultado({ error: err.response?.data?.error || 'No he podido guardar el reporte' });
    } finally {
      setLoading(false);
    }
  }

  async function capturarPantalla() {
    try {
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        backgroundColor: '#f8fafc',
        scale: 1,
        logging: false,
      });
      setCaptura(canvas.toDataURL('image/png'));
    } catch {
      setResultado({ error: 'No he podido sacar la captura ahora mismo' });
    }
  }

  return (
    <>
      {open && (
        <>
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-[1px] z-40" onClick={() => setOpen(false)} />
          <div className="fixed bottom-24 right-24 z-50 w-[calc(100vw-3rem)] max-w-[430px] h-[min(76vh,680px)]">
            <div className="h-full bg-white border border-red-100 shadow-2xl rounded-3xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-white">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/25">
                    <Bug size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">Mejoras de app</p>
                    <p className="text-xs text-slate-500 truncate">Reportar lo que falla o falta</p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 min-h-0 p-4 bg-slate-50/60 overflow-y-auto space-y-4">
                <p className="text-sm text-slate-600">
                  Aqui pueden decir por voz o escrito lo que le falta a la app o lo que va mal. Yo te lo ordeno para retomarlo luego.
                </p>

                <div className="flex flex-wrap gap-2">
                  {WORKERS.map((item) => (
                    <button
                      key={item.value}
                      onClick={() => setTrabajador(item.value)}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${trabajador === item.value ? item.classes : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={toggleMic}
                    className={`px-3 rounded-lg transition-colors flex-shrink-0 ${grabando ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    title="Dictar reporte"
                  >
                    {grabando ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder="Ejemplo: acho, en rutas se queda blanca cuando Maria entra o falta ordenar mejor las tareas..."
                    className="input h-32 resize-none flex-1 text-base leading-relaxed"
                  />
                </div>

                <div className="flex justify-end">
                  <div className="flex gap-2">
                    {isJuanfran ? (
                      <button
                        onClick={capturarPantalla}
                        type="button"
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                      >
                        <Camera size={15} /> Pantallazo
                      </button>
                    ) : null}
                    <button onClick={guardar} disabled={loading || !texto.trim()} className="btn-primary disabled:opacity-40 inline-flex items-center gap-2">
                      {loading ? <Loader2 size={15} className="animate-spin" /> : <Wrench size={15} />}
                      Guardar mejora
                    </button>
                  </div>
                </div>

                {captura ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Captura preparada</p>
                    <img src={captura} alt="Captura de pantalla del reporte" className="w-full rounded-xl border border-slate-200" />
                  </div>
                ) : null}

                {resultado && !resultado.error && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-800">Reporte guardado</span>
                      <span className="text-xs text-slate-500">{resultado.archivo}</span>
                    </div>
                    {resultado.captura ? (
                      <p className="text-xs text-slate-500">Captura guardada: {resultado.captura}</p>
                    ) : null}
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Resumen</p>
                      <p className="text-sm text-slate-700">{resultado.organizado?.resumen}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Acciones sugeridas</p>
                      <div className="space-y-2">
                        {(resultado.organizado?.acciones || []).map((accion, index) => (
                          <div key={index} className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-700">
                            {accion}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {resultado?.error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {resultado.error}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <button
        onClick={() => setOpen((value) => !value)}
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        className="fixed z-50 group touch-none"
        style={{ right: `${position.x}px`, bottom: `${position.y}px` }}
        aria-label="Reportar mejora o error"
      >
        <div className="relative flex items-center justify-center w-14 h-14 rounded-[1.2rem] bg-red-500 text-white shadow-xl shadow-red-500/30 transition-transform duration-200 group-hover:scale-105">
          <span className="absolute inset-0 rounded-[1.2rem] border border-white/20" />
          <AlertTriangle size={20} className="absolute opacity-95" />
        </div>
      </button>
    </>
  );
}
