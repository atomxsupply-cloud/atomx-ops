const assert = require('node:assert/strict');
const test = require('node:test');
const { generateRows } = require('../scripts/refreshOpenaiProductFeed');
const { STORE, serializeCsv } = require('../src/services/openaiProductFeed');

const productUrl = `${STORE}/es/maquinas/42-maquina.html`;
const variantUrl = `${STORE}/es/maquinas/42-103-maquina.html`;

function sampleProduct() {
  return {
    '@type': 'ProductGroup',
    productGroupID: '42',
    brand: { name: 'Marca de prueba' },
    description: 'Máquina compacta para estudio.',
    hasVariant: [{
      '@type': 'Product',
      productID: '42-103',
      name: 'Máquina, color "negro"',
      additionalProperty: [{ name: 'Color', value: 'Negro' }],
      image: `${STORE}/img/negro.jpg`,
      offers: {
        price: '90.00',
        priceCurrency: 'EUR',
        availability: 'https://schema.org/BackOrder',
        url: variantUrl,
      },
    }],
  };
}

function mockStore(mock, { price = '90.000000', duplicate = false } = {}) {
  const group = sampleProduct();
  if (duplicate) group.hasVariant.push(group.hasVariant[0]);
  const sitemap = `${STORE}/1_es_0_sitemap.xml`;
  const results = new Map([
    ['/1_index_sitemap.xml', `<sitemapindex><sitemap><loc>${sitemap}</loc></sitemap></sitemapindex>`],
    ['/1_es_0_sitemap.xml', `<urlset><url><loc>${productUrl}</loc></url></urlset>`],
    ['/es/maquinas/42-maquina.html', `<script type="application/ld+json">${JSON.stringify(group)}</script>`],
  ]);
  mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(input);
    assert.equal(url.origin, STORE);
    const content = results.get(url.pathname);
    if (content) {
      assert.equal(options.headers, undefined);
      return new Response(content);
    }
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.equal(url.searchParams.get('price[chatgpt_regular][use_reduction]'), '0');
    assert.equal(url.searchParams.get('price[chatgpt_current][use_tax]'), '1');
    if (url.pathname === '/api/products') {
      assert.equal(url.searchParams.get('filter[id]'), '[42]');
      return Response.json({
        products: [{
          id: '42', active: '1', visibility: 'both', show_price: '1', condition: 'new',
          chatgpt_current: price, chatgpt_regular: '100.000000',
        }],
      });
    }
    assert.equal(url.pathname, '/api/combinations');
    assert.equal(url.searchParams.get('filter[id]'), '[103]');
    return Response.json({
      combinations: [{
        id: '103', id_product: '42', chatgpt_current: price, chatgpt_regular: '100.000000',
      }],
    });
  });
}

const config = {
  productIds: new Set(['42']),
  categories: new Set(),
  wsKey: 'clave-local-de-prueba',
  pricingContext: {},
};

test('genera una fila por variante con promoción, disponibilidad y URL verificadas', async ({ mock }) => {
  mockStore(mock);
  const rows = await generateRows(config);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].item_id, 'ps-42-103');
  assert.equal(rows[0].group_id, 'ps-product-42');
  assert.equal(rows[0].url, variantUrl);
  assert.equal(rows[0].availability, 'backorder');
  assert.equal(rows[0].price, '100.00 EUR');
  assert.equal(rows[0].sale_price, '90.00 EUR');
  assert.equal(rows[0].target_countries, 'ES');
  assert.equal(rows[0].is_eligible_checkout, 'false');
  assert.deepEqual(JSON.parse(rows[0].variant_dict), { Color: 'Negro' });
  assert.match(serializeCsv(rows), /"Máquina, color ""negro"""/);
});

test('interrumpe la generación si el precio de la API difiere de la ficha pública', async ({ mock }) => {
  mockStore(mock, { price: '89.990000' });
  await assert.rejects(generateRows(config), /Precio sin validar para 42-103/);
});

test('interrumpe la generación si la ficha repite una variante', async ({ mock }) => {
  mockStore(mock, { duplicate: true });
  await assert.rejects(generateRows(config), /Identificador de combinación inválido/);
});
