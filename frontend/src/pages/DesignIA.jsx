import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Link2, Palette, RefreshCw, Save, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'atomx_design_tool_url';

function getDefaultDesignUrl() {
  if (typeof window === 'undefined') return 'http://127.0.0.1:3002';
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return 'http://127.0.0.1:3002';
  return 'https://design.atomxsupply.com';
}

export default function DesignIA() {
  const [draftUrl, setDraftUrl] = useState(getDefaultDesignUrl());
  const [toolUrl, setToolUrl] = useState(getDefaultDesignUrl());
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setDraftUrl(saved);
      setToolUrl(saved);
    }
  }, []);

  const cleanUrl = useMemo(() => String(toolUrl || '').trim(), [toolUrl]);

  function saveUrl() {
    const value = String(draftUrl || '').trim();
    if (!value) return;
    localStorage.setItem(STORAGE_KEY, value);
    setToolUrl(value);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Design IA</h1>
          <p className="mt-1 text-sm text-slate-500">
            Herramienta interna de color y analisis para tatuaje integrada dentro de ATOM X OPS.
          </p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
          Dentro de OPS pero separada, para seguir mejorandola sin ensuciar el flujo diario.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Link2 size={15} />
            Conexion de la herramienta
          </div>
          <div className="flex flex-col gap-3 lg:flex-row">
            <input
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              className="input"
              placeholder="URL de atomx-design"
            />
            <button onClick={saveUrl} className="btn-primary inline-flex items-center justify-center gap-2 whitespace-nowrap">
              <Save size={15} />
              Guardar URL
            </button>
            <button onClick={() => setReloadKey((value) => value + 1)} className="btn inline-flex items-center justify-center gap-2 border border-slate-200 text-slate-700">
              <RefreshCw size={15} />
              Recargar
            </button>
            <a href={cleanUrl || '#'} target="_blank" rel="noreferrer" className="btn inline-flex items-center justify-center gap-2 border border-slate-200 text-slate-700">
              <ExternalLink size={15} />
              Abrir fuera
            </a>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Palette size={15} />
                Diseno
              </div>
              <p className="mt-2 text-xs text-slate-500">Pruebas de color, piel y referencias visuales desde movil o escritorio.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Sparkles size={15} />
                IA
              </div>
              <p className="mt-2 text-xs text-slate-500">La app ya queda preparada para seguir dándole cerebro y conectores sin sacarla de OPS.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Link2 size={15} />
                Conectores
              </div>
              <p className="mt-2 text-xs text-slate-500">Lista para enchufarla luego a clientes, Prestashop y Factusol cuando toque.</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Sparkles size={15} />
            Uso recomendado
          </div>
          <div className="space-y-2 text-sm text-slate-600">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">1. Abrir Design IA desde aqui y trabajar sin salir de OPS.</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">2. Si estas en local, usa normalmente `http://127.0.0.1:3002`.</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">3. Si la publicas luego, cambias la URL una vez y se queda guardada.</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">4. Mas adelante podremos pasar clientes, referencias y catalogo dentro de la propia herramienta.</div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Vista integrada</p>
            <p className="text-xs text-slate-500">{cleanUrl || 'Sin URL configurada'}</p>
          </div>
          <button onClick={() => setReloadKey((value) => value + 1)} className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600">
            Refrescar visor
          </button>
        </div>
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
          <iframe
            key={reloadKey}
            src={cleanUrl}
            title="Design IA"
            className="h-[78vh] min-h-[720px] w-full bg-white"
          />
        </div>
      </div>
    </div>
  );
}
