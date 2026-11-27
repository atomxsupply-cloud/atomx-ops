const path = require('node:path');

const STORE = 'https://www.atomxsupply.com';
const SELLER = 'ATOM X Supply';
const FEED_FILE = path.join(__dirname, '../../var/openai-feed/products.csv');
const MAX_FEED_AGE_MS = 36 * 60 * 60 * 1000;
const AVAILABILITY = new Map([
  ['InStock', 'in_stock'],
  ['LimitedAvailability', 'in_stock'],
  ['OutOfStock', 'out_of_stock'],
  ['SoldOut', 'out_of_stock'],
  ['Discontinued', 'out_of_stock'],
  ['PreOrder', 'pre_order'],
  ['BackOrder', 'backorder'],
  ['PreSale', 'pre_order'],
]);
const COLUMNS = [
  'item_id', 'title', 'description', 'url', 'brand', 'seller_name', 'image_url',
  'availability', 'price', 'sale_price', 'group_id', 'listing_has_variations',
  'variant_dict', 'condition', 'seller_url', 'return_policy', 'target_countries', 'store_country',
  'is_eligible_checkout', 'is_ads_eligible',
];

function storeUrl(value) {
  const url = new URL(value);
  if (url.origin !== STORE || url.username || url.password) {
    throw new Error('El enlace no pertenece al escaparate de Atom X Supply');
  }
  return url;
}

function sitemapLinks(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((match) => match[1]);
}

async function fetchStoreText(value) {
  const url = storeUrl(value);
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`La tienda respondió HTTP ${response.status} en ${url.pathname}`);
  return response.text();
}

async function listProductPages({ productIds, categories }) {
  const index = await fetchStoreText(`${STORE}/1_index_sitemap.xml`);
  const spanishMaps = sitemapLinks(index).filter((url) =>
    /^https:\/\/www\.atomxsupply\.com\/1_es_\d+_sitemap\.xml$/.test(url));
  if (!spanishMaps.length) throw new Error('El sitemap no contiene el catálogo español');

  const pages = new Map();
  for (const mapUrl of spanishMaps) {
    const xml = await fetchStoreText(mapUrl);
    for (const value of sitemapLinks(xml)) {
      const url = new URL(value);
      const match = url.pathname.match(/^\/es\/([^/]+)\/(\d+)-[^/]+\.html$/);
      if (!match || (!productIds.has(match[2]) && !categories.has(match[1]))) continue;
      const id = match[2];
      if (pages.has(id) && pages.get(id) !== value) {
        throw new Error(`El producto ${id} tiene dos URL en el sitemap`);
      }
      pages.set(id, storeUrl(value).href);
    }
  }
  return pages;
}

function readProductGraph(html, id) {
  const products = [];
  const scripts = html.matchAll(/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, body] of scripts) {
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      continue;
    }
    for (const node of (data?.['@graph'] ?? (Array.isArray(data) ? data : [data]))) {
      if (node?.['@type'] === 'ProductGroup' && String(node.productGroupID) === id) {
        products.push(node);
      }
      if (node?.['@type'] === 'Product' && String(node.productID) === id) products.push(node);
    }
  }
  const groups = products.filter((product) => product['@type'] === 'ProductGroup');
  const matches = groups.length ? groups : products;
  if (matches.length !== 1) throw new Error(`Ficha estructurada ambigua o ausente para ${id}`);
  return matches[0];
}

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/[\x00-\x1f\x7f]+/g, ' ').trim() : '';
}

function cents(value) {
  const normalized = typeof value === 'string' ? value.trim() : String(value);
  if (!/^\d+(?:\.\d{1,6})?$/.test(normalized)) return NaN;
  const amount = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : NaN;
}

function money(amount) {
  return `${(amount / 100).toFixed(2)} EUR`;
}

function variantOptions(variant) {
  const options = new Map();
  for (const attribute of variant.additionalProperty ?? []) {
    const name = cleanText(attribute.name);
    const value = cleanText(attribute.value);
    if (!name || !value || options.has(name)) throw new Error('Variante con opciones inválidas');
    options.set(name, value);
  }
  if (!options.size) throw new Error('Variante sin opciones');
  return JSON.stringify(Object.fromEntries([...options].sort(([a], [b]) => a.localeCompare(b))));
}

function buildProductRows(id, pageUrl, product, priceByItem) {
  const grouped = product['@type'] === 'ProductGroup';
  const variants = grouped ? product.hasVariant : [product];
  if (!Array.isArray(variants) || !variants.length) throw new Error(`Sin variantes para ${id}`);

  const seenIds = new Set();
  const seenOptions = new Set();
  let expectedOptionNames;
  return variants.map((variant) => {
    const itemId = String(variant.productID);
    const parent = pageUrl.slice(0, pageUrl.lastIndexOf('/') + 1);
    if (seenIds.has(itemId) || (grouped ? !new RegExp(`^${id}-[1-9]\\d*$`).test(itemId) : itemId !== id)) {
      throw new Error(`ID de variante inválido o repetido para el producto ${id}`);
    }
    seenIds.add(itemId);

    const offer = variant.offers;
    const price = priceByItem.get(itemId);
    const shopPrice = cents(offer?.price);
    const currentPrice = cents(price?.chatgpt_current);
    const regularPrice = cents(price?.chatgpt_regular);
    if (offer?.priceCurrency !== 'EUR' || shopPrice !== currentPrice || !(regularPrice >= currentPrice)) {
      throw new Error(`Precio sin validar para ${itemId}. Comprueba el grupo, el IVA y la moneda de PrestaShop`);
    }

    const url = storeUrl(offer.url || variant.url).href;
    if (grouped ? !url.startsWith(`${parent}${itemId}-`) : url !== pageUrl) {
      throw new Error(`El enlace no selecciona el artículo ${itemId}`);
    }
    const image = variant.image ?? product.image;
    const imageUrl = storeUrl(Array.isArray(image) ? image[0] : image).href;
    const title = cleanText(variant.name);
    const description = cleanText(variant.description ?? product.description);
    const brand = variant.brand ?? product.brand;
    const brandName = cleanText(brand?.name ?? brand);
    if (!title || !description || !brandName) {
      throw new Error(`Falta título, descripción o marca pública para ${itemId}`);
    }

    let options = '';
    if (grouped) {
      options = variantOptions(variant);
      const names = JSON.stringify(Object.keys(JSON.parse(options)));
      if (seenOptions.has(options) || (expectedOptionNames && names !== expectedOptionNames)) {
        throw new Error(`Opciones inconsistentes en el grupo ${id}`);
      }
      seenOptions.add(options);
      expectedOptionNames = names;
    }
    const availability = AVAILABILITY.get(String(offer.availability).split('/').at(-1)) ?? 'unknown';

    return {
      item_id: `ps-${itemId}`,
      title,
      description,
      url,
      brand: brandName,
      seller_name: SELLER,
      image_url: imageUrl,
      availability,
      price: money(regularPrice),
      sale_price: currentPrice < regularPrice ? money(currentPrice) : '',
      group_id: grouped ? `ps-product-${id}` : '',
      listing_has_variations: grouped ? 'true' : '',
      variant_dict: options,
      condition: price.condition,
      seller_url: `${STORE}/es/`,
      return_policy: `${STORE}/es/content/6-cancelacion-y-devolucion-de-pedidos`,
      target_countries: 'ES',
      store_country: 'ES',
      is_eligible_checkout: 'false',
      is_ads_eligible: 'false',
    };
  });
}

function serializeCsv(rows) {
  const escape = (value = '') => `"${String(value).replaceAll('"', '""')}"`;
  return [COLUMNS.join(','), ...rows.map((row) => COLUMNS.map((column) => escape(row[column])).join(','))]
    .join('\r\n') + '\r\n';
}

module.exports = {
  STORE, FEED_FILE, MAX_FEED_AGE_MS,
  fetchStoreText, listProductPages, readProductGraph, buildProductRows, serializeCsv,
};
