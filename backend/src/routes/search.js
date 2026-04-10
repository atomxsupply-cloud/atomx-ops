const express = require('express');
const { db } = require('../db');
const { auth } = require('../middleware/auth');
const { getTienda } = require('../services/tiendaScope');

const router = express.Router();

router.get('/global', auth, (req, res) => {
  const q = String(req.query.q || '').trim();
  const limit = Math.min(parseInt(req.query.limit || '5', 10), 8);
  const tienda = getTienda(req.user);

  if (!q) {
    return res.json({
      query: '',
      clientes: [],
      pedidos: [],
      tareas: [],
      rutas: [],
      productos: [],
    });
  }

  const text = `%${q}%`;
  const normalizedPhone = `%${q.replace(/\s+/g, '')}%`;

  const clientes = db.prepare(`
    SELECT id, nombre, telefono, direccion, zona_reparto
    FROM clientes
    WHERE es_interno = 0
      AND (
        nombre LIKE ?
        OR telefono LIKE ?
        OR direccion LIKE ?
        OR poblacion LIKE ?
        OR nif LIKE ?
      )
    ORDER BY
      CASE WHEN lower(nombre) = lower(?) THEN 0
           WHEN lower(nombre) LIKE lower(?) THEN 1
           ELSE 2 END,
      datetime(updated_at) DESC,
      nombre ASC
    LIMIT ?
  `).all(text, text, text, text, text, q, `${q}%`, limit);

  const pedidos = db.prepare(`
    SELECT id, numero, cliente_nombre, estado, zona_reparto, urgente, created_at
    FROM pedidos
    WHERE tienda = ?
      AND (
        numero LIKE ?
        OR cliente_nombre LIKE ?
        OR cliente_telefono LIKE ?
        OR cliente_direccion LIKE ?
        OR EXISTS (
          SELECT 1
          FROM pedido_items pi
          WHERE pi.pedido_id = pedidos.id
            AND pi.producto_nombre LIKE ?
        )
      )
    ORDER BY urgente DESC, datetime(created_at) DESC
    LIMIT ?
  `).all(tienda, text, text, text, text, text, limit);

  const tareas = db.prepare(`
    SELECT t.id, t.titulo, t.estado, t.prioridad, u.nombre as asignado_nombre
    FROM tareas t
    LEFT JOIN users u ON u.id = t.asignado_a
    WHERE t.tienda = ?
      AND (
        t.titulo LIKE ?
        OR ifnull(t.descripcion, '') LIKE ?
        OR ifnull(t.categoria, '') LIKE ?
      )
    ORDER BY
      CASE WHEN t.estado = 'pendiente' THEN 0 ELSE 1 END,
      datetime(t.updated_at) DESC
    LIMIT ?
  `).all(tienda, text, text, text, limit);

  const rutas = db.prepare(`
    SELECT rc.id, rc.estudio, rc.direccion, rc.estado, u.nombre as asignado_nombre
    FROM rutas_comerciales rc
    LEFT JOIN users u ON u.id = rc.asignado_a
    WHERE rc.tienda = ?
      AND (
        rc.estudio LIKE ?
        OR ifnull(rc.direccion, '') LIKE ?
        OR ifnull(rc.nota, '') LIKE ?
      )
    ORDER BY
      CASE WHEN rc.estado = 'pendiente' THEN 0 ELSE 1 END,
      datetime(rc.updated_at) DESC
    LIMIT ?
  `).all(tienda, text, text, text, limit);

  const productosLocales = db.prepare(`
    SELECT nombre, categoria, stock_actual, proveedor, 'local' as origen
    FROM productos
    WHERE tienda = ?
      AND (
        nombre LIKE ?
        OR ifnull(categoria, '') LIKE ?
        OR ifnull(proveedor, '') LIKE ?
      )
    ORDER BY
      CASE WHEN lower(nombre) = lower(?) THEN 0
           WHEN lower(nombre) LIKE lower(?) THEN 1
           ELSE 2 END,
      nombre ASC
    LIMIT ?
  `).all(tienda, text, text, text, q, `${q}%`, limit);

  const productosPrestashop = db.prepare(`
    SELECT nombre, referencia, stock_actual, 'prestashop' as origen
    FROM prestashop_products_cache
    WHERE nombre LIKE ?
       OR ifnull(referencia, '') LIKE ?
    ORDER BY
      CASE WHEN lower(nombre) = lower(?) THEN 0
           WHEN lower(nombre) LIKE lower(?) THEN 1
           ELSE 2 END,
      datetime(last_seen_at) DESC,
      nombre ASC
    LIMIT ?
  `).all(text, text, q, `${q}%`, limit);

  const seen = new Set();
  const productos = [...productosLocales, ...productosPrestashop].filter((item) => {
    const key = `${item.nombre}|${item.referencia || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);

  res.json({
    query: q,
    clientes,
    pedidos,
    tareas,
    rutas,
    productos,
    total:
      clientes.length +
      pedidos.length +
      tareas.length +
      rutas.length +
      productos.length,
  });
});

module.exports = router;
