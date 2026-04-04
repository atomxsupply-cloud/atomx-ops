const express = require('express');
const { db } = require('../db');
const { auth } = require('../middleware/auth');
const { getTienda } = require('../services/tiendaScope');

const router = express.Router();

router.get('/:tipo', auth, (req, res) => {
  const hoy = new Date().toISOString().split('T')[0];
  const tienda = getTienda(req.user);
  const items = db.prepare('SELECT * FROM checklist_items WHERE tipo = ? ORDER BY orden').all(req.params.tipo);

  const result = items.map((item) => {
    const reg = db.prepare('SELECT * FROM checklist_registros WHERE item_id = ? AND fecha = ? AND tienda = ?').get(item.id, hoy, tienda);
    return { ...item, completado: reg ? reg.completado : 0, hora: reg?.hora || null, usuario_id: reg?.usuario_id || null };
  });

  res.json(result);
});

router.post('/:itemId/toggle', auth, (req, res) => {
  const hoy = new Date().toISOString().split('T')[0];
  const tienda = getTienda(req.user);
  const hora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const existing = db.prepare('SELECT * FROM checklist_registros WHERE item_id = ? AND fecha = ? AND tienda = ?').get(req.params.itemId, hoy, tienda);

  if (existing) {
    db.prepare('UPDATE checklist_registros SET completado = ?, usuario_id = ?, hora = ? WHERE id = ?').run(
      existing.completado ? 0 : 1, req.user.id, existing.completado ? null : hora, existing.id
    );
  } else {
    db.prepare('INSERT INTO checklist_registros (item_id, fecha, tienda, completado, usuario_id, hora) VALUES (?, ?, ?, 1, ?, ?)').run(
      req.params.itemId, hoy, tienda, req.user.id, hora
    );
  }

  res.json({ ok: true });
});

module.exports = router;
