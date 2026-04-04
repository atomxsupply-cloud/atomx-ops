import { useState, useRef } from 'react';
import api from '../api/client';
import { Sparkles, Loader2, CheckCircle2, AlertCircle, Mic, MicOff } from 'lucide-react';

const ASIGNADO_LABEL = { juanje: 'Juanje', papi: 'Papi', juanfran: 'Juanfran' };

export default function InputIA({ onResultado, placeholder }) {
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);
  const [grabando, setGrabando] = useState(false);
  const recognitionRef = useRef(null);

  function toggleMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Tu navegador no soporta dictado por voz. Usa Chrome.'); return; }

    if (grabando) {
      recognitionRef.current?.stop();
      setGrabando(false);
      return;
    }

    const r = new SR();
    r.lang = 'es-ES';
    r.continuous = false;
    r.interimResults = false;
    r.onresult = e => {
      const transcript = e.results[0][0].transcript;
      setTexto(prev => prev ? prev + ' ' + transcript : transcript);
    };
    r.onerror = () => setGrabando(false);
    r.onend = () => setGrabando(false);
    r.start();
    recognitionRef.current = r;
    setGrabando(true);
  }

  async function interpretar() {
    if (!texto.trim()) return;
    setLoading(true);
    setError('');
    setResultado(null);
    try {
      const r = await api.post('/ia/interpretar', { texto });
      setResultado(r.data);
      if (onResultado) onResultado(r.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al interpretar');
    } finally {
      setLoading(false);
    }
  }

  const confianzaColor = { alta: 'text-green-600', media: 'text-yellow-600', baja: 'text-red-500' };

  return (
    <div className="space-y-3">
      <div className="relative">
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) interpretar(); }}
          className="input h-36 resize-none pr-24 text-base leading-relaxed"
          placeholder={placeholder || 'Escribe o dicta el mensaje del equipo...'}
        />
        <div className="absolute bottom-3 right-3 flex gap-1.5">
          <button
            onClick={toggleMic}
            className={`p-2 rounded-lg transition-colors ${grabando ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            title="Dictar por voz"
          >
            {grabando ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
          <button
            onClick={interpretar}
            disabled={loading || !texto.trim()}
            className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3 disabled:opacity-40"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {loading ? 'Leyendo...' : 'Interpretar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {resultado && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-500" />
            <span className="text-sm font-medium text-slate-700">Detectado: <span className="capitalize">{resultado.tipo}</span></span>
            <span className={`text-xs ml-auto ${confianzaColor[resultado.confianza]}`}>
              confianza {resultado.confianza}
            </span>
          </div>

          <p className="text-sm text-slate-600 bg-white rounded-lg px-3 py-2 border border-slate-100">
            {resultado.resumen}
          </p>

          {resultado.pedido?.items?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Productos detectados</p>
              <div className="space-y-1">
                {resultado.pedido.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-white rounded px-3 py-1.5 border border-slate-100">
                    <span className="text-atomx-500 font-medium">×{item.cantidad}</span>
                    <span className="text-slate-700">{item.producto_nombre}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {resultado.pedido?.cliente_nombre && (
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Cliente</p>
              <div className="bg-white rounded-lg px-3 py-2 border border-slate-100 text-sm space-y-0.5">
                <p className="font-medium text-slate-700">{resultado.pedido.cliente_nombre}</p>
                {resultado.pedido.cliente_dni && <p className="text-slate-500">DNI: {resultado.pedido.cliente_dni}</p>}
                {resultado.pedido.cliente_email && <p className="text-slate-500">{resultado.pedido.cliente_email}</p>}
                {resultado.pedido.cliente_telefono && <p className="text-slate-500">Tel: {resultado.pedido.cliente_telefono}</p>}
                {resultado.pedido.cliente_direccion && <p className="text-slate-500">{resultado.pedido.cliente_direccion} {resultado.pedido.cliente_cp}</p>}
              </div>
            </div>
          )}

          {resultado.tareas?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Tareas detectadas</p>
              {resultado.tareas.map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-sm bg-white rounded px-3 py-1.5 border border-slate-100">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.prioridad === 'alta' ? 'bg-red-400' : t.prioridad === 'baja' ? 'bg-slate-300' : 'bg-blue-400'}`} />
                  <span className="flex-1">{t.titulo}</span>
                  {t.asignado_a && (
                    <span className="text-xs bg-atomx-100 text-atomx-700 px-2 py-0.5 rounded-full">
                      {ASIGNADO_LABEL[t.asignado_a] || t.asignado_a}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {resultado.nota && (
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Nota</p>
              <p className="text-sm bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2 text-slate-700">{resultado.nota}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
