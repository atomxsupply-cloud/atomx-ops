import { useState } from 'react';
import Tesseract from 'tesseract.js';
import { Camera, Loader2, ReceiptText, Wand2 } from 'lucide-react';

function parseNumber(raw) {
  const cleaned = String(raw || '')
    .replace(/[Oo]/g, '0')
    .replace(/[^0-9,.\-]/g, '')
    .replace(/\.(?=.*\.)/g, '')
    .replace(',', '.');
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function findValue(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = parseNumber(match[1]);
      if (value != null) return value;
    }
  }
  return null;
}

function extractCajaData(text) {
  const normalized = String(text || '')
    .toLowerCase()
    .replace(/[€eur]/g, ' ')
    .replace(/\s+/g, ' ');

  return {
    manana_cierre: findValue(normalized, [
      /manana[^0-9]{0,18}cierre[^0-9]{0,8}([0-9.,-]+)/,
      /cierre manana[^0-9]{0,8}([0-9.,-]+)/,
      /efectivo manana[^0-9]{0,8}([0-9.,-]+)/,
    ]),
    ajuste_factusol: findValue(normalized, [
      /factusol[^0-9]{0,12}(?:resta|ajuste|salida)?[^0-9]{0,8}([0-9.,-]+)/,
      /resta[^0-9]{0,12}factusol[^0-9]{0,8}([0-9.,-]+)/,
    ]),
    tarde_apertura: findValue(normalized, [
      /apertura tarde[^0-9]{0,8}([0-9.,-]+)/,
      /tarde[^0-9]{0,12}apertura[^0-9]{0,8}([0-9.,-]+)/,
    ]),
    tarde_cierre: findValue(normalized, [
      /cierre tarde[^0-9]{0,8}([0-9.,-]+)/,
      /tarde[^0-9]{0,12}cierre[^0-9]{0,8}([0-9.,-]+)/,
      /total caja[^0-9]{0,8}([0-9.,-]+)/,
    ]),
  };
}

function buildSummary(data) {
  const lines = [];
  if (data.manana_cierre != null) lines.push(`Cierre manana: ${data.manana_cierre.toFixed(2)} EUR`);
  if (data.ajuste_factusol != null) lines.push(`Ajuste Factusol: ${data.ajuste_factusol.toFixed(2)} EUR`);
  if (data.tarde_apertura != null) lines.push(`Apertura tarde: ${data.tarde_apertura.toFixed(2)} EUR`);
  if (data.tarde_cierre != null) lines.push(`Cierre tarde: ${data.tarde_cierre.toFixed(2)} EUR`);
  return lines.length ? lines.join('\n') : 'No he detectado importes claros. Puedes corregirlos abajo.';
}

export default function PhotoCajaAssistant({ onApply }) {
  const [ocrText, setOcrText] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setSummary('');

    try {
      const result = await Tesseract.recognize(file, 'spa+eng');
      const text = result.data.text.replace(/\n{3,}/g, '\n\n').trim();
      setOcrText(text);
      const extracted = extractCajaData(text);
      setSummary(buildSummary(extracted));
    } catch (err) {
      setError(`No he podido leer la foto. ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function applyDetectedData() {
    setApplying(true);
    try {
      const extracted = extractCajaData(ocrText);
      onApply?.(extracted);
      setSummary(buildSummary(extracted));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-atomx-500">
            <ReceiptText size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800">Foto a caja</p>
            <p className="text-sm text-slate-500">Haz una foto al apunte y te saco cierres, apertura de tarde y ajuste Factusol.</p>
          </div>
        </div>

        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
          <Camera size={15} /> Hacer foto
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
        </label>
      </div>

      {loading ? (
        <div className="card flex items-center gap-2 text-sm text-slate-600">
          <Loader2 size={16} className="animate-spin text-atomx-500" /> Leyendo importes de la foto...
        </div>
      ) : null}

      {error ? <div className="card text-sm text-red-600">{error}</div> : null}

      {ocrText ? (
        <div className="card space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-800">Texto detectado</p>
            <button onClick={applyDetectedData} disabled={applying} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {applying ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
              Pasar a caja
            </button>
          </div>
          <textarea value={ocrText} onChange={(e) => setOcrText(e.target.value)} className="input h-40 resize-none font-mono text-sm" />
        </div>
      ) : null}

      {summary ? (
        <div className="card space-y-2">
          <p className="text-sm font-semibold text-slate-800">Lectura rapida</p>
          <textarea value={summary} readOnly className="input h-28 resize-none text-sm leading-relaxed" />
        </div>
      ) : null}
    </div>
  );
}
