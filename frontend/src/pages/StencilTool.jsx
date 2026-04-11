import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, Printer, Download, ZoomIn, ZoomOut,
  RotateCcw, Maximize2, Sliders, ChevronDown, ChevronUp,
  Scissors,
} from 'lucide-react';

// ─── Image processing helpers ────────────────────────────────────────────────

function toGray(src, brightness, contrast) {
  const cf = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    let r = Math.min(255, Math.max(0, src[i]   + brightness));
    let g = Math.min(255, Math.max(0, src[i+1] + brightness));
    let b = Math.min(255, Math.max(0, src[i+2] + brightness));
    r = Math.min(255, Math.max(0, cf * (r - 128) + 128));
    g = Math.min(255, Math.max(0, cf * (g - 128) + 128));
    b = Math.min(255, Math.max(0, cf * (b - 128) + 128));
    const v = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    out[i] = out[i+1] = out[i+2] = v;
    out[i+3] = 255;
  }
  return out;
}

function boxBlur(data, w, h, r) {
  const rad = Math.round(r);
  if (rad < 1) return data;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0, cnt = 0;
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            sum += data[(ny * w + nx) * 4]; cnt++;
          }
        }
      }
      const idx = (y * w + x) * 4, v = Math.round(sum / cnt);
      out[idx] = out[idx+1] = out[idx+2] = v; out[idx+3] = 255;
    }
  }
  return out;
}

function sobelEdge(data, w, h) {
  const out = new Uint8ClampedArray(data.length);
  const Kx = [-1,0,1,-2,0,2,-1,0,1];
  const Ky = [-1,-2,-1, 0,0,0, 1,2,1];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let gx = 0, gy = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const v = data[((y + ky) * w + (x + kx)) * 4];
          const ki = (ky + 1) * 3 + (kx + 1);
          gx += Kx[ki] * v; gy += Ky[ki] * v;
        }
      }
      const mag = Math.min(255, Math.sqrt(gx * gx + gy * gy));
      const idx = (y * w + x) * 4;
      out[idx] = out[idx+1] = out[idx+2] = mag; out[idx+3] = 255;
    }
  }
  return out;
}

// Morphological dilation: expands dark (line) pixels
function dilate(data, w, h, r) {
  if (r < 1) return data;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let minV = 255;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h)
            minV = Math.min(minV, data[(ny * w + nx) * 4]);
        }
      }
      const idx = (y * w + x) * 4;
      out[idx] = out[idx+1] = out[idx+2] = minV; out[idx+3] = 255;
    }
  }
  return out;
}

function processFrame(imgData, params, mode) {
  const { width: w, height: h, data: src } = imgData;

  if (mode === 'original') return new ImageData(new Uint8ClampedArray(src), w, h);

  const gray = toGray(src, params.brightness, params.contrast);
  if (mode === 'gray') return new ImageData(gray, w, h);

  if (mode === 'highcontrast') {
    const hcf = (259 * (80 + 255)) / (255 * (259 - 80));
    const hc = new Uint8ClampedArray(gray.length);
    for (let i = 0; i < gray.length; i += 4) {
      const v = Math.min(255, Math.max(0, hcf * (gray[i] - 128) + 128));
      hc[i] = hc[i+1] = hc[i+2] = v; hc[i+3] = 255;
    }
    return new ImageData(hc, w, h);
  }

  // stencil / clean
  const blurred = boxBlur(gray, w, h, params.blur);
  const edges   = sobelEdge(blurred, w, h);
  const ew      = params.edgeIntensity / 100;

  const raw = new Uint8ClampedArray(gray.length);
  for (let i = 0; i < blurred.length; i += 4) {
    const thresh = blurred[i] < params.threshold ? 0 : 255;
    const combined = Math.max(0, thresh - edges[i] * ew);
    raw[i] = raw[i+1] = raw[i+2] = combined < 128 ? 0 : 255;
    raw[i+3] = 255;
  }

  const thick  = dilate(raw, w, h, params.lineThickness);
  const smooth = boxBlur(thick, w, h, params.smoothing * 0.6);

  if (mode === 'clean') {
    const clean = new Uint8ClampedArray(smooth.length);
    for (let i = 0; i < smooth.length; i += 4) {
      const v = smooth[i] < 128 ? 0 : 255;
      clean[i] = clean[i+1] = clean[i+2] = v; clean[i+3] = 255;
    }
    return new ImageData(clean, w, h);
  }

  return new ImageData(smooth, w, h);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_PREVIEW_PX = 900; // working canvas size for fast preview

function fitSize(w, h, max) {
  if (w <= max && h <= max) return { w, h };
  const r = Math.min(max / w, max / h);
  return { w: Math.round(w * r), h: Math.round(h * r) };
}

const PRESETS = {
  soft:    { threshold: 145, contrast: 20, brightness:  5, blur: 1, edgeIntensity: 30, lineThickness: 1, smoothing: 1 },
  hard:    { threshold: 100, contrast: 45, brightness:  0, blur: 0, edgeIntensity: 70, lineThickness: 2, smoothing: 0 },
  thin:    { threshold: 130, contrast: 30, brightness:  0, blur: 1, edgeIntensity: 80, lineThickness: 0, smoothing: 1 },
  marked:  { threshold: 110, contrast: 35, brightness: -5, blur: 0, edgeIntensity: 55, lineThickness: 3, smoothing: 0 },
};

const PRESET_LABELS = { soft: 'Suave', hard: 'Duro', thin: 'Fino', marked: 'Marcado' };

const DEFAULT_PARAMS = {
  threshold: 128, contrast: 25, brightness: 0,
  blur: 1, edgeIntensity: 50, lineThickness: 1, smoothing: 1,
};

const MODES = [
  { id: 'original',     label: 'Original'  },
  { id: 'gray',         label: 'Grises'    },
  { id: 'highcontrast', label: 'Contraste' },
  { id: 'stencil',      label: 'Stencil'   },
  { id: 'clean',        label: 'Limpio'    },
];

const SLIDERS = [
  { key: 'threshold',     label: 'Umbral',           min: 50,  max: 220, step: 1 },
  { key: 'contrast',      label: 'Contraste',        min: -50, max: 100, step: 1 },
  { key: 'brightness',    label: 'Brillo',           min: -80, max: 80,  step: 1 },
  { key: 'blur',          label: 'Reducir ruido',    min: 0,   max: 4,   step: 1 },
  { key: 'edgeIntensity', label: 'Bordes',           min: 0,   max: 100, step: 1 },
  { key: 'lineThickness', label: 'Grosor de linea',  min: 0,   max: 4,   step: 1 },
  { key: 'smoothing',     label: 'Suavizado',        min: 0,   max: 3,   step: 1 },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function StencilTool() {
  const [imageInfo, setImageInfo]   = useState(null); // { el, origW, origH, w, h }
  const [mode, setMode]             = useState('stencil');
  const [params, setParams]         = useState(DEFAULT_PARAMS);
  const [zoom, setZoom]             = useState(1);
  const [panOffset, setPanOffset]   = useState({ x: 0, y: 0 });
  const [panStart, setPanStart]     = useState(null);
  const [dragging, setDragging]     = useState(false);
  const [processing, setProcessing] = useState(false);
  const [ctrlOpen, setCtrlOpen]     = useState(true);

  const canvasRef     = useRef(null);
  const offscreenRef  = useRef(null); // offscreen canvas at preview resolution
  const origImgRef    = useRef(null); // original HTMLImageElement for HD export
  const fileInputRef  = useRef(null);
  const rafRef        = useRef(null);

  // ── Load image ──────────────────────────────────────────────────────────────
  function loadFile(file) {
    if (!file?.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      origImgRef.current = img;
      const { w, h } = fitSize(img.width, img.height, MAX_PREVIEW_PX);
      const oc = document.createElement('canvas');
      oc.width = w; oc.height = h;
      oc.getContext('2d').drawImage(img, 0, 0, w, h);
      offscreenRef.current = oc;
      setImageInfo({ origW: img.width, origH: img.height, w, h });
      setZoom(1);
      setPanOffset({ x: 0, y: 0 });
    };
    img.src = url;
  }

  // ── Render canvas ───────────────────────────────────────────────────────────
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const oc = offscreenRef.current;
    if (!canvas || !oc) return;
    setProcessing(true);
    const srcData = oc.getContext('2d').getImageData(0, 0, oc.width, oc.height);
    const result  = processFrame(srcData, params, mode);
    canvas.width  = oc.width;
    canvas.height = oc.height;
    canvas.getContext('2d').putImageData(result, 0, 0);
    setProcessing(false);
  }, [params, mode]);

  useEffect(() => {
    if (!imageInfo) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(renderCanvas);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [imageInfo, params, mode, renderCanvas]);

  // ── Drag & drop ─────────────────────────────────────────────────────────────
  function onDrop(e) { e.preventDefault(); setDragging(false); loadFile(e.dataTransfer.files[0]); }
  function onDragOver(e) { e.preventDefault(); setDragging(true); }

  // ── Pan ─────────────────────────────────────────────────────────────────────
  function onPointerDown(e) {
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!panStart) return;
    setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }
  function onPointerUp() { setPanStart(null); }

  // ── Controls ────────────────────────────────────────────────────────────────
  function setParam(key, val) { setParams(p => ({ ...p, [key]: val })); }

  function applyPreset(name) {
    setParams({ ...DEFAULT_PARAMS, ...PRESETS[name] });
    setMode('stencil');
  }

  function resetAll() {
    setParams(DEFAULT_PARAMS);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    setMode('stencil');
  }

  // ── Export / Print ──────────────────────────────────────────────────────────
  function getExportCanvas(whiteBg = false) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    if (!whiteBg) return canvas;
    const ec = document.createElement('canvas');
    ec.width = canvas.width; ec.height = canvas.height;
    const ctx = ec.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ec.width, ec.height);
    ctx.drawImage(canvas, 0, 0);
    return ec;
  }

  function exportPNG(whiteBg = false) {
    const ec = getExportCanvas(whiteBg);
    if (!ec) return;
    const a = document.createElement('a');
    a.download = `stencil-atomx-${Date.now()}.png`;
    a.href = ec.toDataURL('image/png');
    a.click();
  }

  function exportHighRes() {
    const img = origImgRef.current;
    if (!img) return;
    const fc = document.createElement('canvas');
    fc.width = img.width; fc.height = img.height;
    fc.getContext('2d').drawImage(img, 0, 0);
    const fullData = fc.getContext('2d').getImageData(0, 0, fc.width, fc.height);
    const result   = processFrame(fullData, params, mode === 'stencil' || mode === 'original' ? 'clean' : mode);
    const fc2 = document.createElement('canvas');
    fc2.width = img.width; fc2.height = img.height;
    const ctx2 = fc2.getContext('2d');
    ctx2.fillStyle = '#ffffff';
    ctx2.fillRect(0, 0, fc2.width, fc2.height);
    ctx2.putImageData(result, 0, 0);
    const a = document.createElement('a');
    a.download = `stencil-atomx-hd-${Date.now()}.png`;
    a.href = fc2.toDataURL('image/png');
    a.click();
  }

  function handlePrint() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // White background for print
    const pc = document.createElement('canvas');
    pc.width = canvas.width; pc.height = canvas.height;
    const ctx = pc.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pc.width, pc.height);
    ctx.drawImage(canvas, 0, 0);
    const dataUrl = pc.toDataURL('image/png');
    const w = window.open('', '_blank');
    if (!w) { alert('Permite popups para imprimir'); return; }
    w.document.write(`<!DOCTYPE html><html><head><title>Stencil ATOM X</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}
      body{background:#fff;display:flex;justify-content:center;align-items:flex-start;padding:10mm}
      img{max-width:100%;display:block;page-break-inside:avoid}
      @media print{body{padding:0}img{max-width:190mm;max-height:277mm}}
      </style></head><body>
      <img src="${dataUrl}" />
      <script>window.onload=()=>setTimeout(()=>window.print(),200)</script>
      </body></html>`);
    w.document.close();
  }

  const hasImage = !!imageInfo;
  const bgForMode = mode === 'clean' || mode === 'stencil' ? '#ffffff' : 'transparent';

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Scissors size={22} className="text-atomx-500" />
            Stencil Tool
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Convierte cualquier imagen en un stencil limpio listo para tatuar
          </p>
        </div>
        {hasImage && (
          <div className="flex flex-wrap gap-2">
            <button onClick={handlePrint} className="btn inline-flex items-center gap-2 border border-slate-200 text-slate-700">
              <Printer size={15} /> Imprimir
            </button>
            <button onClick={exportHighRes} className="btn-primary inline-flex items-center gap-2">
              <Download size={15} /> Exportar HD
            </button>
          </div>
        )}
      </div>

      {/* ── Mode tabs ── */}
      {hasImage && (
        <div className="flex gap-1 rounded-2xl bg-slate-100 p-1 overflow-x-auto no-scrollbar">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex-1 min-w-[62px] rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                mode === m.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Main grid ── */}
      <div className={`grid gap-4 ${hasImage ? 'lg:grid-cols-[1fr,300px]' : ''}`}>

        {/* ── Canvas area ── */}
        <div
          className={`relative rounded-3xl border-2 border-dashed overflow-hidden transition-colors ${
            dragging ? 'border-atomx-400 bg-atomx-50' : 'border-slate-200 bg-slate-50'
          }`}
          style={{ minHeight: hasImage ? '60vh' : '42vh' }}
          onDragOver={onDragOver}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          {!hasImage ? (
            /* Drop zone */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
              <div className="rounded-full bg-slate-200 p-5">
                <Upload size={28} className="text-slate-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-slate-700 text-lg">Sube tu imagen</p>
                <p className="text-sm text-slate-400 mt-1">Arrastra aqui o pulsa para seleccionar</p>
                <p className="text-xs text-slate-400 mt-0.5">JPG, PNG, WEBP</p>
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="btn-primary px-8">
                Elegir imagen
              </button>
            </div>
          ) : (
            /* Canvas with pan */
            <>
              <div
                className="absolute inset-0 flex items-center justify-center overflow-hidden"
                style={{ cursor: panStart ? 'grabbing' : 'grab', background: bgForMode }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
              >
                <canvas
                  ref={canvasRef}
                  style={{
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    display: 'block',
                    boxShadow: '0 2px 20px rgba(0,0,0,0.12)',
                    background: bgForMode,
                  }}
                />
              </div>

              {/* Processing badge */}
              {processing && (
                <div className="absolute top-3 left-3 rounded-full bg-slate-900/75 px-3 py-1 text-xs text-white backdrop-blur-sm">
                  Procesando…
                </div>
              )}

              {/* Zoom controls */}
              <div className="absolute bottom-3 left-3 flex items-center gap-1">
                <button onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))}
                  className="h-8 w-8 rounded-xl bg-white/95 border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm hover:bg-white">
                  <ZoomOut size={14} />
                </button>
                <button
                  onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }}
                  className="rounded-xl bg-white/95 border border-slate-200 px-2.5 h-8 text-xs font-mono text-slate-700 shadow-sm hover:bg-white min-w-[46px]">
                  {Math.round(zoom * 100)}%
                </button>
                <button onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))}
                  className="h-8 w-8 rounded-xl bg-white/95 border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm hover:bg-white">
                  <ZoomIn size={14} />
                </button>
                <button
                  onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }}
                  className="h-8 w-8 rounded-xl bg-white/95 border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm hover:bg-white"
                  title="Centrar">
                  <Maximize2 size={14} />
                </button>
              </div>

              {/* Change image */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute top-3 right-3 rounded-xl bg-white/95 border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-white">
                Cambiar imagen
              </button>
            </>
          )}
        </div>

        {/* ── Controls panel ── */}
        {hasImage && (
          <div className="space-y-3">

            {/* Presets */}
            <div className="card">
              <p className="label">Presets rapidos</p>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {Object.keys(PRESETS).map(name => (
                  <button
                    key={name}
                    onClick={() => applyPreset(name)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:border-atomx-400 hover:text-atomx-600 hover:bg-atomx-50 transition-colors"
                  >
                    {PRESET_LABELS[name]}
                  </button>
                ))}
              </div>
            </div>

            {/* Sliders */}
            <div className="card">
              <button
                className="flex w-full items-center justify-between"
                onClick={() => setCtrlOpen(o => !o)}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Sliders size={14} /> Ajustes
                </span>
                {ctrlOpen
                  ? <ChevronUp size={14} className="text-slate-400" />
                  : <ChevronDown size={14} className="text-slate-400" />}
              </button>

              {ctrlOpen && (
                <div className="mt-4 space-y-4">
                  {SLIDERS.map(({ key, label, min, max, step }) => (
                    <div key={key}>
                      <div className="flex justify-between mb-1">
                        <label className="label mb-0">{label}</label>
                        <span className="text-xs font-mono text-atomx-600 tabular-nums">{params[key]}</span>
                      </div>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={params[key]}
                        onChange={e => setParam(key, Number(e.target.value))}
                        className="w-full h-1.5 accent-atomx-500 cursor-pointer"
                      />
                    </div>
                  ))}

                  <button
                    onClick={resetAll}
                    className="btn w-full inline-flex items-center justify-center gap-2 border border-slate-200 text-slate-600"
                  >
                    <RotateCcw size={13} /> Resetear ajustes
                  </button>
                </div>
              )}
            </div>

            {/* Export */}
            <div className="card space-y-2">
              <p className="label">Exportar / Imprimir</p>
              <button onClick={handlePrint} className="btn w-full inline-flex items-center justify-center gap-2 border border-slate-200 text-slate-700">
                <Printer size={14} /> Imprimir
              </button>
              <button onClick={() => exportPNG(true)} className="btn w-full inline-flex items-center justify-center gap-2 border border-slate-200 text-slate-700">
                <Download size={14} /> PNG fondo blanco
              </button>
              <button onClick={exportHighRes} className="btn-primary w-full inline-flex items-center justify-center gap-2">
                <Download size={14} /> Exportar alta calidad
              </button>
            </div>

            {/* Image info */}
            <p className="text-center text-xs text-slate-400">
              {imageInfo.origW} × {imageInfo.origH} px &nbsp;·&nbsp; preview {imageInfo.w} × {imageInfo.h} px
            </p>
          </div>
        )}
      </div>

      {/* Hidden file input — single element reused everywhere */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { loadFile(e.target.files[0]); e.target.value = ''; }}
      />
    </div>
  );
}
