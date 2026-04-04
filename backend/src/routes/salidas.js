const express = require('express');
const { db } = require('../db');
const { auth } = require('../middleware/auth');
const { getHoy, registerSalida, deleteSalida } = require('../services/salidas');
const { getTienda } = require('../services/tiendaScope');

const router = express.Router();

router.get('/hoy', auth, (req, res) => {
  const hoy = getHoy();
  const tienda = getTienda(req.user);

  const items = db.prepare(`
    SELECT s.*, u.nombre as usuario
    FROM salidas_dinero s
    LEFT JOIN users u ON s.created_by = u.id
    WHERE s.fecha = ? AND s.tienda = ?
    ORDER BY s.created_at DESC
  `).all(hoy, tienda);

  const total = db.prepare(`
    SELECT COALESCE(SUM(importe), 0) as total
    FROM salidas_dinero
    WHERE fecha = ? AND tienda = ?
  `).get(hoy, tienda).total;

  res.json({ fecha: hoy, total, items });
});

router.get('/historial', auth, (req, res) => {
  const dias = db.prepare(`
    SELECT fecha, COUNT(*) as movimientos, COALESCE(SUM(importe), 0) as total
    FROM salidas_dinero
    WHERE tienda = ?
    GROUP BY fecha
    ORDER BY fecha DESC
    LIMIT 30
  `).all(getTienda(req.user));

  res.json(dias);
});

router.post('/', auth, (req, res) => {
  const { importe, concepto } = req.body;
  try {
    const result = registerSalida({
      concepto,
      importe,
      tienda: getTienda(req.user),
      createdBy: req.user.id,
      notifyUserId: req.user.id,
      source: 'salida_desde_modulo',
    });

    res.status(201).json(result.salida);
  } catch (error) {
    res.status(400).json({ error: error.message || 'No se ha podido registrar la salida' });
  }
});

router.delete('/:id', auth, (req, res) => {
  const row = deleteSalida({
    salidaId: req.params.id,
    tienda: getTienda(req.user),
    deletedBy: req.user.id,
  });

  if (!row) return res.status(404).json({ error: 'No encontrada' });
  res.json({ ok: true });
});

module.exports = router;
