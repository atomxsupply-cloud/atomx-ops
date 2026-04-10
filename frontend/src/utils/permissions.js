export function getUserProfile(user) {
  const explicitRole = String(user?.rol || '').toLowerCase();
  if (['admin_full', 'ops_core', 'store_commercial', 'commercial_only', 'mallorca_store', 'store_default'].includes(explicitRole)) {
    return explicitRole;
  }
  const email = String(user?.email || '').toLowerCase();
  const nombre = String(user?.nombre || '').toLowerCase();
  const key = email || nombre;

  if (key.includes('juanfran')) return 'admin_full';
  if (key.includes('juanje')) return 'ops_core';
  if (key.includes('lida')) return 'mallorca_store';
  if (key.includes('andrea')) return 'store_commercial';
  if (key.includes('maria')) return 'commercial_only';
  if (key.includes('papi')) return 'store_commercial';
  return 'store_default';
}

export function canAccessSection(user, section) {
  const profile = getUserProfile(user);
  if (section === 'factusol') return profile === 'admin_full';
  if (section === 'buscador') return true;
  if (section === 'designia') return true;
  if (profile === 'admin_full') return true;

  const allowedByProfile = {
    ops_core: new Set(['dashboard', 'buscador', 'designia', 'clientes', 'pedidos', 'tareas', 'notas', 'stock', 'caja', 'salidas', 'rutas', 'fichajes', 'prestashop']),
    commercial_only: new Set(['dashboard', 'buscador', 'designia', 'tareas', 'rutas', 'fichajes', 'stock']),
    store_commercial: new Set(['dashboard', 'buscador', 'designia', 'clientes', 'pedidos', 'tareas', 'notas', 'stock', 'caja', 'salidas', 'rutas', 'fichajes', 'prestashop']),
    mallorca_store: new Set(['dashboard', 'buscador', 'designia', 'clientes', 'tareas', 'notas', 'stock', 'caja', 'salidas', 'fichajes', 'rutas']),
    store_default: new Set(['dashboard', 'buscador', 'designia', 'tareas', 'notas', 'stock', 'caja', 'salidas', 'fichajes']),
  };

  return allowedByProfile[profile]?.has(section) || false;
}
