const express = require('express');
const { db } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, (req, res) => {
  const items = db.prepare(`
    SELECT *
    FROM notificaciones
    WHERE user_id = ?
    ORDER BY leida ASC, created_at DESC
    LIMIT 30
  `).all(req.user.id);

  const unread = db.prepare(`
    SELECT COUNT(*) as n
    FROM notificaciones
    WHERE user_id = ? AND leida = 0
  `).get(req.user.id).n;

  res.json({ items, unread });
});

router.patch('/:id/leida', auth, (req, res) => {
  db.prepare(`
    UPDATE notificaciones
    SET leida = 1
    WHERE id = ? AND user_id = ?
  `).run(req.params.id, req.user.id);

  res.json({ ok: true });
});

router.patch('/leer-todas', auth, (req, res) => {
  db.prepare(`
    UPDATE notificaciones
    SET leida = 1
    WHERE user_id = ? AND leida = 0
  `).run(req.user.id);

  res.json({ ok: true });
});

module.exports = router;
