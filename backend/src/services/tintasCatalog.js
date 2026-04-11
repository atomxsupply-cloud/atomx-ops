const { db } = require('../db');
const { ensureConfig, getProducts } = require('./prestashop');
const fs = require('fs');
const path = require('path');

const ATOMX_SEARCH_BASE = 'https://www.atomxsupply.com/busqueda?controller=search&s=';
const CSV_CATALOG_PATH = path.join(__dirname, '..', '..', '..', 'datos', 'catalogo-web', 'product_2026-04-11_141642.csv');
const MAIN_INKS_JSON_PATH = path.join(__dirname, '..', '..', '..', 'datos', 'catalogo-web', 'catalogo_tintas_principales.json');

function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchUrl(name = '') {
  return `${ATOMX_SEARCH_BASE}${encodeURIComponent(String(name || '').trim())}`;
}

// Heuristica: queremos SOLO tintas (negra/blanca/color). Mejor filtrar por nombre
// antes que exponer todo el catalogo de PrestaShop.
function detectInkBrand(normalizedName = '') {
  const n = normalizedName;
  if (!n) return null;

  // Orden importa: "vice colors" antes que "vice"
  if (/\bvice\s+colors?\b/.test(n)) return 'VICE_COLORS';
  if (/\bhype\s+ink\b/.test(n)) return 'HYPE_INK';
  if (/\bdynamic\b/.test(n)) return 'DYNAMIC';
  if (/\ballegory\b/.test(n)) return 'ALLEGORY';
  if (/\beternal\b/.test(n)) return 'ETERNAL';
  if (/\bradiant\b/.test(n)) return 'RADIANT';
  if (/\bdermaglo\b/.test(n)) return 'DERMAGLO';
  if (/\bvice\b/.test(n)) return 'VICE';
  return null;
}

function detectInkBrandFromCategory(rawCategory = '', rawName = '') {
  const category = normalizeText(rawCategory);
  if (category === 'eternal ink') return 'ETERNAL';
  if (category === 'vice colors') return 'VICE_COLORS';
  if (category === 'radiant colors') return 'RADIANT';
  if (category === 'dynamic') return 'DYNAMIC';
  return detectInkBrand(normalizeText(rawName));
}

function isWhiteInk(normalizedName = '') {
  const n = normalizedName;
  // Blancos que quieres: super white (radiant), nuclear white, blancos de dynamic/vice/eternal
  return /\b(white|blanco|blanca)\b/.test(n) || /\b(nuclear\s+white|super\s+white|perfect\s+white)\b/.test(n);
}

function isBlackInk(normalizedName = '') {
  const n = normalizedName;
  // Negros + sets de gris (greywash) que son familia de negro
  return (
    /\b(black|negro|negra)\b/.test(n) ||
    /\b(lining|liner|outline|linea)\b/.test(n) ||
    /\b(triple|triple\s+black)\b/.test(n) ||
    /\b(greywash|graywash|grey\s+wash|gray\s+wash|wash)\b/.test(n) ||
    /\b(grey|gray|gris)\b/.test(n)
  );
}

function classifyInk(productName = '') {
  const n = normalizeText(productName);
  if (isWhiteInk(n)) return 'blanca';
  if (isBlackInk(n)) return 'negra';
  return 'color';
}

function parseCsvLine(line = '') {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ';' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => String(value || '').trim());
}

function loadCsvCatalogEntries() {
  if (!fs.existsSync(CSV_CATALOG_PATH)) return [];

  const raw = fs.readFileSync(CSV_CATALOG_PATH, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const idx = Object.fromEntries(headers.map((header, i) => [normalizeText(header), i]));
  const result = [];

  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const nombre = cols[idx['nombre']] || '';
    const referencia = cols[idx['referencia']] || '';
    const categoriaRaw = cols[idx['categoria']] || cols[idx['categoria a']] || '';
    const marca = detectInkBrandFromCategory(categoriaRaw, nombre);
    if (!nombre || !marca) continue;
    if (!looksLikeInk(nombre, categoriaRaw)) continue;

    result.push({
      nombre,
      categoria: classifyInk(nombre),
      marca,
      precio: Number(cols[idx['precio imp incl']] || cols[idx['precio imp incl ']] || 0),
      uso: '',
      stock: cols[idx['cantidad']] === '' ? null : Number(cols[idx['cantidad']]),
      activo: String(cols[idx['estado']] || '') !== '0',
      referencia,
      link: buildSearchUrl(nombre),
      source: 'catalogo_csv',
    });
  }

  return result;
}

function loadMainInkJsonEntries() {
  if (!fs.existsSync(MAIN_INKS_JSON_PATH)) return [];

  try {
    const parsed = JSON.parse(fs.readFileSync(MAIN_INKS_JSON_PATH, 'utf8'));
    return Object.entries(parsed || {}).flatMap(([brand, items]) =>
      (items || []).map((item) => ({
        nombre: item.nombre || '',
        categoria: item.tipo_tinta || classifyInk(item.nombre || ''),
        marca: brand || item.marca || 'OTRA',
        precio: Number(item.precio || 0),
        uso: '',
        stock: item.cantidad == null ? null : Number(item.cantidad),
        activo: String(item.estado || '') !== '0',
        referencia: item.referencia || '',
        link: buildSearchUrl(item.nombre || ''),
        source: 'catalogo_principal_json',
      }))
    ).filter((item) => item.nombre);
  } catch {
    return [];
  }
}

function looksLikeInk(productName = '', rawCategory = '') {
  const n = normalizeText(productName);
  if (!n) return false;

  // Excluir cosas obvias que no son tinta
  const excludes = [
    'aguja', 'agujas', 'needle', 'cartridge', 'cartucho', 'cartuchos',
    'grip', 'tubo', 'tubos', 'punta', 'tip', 'maquina', 'machine',
    'fuente', 'power', 'cable', 'clip cord', 'pedal',
    'guante', 'guantes', 'glove', 'mascarilla', 'mask',
    'vaselina', 'green soap', 'jab', 'jabón', 'jabon', 'spray',
    'film', 'wrap', 'tape', 'aftercare', 'crema', 'pomada',
    'desinfect', 'sanit', 'alcohol', 'alcoh',
    'transfer', 'stencil', 'papel', 'paper', 'calco',
    'mueble', 'camilla', 'taburete',
    'carro', 'mesa',
  ];
  if (excludes.some((token) => n.includes(token))) return false;

  // Si el nombre indica claramente que NO es tinta, fuera aunque tenga marca.
  // "set/pack" a veces son packs de tinta (greywash, etc.), asi que no los bloqueamos por defecto.
  const hardNonInk = ['kit', 'mueble', 'carro', 'mesa'];
  if (hardNonInk.some((token) => n.includes(token))) return false;

  const brand = detectInkBrandFromCategory(rawCategory, productName);
  if (!brand) return false;

  const categoria = classifyInk(productName);

  // Reglas EXACTAS (segun lo que has pedido)
  const allowedBlackBrands = new Set(['VICE_COLORS', 'HYPE_INK', 'DYNAMIC', 'ALLEGORY']);
  const allowedWhiteBrands = new Set(['RADIANT', 'DYNAMIC', 'VICE_COLORS', 'VICE', 'ETERNAL']);
  const allowedColorBrands = new Set(['DERMAGLO', 'VICE_COLORS', 'ETERNAL', 'RADIANT']);

  if (categoria === 'negra') return allowedBlackBrands.has(brand);
  if (categoria === 'blanca') return allowedWhiteBrands.has(brand) && isWhiteInk(n);
  return allowedColorBrands.has(brand);
}

function toEntry(row) {
  let categoriaRaw = row.categoria || '';
  if (!categoriaRaw && row.raw_json) {
    try {
      const parsed = JSON.parse(row.raw_json);
      categoriaRaw = parsed.category_name || parsed.category || parsed.categoria || '';
    } catch {}
  }
  const normalized = normalizeText(row.nombre || '');
  const marca = detectInkBrandFromCategory(categoriaRaw, row.nombre || '') || detectInkBrand(normalized);
  return {
    nombre: row.nombre || '',
    categoria: classifyInk(row.nombre || ''),
    marca: marca || 'OTRA',
    precio: Number(row.precio_con_iva ?? 0),
    uso: '',
    stock: row.stock_actual ?? null,
    activo: !!row.activo,
    referencia: row.referencia || '',
    link: buildSearchUrl(row.nombre || ''),
    source: 'prestashop_cache',
  };
}

function groupByCategoria(entries = []) {
  return entries.reduce((acc, entry) => {
    const cat = entry.categoria || 'color';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(entry);
    return acc;
  }, {});
}

function countByBrand(entries = []) {
  return entries.reduce((acc, entry) => {
    const brand = String(entry?.marca || 'OTRA').toUpperCase();
    acc[brand] = (acc[brand] || 0) + 1;
    return acc;
  }, {});
}

async function getLiveBrandEntries(searchTerm = '', limit = 120) {
  const live = await getProducts({ limit, search: searchTerm });
  return (live || [])
    .filter((item) => looksLikeInk(item.nombre, item.categoria || ''))
    .map((item) => ({
      marca: detectInkBrandFromCategory(item.categoria || '', item.nombre || '') || 'OTRA',
      nombre: item.nombre || '',
      categoria: classifyInk(item.nombre || ''),
      precio: Number(item.precio_con_iva ?? item.precio ?? 0),
      uso: '',
      stock: item.stock_actual ?? null,
      activo: !!item.activo,
      referencia: item.referencia || '',
      link: buildSearchUrl(item.nombre || ''),
      source: 'prestashop_live',
    }))
    .filter((item) => item.nombre);
}

async function getTintasCatalog({ limit = 2500 } = {}) {
  const mainJsonEntries = loadMainInkJsonEntries();
  const csvEntries = mainJsonEntries.length ? [] : loadCsvCatalogEntries();

  // 1) Preferimos cache DB porque es instantaneo y estable.
  const rows = db.prepare(`
    SELECT product_id, nombre, referencia, precio_con_iva, activo, stock_actual, raw_json
    FROM prestashop_products_cache
    WHERE nombre IS NOT NULL AND TRIM(nombre) <> ''
    ORDER BY last_seen_at DESC
    LIMIT ?
  `).all(Number(limit) || 2500);

  const filtered = rows
    .filter((row) => looksLikeInk(row.nombre, row.categoria || ''))
    .map(toEntry)
    .filter((item) => item.nombre);

  // 2) Si la cache aun no se ha rellenado, intentamos en vivo (solo en ese caso)
  // para que Design funcione "out of the box".
  let liveFiltered = [];
  if (filtered.length < 25) {
    try {
      ensureConfig();
      liveFiltered = await getLiveBrandEntries('', 2500);
    } catch {
      liveFiltered = [];
    }
  }

  // 3) Si alguna marca clave no aparece en cache, intentamos hidratarla en vivo por busqueda.
  // Esto evita que Design se quede "ciego" con Vice u otras marcas por una cache incompleta.
  const strategicSearches = [
    { brand: 'VICE_COLORS', search: 'vice' },
    { brand: 'RADIANT', search: 'radiant' },
    { brand: 'DERMAGLO', search: 'dermaglo' },
    { brand: 'ALLEGORY', search: 'allegory' },
    { brand: 'HYPE_INK', search: 'hype ink' },
    { brand: 'DYNAMIC', search: 'dynamic' },
    { brand: 'ETERNAL', search: 'eternal' },
  ];

  const cachedBrandCounts = countByBrand([...mainJsonEntries, ...csvEntries, ...filtered]);
  const missingBrandSearches = strategicSearches.filter(({ brand }) => !cachedBrandCounts[brand]);

  if (missingBrandSearches.length) {
    try {
      ensureConfig();
      for (const item of missingBrandSearches) {
        const batch = await getLiveBrandEntries(item.search, 180);
        liveFiltered.push(...batch.filter((entry) => String(entry.marca || '').toUpperCase() === item.brand || (item.brand === 'VICE_COLORS' && String(entry.marca || '').toUpperCase() === 'VICE')));
      }
    } catch {}
  }

  const all = [...mainJsonEntries, ...csvEntries, ...filtered, ...liveFiltered]
    // Dedup por nombre+ref para no duplicar cuando cache y live conviven
    .reduce((acc, item) => {
      const key = `${normalizeText(item.nombre)}|${normalizeText(item.referencia || '')}|${String(item.marca || '')}`;
      if (acc.map.has(key)) return acc;
      acc.map.set(key, true);
      acc.items.push(item);
      return acc;
    }, { map: new Map(), items: [] }).items;

  const grouped = groupByCategoria(all);
  const categories = ['negra', 'blanca', 'color']
    .filter((cat) => grouped[cat]?.length)
    .map((cat) => ({
      categoria: cat,
      total: grouped[cat].length,
      items: grouped[cat].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    }));

  return {
    total: all.length,
    categories,
    sources: {
      catalogo_principal_json: mainJsonEntries.length,
      catalogo_csv: csvEntries.length,
      prestashop_cache: rows.length,
      prestashop_live: liveFiltered.length,
    },
  };
}

async function searchTintasCatalog(query = '', limit = 12) {
  const q = normalizeText(query);
  if (!q) return [];

  // Busqueda rapida solo sobre cache local (sin llamadas a PrestaShop).
  const rows = db.prepare(`
    SELECT nombre, referencia, precio_con_iva, activo, stock_actual, raw_json
    FROM prestashop_products_cache
    WHERE nombre IS NOT NULL AND TRIM(nombre) <> ''
    ORDER BY last_seen_at DESC
    LIMIT 6000
  `).all();

  const items = rows
    .filter((row) => looksLikeInk(row.nombre, row.categoria || ''))
    .map((row) => toEntry({ ...row }));

  const scored = items
    .map((item) => {
      const haystack = normalizeText(`${item.nombre} ${item.categoria} ${item.referencia}`);
      let score = 0;
      if (haystack.includes(q)) score += 40;
      q.split(' ').filter(Boolean).forEach((token) => {
        if (haystack.includes(token)) score += 8;
      });
      return { item, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.item.nombre.localeCompare(b.item.nombre))
    .slice(0, limit)
    .map(({ item }) => item);

  return scored;
}

module.exports = {
  getTintasCatalog,
  searchTintasCatalog,
};
