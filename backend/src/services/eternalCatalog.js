const fs = require('fs');
const path = require('path');
const { getProducts, ensureConfig } = require('./prestashop');

const BASE_CATALOG_PATH = path.join(__dirname, '..', '..', 'cerebro-bot', 'eternal-catalogo-base.json');
const LOCAL_SNAPSHOT_PATH = path.join(__dirname, '..', '..', 'cerebro-bot', 'catalogo-procesado.json');
const ATOMX_SEARCH_BASE = 'https://www.atomxsupply.com/busqueda?controller=search&s=';

function readJsonIfExists(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    console.warn('No he podido leer JSON:', filePath, error.message);
    return fallback;
  }
}

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

function toCatalogEntry(item = {}, categoria = 'otros') {
  return {
    nombre: item.nombre || '',
    categoria,
    precio: Number(item.precio || item.precioConIva || item.precio_con_iva || 0),
    uso: item.uso || '',
    stock: item.stock ?? item.cantidad ?? item.stock_actual ?? null,
    activo: typeof item.activo === 'boolean' ? item.activo : true,
    referencia: item.referencia || item.ref || '',
    link: item.link || buildSearchUrl(item.nombre),
    source: item.source || 'base',
  };
}

function loadBaseCatalog() {
  const base = readJsonIfExists(BASE_CATALOG_PATH, { categories: [] });
  return (base.categories || []).flatMap((group) =>
    (group.items || []).map((item) => toCatalogEntry(item, group.categoria || 'otros'))
  );
}

function loadLocalSnapshotMatches() {
  const snapshot = readJsonIfExists(LOCAL_SNAPSHOT_PATH, { productos: [] });
  return (snapshot.productos || [])
    .filter((item) => normalizeText(item.nombre).includes('eternal'))
    .map((item) => ({
      nombre: item.nombre,
      categoria: item.categoria || 'otros',
      precio: Number(item.precioConIva || 0),
      stock: item.cantidad ?? null,
      activo: item.activo !== false,
      referencia: item.ref || '',
      link: buildSearchUrl(item.nombre),
      source: 'ops_snapshot',
    }));
}

async function loadPrestashopMatches() {
  try {
    ensureConfig();
  } catch {
    return [];
  }

  try {
    const items = await getProducts({ limit: 250, search: 'eternal' });
    return items
      .filter((item) => normalizeText(item.nombre).includes('eternal'))
      .map((item) => ({
        nombre: item.nombre,
        categoria: 'live',
        precio: Number(item.precio_con_iva ?? item.precio ?? 0),
        stock: item.stock_actual ?? null,
        activo: !!item.activo,
        referencia: item.referencia || '',
        link: buildSearchUrl(item.nombre),
        source: 'prestashop_live',
      }));
  } catch (error) {
    console.warn('No he podido cargar Eternal desde PrestaShop:', error.message);
    return [];
  }
}

function scoreNameMatch(baseName = '', candidateName = '') {
  const a = normalizeText(baseName);
  const b = normalizeText(candidateName);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 75;

  const aTokens = a.split(' ');
  const bTokens = b.split(' ');
  const shared = aTokens.filter((token) => token && bTokens.includes(token));
  return shared.length * 10;
}

function mergeEntry(baseEntry, candidates = []) {
  const best = candidates
    .map((candidate) => ({ candidate, score: scoreNameMatch(baseEntry.nombre, candidate.nombre) }))
    .filter((item) => item.score >= 30)
    .sort((a, b) => b.score - a.score)[0]?.candidate;

  if (!best) {
    return {
      ...baseEntry,
      disponible: baseEntry.stock == null ? null : baseEntry.stock > 0,
    };
  }

  return {
    ...baseEntry,
    precio: best.precio || baseEntry.precio,
    stock: best.stock ?? baseEntry.stock ?? null,
    activo: typeof best.activo === 'boolean' ? best.activo : baseEntry.activo,
    referencia: best.referencia || baseEntry.referencia,
    link: best.link || baseEntry.link,
    source: best.source || baseEntry.source,
    disponible: best.stock == null ? null : best.stock > 0,
  };
}

function groupCatalog(entries = []) {
  return entries.reduce((acc, entry) => {
    const categoria = entry.categoria || 'otros';
    if (!acc[categoria]) acc[categoria] = [];
    acc[categoria].push(entry);
    return acc;
  }, {});
}

async function getEternalCatalog() {
  const baseEntries = loadBaseCatalog();
  const localSnapshot = loadLocalSnapshotMatches();
  const liveMatches = await loadPrestashopMatches();
  const merged = baseEntries.map((entry) => mergeEntry(entry, [...liveMatches, ...localSnapshot]));
  const byCategory = groupCatalog(merged);

  return {
    total: merged.length,
    categories: Object.entries(byCategory).map(([categoria, items]) => ({
      categoria,
      total: items.length,
      items: items.sort((a, b) => a.nombre.localeCompare(b.nombre)),
    })),
    sources: {
      base: true,
      ops_snapshot: localSnapshot.length,
      prestashop_live: liveMatches.length,
    },
  };
}

async function searchEternalCatalog(query = '', limit = 12) {
  const q = normalizeText(query);
  if (!q) return [];

  const catalog = await getEternalCatalog();
  const scored = catalog.categories
    .flatMap((group) => group.items)
    .map((item) => {
      const haystack = normalizeText(`${item.nombre} ${item.categoria} ${item.uso} ${item.referencia}`);
      let score = 0;
      if (haystack.includes(q)) score += 40;
      q.split(' ').filter(Boolean).forEach((token) => {
        if (haystack.includes(token)) score += 8;
      });
      score += scoreNameMatch(item.nombre, query);
      return { item, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.item.nombre.localeCompare(b.item.nombre))
    .slice(0, limit)
    .map(({ item }) => item);

  return scored;
}

module.exports = {
  getEternalCatalog,
  searchEternalCatalog,
};
