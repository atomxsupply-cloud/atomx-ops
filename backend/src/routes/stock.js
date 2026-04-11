const express = require('express');
const fs = require('fs');
const path = require('path');
const { db, log } = require('../db');
const { auth } = require('../middleware/auth');
const { getTienda } = require('../services/tiendaScope');

const router = express.Router();
const MATERIALS_CATALOG_PATH = path.join(__dirname, '..', '..', '..', 'datos', 'catalogo-web', 'catalogo_materiales_por_familia.json');

let materialsCatalogCache = null;
let materialsCatalogCacheMtime = 0;

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function loadMaterialsCatalog() {
  try {
    const stat = fs.statSync(MATERIALS_CATALOG_PATH);
    if (!materialsCatalogCache || stat.mtimeMs !== materialsCatalogCacheMtime) {
      materialsCatalogCache = JSON.parse(fs.readFileSync(MATERIALS_CATALOG_PATH, 'utf8'));
      materialsCatalogCacheMtime = stat.mtimeMs;
    }
    return materialsCatalogCache || {};
  } catch {
    return {};
  }
}

router.get('/materiales/catalogo', auth, (req, res) => {
  const { familia = '', search = '', en_stock = '0', limit = '40' } = req.query;
  const catalog = loadMaterialsCatalog();
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 120);
  const onlyInStock = en_stock === '1';
  const normalizedSearch = normalizeText(search);
  const requestedFamily = String(familia || '').trim();

  const families = Object.entries(catalog)
    .map(([familyKey, items]) => ({
      key: familyKey,
      label: familyKey.replace(/_/g, ' '),
      total: Array.isArray(items) ? items.length : 0,
    }))
    .filter((family) => family.total > 0)
    .sort((a, b) => b.total - a.total);

  const sourceItems = requestedFamily && Array.isArray(catalog[requestedFamily])
    ? catalog[requestedFamily]
    : Object.values(catalog).flat();

  const items = sourceItems
    .filter((item) => {
      const stock = Number(item.cantidad || 0);
      if (onlyInStock && stock <= 0) return false;
      if (!normalizedSearch) return true;
      const haystack = normalizeText(`${item.nombre} ${item.referencia} ${item.categoria} ${item.familia}`);
      return haystack.includes(normalizedSearch);
    })
    .slice(0, safeLimit)
    .map((item) => ({
      id: item.id,
      nombre: item.nombre,
      referencia: item.referencia || '',
      categoria: item.categoria || '',
      familia: item.familia || requestedFamily || '',
      precio: Number(item.precio || 0),
      stock_actual: Number(item.cantidad || 0),
      activo: String(item.estado || '0') === '1',
      imagen: item.imagen || '',
    }));

  res.json({
    families,
    items,
    meta: {
      family: requestedFamily || null,
      search: search || '',
      en_stock: onlyInStock,
      limit: safeLimit,
      total: items.length,
    },
  });
});

router.get('/', auth, (req, res) => {
  const { bajo_minimo, categoria, proveedor, search } = req.query;
  let where = ['p.tienda = ?'];
  const params = [getTienda(req.user)];

  if (bajo_minimo === '1') { where.push('p.stock_actual <= p.stock_minimo'); }
  if (categoria) { where.push('p.categoria = ?'); params.push(categoria); }
  if (proveedor) { where.push('p.proveedor = ?'); params.push(proveedor); }
  if (search) { where.push('p.nombre LIKE ?'); params.push(`%${search}%`); }

  const productos = db.prepare(`
    SELECT p.*, u.nombre as actualizado_por
    FROM productos p
    LEFT JOIN users u ON p.updated_by = u.id
    WHERE ${where.join(' AND ')}
    ORDER BY (p.stock_actual <= p.stock_minimo) DESC, p.nombre ASC
  `).all(...params);

  res.json(productos);
});

router.post('/', auth, (req, res) => {
  const { nombre, categoria, proveedor, stock_actual, stock_minimo } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });

  const r = db.prepare(`INSERT INTO productos (tienda, nombre, categoria, proveedor, stock_actual, stock_minimo, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    getTienda(req.user), nombre, categoria || null, proveedor || null, stock_actual || 0, stock_minimo || 5, req.user.id
  );
  log('productos', r.lastInsertRowid, 'crear', req.user.id, { nombre });
  res.status(201).json(db.prepare('SELECT * FROM productos WHERE id = ? AND tienda = ?').get(r.lastInsertRowid, getTienda(req.user)));
});

router.put('/:id', auth, (req, res) => {
  const { nombre, categoria, proveedor, stock_actual, stock_minimo } = req.body;
  db.prepare(`
    UPDATE productos SET nombre=?, categoria=?, proveedor=?, stock_actual=?, stock_minimo=?,
    updated_by=?, updated_at=datetime('now','localtime') WHERE id=? AND tienda=?
  `).run(nombre, categoria, proveedor, stock_actual, stock_minimo, req.user.id, req.params.id, getTienda(req.user));
  log('productos', parseInt(req.params.id), 'editar', req.user.id, { stock_actual });
  res.json({ ok: true });
});

router.patch('/:id/stock', auth, (req, res) => {
  const { stock_actual } = req.body;
  db.prepare(`UPDATE productos SET stock_actual=?, updated_by=?, updated_at=datetime('now','localtime') WHERE id=? AND tienda=?`).run(stock_actual, req.user.id, req.params.id, getTienda(req.user));
  log('productos', parseInt(req.params.id), 'editar_stock', req.user.id, { stock_actual });
  res.json({ ok: true });
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM productos WHERE id = ? AND tienda = ?').run(req.params.id, getTienda(req.user));
  res.json({ ok: true });
});

module.exports = router;
