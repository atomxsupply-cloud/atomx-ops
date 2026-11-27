const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { prestaFetch } = require('../src/services/prestashopClient');
const {
  STORE, FEED_FILE, listProductPages, fetchStoreText, readProductGraph,
  buildProductRows, serializeCsv,
} = require('../src/services/openaiProductFeed');

const BATCH_SIZE = 30;

function readConfig() {
  const list = (value) => new Set((value || '').split(',').map((entry) => entry.trim()).filter(Boolean));
  const productIds = list(process.env.CHATGPT_FEED_PRODUCT_IDS);
  const categories = list(process.env.CHATGPT_FEED_CATEGORIES);
  if ((!productIds.size && !categories.size) || [...productIds].some((id) => !/^[1-9]\d*$/.test(id))) {
    throw new Error('Configura CHATGPT_FEED_PRODUCT_IDS o CHATGPT_FEED_CATEGORIES');
  }
  const wsKey = process.env.CHATGPT_FEED_PRESTASHOP_WS_KEY?.trim();
  if (!wsKey) throw new Error('Falta la clave de solo lectura CHATGPT_FEED_PRESTASHOP_WS_KEY');

  const pricingContext = {};
  for (const scope of ['group', 'country', 'currency']) {
    const id = process.env[`CHATGPT_FEED_PRESTA_${scope.toUpperCase()}_ID`];
    if (!id) continue;
    if (!/^[1-9]\d*$/.test(id)) throw new Error(`Identificador de precio inválido: ${scope}`);
    pricingContext[scope] = id;
  }
  return { productIds, categories, wsKey, pricingContext };
}

async function getPrices(resource, ids, config) {
  const isProduct = resource === 'products';
  const params = {
    display: isProduct ? '[id,active,visibility,show_price,condition,chatgpt_regular,chatgpt_current]'
      : '[id,id_product,chatgpt_regular,chatgpt_current]',
  };
  for (const [name, useReduction] of [['chatgpt_regular', 0], ['chatgpt_current', 1]]) {
    const scope = { use_tax: 1, use_reduction: useReduction, decimals: 6, ...config.pricingContext };
    for (const [key, value] of Object.entries(scope)) params[`price[${name}][${key}]`] = value;
  }

  const products = new Map();
  for (let offset = 0; offset < ids.length; offset += BATCH_SIZE) {
    const batch = ids.slice(offset, offset + BATCH_SIZE);
    let response;
    try {
      response = await prestaFetch(resource, { ...params, 'filter[id]': `[${batch.join('|')}]` }, {
        config: { baseUrl: STORE, wsKey: config.wsKey },
        redirect: 'error',
        signal: AbortSignal.timeout(25_000),
      });
    } catch (error) {
      const status = Number.isInteger(error.status) ? ` HTTP ${error.status}` : '';
      throw new Error(`PrestaShop no devolvió ${resource}${status}`);
    }
    const results = response?.[resource];
    if (!Array.isArray(results) || results.length !== batch.length) {
      throw new Error(`PrestaShop devolvió un lote incompleto de ${resource}`);
    }
    for (const row of results) {
      const id = String(row.id);
      if (!batch.includes(id) || products.has(id)) throw new Error(`ID inesperado en ${resource}`);
      products.set(id, row);
    }
  }
  return products;
}

async function generateRows(config) {
  const pages = await listProductPages(config);
  for (const id of config.productIds) {
    if (!pages.has(id)) throw new Error(`El producto aprobado ${id} ya no aparece en el sitemap español`);
  }
  if (!pages.size) throw new Error('La selección no contiene fichas públicas');

  const catalogue = await getPrices('products', [...pages.keys()], config);
  const publicItems = [];
  const combinations = new Set();
  for (const [id, url] of pages) {
    const product = catalogue.get(id);
    if (String(product.active) !== '1' || String(product.show_price) !== '1' ||
        !['both', 'catalog', 'search'].includes(product.visibility)) continue;
    if (!['new', 'refurbished', 'used'].includes(product.condition)) {
      throw new Error(`Estado del artículo sin confirmar: ${id}`);
    }
    const graph = readProductGraph(await fetchStoreText(url), id);
    for (const variant of graph.hasVariant ?? []) {
      const [parentId, childId, extra] = String(variant.productID).split('-');
      if (parentId !== id || !/^[1-9]\d*$/.test(childId) || extra !== undefined || combinations.has(childId)) {
        throw new Error(`Identificador de combinación inválido para ${id}`);
      }
      combinations.add(childId);
    }
    publicItems.push({ id, url, graph });
  }

  const variants = await getPrices('combinations', [...combinations], config);
  for (const [id, variant] of variants) {
    const parentId = String(variant.id_product);
    const parent = catalogue.get(parentId);
    if (!parent) throw new Error(`PrestaShop devolvió una combinación con padre desconocido: ${id}`);
    catalogue.set(`${parentId}-${id}`, { ...variant, condition: parent.condition });
  }
  const rows = publicItems.flatMap(({ id, url, graph }) => buildProductRows(id, url, graph, catalogue));
  if (!rows.length) throw new Error('La selección vigente no produjo filas para el feed');
  return rows;
}

async function refresh() {
  const checkOnly = process.argv.includes('--check');
  if (!checkOnly && process.env.CHATGPT_FEED_ENABLED !== '1') {
    throw new Error('Activa CHATGPT_FEED_ENABLED después de confirmar España y EUR en Business Hub');
  }
  const rows = await generateRows(readConfig());
  if (checkOnly) {
    console.log(`Validación completada: ${rows.length} filas de España en EUR`);
    return;
  }
  const directory = path.dirname(FEED_FILE);
  await fs.mkdir(directory, { recursive: true, mode: 0o750 });
  const temporary = path.join(directory, `.${randomUUID()}.csv`);
  try {
    await fs.writeFile(temporary, serializeCsv(rows), { mode: 0o640, flag: 'wx' });
    await fs.rename(temporary, FEED_FILE);
  } finally {
    await fs.rm(temporary, { force: true });
  }
  console.log(`Catálogo actualizado en ${new Date().toISOString()}: ${rows.length} filas`);
}

if (require.main === module) {
  refresh().catch((error) => {
    console.error(`Catálogo de ChatGPT: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { generateRows };
