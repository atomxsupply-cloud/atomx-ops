function getProfile(user) {
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

function canAccessSection(user, section) {
  const profile = getProfile(user);
  if (section === 'factusol') return profile === 'admin_full';
  if (section === 'buscador') return true;
  if (section === 'designia') return true;
  if (profile === 'admin_full') return true;

  const allowedByProfile = {
    ops_core: new Set(['dashboard', 'buscador', 'designia', 'clientes', 'pedidos', 'tareas', 'notas', 'stock', 'caja', 'salidas', 'checklist', 'auth', 'rutas', 'fichajes', 'prestashop']),
    commercial_only: new Set(['dashboard', 'buscador', 'designia', 'tareas', 'rutas', 'auth', 'fichajes', 'stock']),
    store_commercial: new Set(['dashboard', 'buscador', 'designia', 'clientes', 'pedidos', 'tareas', 'notas', 'stock', 'caja', 'salidas', 'checklist', 'auth', 'rutas', 'fichajes', 'prestashop']),
    mallorca_store: new Set(['dashboard', 'buscador', 'designia', 'clientes', 'tareas', 'notas', 'stock', 'caja', 'salidas', 'auth', 'fichajes', 'rutas']),
    store_default: new Set(['dashboard', 'buscador', 'designia', 'tareas', 'notas', 'stock', 'caja', 'salidas', 'checklist', 'auth', 'fichajes']),
  };

  return allowedByProfile[profile]?.has(section) || false;
}

function requireSection(section) {
  return (req, res, next) => {
    if (!canAccessSection(req.user, section)) {
      return res.status(403).json({ error: 'Sin acceso a esta seccion' });
    }
    next();
  };
}

module.exports = { getProfile, canAccessSection, requireSection };
