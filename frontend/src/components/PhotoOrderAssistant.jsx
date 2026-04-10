import { useState } from 'react';
import Tesseract from 'tesseract.js';
import { Camera, Loader2, ScanText, Sparkles } from 'lucide-react';
import api from '../api/client';

function buildReadableText(resultado) {
  const pedido = resultado?.pedido || {};
  const lines = [];

  lines.push(`Resumen: ${resultado?.resumen || 'Pedido detectado desde imagen'}`);
  if (pedido.cliente_nombre) lines.push(`Cliente: ${pedido.cliente_nombre}`);
  if (pedido.cliente_telefono) lines.push(`Telefono: ${pedido.cliente_telefono}`);
  if (pedido.cliente_email) lines.push(`Email: ${pedido.cliente_email}`);
  if (pedido.cliente_direccion || pedido.cliente_cp) lines.push(`Direccion: ${(pedido.cliente_direccion || '').trim()} ${(pedido.cliente_cp || '').trim()}`.trim());
  if (pedido.tipo_documento) lines.push(`Documento: ${pedido.tipo_documento}`);
  if (pedido.metodo_envio) lines.push(`Entrega: ${pedido.metodo_envio}`);
  if (typeof pedido.descuento === 'number') lines.push(`Descuento: ${pedido.descuento}%`);
  if (pedido.notas) lines.push(`Notas: ${pedido.notas}`);

  if (pedido.items?.length) {
    lines.push('Productos:');
    pedido.items.forEach((item) => lines.push(`- ${item.cantidad || 1} x ${item.producto_nombre}`));
  }

  return lines.join('\n');
}

export default function PhotoOrderAssistant({ onResultado }) {
  const [ocrText, setOcrText] = useState('');
  const [orderedText, setOrderedText] = useState('');
  const [loadingOcr, setLoadingOcr] = useState(false);
  const [loadingIa, setLoadingIa] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setOrderedText('');
    setLoadingOcr(true);

    try {
      const result = await Tesseract.recognize(file, 'spa+eng');
      setOcrText(result.data.text.replace(/\n{3,}/g, '\n\n').trim());
    } catch (err) {
      setError(`No he podido leer la foto. ${err.message}`);
    } finally {
      setLoadingOcr(false);
    }
  }

  async function ordenarConIA() {
    if (!ocrText.trim()) return;
    setError('');
    setLoadingIa(true);

    try {
      const r = await api.post('/ia/interpretar', { texto: ocrText });
      setOrderedText(buildReadableText(r.data));
      onResultado?.(r.data);
    } catch (err) {
      setError(err.response?.data?.error || 'No he podido ordenar el texto con IA');
    } finally {
      setLoadingIa(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-atomx-500">
            <Camera size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">Foto a pedido limpio</p>
            <p className="text-sm text-slate-500">Sube una foto de nota, lista o pedido y te lo dejo reescrito para tienda.</p>
          </div>
        </div>

        <label className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium cursor-pointer hover:bg-slate-800">
          <Camera size={15} /> Hacer foto
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
        </label>
      </div>

      {loadingOcr && (
        <div className="card flex items-center gap-2 text-sm text-slate-600">
          <Loader2 size={16} className="animate-spin text-atomx-500" /> Leyendo texto de la imagen...
        </div>
      )}

      {error && <div className="card text-sm text-red-600">{error}</div>}

      {ocrText && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-800">Texto detectado</p>
            <button onClick={ordenarConIA} disabled={loadingIa} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {loadingIa ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              Ordenar con IA
            </button>
          </div>
          <textarea value={ocrText} onChange={(e) => setOcrText(e.target.value)} className="input h-40 resize-none font-mono text-sm" />
        </div>
      )}

      {orderedText && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <ScanText size={16} className="text-atomx-500" />
            <p className="text-sm font-semibold text-slate-800">Texto ordenado para tienda</p>
          </div>
          <textarea value={orderedText} onChange={(e) => setOrderedText(e.target.value)} className="input h-48 resize-none text-sm leading-relaxed" />
        </div>
      )}
    </div>
  );
}
