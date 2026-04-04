const { db, log, notify } = require('../db');

function getHoy() {
  return new Date().toISOString().split('T')[0];
}

function registerSalida({ concepto, importe, tienda = 'murcia', createdBy, notifyUserId, source = 'modulo_salidas' }) {
  const amount = parseFloat(importe);
  const cleanConcept = String(concepto || '').trim();

  if (!cleanConcept || !amount || amount <= 0) {
    throw new Error('Concepto e importe validos requeridos');
  }

  const hoy = getHoy();
  const caja = db.prepare(`SELECT * FROM caja_dias WHERE fecha = ? AND tienda = ? AND estado = 'abierta'`).get(hoy, tienda);
  let cajaMovimientoId = null;

  if (caja) {
    const cajaInsert = db.prepare(`
      INSERT INTO caja_movimientos (caja_id, tipo, concepto, importe, metodo_pago, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(caja.id, 'gasto', `Salida: ${cleanConcept}`, amount, 'efectivo', createdBy);

    cajaMovimientoId = cajaInsert.lastInsertRowid;
    log('caja', caja.id, source, createdBy, { concepto: cleanConcept, importe: amount, cajaMovimientoId, tienda });
  }

  const salidaInsert = db.prepare(`
    INSERT INTO salidas_dinero (fecha, tienda, concepto, importe, caja_movimiento_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(hoy, tienda, cleanConcept, amount, cajaMovimientoId, createdBy);

  log('salidas_dinero', salidaInsert.lastInsertRowid, 'crear', createdBy, {
    concepto: cleanConcept,
    importe: amount,
    cajaMovimientoId,
    source,
    tienda,
  });

  if (notifyUserId) {
    notify(notifyUserId, 'salidas', 'Salida registrada', `${amount.toFixed(2)}EUR - ${cleanConcept}`, '/salidas');
  }

  const salida = db.prepare(`
    SELECT s.*, u.nombre as usuario
    FROM salidas_dinero s
    LEFT JOIN users u ON u.id = s.created_by
    WHERE s.id = ? AND s.tienda = ?
  `).get(salidaInsert.lastInsertRowid, tienda);

  return { salida, cajaMovimientoId, cajaAbierta: !!caja };
}

function deleteSalida({ salidaId, tienda = 'murcia', deletedBy }) {
  const row = db.prepare(`SELECT * FROM salidas_dinero WHERE id = ? AND tienda = ?`).get(salidaId, tienda);
  if (!row) return null;

  db.prepare(`DELETE FROM salidas_dinero WHERE id = ? AND tienda = ?`).run(salidaId, tienda);

  if (row.caja_movimiento_id) {
    db.prepare(`DELETE FROM caja_movimientos WHERE id = ?`).run(row.caja_movimiento_id);
  }

  log('salidas_dinero', Number(salidaId), 'eliminar', deletedBy, {
    concepto: row.concepto,
    importe: row.importe,
    cajaMovimientoId: row.caja_movimiento_id || null,
    tienda,
  });

  return row;
}

module.exports = { getHoy, registerSalida, deleteSalida };
