const express = require('express');
const { db, log } = require('../db');
const { auth } = require('../middleware/auth');
const { getTienda } = require('../services/tiendaScope');

const router = express.Router();

function nextNumero() {
  const last = db.prepare(`SELECT numero FROM pedidos ORDER BY id DESC LIMIT 1`).get();
  if (!last) return 'PED-0001';
  const n = parseInt(last.numero.split('-')[1]) + 1;
  return `PED-${String(n).padStart(4, '0')}`;
}

// Listar
router.get('/', auth, (req, res) => {
  const { estado, urgente, zona_reparto, search, limit = 50, offset = 0 } = req.query;
  let where = ['p.tienda = ?'];
  const params = [getTienda(req.user)];

  if (estado) { where.push('p.estado = ?'); params.push(estado); }
  if (urgente === '1') { where.push('p.urgente = 1'); }
  if (zona_reparto) { where.push('p.zona_reparto = ?'); params.push(zona_reparto); }
  if (search) {
    where.push('(p.cliente_nombre LIKE ? OR p.numero LIKE ? OR p.cliente_email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const pedidos = db.prepare(`
    SELECT p.*, u.nombre as responsable_nombre, c.nombre as creador_nombre
    FROM pedidos p
    LEFT JOIN users u ON p.responsable_id = u.id
    LEFT JOIN users c ON p.created_by = c.id
    WHERE ${where.join(' AND ')}
    ORDER BY p.urgente DESC, p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset));

  // Añadir items a cada pedido
  const result = pedidos.map(p => ({
    ...p,
    items: db.prepare('SELECT * FROM pedido_items WHERE pedido_id = ?').all(p.id)
  }));

  const total = db.prepare(`SELECT COUNT(*) as n FROM pedidos p WHERE ${where.join(' AND ')}`).get(...params).n;

  res.json({ pedidos: result, total });
});

// Crear
router.post('/', auth, (req, res) => {
  const { cliente_nombre, cliente_dni, cliente_email, cliente_telefono, cliente_direccion, cliente_cp,
    zona_reparto, tipo_documento, descuento, metodo_envio, urgente, notas, responsable_id, items } = req.body;

  if (!cliente_nombre) return res.status(400).json({ error: 'Nombre de cliente requerido' });

  const numero = nextNumero();
  const tienda = getTienda(req.user);
  const stmt = db.prepare(`
    INSERT INTO pedidos (numero, tienda, cliente_nombre, cliente_dni, cliente_email, cliente_telefono,
      cliente_direccion, cliente_cp, zona_reparto, tipo_documento, descuento, metodo_envio, urgente, notas,
      responsable_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const r = stmt.run(numero, tienda, cliente_nombre, cliente_dni || null, cliente_email || null,
    cliente_telefono || null, cliente_direccion || null, cliente_cp || null,
    zona_reparto || 'ZONA MURCIA', tipo_documento || 'factura', descuento || 0, metodo_envio || 'envio',
    urgente ? 1 : 0, notas || null, responsable_id || null, req.user.id);

  const pedidoId = r.lastInsertRowid;

  if (items && items.length > 0) {
    const itemStmt = db.prepare(`INSERT INTO pedido_items (pedido_id, producto_nombre, cantidad, precio_unitario) VALUES (?, ?, ?, ?)`);
    items.forEach(item => itemStmt.run(pedidoId, item.producto_nombre, item.cantidad || 1, item.precio_unitario || 0));
  }

  log('pedidos', pedidoId, 'crear', req.user.id, { numero, cliente_nombre });
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ? AND tienda = ?').get(pedidoId, tienda);
  res.status(201).json({ ...pedido, items: db.prepare('SELECT * FROM pedido_items WHERE pedido_id = ?').all(pedidoId) });
});

// Obtener uno
router.get('/:id', auth, (req, res) => {
  const pedido = db.prepare('SELECT p.*, u.nombre as responsable_nombre FROM pedidos p LEFT JOIN users u ON p.responsable_id = u.id WHERE p.id = ? AND p.tienda = ?').get(req.params.id, getTienda(req.user));
  if (!pedido) return res.status(404).json({ error: 'No encontrado' });
  const items = db.prepare('SELECT * FROM pedido_items WHERE pedido_id = ?').all(pedido.id);
  const historial = db.prepare('SELECT a.*, u.nombre as usuario FROM actividad a LEFT JOIN users u ON a.usuario_id = u.id WHERE a.tabla = ? AND a.registro_id = ? ORDER BY a.created_at DESC').all('pedidos', pedido.id);
  res.json({ ...pedido, items, historial });
});

// Actualizar estado
router.patch('/:id/estado', auth, (req, res) => {
  const { estado } = req.body;
  const estados = ['pendiente', 'preparando', 'listo', 'enviado', 'entregado', 'incidencia', 'cancelado'];
  if (!estados.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });

  db.prepare(`UPDATE pedidos SET estado = ?, updated_at = datetime('now','localtime') WHERE id = ? AND tienda = ?`).run(estado, req.params.id, getTienda(req.user));
  log('pedidos', parseInt(req.params.id), 'cambiar_estado', req.user.id, { estado });
  res.json({ ok: true });
});

// Actualizar pedido completo
router.put('/:id', auth, (req, res) => {
  const { cliente_nombre, cliente_dni, cliente_email, cliente_telefono, cliente_direccion,
    cliente_cp, zona_reparto, tipo_documento, descuento, metodo_envio, urgente, notas, responsable_id, items } = req.body;

  db.prepare(`
    UPDATE pedidos SET cliente_nombre=?, cliente_dni=?, cliente_email=?, cliente_telefono=?,
    cliente_direccion=?, cliente_cp=?, zona_reparto=?, tipo_documento=?, descuento=?, metodo_envio=?,
    urgente=?, notas=?, responsable_id=?, updated_at=datetime('now','localtime') WHERE id=? AND tienda=?
  `).run(cliente_nombre, cliente_dni, cliente_email, cliente_telefono, cliente_direccion,
    cliente_cp, zona_reparto || 'ZONA MURCIA', tipo_documento, descuento, metodo_envio, urgente ? 1 : 0, notas, responsable_id, req.params.id, getTienda(req.user));

  if (items) {
    db.prepare('DELETE FROM pedido_items WHERE pedido_id = ?').run(req.params.id);
    const stmt = db.prepare(`INSERT INTO pedido_items (pedido_id, producto_nombre, cantidad, precio_unitario) VALUES (?, ?, ?, ?)`);
    items.forEach(item => stmt.run(req.params.id, item.producto_nombre, item.cantidad || 1, item.precio_unitario || 0));
  }

  log('pedidos', parseInt(req.params.id), 'editar', req.user.id, { cliente_nombre });
  res.json({ ok: true });
});

module.exports = router;
