function getConfig() {
  return {
    baseUrl: String(process.env.PRESTASHOP_BASE_URL || '').replace(/\/+$/, ''),
    wsKey: String(process.env.PRESTASHOP_WS_KEY || ''),
  };
}

function ensureConfig({ baseUrl, wsKey } = getConfig()) {
  if (!baseUrl || !wsKey) {
    const error = new Error('PrestaShop no esta configurado en el .env');
    error.status = 503;
    throw error;
  }
}

function buildHeaders(extra, wsKey) {
  const auth = Buffer.from(`${wsKey}:`).toString('base64');
  return {
    Authorization: `Basic ${auth}`,
    Accept: 'application/json',
    ...extra,
  };
}

function buildUrl(baseUrl, resource, params) {
  const url = new URL(`/api/${resource}`, baseUrl);
  url.searchParams.set('output_format', 'JSON');

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, value);
  });

  return url.toString();
}

async function prestaFetch(resource, params = {}, options = {}) {
  const config = options.config ?? getConfig();
  ensureConfig(config);
  const response = await fetch(buildUrl(config.baseUrl, resource, params), {
    method: options.method || 'GET',
    headers: buildHeaders(options.headers, config.wsKey),
    redirect: options.redirect,
    signal: options.signal,
    body: options.body,
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const error = new Error(typeof data === 'string' ? data : `Error PrestaShop (${response.status})`);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

module.exports = { ensureConfig, prestaFetch };
