const FACTUSOL_API_BASE = process.env.FACTUSOL_API_BASE_URL || 'https://api.sdelsol.com';

function getFactusolConfig() {
  return {
    baseUrl: FACTUSOL_API_BASE.replace(/\/+$/, ''),
    manufacturerCode: String(process.env.FACTUSOL_MANUFACTURER_CODE || '').trim(),
    clientId: String(process.env.FACTUSOL_CLIENT_ID || '').trim(),
    clientSecret: String(process.env.FACTUSOL_CLIENT_SECRET || '').trim(),
    databaseId: String(process.env.FACTUSOL_DATABASE_ID || '').trim(),
  };
}

function mask(value, visible = 4) {
  const text = String(value || '');
  if (!text) return '';
  if (text.length <= visible) return '*'.repeat(text.length);
  return `${text.slice(0, visible)}${'*'.repeat(Math.max(text.length - visible, 4))}`;
}

function getFactusolStatus() {
  const config = getFactusolConfig();
  const ready = Boolean(
    config.manufacturerCode &&
    config.clientId &&
    config.clientSecret &&
    config.databaseId
  );

  return {
    ready,
    baseUrl: config.baseUrl,
    fields: {
      manufacturerCode: mask(config.manufacturerCode),
      clientId: mask(config.clientId),
      clientSecret: config.clientSecret ? 'configurada' : '',
      databaseId: mask(config.databaseId),
    },
  };
}

async function factusolFetch(pathname, { method = 'GET', body, token } = {}) {
  const config = getFactusolConfig();
  const url = `${config.baseUrl}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (config.manufacturerCode) headers['X-Factusol-Manufacturer'] = config.manufacturerCode;

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const error = new Error(`Factusol API ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function requestFactusolToken() {
  const config = getFactusolConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new Error('Faltan credenciales de Factusol');
  }

  // Placeholder preparado para el dia que tengamos el endpoint real confirmado.
  throw new Error('Pendiente de configurar el endpoint OAuth/API real de Factusol nube');
}

async function syncFactusolClientes() {
  const status = getFactusolStatus();
  if (!status.ready) {
    throw new Error('Faltan credenciales Factusol');
  }

  // Aqui colgaremos la sincronizacion real cuando tengamos el acceso API activado.
  return {
    ok: false,
    pendiente: true,
    message: 'Conector base listo. Falta activar y probar el acceso API oficial de Factusol nube.',
  };
}

module.exports = {
  getFactusolConfig,
  getFactusolStatus,
  factusolFetch,
  requestFactusolToken,
  syncFactusolClientes,
};
