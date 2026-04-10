const express = require('express');
const { db, log, notify } = require('../db');
const { auth } = require('../middleware/auth');
const { getTienda } = require('../services/tiendaScope');

const router = express.Router();
const NOTE_PRIORIDADES = new Set(['alta', 'normal', 'baja']);
const NOTE_CATEGORIAS = new Set(['general', 'pedidos', 'stock', 'clientes', 'web', 'direccion', 'equipo']);
const NOTE_ESTADOS = new Set(['abierta', 'hecha']);

function noteRecipients(tienda, excludeUserId) {
  return db.prepare(`
    SELECT id
    FROM users
    WHERE activo = 1 AND tienda = ? AND id != ?
  `).all(tienda, excludeUserId);
}

router.get('/', auth, (req, res) => {
  const tienda = getTienda(req.user);
  const search = String(req.query.search || '').trim();
  const prioridad = String(req.query.prioridad || '').trim();
  const categoria = String(req.query.categoria || '').trim();
  const estado = String(req.query.estado || '').trim();
  const soloPinned = String(req.query.pinned || '') === '1';

  let sql = `
    SELECT n.*, u.nombre as autor FROM notas n
    LEFT JOIN users u ON n.autor_id = u.id
    WHERE n.tienda = ?
  `;
  const params = [tienda];
  if (search) {
    sql += ` AND (LOWER(n.contenido) LIKE ? OR LOWER(COALESCE(u.nombre, '')) LIKE ?)`;
    params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
  }
  if (NOTE_PRIORIDADES.has(prioridad)) {
    sql += ` AND n.prioridad = ?`;
    params.push(prioridad);
  }
  if (NOTE_CATEGORIAS.has(categoria)) {
    sql += ` AND n.categoria = ?`;
    params.push(categoria);
  }
  if (NOTE_ESTADOS.has(estado)) {
    sql += ` AND n.estado = ?`;
    params.push(estado);
  }
  if (soloPinned) {
    sql += ` AND n.pinned = 1`;
  }
  sql += ` ORDER BY n.pinned DESC, CASE n.prioridad WHEN 'alta' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, n.created_at DESC LIMIT 80`;
  const notas = db.prepare(sql).all(...params);
  res.json(notas);
});

router.post('/', auth, (req, res) => {
  const { contenido, pinned } = req.body;
  const prioridad = NOTE_PRIORIDADES.has(String(req.body.prioridad || '')) ? req.body.prioridad : 'normal';
  const categoria = NOTE_CATEGORIAS.has(String(req.body.categoria || '')) ? req.body.categoria : 'general';
  const estado = NOTE_ESTADOS.has(String(req.body.estado || '')) ? req.body.estado : 'abierta';
  if (!contenido) return res.status(400).json({ error: 'Contenido requerido' });

  const tienda = getTienda(req.user);
  const result = db.prepare(`
    INSERT INTO notas (tienda, contenido, autor_id, categoria, prioridad, estado, pinned, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
  `).run(tienda, contenido, req.user.id, categoria, prioridad, estado, pinned ? 1 : 0);

  log('notas', result.lastInsertRowid, 'crear', req.user.id, {});

  noteRecipients(tienda, req.user.id).forEach((user) => {
    notify(
      user.id,
      'nota',
      pinned ? 'Nota fijada nueva' : 'Nota nueva',
      `${req.user.nombre} ha dejado un aviso para el equipo.`,
      '/notas'
    );
  });

  res.status(201).json(
    db.prepare(`
      SELECT n.*, u.nombre as autor
      FROM notas n
      LEFT JOIN users u ON n.autor_id = u.id
      WHERE n.id = ? AND n.tienda = ?
    `).get(result.lastInsertRowid, tienda)
  );
});

router.patch('/:id/pin', auth, (req, res) => {
  const nota = db.prepare('SELECT pinned FROM notas WHERE id = ? AND tienda = ?').get(req.params.id, getTienda(req.user));
  if (!nota) return res.status(404).json({ error: 'No encontrada' });
  db.prepare(`UPDATE notas SET pinned = ?, updated_at = datetime('now','localtime') WHERE id = ? AND tienda = ?`).run(nota.pinned ? 0 : 1, req.params.id, getTienda(req.user));
  res.json({ ok: true });
});

router.patch('/:id', auth, (req, res) => {
  const tienda = getTienda(req.user);
  const nota = db.prepare('SELECT * FROM notas WHERE id = ? AND tienda = ?').get(req.params.id, tienda);
  if (!nota) return res.status(404).json({ error: 'No encontrada' });
  const contenido = String(req.body.contenido || nota.contenido || '').trim();
  if (!contenido) return res.status(400).json({ error: 'Contenido requerido' });
  const prioridad = NOTE_PRIORIDADES.has(String(req.body.prioridad || '')) ? req.body.prioridad : nota.prioridad || 'normal';
  const categoria = NOTE_CATEGORIAS.has(String(req.body.categoria || '')) ? req.body.categoria : nota.categoria || 'general';
  const estado = NOTE_ESTADOS.has(String(req.body.estado || '')) ? req.body.estado : nota.estado || 'abierta';
  db.prepare(`
    UPDATE notas
    SET contenido = ?, categoria = ?, prioridad = ?, estado = ?, updated_at = datetime('now','localtime')
    WHERE id = ? AND tienda = ?
  `).run(contenido, categoria, prioridad, estado, req.params.id, tienda);
  res.json({ ok: true });
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM notas WHERE id = ? AND tienda = ?').run(req.params.id, getTienda(req.user));
  res.json({ ok: true });
});

module.exports = router;
