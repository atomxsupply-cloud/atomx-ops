import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Loader2, Mic, MicOff, Plus, RotateCcw, Send, Sparkles, User } from 'lucide-react';
import api from '../api/client';
import InputIA from './InputIA';

const WORKERS = [
  { value: 'Juanfran', label: 'Juanfran', classes: 'bg-emerald-500 text-white' },
  { value: 'Juanje', label: 'Juanje', classes: 'bg-sky-500 text-white' },
  { value: 'Papi', label: 'Papi', classes: 'bg-orange-500 text-white' },
  { value: 'Maria', label: 'Maria', classes: 'bg-pink-500 text-white' },
  { value: 'Lida', label: 'Lida', classes: 'bg-fuchsia-500 text-white' },
];

function extractQuickReplies(texto = '') {
  const textoPlano = String(texto || '').replace(/\n+/g, ' ').trim();
  const matches = [...textoPlano.matchAll(/(?:^|\s)(\d+)[\.\)]\s+(.+?)(?=(?:\s+\d+[\.\)]\s+)|$)/g)];
  return matches.map((match) => match[2].trim()).filter(Boolean).slice(0, 3);
}

export default function AssistantPanel({ compact = false, onClose }) {
  const [tab, setTab] = useState('chat');
  const [mensajes, setMensajes] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [grabando, setGrabando] = useState(false);
  const [worker, setWorker] = useState('Juanfran');
  const [workerInput, setWorkerInput] = useState('');
  const [workerLoading, setWorkerLoading] = useState(false);
  const [workerResult, setWorkerResult] = useState(null);
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, loading]);

  useEffect(() => {
    async function loadHistory() {
      setLoadingHistory(true);
      try {
        const r = await api.get('/ia/historial');
        const items = (r.data?.items || []).map((item) => ({
          rol: item.rol === 'assistant' ? 'bot' : 'user',
          texto: item.mensaje,
        }));
        setMensajes(items.length ? items : [
          { rol: 'bot', texto: 'Acho, ya estoy por aqui. Dime que necesitas y sigo el hilo contigo.' },
        ]);
      } catch {
        setMensajes([
          { rol: 'bot', texto: 'Acho, ya estoy por aqui. Dime que necesitas y sigo el hilo contigo.' },
        ]);
      } finally {
        setLoadingHistory(false);
      }
    }
    loadHistory();
  }, []);

  function toggleMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('Tu navegador no soporta dictado por voz. Usa Chrome.');
      return;
    }

    if (grabando) {
      recognitionRef.current?.stop();
      setGrabando(false);
      return;
    }

    const r = new SR();
    r.lang = 'es-ES';
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    r.onerror = () => setGrabando(false);
    r.onend = () => setGrabando(false);
    r.start();
    recognitionRef.current = r;
    setGrabando(true);
  }

  function toggleWorkerMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('Tu navegador no soporta dictado por voz. Usa Chrome.');
      return;
    }

    if (grabando) {
      recognitionRef.current?.stop();
      setGrabando(false);
      return;
    }

    const r = new SR();
    r.lang = 'es-ES';
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setWorkerInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    r.onerror = () => setGrabando(false);
    r.onend = () => setGrabando(false);
    r.start();
    recognitionRef.current = r;
    setGrabando(true);
  }

  async function enviar() {
    if (!input.trim() || loading) return;

    const pregunta = input.trim();
    setInput('');
    setMensajes((prev) => [...prev, { rol: 'user', texto: pregunta }]);
    setLoading(true);

    try {
      const r = await api.post('/ia/preguntar', { pregunta });
      setMensajes((prev) => [...prev, { rol: 'bot', texto: r.data.respuesta }]);
    } catch (err) {
      setMensajes((prev) => [
        ...prev,
        { rol: 'bot', texto: `No he podido responder ahora. ${err.response?.data?.error || 'Prueba otra vez.'}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function enviarAccionRapida(texto) {
    if (!texto || loading) return;
    setInput('');
    setMensajes((prev) => [...prev, { rol: 'user', texto }]);
    setLoading(true);

    try {
      const r = await api.post('/ia/preguntar', { pregunta: texto });
      setMensajes((prev) => [...prev, { rol: 'bot', texto: r.data.respuesta }]);
    } catch (err) {
      setMensajes((prev) => [
        ...prev,
        { rol: 'bot', texto: `No he podido responder ahora. ${err.response?.data?.error || 'Prueba otra vez.'}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function resetHistory() {
    try {
      await api.delete('/ia/historial');
      setMensajes([{ rol: 'bot', texto: 'Listo, te he limpiado la memoria de esta conversacion. Empezamos de nuevo cuando quieras.' }]);
    } catch {
      setMensajes((prev) => [...prev, { rol: 'bot', texto: 'No he podido limpiar la memoria ahora mismo.' }]);
    }
  }

  function handleResultado(resultado) {
    if (resultado.tipo === 'pedido' || resultado.tipo === 'mixto') {
      sessionStorage.setItem('pedido_ia', JSON.stringify(resultado.pedido));
      navigate('/pedidos?desde_ia=1');
      onClose?.();
    }
  }

  async function guardarAccionTrabajador() {
    if (!workerInput.trim() || workerLoading) return;

    setWorkerLoading(true);
    try {
      const r = await api.post('/ia/accion-trabajador', {
        trabajador: worker,
        texto: workerInput.trim(),
      });
      setWorkerResult(r.data);
      setWorkerInput('');
    } catch (err) {
      setWorkerResult({
        error: err.response?.data?.error || 'No he podido guardar la nota del trabajador',
      });
    } finally {
      setWorkerLoading(false);
    }
  }

  return (
    <div className={`flex flex-col ${compact ? 'h-full' : 'space-y-4 max-w-3xl'}`}>
      {!compact && (
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Sparkles size={22} className="text-atomx-500" /> Asistente IA
          </h1>
          <p className="text-slate-500 text-sm">Cerebro entrenado con historial, catalogo y conocimiento de tatuaje</p>
        </div>
      )}

      <div className={`flex gap-1 bg-slate-100 rounded-lg p-1 ${compact ? 'w-full' : 'w-fit'}`}>
        <button
          onClick={() => setTab('chat')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'chat' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Chat
        </button>
        <button
          onClick={() => setTab('parser')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'parser' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Pedido
        </button>
        <button
          onClick={() => setTab('acciones')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'acciones' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Acciones
        </button>
      </div>

      {tab === 'chat' && (
        <div className={`card flex flex-col ${compact ? 'flex-1 min-h-0 p-3' : 'h-[500px]'}`}>
          <div className="flex items-center justify-between gap-3 mb-3 border-b border-slate-100 pb-3">
            <p className="text-xs text-slate-500">
              Me acuerdo del hilo de cada persona para no perder contexto al responder.
            </p>
            <button
              onClick={resetHistory}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200"
            >
              <RotateCcw size={13} /> Reiniciar hilo
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
            {loadingHistory && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-atomx-500 flex items-center justify-center flex-shrink-0">
                  <Sparkles size={14} className="text-white" />
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5">
                  <Loader2 size={16} className="animate-spin text-slate-400" />
                </div>
              </div>
            )}

            {mensajes.map((m, i) => (
              <div key={i} className={`flex gap-2.5 ${m.rol === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${m.rol === 'bot' ? 'bg-atomx-500' : 'bg-slate-200'}`}>
                  {m.rol === 'bot' ? <Sparkles size={14} className="text-white" /> : <User size={14} className="text-slate-600" />}
                </div>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.rol === 'bot' ? 'bg-slate-50 border border-slate-100 text-slate-700' : 'bg-atomx-500 text-white'}`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.texto}</p>
                  {m.rol === 'bot' && extractQuickReplies(m.texto).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {extractQuickReplies(m.texto).map((opcion) => (
                        <button
                          key={opcion}
                          onClick={() => enviarAccionRapida(opcion)}
                          className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                        >
                          {opcion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-atomx-500 flex items-center justify-center flex-shrink-0">
                  <Sparkles size={14} className="text-white" />
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2.5">
                  <Loader2 size={16} className="animate-spin text-slate-400" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="flex gap-2 border-t border-slate-100 pt-3">
            <button
              onClick={toggleMic}
              className={`px-3 rounded-lg transition-colors flex-shrink-0 ${grabando ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              title="Dictar por voz"
            >
              {grabando ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && enviar()}
              placeholder={grabando ? 'Escuchando...' : 'Pregunta lo que necesites...'}
              className="input flex-1 text-base"
              disabled={loading}
            />
            <button onClick={enviar} disabled={loading || !input.trim()} className="btn-primary px-3 disabled:opacity-40">
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      {tab === 'parser' && (
        <div className={`card ${compact ? 'p-3' : ''}`}>
          <p className="text-sm text-slate-500 mb-4">
            Pega un mensaje libre y lo convierto en pedido estructurado para el equipo.
          </p>
          <InputIA
            onResultado={handleResultado}
            placeholder={`Ejemplo:\n\nfactura para Alberto Sanchez\n3 cajas kwadron 9RL 0.30\n2 cajas bishop 5RL 0.25\nenvio a Murcia`}
          />
          {sessionStorage.getItem('pedido_ia') && (
            <div className="mt-4 flex items-center gap-2">
              <button onClick={() => navigate('/pedidos?desde_ia=1')} className="btn-primary flex items-center gap-1.5">
                <Plus size={15} /> Crear este pedido
              </button>
              <span className="text-xs text-slate-400">Abrira el formulario pre-rellenado</span>
            </div>
          )}
        </div>
      )}

      {tab === 'acciones' && (
        <div className={`card ${compact ? 'p-3' : ''} space-y-4`}>
          <div>
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <ClipboardList size={18} className="text-atomx-500" /> Acciones trabajadores necesarias
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Aqui pueden dejar notas o problemas por voz o texto. Yo lo ordeno, lo guardo en carpeta y te propongo acciones.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {WORKERS.map((item) => (
              <button
                key={item.value}
                onClick={() => setWorker(item.value)}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${worker === item.value ? item.classes : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={toggleWorkerMic}
              className={`px-3 rounded-lg transition-colors flex-shrink-0 ${grabando ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              title="Dictar incidencia"
            >
              {grabando ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <textarea
              value={workerInput}
              onChange={(e) => setWorkerInput(e.target.value)}
              placeholder="Ejemplo: acho, a Maria le faltan horarios de Benidorm y no sabe por donde empezar..."
              className="input h-28 resize-none flex-1"
            />
          </div>

          <div className="flex justify-end">
            <button onClick={guardarAccionTrabajador} disabled={workerLoading || !workerInput.trim()} className="btn-primary disabled:opacity-40">
              {workerLoading ? 'Guardando...' : 'Guardar y ordenar'}
            </button>
          </div>

          {workerResult && !workerResult.error && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-800">Guardado en carpeta</span>
                <span className="text-xs text-slate-500">{workerResult.archivo}</span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Resumen</p>
                <p className="text-sm text-slate-700">{workerResult.organizado?.resumen}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Problema</p>
                <p className="text-sm text-slate-700">{workerResult.organizado?.problema}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Acciones propuestas</p>
                <div className="space-y-2">
                  {(workerResult.organizado?.acciones || []).map((accion, index) => (
                    <div key={index} className="rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm text-slate-700">
                      {accion}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {workerResult?.error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {workerResult.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
