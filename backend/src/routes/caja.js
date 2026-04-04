const express = require('express');
const { db, log } = require('../db');
const { auth } = require('../middleware/auth');
const { getTienda } = require('../services/tiendaScope');

const router = express.Router();

function getHoy() {
  return new Date().toISOString().split('T')[0];
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

router.get('/hoy', auth, (req, res) => {
  const hoy = getHoy();
  const tienda = getTienda(req.user);
  const caja = db.prepare('SELECT * FROM caja_dias WHERE fecha = ? AND tienda = ?').get(hoy, tienda);
  if (!caja) return res.json(null);

  const movimientos = db.prepare(`
    SELECT m.*, u.nombre as usuario FROM caja_movimientos m
    LEFT JOIN users u ON m.created_by = u.id
    WHERE m.caja_id = ?
    ORDER BY m.created_at ASC
  `).all(caja.id);

  const ingresos = movimientos.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + m.importe, 0);
  const gastos = movimientos.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + m.importe, 0);
  const saldo_real = caja.apertura_importe + ingresos - gastos;
  const movimientosManana = movimientos.filter((m) => Number((m.created_at || '').substring(11, 13)) < 15);
  const movimientosTarde = movimientos.filter((m) => Number((m.created_at || '').substring(11, 13)) >= 15);
  const ingresosManana = movimientosManana.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + m.importe, 0);
  const gastosManana = movimientosManana.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + m.importe, 0);
  const ingresosTarde = movimientosTarde.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + m.importe, 0);
  const gastosTarde = movimientosTarde.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + m.importe, 0);
  const mananaEsperado = (caja.manana_apertura ?? caja.apertura_importe) + ingresosManana - gastosManana;
  const tardeAperturaCalculada = Number(caja.manana_cierre ?? mananaEsperado) - Number(caja.factusol_ajuste_tarde || 0);

  res.json({
    ...caja,
    movimientos,
    ingresos,
    gastos,
    saldo_real,
    resumen_turnos: {
      manana: {
        apertura: caja.manana_apertura ?? caja.apertura_importe,
        cierre: caja.manana_cierre,
        ingresos: ingresosManana,
        gastos: gastosManana,
        esperado: mananaEsperado,
      },
      tarde: {
        apertura: caja.tarde_apertura ?? tardeAperturaCalculada,
        cierre: caja.tarde_cierre,
        ingresos: ingresosTarde,
        gastos: gastosTarde,
        ajuste_factusol: caja.factusol_ajuste_tarde || 0,
      },
    },
  });
});

router.post('/abrir', auth, (req, res) => {
  const hoy = getHoy();
  const tienda = getTienda(req.user);
  const existe = db.prepare('SELECT id FROM caja_dias WHERE fecha = ? AND tienda = ?').get(hoy, tienda);
  if (existe) return res.status(400).json({ error: 'La caja de hoy ya esta abierta' });

  const { apertura_importe } = req.body;
  let r;
  try {
    r = db.prepare(`INSERT INTO caja_dias (fecha, tienda, apertura_importe, manana_apertura, created_by) VALUES (?, ?, ?, ?, ?)`).run(
      hoy,
      tienda,
      apertura_importe || 0,
      apertura_importe || 0,
      req.user.id
    );
  } catch (error) {
    if (String(error.message || '').includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'La caja de hoy ya existe para esta tienda. Recarga y seguimos.' });
    }
    throw error;
  }

  log('caja', r.lastInsertRowid, 'abrir', req.user.id, { apertura_importe, tienda });
  res.status(201).json(db.prepare('SELECT * FROM caja_dias WHERE id = ? AND tienda = ?').get(r.lastInsertRowid, tienda));
});

router.post('/turno', auth, (req, res) => {
  const hoy = getHoy();
  const tienda = getTienda(req.user);
  const caja = db.prepare(`SELECT * FROM caja_dias WHERE fecha = ? AND tienda = ?`).get(hoy, tienda);
  if (!caja) return res.status(404).json({ error: 'No hay caja abierta hoy' });

  const { turno, apertura, cierre, ajuste_factusol } = req.body;
  if (turno === 'manana') {
    const aperturaManana = apertura == null ? (caja.manana_apertura ?? caja.apertura_importe ?? 100) : toNumber(apertura, caja.manana_apertura ?? caja.apertura_importe ?? 100);
    const cierreManana = cierre == null ? null : toNumber(cierre, null);
    db.prepare(`
      UPDATE caja_dias
      SET manana_apertura = ?,
          manana_cierre = ?
      WHERE id = ?
    `).run(aperturaManana, cierreManana, caja.id);
  }

  if (turno === 'tarde') {
    const ajusteFactusol = toNumber(ajuste_factusol, caja.factusol_ajuste_tarde || 0);
    const baseManana = cierre == null ? (caja.manana_cierre ?? caja.manana_apertura ?? caja.apertura_importe ?? 100) : (caja.manana_cierre ?? caja.manana_apertura ?? caja.apertura_importe ?? 100);
    const aperturaTardeCalculada = apertura == null
      ? baseManana - ajusteFactusol
      : toNumber(apertura, baseManana - ajusteFactusol);
    const cierreTarde = cierre == null ? null : toNumber(cierre, null);
    db.prepare(`
      UPDATE caja_dias
      SET factusol_ajuste_tarde = ?,
          tarde_apertura = ?,
          tarde_cierre = ?
      WHERE id = ?
    `).run(ajusteFactusol, aperturaTardeCalculada, cierreTarde, caja.id);
  }

  log('caja', caja.id, 'turno', req.user.id, { turno, apertura, cierre, ajuste_factusol, tienda });
  res.json(db.prepare(`SELECT * FROM caja_dias WHERE id = ?`).get(caja.id));
});

router.post('/cerrar', auth, (req, res) => {
  const hoy = getHoy();
  const tienda = getTienda(req.user);
  const caja = db.prepare(`SELECT * FROM caja_dias WHERE fecha = ? AND tienda = ? AND estado = 'abierta'`).get(hoy, tienda);
  if (!caja) return res.status(404).json({ error: 'No hay caja abierta hoy' });

  const { cierre_importe, observaciones } = req.body;
  const movs = db.prepare('SELECT tipo, SUM(importe) as total FROM caja_movimientos WHERE caja_id = ? GROUP BY tipo').all(caja.id);
  const ingresos = movs.find((m) => m.tipo === 'ingreso')?.total || 0;
  const gastos = movs.find((m) => m.tipo === 'gasto')?.total || 0;
  const esperado = caja.apertura_importe + ingresos - gastos;
  const descuadre = cierre_importe - esperado;

  db.prepare(`
    UPDATE caja_dias SET cierre_importe=?, observaciones=?, estado='cerrada',
    total_ingresos=?, total_gastos=?, closed_by=? WHERE id=?
  `).run(cierre_importe, observaciones || null, ingresos, gastos, req.user.id, caja.id);

  log('caja', caja.id, 'cerrar', req.user.id, { cierre_importe, descuadre, tienda });
  res.json({ ok: true, descuadre, esperado });
});

router.post('/movimiento', auth, (req, res) => {
  const hoy = getHoy();
  const tienda = getTienda(req.user);
  const caja = db.prepare(`SELECT * FROM caja_dias WHERE fecha = ? AND tienda = ? AND estado = 'abierta'`).get(hoy, tienda);
  if (!caja) return res.status(400).json({ error: 'Abre la caja primero' });

  const { tipo, concepto, importe, metodo_pago } = req.body;
  if (!tipo || !concepto || !importe) return res.status(400).json({ error: 'Faltan campos' });

  let r;
  try {
    r = db.prepare(`
      INSERT INTO caja_movimientos (caja_id, tipo, concepto, importe, metodo_pago, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(caja.id, tipo, concepto, parseFloat(importe), metodo_pago || 'efectivo', req.user.id);
  } catch (error) {
    if (String(error.message || '').includes('FOREIGN KEY constraint failed')) {
      return res.status(400).json({
        error: 'La caja de hoy se ha quedado desajustada por una migracion vieja. Reinicia backend y prueba otra vez.',
      });
    }
    throw error;
  }

  log('caja', caja.id, tipo === 'ingreso' ? 'ingreso' : 'gasto', req.user.id, { concepto, importe, tienda });
  res.status(201).json(db.prepare('SELECT * FROM caja_movimientos WHERE id = ?').get(r.lastInsertRowid));
});

router.post('/reset', auth, (req, res) => {
  const hoy = getHoy();
  const tienda = getTienda(req.user);
  const caja = db.prepare(`SELECT * FROM caja_dias WHERE fecha = ? AND tienda = ?`).get(hoy, tienda);
  if (!caja) return res.status(404).json({ error: 'No hay caja abierta hoy' });

  db.exec('BEGIN');
  try {
    db.prepare(`DELETE FROM caja_movimientos WHERE caja_id = ?`).run(caja.id);
    db.prepare(`
      UPDATE caja_dias
      SET manana_apertura = apertura_importe,
          manana_cierre = NULL,
          tarde_apertura = NULL,
          tarde_cierre = NULL,
          factusol_ajuste_tarde = 0,
          cierre_importe = NULL,
          total_ingresos = 0,
          total_gastos = 0,
          observaciones = NULL,
          estado = 'abierta',
          closed_by = NULL
      WHERE id = ?
    `).run(caja.id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  log('caja', caja.id, 'reset', req.user.id, { tienda });
  res.json({ ok: true });
});

router.get('/historial', auth, (req, res) => {
  const cajas = db.prepare(`
    SELECT c.*, u.nombre as abierta_por FROM caja_dias c
    LEFT JOIN users u ON c.created_by = u.id
    WHERE c.tienda = ?
    ORDER BY c.fecha DESC LIMIT 30
  `).all(getTienda(req.user));

  res.json(cajas);
});

module.exports = router;
