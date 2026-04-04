export function getUserProfile(user) {
  const email = String(user?.email || '').toLowerCase();
  const nombre = String(user?.nombre || '').toLowerCase();
  const key = email || nombre;

  if (key.includes('juanfran')) return 'admin_full';
  if (key.includes('juanje')) return 'ops_core';
  if (key.includes('lida')) return 'mallorca_store';
  if (key.includes('andrea')) return 'commercial_only';
  if (key.includes('maria')) return 'commercial_only';
  if (key.includes('papi')) return 'store_commercial';
  return 'store_default';
}

export function canAccessSection(user, section) {
  const profile = getUserProfile(user);
  if (profile === 'admin_full') return true;

  const allowedByProfile = {
    ops_core: new Set(['dashboard', 'pedidos', 'tareas', 'notas', 'stock', 'caja', 'salidas', 'rutas', 'ia', 'fichajes', 'prestashop']),
    commercial_only: new Set(['dashboard', 'tareas', 'rutas', 'ia', 'fichajes', 'stock']),
    store_commercial: new Set(['dashboard', 'pedidos', 'tareas', 'notas', 'stock', 'caja', 'salidas', 'rutas', 'ia', 'fichajes', 'prestashop']),
    mallorca_store: new Set(['dashboard', 'tareas', 'notas', 'stock', 'caja', 'salidas', 'ia', 'fichajes', 'rutas']),
    store_default: new Set(['dashboard', 'tareas', 'notas', 'stock', 'caja', 'salidas', 'ia', 'fichajes']),
  };

  return allowedByProfile[profile]?.has(section) || false;
}
