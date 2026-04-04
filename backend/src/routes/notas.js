const express = require('express');
const { db, log } = require('../db');
const { auth } = require('../middleware/auth');
const { getTienda } = require('../services/tiendaScope');

const router = express.Router();

router.get('/', auth, (req, res) => {
  const notas = db.prepare(`
    SELECT n.*, u.nombre as autor FROM notas n
    LEFT JOIN users u ON n.autor_id = u.id
    WHERE n.tienda = ?
    ORDER BY n.pinned DESC, n.created_at DESC
    LIMIT 50
  `).all(getTienda(req.user));
  res.json(notas);
});

router.post('/', auth, (req, res) => {
  const { contenido, pinned } = req.body;
  if (!contenido) return res.status(400).json({ error: 'Contenido requerido' });

  const r = db.prepare(`INSERT INTO notas (tienda, contenido, autor_id, pinned) VALUES (?, ?, ?, ?)`).run(getTienda(req.user), contenido, req.user.id, pinned ? 1 : 0);
  log('notas', r.lastInsertRowid, 'crear', req.user.id, {});
  res.status(201).json(db.prepare(`SELECT n.*, u.nombre as autor FROM notas n LEFT JOIN users u ON n.autor_id = u.id WHERE n.id = ? AND n.tienda = ?`).get(r.lastInsertRowid, getTienda(req.user)));
});

router.patch('/:id/pin', auth, (req, res) => {
  const nota = db.prepare('SELECT pinned FROM notas WHERE id = ? AND tienda = ?').get(req.params.id, getTienda(req.user));
  if (!nota) return res.status(404).json({ error: 'No encontrada' });
  db.prepare('UPDATE notas SET pinned = ? WHERE id = ? AND tienda = ?').run(nota.pinned ? 0 : 1, req.params.id, getTienda(req.user));
  res.json({ ok: true });
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM notas WHERE id = ? AND tienda = ?').run(req.params.id, getTienda(req.user));
  res.json({ ok: true });
});

module.exports = router;
