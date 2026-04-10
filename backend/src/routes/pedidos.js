const express = require('express');
const { db, log, notify } = require('../db');
const { auth } = require('../middleware/auth');
const { getTienda } = require('../services/tiendaScope');

const router = express.Router();

function nextNumero() {
  const last = db.prepare(`SELECT numero FROM pedidos ORDER BY id DESC LIMIT 1`).get();
  if (!last) return 'PED-0001';
  const n = parseInt(last.numero.split('-')[1], 10) + 1;
  return `PED-${String(n).padStart(4, '0')}`;
}

function teamRecipients(tienda, excludeUserId, includeUserId = null) {
  const rows = db.prepare(`
    SELECT id
    FROM users
    WHERE activo = 1 AND tienda = ?
  `).all(tienda);

  const ids = new Set();
  rows.forEach((row) => {
    if (row.id !== excludeUserId) ids.add(row.id);
  });
  if (includeUserId && includeUserId !== excludeUserId) ids.add(includeUserId);
  return [...ids];
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function isInternalClient(name) {
  const value = normalizeText(name);
  return value.startsWith('ventas tienda') || value.startsWith('tattoo ');
}

function upsertClienteFromPedido({
  tienda,
  cliente_nombre,
  cliente_dni,
  cliente_email,
  cliente_telefono,
  cliente_direccion,
  cliente_cp,
  zona_reparto,
}) {
  const nombre = String(cliente_nombre || '').trim();
  if (!nombre) return null;

  const nif = String(cliente_dni || '').trim() || null;
  const telefono = String(cliente_telefono || '').trim() || null;
  const email = String(cliente_email || '').trim() || null;
  const direccion = String(cliente_direccion || '').trim() || null;
  const cp = String(cliente_cp || '').trim() || null;
  const zona = String(zona_reparto || '').trim() || 'ZONA MURCIA';
  const interno = isInternalClient(nombre) ? 1 : 0;

  const existing = nif
    ? db.prepare(`
        SELECT id
        FROM clientes
        WHERE codigo_externo IS NULL
          AND nombre = ?
          AND nif = ?
        LIMIT 1
      `).get(nombre, nif)
    : db.prepare(`
        SELECT id
        FROM clientes
        WHERE codigo_externo IS NULL
          AND nombre = ?
        LIMIT 1
      `).get(nombre);

  if (existing?.id) {
    db.prepare(`
      UPDATE clientes
      SET telefono = COALESCE(?, telefono),
          email = COALESCE(?, email),
          direccion = COALESCE(?, direccion),
          cp = COALESCE(?, cp),
          nif = COALESCE(?, nif),
          zona_reparto = COALESCE(?, zona_reparto),
          es_interno = ?,
          updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      telefono,
      email,
      direccion,
      cp,
      nif,
      zona,
      interno,
      existing.id
    );
    return existing.id;
  }

  const result = db.prepare(`
    INSERT INTO clientes (
      nombre, telefono, email, direccion, cp, nif, zona_reparto, es_interno, origen, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pedido_manual', datetime('now','localtime'))
  `).run(
    nombre,
    telefono,
    email,
    direccion,
    cp,
    nif,
    zona,
    interno
  );

  return result.lastInsertRowid;
}

router.get('/', auth, (req, res) => {
  const { estado, urgente, zona_reparto, search, limit = 50, offset = 0 } = req.query;
  const where = ['p.tienda = ?'];
  const params = [getTienda(req.user)];

  if (estado) {
    where.push('p.estado = ?');
    params.push(estado);
  }
  if (urgente === '1') {
    where.push('p.urgente = 1');
  }
  if (zona_reparto) {
    where.push('p.zona_reparto = ?');
    params.push(zona_reparto);
  }
  if (search) {
    where.push(`(
      p.cliente_nombre LIKE ?
      OR p.numero LIKE ?
      OR p.cliente_email LIKE ?
      OR p.cliente_telefono LIKE ?
      OR p.cliente_dni LIKE ?
      OR p.cliente_direccion LIKE ?
      OR p.cliente_cp LIKE ?
      OR EXISTS (
        SELECT 1
        FROM pedido_items pi
        WHERE pi.pedido_id = p.id
          AND pi.producto_nombre LIKE ?
      )
    )`);
    params.push(
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`
    );
  }

  const pedidos = db.prepare(`
    SELECT p.*, u.nombre as responsable_nombre, c.nombre as creador_nombre
    FROM pedidos p
    LEFT JOIN users u ON p.responsable_id = u.id
    LEFT JOIN users c ON p.created_by = c.id
    WHERE ${where.join(' AND ')}
    ORDER BY p.urgente DESC, p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit, 10), parseInt(offset, 10));

  const result = pedidos.map((pedido) => ({
    ...pedido,
    items: db.prepare('SELECT * FROM pedido_items WHERE pedido_id = ?').all(pedido.id),
  }));

  const total = db.prepare(`SELECT COUNT(*) as n FROM pedidos p WHERE ${where.join(' AND ')}`).get(...params).n;

  res.json({ pedidos: result, total });
});

router.post('/', auth, (req, res) => {
  const {
    cliente_nombre,
    cliente_dni,
    cliente_email,
    cliente_telefono,
    cliente_direccion,
    cliente_cp,
    zona_reparto,
    tipo_documento,
    descuento,
    metodo_envio,
    urgente,
    notas,
    responsable_id,
    items,
  } = req.body;

  if (!cliente_nombre) return res.status(400).json({ error: 'Nombre de cliente requerido' });

  const numero = nextNumero();
  const tienda = getTienda(req.user);
  const stmt = db.prepare(`
    INSERT INTO pedidos (numero, tienda, cliente_nombre, cliente_dni, cliente_email, cliente_telefono,
      cliente_direccion, cliente_cp, zona_reparto, tipo_documento, descuento, metodo_envio, urgente, notas,
      responsable_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    numero,
    tienda,
    cliente_nombre,
    cliente_dni || null,
    cliente_email || null,
    cliente_telefono || null,
    cliente_direccion || null,
    cliente_cp || null,
    zona_reparto || 'ZONA MURCIA',
    tipo_documento || 'factura',
    descuento || 0,
    metodo_envio || 'envio',
    urgente ? 1 : 0,
    notas || null,
    responsable_id || null,
    req.user.id
  );

  upsertClienteFromPedido({
    tienda,
    cliente_nombre,
    cliente_dni,
    cliente_email,
    cliente_telefono,
    cliente_direccion,
    cliente_cp,
    zona_reparto,
  });

  const pedidoId = result.lastInsertRowid;

  if (items && items.length > 0) {
    const itemStmt = db.prepare(`
      INSERT INTO pedido_items (pedido_id, producto_nombre, cantidad, precio_unitario)
      VALUES (?, ?, ?, ?)
    `);
    items.forEach((item) => itemStmt.run(
      pedidoId,
      item.producto_nombre,
      item.cantidad || 1,
      item.precio_unitario || 0
    ));
  }

  log('pedidos', pedidoId, 'crear', req.user.id, { numero, cliente_nombre });

  teamRecipients(tienda, req.user.id, responsable_id).forEach((userId) => {
    notify(
      userId,
      'pedido',
      'Pedido nuevo',
      `${req.user.nombre} ha creado ${numero} para ${cliente_nombre}${urgente ? ' (urgente)' : ''}.`,
      '/pedidos'
    );
  });

  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ? AND tienda = ?').get(pedidoId, tienda);
  res.status(201).json({
    ...pedido,
    items: db.prepare('SELECT * FROM pedido_items WHERE pedido_id = ?').all(pedidoId),
  });
});

router.get('/:id', auth, (req, res) => {
  const pedido = db.prepare(`
    SELECT p.*, u.nombre as responsable_nombre
    FROM pedidos p
    LEFT JOIN users u ON p.responsable_id = u.id
    WHERE p.id = ? AND p.tienda = ?
  `).get(req.params.id, getTienda(req.user));

  if (!pedido) return res.status(404).json({ error: 'No encontrado' });

  const items = db.prepare('SELECT * FROM pedido_items WHERE pedido_id = ?').all(pedido.id);
  const historial = db.prepare(`
    SELECT a.*, u.nombre as usuario
    FROM actividad a
    LEFT JOIN users u ON a.usuario_id = u.id
    WHERE a.tabla = ? AND a.registro_id = ?
    ORDER BY a.created_at DESC
  `).all('pedidos', pedido.id);

  res.json({ ...pedido, items, historial });
});

router.patch('/:id/estado', auth, (req, res) => {
  const { estado } = req.body;
  const estados = ['pendiente', 'preparando', 'listo', 'enviado', 'entregado', 'incidencia', 'cancelado'];
  if (!estados.includes(estado)) return res.status(400).json({ error: 'Estado invalido' });

  const tienda = getTienda(req.user);
  const pedido = db.prepare(`
    SELECT numero, cliente_nombre, responsable_id
    FROM pedidos
    WHERE id = ? AND tienda = ?
  `).get(req.params.id, tienda);

  db.prepare(`
    UPDATE pedidos
    SET estado = ?, updated_at = datetime('now','localtime')
    WHERE id = ? AND tienda = ?
  `).run(estado, req.params.id, tienda);

  log('pedidos', parseInt(req.params.id, 10), 'cambiar_estado', req.user.id, { estado });

  if (pedido) {
    teamRecipients(tienda, req.user.id, pedido.responsable_id).forEach((userId) => {
      notify(
        userId,
        'pedido',
        'Pedido actualizado',
        `${req.user.nombre} ha puesto ${pedido.numero} en ${estado}.`,
        '/pedidos'
      );
    });
  }

  res.json({ ok: true });
});

router.put('/:id', auth, (req, res) => {
  const {
    cliente_nombre,
    cliente_dni,
    cliente_email,
    cliente_telefono,
    cliente_direccion,
    cliente_cp,
    zona_reparto,
    tipo_documento,
    descuento,
    metodo_envio,
    urgente,
    notas,
    responsable_id,
    items,
  } = req.body;

  const tienda = getTienda(req.user);

  db.prepare(`
    UPDATE pedidos SET cliente_nombre=?, cliente_dni=?, cliente_email=?, cliente_telefono=?,
    cliente_direccion=?, cliente_cp=?, zona_reparto=?, tipo_documento=?, descuento=?, metodo_envio=?,
    urgente=?, notas=?, responsable_id=?, updated_at=datetime('now','localtime') WHERE id=? AND tienda=?
  `).run(
    cliente_nombre,
    cliente_dni,
    cliente_email,
    cliente_telefono,
    cliente_direccion,
    cliente_cp,
    zona_reparto || 'ZONA MURCIA',
    tipo_documento,
    descuento,
    metodo_envio,
    urgente ? 1 : 0,
    notas,
    responsable_id,
    req.params.id,
    tienda
  );

  upsertClienteFromPedido({
    tienda,
    cliente_nombre,
    cliente_dni,
    cliente_email,
    cliente_telefono,
    cliente_direccion,
    cliente_cp,
    zona_reparto,
  });

  if (items) {
    db.prepare('DELETE FROM pedido_items WHERE pedido_id = ?').run(req.params.id);
    const stmt = db.prepare(`
      INSERT INTO pedido_items (pedido_id, producto_nombre, cantidad, precio_unitario)
      VALUES (?, ?, ?, ?)
    `);
    items.forEach((item) => stmt.run(
      req.params.id,
      item.producto_nombre,
      item.cantidad || 1,
      item.precio_unitario || 0
    ));
  }

  log('pedidos', parseInt(req.params.id, 10), 'editar', req.user.id, { cliente_nombre });

  const pedido = db.prepare('SELECT numero FROM pedidos WHERE id = ? AND tienda = ?').get(req.params.id, tienda);
  teamRecipients(tienda, req.user.id, responsable_id).forEach((userId) => {
    notify(
      userId,
      'pedido',
      'Pedido retocado',
      `${req.user.nombre} ha actualizado ${pedido?.numero || 'un pedido'} de ${cliente_nombre}.`,
      '/pedidos'
    );
  });

  res.json({ ok: true });
});

module.exports = router;
