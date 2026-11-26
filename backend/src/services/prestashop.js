const { db } = require('../db');

const { ensureConfig, prestaFetch } = require('./prestashopClient');

function pickLangValue(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return pickLangValue(value[0]);
  if (value && typeof value === 'object') {
    if (typeof value.value === 'string') return value.value;
    if (Array.isArray(value.language)) return pickLangValue(value.language[0]);
    if (value.language && typeof value.language === 'object') return pickLangValue(value.language);
    const first = Object.values(value)[0];
    return pickLangValue(first);
  }
  return '';
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandSearchAliases(text) {
  let result = normalize(text);
  const aliases = [
    ['dynam', 'dynamic'],
    ['dyn', 'dynamic'],
    ['kwa', 'kwadron'],
    ['kwad', 'kwadron'],
    ['emal', 'emalla'],
    ['elim', 'elimination'],
    ['rm', 'round magnum'],
    ['m1', 'magnum'],
    ['rl', 'round liner'],
    ['rs', 'round shader'],
  ];

  aliases.forEach(([from, to]) => {
    result = result.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
  });

  return result;
}

function tokenizeSearch(text) {
  return expandSearchAliases(text)
    .split(' ')
    .filter(Boolean);
}

function parseMeasureTokens(text) {
  const compact = normalize(text).replace(/\s+/g, '');
  return [...new Set(compact.match(/\d{4,5}/g) || [])];
}

function detectFamilyHint(text) {
  const normalized = expandSearchAliases(text);
  if (normalized.includes('round magnum')) return 'rm';
  if (normalized.includes('round shader')) return 'rs';
  if (normalized.includes('round liner') || normalized.includes('linea') || normalized.includes('liner')) return 'rl';
  return '';
}

function isDoneState(name) {
  const lower = normalize(name);
  return ['enviado', 'expedido', 'entregado', 'completado'].some((token) => lower.includes(token));
}

function familyScore(productName, familyHint) {
  if (!familyHint) return 0;
  const name = normalize(productName);
  if (familyHint === 'rm') return name.includes('round magnum') ? 12 : -4;
  if (familyHint === 'rs') return name.includes('round shader') ? 12 : -4;
  if (familyHint === 'rl') return (name.includes('linea') || name.includes('liner')) ? 12 : -4;
  return 0;
}

async function getCombinations({ limit = 2500 } = {}) {
  try {
    const data = await prestaFetch('combinations', {
      display: '[id,id_product,reference,price]',
      limit: `0,${limit}`,
    });
    return Array.isArray(data?.combinations) ? data.combinations : [];
  } catch {
    return [];
  }
}

function normalizeProduct(product, stockItem) {
  const precioSinIva = Number(product.price || 0);
  const precioConIva = Number((precioSinIva * 1.21).toFixed(2));
  return {
    id: Number(product.id),
    id_stock: stockItem ? Number(stockItem.id) : null,
    nombre: pickLangValue(product.name),
    referencia: product.reference || '',
    precio: precioSinIva,
    precio_sin_iva: precioSinIva,
    precio_con_iva: precioConIva,
    activo: String(product.active) === '1',
    stock_actual: stockItem ? Number(stockItem.quantity || 0) : null,
    id_product: stockItem ? Number(stockItem.id_product || product.id) : Number(product.id),
    id_product_attribute: stockItem ? Number(stockItem.id_product_attribute || 0) : 0,
  };
}

async function getProducts({ limit = 50, search = '' } = {}) {
  const params = {
    display: '[id,name,reference,price,active]',
    limit: `0,${search ? Math.max(limit * 12, 800) : limit}`,
  };

  const data = await prestaFetch('products', params);
  const products = Array.isArray(data?.products) ? data.products : [];

  const stockData = await prestaFetch('stock_availables', {
    display: '[id,id_product,id_product_attribute,quantity]',
    limit: `0,${search ? Math.max(limit * 30, 3000) : Math.max(limit * 3, 150)}`,
  });
  const stockList = Array.isArray(stockData?.stock_availables) ? stockData.stock_availables : [];
  const stockByProduct = new Map();
  const stockByCombination = new Map();
  stockList.forEach((item) => {
    if (!stockByProduct.has(String(item.id_product))) {
      stockByProduct.set(String(item.id_product), item);
    }
    if (Number(item.id_product_attribute || 0) > 0) {
      stockByCombination.set(`${item.id_product}:${item.id_product_attribute}`, item);
    }
  });

  let normalized = products.map((product) => normalizeProduct(product, stockByProduct.get(String(product.id))));

  if (search) {
    const tokens = tokenizeSearch(search);
    const measureTokens = parseMeasureTokens(search);
    const familyHint = detectFamilyHint(search);
    const productById = new Map(products.map((product) => [String(product.id), product]));
    const combinations = await getCombinations({ limit: Math.max(limit * 40, 4000) });

    const combinationResults = combinations
      .map((combo) => {
        const parent = productById.get(String(combo.id_product));
        if (!parent) return null;
        const comboRef = String(combo.reference || '').trim();
        if (!comboRef) return null;
        const comboNeedleCompact = normalize(comboRef).replace(/\s+/g, '');
        const comboTokens = tokenizeSearch(comboRef);
        const haystack = `${normalize(pickLangValue(parent.name))} ${expandSearchAliases(pickLangValue(parent.name))} ${normalize(comboRef)} ${comboNeedleCompact}`;
        const exactMeasureBoost = measureTokens.some((token) => comboNeedleCompact.includes(token)) ? 30 : 0;
        const tokenScore = tokens.reduce((acc, token) => {
          if (haystack.includes(token)) return acc + 6;
          if (token.length >= 3 && haystack.replaceAll(' ', '').includes(token.replaceAll(' ', ''))) return acc + 3;
          return acc;
        }, 0);
        const comboStock = stockByCombination.get(`${combo.id_product}:${combo.id}`) || stockByProduct.get(String(combo.id_product));
        const basePrice = Number(parent.price || 0);
        const comboImpact = Number(combo.price || 0);
        const comboPrice = Number((basePrice + comboImpact).toFixed(2));
        return {
          id: `${parent.id}-${combo.id}`,
          id_stock: comboStock ? Number(comboStock.id) : null,
          nombre: `${pickLangValue(parent.name)} · ${comboRef}`,
          referencia: comboRef,
          precio: comboPrice,
          precio_sin_iva: comboPrice,
          precio_con_iva: Number((comboPrice * 1.21).toFixed(2)),
          activo: String(parent.active) === '1',
          stock_actual: comboStock ? Number(comboStock.quantity || 0) : null,
          id_product: Number(parent.id),
          id_product_attribute: Number(combo.id || 0),
          _score: exactMeasureBoost + tokenScore + familyScore(parent.name, familyHint) + (comboTokens.length ? 2 : 0),
        };
      })
      .filter((item) => item && item._score > 0)
      .sort((a, b) => b._score - a._score || a.nombre.localeCompare(b.nombre));

    const parentResults = normalized
      .map((item) => {
        const haystack = `${normalize(item.nombre)} ${expandSearchAliases(item.nombre)} ${normalize(item.referencia)}`;
        const compactHaystack = haystack.replaceAll(' ', '');
        const exactMeasureBoost = measureTokens.some((token) => compactHaystack.includes(token)) ? 14 : 0;
        const score = tokens.reduce((acc, token) => {
          if (haystack.includes(token)) return acc + 4;
          if (token.length >= 3 && compactHaystack.includes(token.replaceAll(' ', ''))) return acc + 2;
          return acc;
        }, 0);
        return { ...item, _score: score + exactMeasureBoost + familyScore(item.nombre, familyHint) };
      })
      .filter((item) => item._score > 0)
      .sort((a, b) => b._score - a._score || a.nombre.localeCompare(b.nombre));

    const merged = [];
    const seen = new Set();
    [...combinationResults, ...parentResults].forEach((item) => {
      const key = `${normalize(item.nombre)}|${normalize(item.referencia)}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(item);
      }
    });

    normalized = merged.slice(0, limit).map(({ _score, ...item }) => item);
  }

  return normalized;
}

async function getOrders({ limit = 25 } = {}) {
  const data = await prestaFetch('orders', {
    display: '[id,reference,current_state,id_customer,total_paid,date_add,payment]',
    sort: '[id_DESC]',
    limit: `0,${limit}`,
  });
  return Array.isArray(data?.orders) ? data.orders : [];
}

async function getOrderStates() {
  const data = await prestaFetch('order_states', {
    display: '[id,name]',
    limit: '0,200',
  });
  const states = Array.isArray(data?.order_states) ? data.order_states : [];
  return states.map((item) => ({
    id: Number(item.id),
    nombre: pickLangValue(item.name),
  }));
}

async function getOrderDetails(orderIds = []) {
  if (!Array.isArray(orderIds) || !orderIds.length) return [];
  const stockData = await prestaFetch('stock_availables', {
    display: '[id,id_product,id_product_attribute,quantity]',
    limit: '0,5000',
  });
  const stockList = Array.isArray(stockData?.stock_availables) ? stockData.stock_availables : [];
  const stockByKey = new Map();
  const stockByProduct = new Map();

  stockList.forEach((item) => {
    const key = `${Number(item.id_product || 0)}:${Number(item.id_product_attribute || 0)}`;
    stockByKey.set(key, Number(item.quantity || 0));
    if (!stockByProduct.has(String(item.id_product))) {
      stockByProduct.set(String(item.id_product), Number(item.quantity || 0));
    }
  });

  const settled = await Promise.allSettled(
    orderIds.map((orderId) => prestaFetch(`orders/${orderId}`))
  );

  return settled.flatMap((entry, index) => {
    if (entry.status !== 'fulfilled') return [];
    const order = entry.value?.order;
    const rows = toArray(
      order?.associations?.order_rows?.order_row
      || order?.associations?.order_rows
    );
    const realOrderId = Number(order?.id || orderIds[index]);
    return rows.map((item, rowIndex) => ({
      product_id: Number(item.product_id || 0),
      product_attribute_id: Number(item.product_attribute_id || 0),
      id: Number(item.id || `${realOrderId}${rowIndex + 1}`),
      id_order: realOrderId,
      product_name: item.product_name || '',
      product_reference: item.product_reference || '',
      product_quantity: Number(item.product_quantity || 0),
      total_price_tax_incl: Number(item.unit_price_tax_incl || item.total_price_tax_incl || 0),
      total_price_tax_excl: Number(item.unit_price_tax_excl || item.total_price_tax_excl || 0),
      stock_actual: stockByKey.get(`${Number(item.product_id || 0)}:${Number(item.product_attribute_id || 0)}`)
        ?? stockByProduct.get(String(item.product_id || ''))
        ?? null,
    }));
  });
}

async function getCustomers({ limit = 25, search = '' } = {}) {
  const params = {
    display: '[id,firstname,lastname,email,company,date_add]',
    sort: '[id_DESC]',
    limit: `0,${limit}`,
  };
  if (search) params['filter[email]'] = `%[${search}]%`;
  const data = await prestaFetch('customers', params);
  return Array.isArray(data?.customers) ? data.customers : [];
}

async function getDuplicateProducts({ limitGroups = 40 } = {}) {
  const data = await prestaFetch('products', {
    display: '[id,name,reference,price,active,description,description_short,meta_title,meta_description,link_rewrite]',
    limit: '0,2500',
  });
  const products = Array.isArray(data?.products) ? data.products : [];
  const groups = new Map();

  products.forEach((product) => {
    const nombre = pickLangValue(product.name);
    const referencia = String(product.reference || '').trim();
    const keyBase = referencia ? `ref:${normalize(referencia)}` : `name:${normalize(nombre)}`;
    if (!keyBase || keyBase.endsWith(':')) return;

    const description = stripHtml(pickLangValue(product.description));
    const descriptionShort = stripHtml(pickLangValue(product.description_short));
    const metaTitle = pickLangValue(product.meta_title);
    const metaDescription = pickLangValue(product.meta_description);
    const linkRewrite = pickLangValue(product.link_rewrite);
    const price = Number(product.price || 0);
    const active = String(product.active) === '1';
    const filledFields = [
      !!referencia,
      price > 0,
      active,
      descriptionShort.length > 20,
      description.length > 80,
      metaTitle.length > 8,
      metaDescription.length > 20,
      linkRewrite.length > 4,
    ].filter(Boolean).length;
    const contentWeight = Math.min(
      description.length + descriptionShort.length + metaTitle.length + metaDescription.length + linkRewrite.length,
      240
    );
    const score = filledFields * 20 + contentWeight + (active ? 8 : 0) + (price > 0 ? 5 : 0);

    const entry = {
      id: Number(product.id),
      nombre,
      referencia,
      precio: price,
      activo: active,
      description_chars: description.length,
      description_short_chars: descriptionShort.length,
      meta_title_chars: metaTitle.length,
      meta_description_chars: metaDescription.length,
      score,
      filled_fields: filledFields,
    };

    if (!groups.has(keyBase)) groups.set(keyBase, []);
    groups.get(keyBase).push(entry);
  });

  return [...groups.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => {
      const sorted = [...items].sort((a, b) => b.score - a.score || b.filled_fields - a.filled_fields || a.id - b.id);
      return {
        key,
        total: sorted.length,
        keep: sorted[0],
        duplicates: sorted.slice(1),
      };
    })
    .sort((a, b) => b.total - a.total || b.keep.score - a.keep.score)
    .slice(0, limitGroups);
}

async function getStockByProductId(productId) {
  const data = await prestaFetch('stock_availables', {
    display: '[id,id_product,id_product_attribute,quantity]',
    'filter[id_product]': `[${productId}]`,
  });
  const items = Array.isArray(data?.stock_availables) ? data.stock_availables : [];
  return items[0] || null;
}

async function updateStockAvailable(stockAvailableId, quantity) {
  const schema = await prestaFetch(`stock_availables/${stockAvailableId}`);
  const stock = schema?.stock_available;
  if (!stock) {
    const error = new Error('No he encontrado ese stock en PrestaShop');
    error.status = 404;
    throw error;
  }

  stock.quantity = String(quantity);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <stock_available>
    <id><![CDATA[${stock.id}]]></id>
    <id_product><![CDATA[${stock.id_product}]]></id_product>
    <id_product_attribute><![CDATA[${stock.id_product_attribute || 0}]]></id_product_attribute>
    <id_shop><![CDATA[${stock.id_shop || 1}]]></id_shop>
    <id_shop_group><![CDATA[${stock.id_shop_group || 0}]]></id_shop_group>
    <quantity><![CDATA[${stock.quantity}]]></quantity>
    <depends_on_stock><![CDATA[${stock.depends_on_stock || 0}]]></depends_on_stock>
    <out_of_stock><![CDATA[${stock.out_of_stock || 0}]]></out_of_stock>
    <location><![CDATA[${stock.location || ''}]]></location>
  </stock_available>
</prestashop>`;

  await prestaFetch(`stock_availables/${stockAvailableId}`, {}, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/xml',
      Accept: 'application/json',
    },
    body: xml,
  });

  return { ok: true, id: Number(stockAvailableId), quantity: Number(quantity) };
}

function syncPrestashopAnalytics({ orders = [], orderDetails = [], products = [], statesMap = {} } = {}) {
  const now = db.prepare(`SELECT datetime('now','localtime') as now, date('now','localtime') as today`).get();
  const insertOrder = db.prepare(`
    INSERT INTO prestashop_orders_cache (
      order_id, reference, current_state, state_name, customer_id, payment, total_paid, date_add, raw_json, first_seen_at, last_seen_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(order_id) DO UPDATE SET
      reference = excluded.reference,
      current_state = excluded.current_state,
      state_name = excluded.state_name,
      customer_id = excluded.customer_id,
      payment = excluded.payment,
      total_paid = excluded.total_paid,
      date_add = excluded.date_add,
      raw_json = excluded.raw_json,
      last_seen_at = excluded.last_seen_at
  `);
  const insertItem = db.prepare(`
    INSERT INTO prestashop_order_items_cache (
      row_id, order_id, product_id, product_attribute_id, product_name, product_reference, product_quantity,
      total_price_tax_incl, total_price_tax_excl, stock_actual, first_seen_at, last_seen_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(row_id) DO UPDATE SET
      order_id = excluded.order_id,
      product_id = excluded.product_id,
      product_attribute_id = excluded.product_attribute_id,
      product_name = excluded.product_name,
      product_reference = excluded.product_reference,
      product_quantity = excluded.product_quantity,
      total_price_tax_incl = excluded.total_price_tax_incl,
      total_price_tax_excl = excluded.total_price_tax_excl,
      stock_actual = excluded.stock_actual,
      last_seen_at = excluded.last_seen_at
  `);
  const insertProduct = db.prepare(`
    INSERT INTO prestashop_products_cache (
      product_id, stock_id, product_attribute_id, nombre, referencia, precio_sin_iva, precio_con_iva,
      activo, stock_actual, raw_json, first_seen_at, last_seen_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(product_id) DO UPDATE SET
      stock_id = excluded.stock_id,
      product_attribute_id = excluded.product_attribute_id,
      nombre = excluded.nombre,
      referencia = excluded.referencia,
      precio_sin_iva = excluded.precio_sin_iva,
      precio_con_iva = excluded.precio_con_iva,
      activo = excluded.activo,
      stock_actual = excluded.stock_actual,
      raw_json = excluded.raw_json,
      last_seen_at = excluded.last_seen_at
  `);
  const upsertMetrics = db.prepare(`
    INSERT INTO prestashop_daily_metrics (
      fecha, total_orders, total_pending, total_done, total_sales, total_products, total_active_products, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(fecha) DO UPDATE SET
      total_orders = excluded.total_orders,
      total_pending = excluded.total_pending,
      total_done = excluded.total_done,
      total_sales = excluded.total_sales,
      total_products = excluded.total_products,
      total_active_products = excluded.total_active_products,
      updated_at = excluded.updated_at
  `);

  try {
    db.exec('BEGIN');
    orders.forEach((order) => {
      const stateName = statesMap[order.current_state] || `Estado ${order.current_state}`;
      insertOrder.run(
        Number(order.id),
        order.reference || '',
        String(order.current_state || ''),
        stateName,
        Number(order.id_customer || 0),
        order.payment || '',
        Number(order.total_paid || 0),
        order.date_add || null,
        JSON.stringify(order),
        now.now,
        now.now
      );
    });

    orderDetails.forEach((item) => {
      insertItem.run(
        Number(item.id),
        Number(item.id_order || 0),
        Number(item.product_id || 0),
        Number(item.product_attribute_id || 0),
        item.product_name || '',
        item.product_reference || '',
        Number(item.product_quantity || 0),
        Number(item.total_price_tax_incl || 0),
        Number(item.total_price_tax_excl || 0),
        item.stock_actual == null ? null : Number(item.stock_actual || 0),
        now.now,
        now.now
      );
    });

    products.forEach((product) => {
      insertProduct.run(
        Number(product.id_product || product.id || 0),
        product.id_stock == null ? null : Number(product.id_stock || 0),
        Number(product.id_product_attribute || 0),
        product.nombre || '',
        product.referencia || '',
        Number(product.precio_sin_iva ?? product.precio ?? 0),
        Number(product.precio_con_iva ?? 0),
        product.activo ? 1 : 0,
        product.stock_actual == null ? null : Number(product.stock_actual || 0),
        JSON.stringify(product),
        now.now,
        now.now
      );
    });

    if (orders.length || products.length) {
      const pendingOrders = orders.filter((order) => !isDoneState(statesMap[order.current_state] || `Estado ${order.current_state}`)).length;
      const doneOrders = orders.length - pendingOrders;
      upsertMetrics.run(
        now.today,
        orders.length,
        pendingOrders,
        doneOrders,
        orders.reduce((sum, order) => sum + Number(order.total_paid || 0), 0),
        products.length,
        products.filter((product) => product.activo).length,
        now.now
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}

module.exports = {
  ensureConfig,
  getProducts,
  getOrders,
  getOrderStates,
  getOrderDetails,
  getCustomers,
  getDuplicateProducts,
  getStockByProductId,
  updateStockAvailable,
  syncPrestashopAnalytics,
};
