function getProfile(user) {
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

function canAccessSection(user, section) {
  const profile = getProfile(user);
  if (profile === 'admin_full') return true;

  const allowedByProfile = {
    ops_core: new Set(['dashboard', 'pedidos', 'tareas', 'notas', 'stock', 'caja', 'salidas', 'checklist', 'ia', 'auth', 'rutas', 'fichajes', 'prestashop']),
    commercial_only: new Set(['dashboard', 'tareas', 'rutas', 'ia', 'auth', 'fichajes', 'stock']),
    store_commercial: new Set(['dashboard', 'pedidos', 'tareas', 'notas', 'stock', 'caja', 'salidas', 'checklist', 'ia', 'auth', 'rutas', 'fichajes', 'prestashop']),
    mallorca_store: new Set(['dashboard', 'tareas', 'notas', 'stock', 'caja', 'salidas', 'ia', 'auth', 'fichajes', 'rutas']),
    store_default: new Set(['dashboard', 'tareas', 'notas', 'stock', 'caja', 'salidas', 'checklist', 'ia', 'auth', 'fichajes']),
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
