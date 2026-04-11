const express = require('express');
const { db } = require('../db');
const { auth } = require('../middleware/auth');
const { getTienda } = require('../services/tiendaScope');
const { getFactusolStatus } = require('../services/factusolCloud');

const router = express.Router();

function todayLocal() {
  return new Date().toISOString().split('T')[0];
}

function monthPrefix(dateText) {
  return String(dateText || todayLocal()).slice(0, 7);
}

function toNumber(value) {
  return Number(value || 0);
}

router.get('/overview', auth, (req, res) => {
  const tienda = getTienda(req.user);
  const today = todayLocal();
  const month = monthPrefix(today);

  const pedidosHoy = db.prepare(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN urgente = 1 THEN 1 ELSE 0 END) AS urgentes
    FROM pedidos
    WHERE tienda = ? AND substr(created_at, 1, 10) = ?
  `).get(tienda, today);

  const pedidosMes = db.prepare(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN estado IN ('entregado','enviado') THEN 1 ELSE 0 END) AS cerrados
    FROM pedidos
    WHERE tienda = ? AND substr(created_at, 1, 7) = ?
  `).get(tienda, month);

  const cajaHoy = db.prepare(`
    SELECT *
    FROM caja_dias
    WHERE tienda = ? AND fecha = ?
  `).get(tienda, today);

  const salidasHoy = db.prepare(`
    SELECT COUNT(*) AS total, COALESCE(SUM(importe), 0) AS importe
    FROM salidas_dinero
    WHERE tienda = ? AND fecha = ?
  `).get(tienda, today);

  const salidasMes = db.prepare(`
    SELECT COUNT(*) AS total, COALESCE(SUM(importe), 0) AS importe
    FROM salidas_dinero
    WHERE tienda = ? AND substr(fecha, 1, 7) = ?
  `).get(tienda, month);

  const tareas = db.prepare(`
    SELECT
      SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) AS pendientes,
      SUM(CASE WHEN estado = 'pendiente' AND fecha_limite < ? THEN 1 ELSE 0 END) AS atrasadas
    FROM tareas
    WHERE tienda = ?
  `).get(today, tienda);

  const rutas = db.prepare(`
    SELECT
      SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) AS pendientes,
      SUM(CASE WHEN paid_at IS NOT NULL AND substr(paid_at, 1, 10) = ? THEN 1 ELSE 0 END) AS pagadas_hoy
    FROM rutas_comerciales
    WHERE tienda = ?
  `).get(today, tienda);

  const fichajesActivos = db.prepare(`
    SELECT COUNT(*) AS total
    FROM fichajes
    WHERE tienda = ? AND fecha = ? AND finished_at IS NULL
  `).get(tienda, today);

  const topClientes = db.prepare(`
    SELECT
      cliente_nombre,
      COUNT(*) AS pedidos_total,
      MAX(created_at) AS ultimo_pedido,
      COALESCE(MAX(cliente_telefono), '') AS telefono,
      COALESCE(MAX(zona_reparto), '') AS zona
    FROM pedidos
    WHERE tienda = ?
    GROUP BY cliente_nombre
    ORDER BY pedidos_total DESC, ultimo_pedido DESC
    LIMIT 8
  `).all(tienda);

  const equipo = db.prepare(`
    SELECT
      u.nombre,
      SUM(CASE WHEN t.estado = 'pendiente' THEN 1 ELSE 0 END) AS pendientes,
      SUM(CASE WHEN t.estado = 'pendiente' AND t.fecha_limite < ? THEN 1 ELSE 0 END) AS atrasadas
    FROM users u
    LEFT JOIN tareas t
      ON t.asignado_a = u.id
      AND t.tienda = ?
    WHERE u.activo = 1 AND u.tienda = ?
    GROUP BY u.id, u.nombre
    ORDER BY u.nombre ASC
  `).all(today, tienda, tienda);

  const ultimosMovimientos = db.prepare(`
    SELECT
      a.tabla,
      a.accion,
      a.created_at,
      u.nombre AS usuario
    FROM actividad a
    LEFT JOIN users u ON u.id = a.usuario_id
    WHERE a.tienda = ?
    ORDER BY a.created_at DESC
    LIMIT 10
  `).all(tienda);

  const seriePedidos = db.prepare(`
    SELECT substr(created_at, 1, 10) AS fecha, COUNT(*) AS total
    FROM pedidos
    WHERE tienda = ? AND substr(created_at, 1, 10) >= date('now', '-6 day')
    GROUP BY substr(created_at, 1, 10)
    ORDER BY fecha ASC
  `).all(tienda);

  const serieSalidas = db.prepare(`
    SELECT fecha, COALESCE(SUM(importe), 0) AS total
    FROM salidas_dinero
    WHERE tienda = ? AND fecha >= date('now', '-6 day')
    GROUP BY fecha
    ORDER BY fecha ASC
  `).all(tienda);

  const pedidosPorEstado = db.prepare(`
    SELECT estado, COUNT(*) AS total
    FROM pedidos
    WHERE tienda = ? AND substr(created_at, 1, 7) = ?
    GROUP BY estado
    ORDER BY total DESC
  `).all(tienda, month);

  const pedidosPorZona = db.prepare(`
    SELECT zona_reparto AS zona, COUNT(*) AS total
    FROM pedidos
    WHERE tienda = ? AND substr(created_at, 1, 7) = ?
    GROUP BY zona_reparto
    ORDER BY total DESC
    LIMIT 6
  `).all(tienda, month);

  const pedidosSemanaPasada = db.prepare(`
    SELECT COUNT(*) AS total
    FROM pedidos
    WHERE tienda = ?
      AND substr(created_at, 1, 10) BETWEEN date('now', '-13 day') AND date('now', '-7 day')
  `).get(tienda);

  const pedidosUltimos7 = db.prepare(`
    SELECT COUNT(*) AS total
    FROM pedidos
    WHERE tienda = ?
      AND substr(created_at, 1, 10) >= date('now', '-6 day')
  `).get(tienda);

  const cajaTarde = cajaHoy ? Math.max(0, toNumber(cajaHoy.tarde_cierre) - toNumber(cajaHoy.factusol_ajuste_tarde)) : 0;
  const pedidosTrend = toNumber(pedidosUltimos7?.total) - toNumber(pedidosSemanaPasada?.total);
  const cajaScore = cajaHoy ? Math.max(0, 100 - Math.min(Math.abs(cajaTarde), 100)) : 40;
  const tareasScore = Math.max(0, 100 - Math.min(toNumber(tareas?.atrasadas) * 15, 100));
  const rutasScore = Math.max(0, 100 - Math.min(Math.max(toNumber(rutas?.pendientes) - 4, 0) * 12, 100));
  const cajaHealth = { label: 'Caja', value: cajaScore };
  const tareasHealth = { label: 'Equipo', value: tareasScore };
  const rutasHealth = { label: 'Rutas', value: rutasScore };
  const pedidosHealth = { label: 'Pedidos', value: pedidosTrend >= 0 ? 78 : 58 };
  const factusolStatus = getFactusolStatus();

  const saldoCajaHoy = cajaHoy
    ? toNumber(cajaHoy.manana_cierre || 0) + toNumber(cajaHoy.tarde_cierre || 0) + toNumber(cajaHoy.cierre_importe || 0)
    : 0;

  const recomendaciones = [];
  if (!cajaHoy) recomendaciones.push('Abrir y revisar la caja del dia cuanto antes para no trabajar a ciegas.');
  if (toNumber(tareas?.atrasadas) > 0) recomendaciones.push(`Hay ${toNumber(tareas.atrasadas)} tareas atrasadas. Conviene repartirlas hoy mismo.`);
  if (toNumber(rutas?.pendientes) > 6) recomendaciones.push('Las rutas llevan mucha carga. Reordena paradas y exportalas a Google Maps.');
  if (toNumber(pedidosHoy?.urgentes) > 0) recomendaciones.push(`Tienes ${toNumber(pedidosHoy.urgentes)} pedidos urgentes activos. Prioridad total.`);
  if (toNumber(salidasHoy?.importe) > 250) recomendaciones.push('Las salidas de dinero de hoy son altas. Merece la pena revisar conceptos y fugas.');
  if (!recomendaciones.length) recomendaciones.push('El pulso general esta estable. Hoy toca vigilar caja, web y reparto sin complicarse.');

  res.json({
    resumen: {
      pedidos_hoy: toNumber(pedidosHoy?.total),
      urgentes_hoy: toNumber(pedidosHoy?.urgentes),
      pedidos_mes: toNumber(pedidosMes?.total),
      pedidos_cerrados_mes: toNumber(pedidosMes?.cerrados),
      salidas_hoy: toNumber(salidasHoy?.importe),
      salidas_mes: toNumber(salidasMes?.importe),
      tareas_pendientes: toNumber(tareas?.pendientes),
      tareas_atrasadas: toNumber(tareas?.atrasadas),
      rutas_pendientes: toNumber(rutas?.pendientes),
      rutas_pagadas_hoy: toNumber(rutas?.pagadas_hoy),
      fichajes_activos: toNumber(fichajesActivos?.total),
      caja_abierta: Boolean(cajaHoy),
      saldo_caja_hoy: saldoCajaHoy,
      tendencia_pedidos_7d: pedidosTrend,
    },
    caja_hoy: cajaHoy ? {
      fecha: cajaHoy.fecha,
      manana_apertura: toNumber(cajaHoy.manana_apertura),
      manana_cierre: toNumber(cajaHoy.manana_cierre),
      tarde_apertura: toNumber(cajaHoy.tarde_apertura),
      tarde_cierre: toNumber(cajaHoy.tarde_cierre),
      factusol_ajuste_tarde: toNumber(cajaHoy.factusol_ajuste_tarde),
      cierre_importe: toNumber(cajaHoy.cierre_importe),
      estado: cajaHoy.estado,
    } : null,
    top_clientes: topClientes,
    equipo,
    actividad: ultimosMovimientos,
    series: {
      pedidos: seriePedidos,
      salidas: serieSalidas,
      pedidos_estado: pedidosPorEstado,
      pedidos_zona: pedidosPorZona,
    },
    health: [cajaHealth, tareasHealth, rutasHealth, pedidosHealth],
    factusol: factusolStatus,
    recomendaciones,
  });
});

router.get('/design-feedback', auth, (req, res) => {
  const code = String(req.query.code || '').trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 200);

  if (code) {
    const item = db.prepare(`
      SELECT *
      FROM design_feedback
      WHERE reward_code = ?
      LIMIT 1
    `).get(code);

    return res.json({
      code,
      valid: Boolean(item && item.reward_status === 'valid'),
      item: item || null,
    });
  }

  const items = db.prepare(`
    SELECT id, autor, feedback, selected_brand, skin_tone, estilo_detectado, reward_code, reward_amount, reward_status, created_at
    FROM design_feedback
    ORDER BY id DESC
    LIMIT ?
  `).all(limit);

  res.json({ total: items.length, items });
});

router.patch('/design-feedback/:id/redeem', auth, (req, res) => {
  const id = Number(req.params.id || 0);
  if (!id) return res.status(400).json({ error: 'Id invalido' });

  const current = db.prepare(`
    SELECT id, reward_code, reward_status
    FROM design_feedback
    WHERE id = ?
    LIMIT 1
  `).get(id);

  if (!current) return res.status(404).json({ error: 'Feedback no encontrado' });

  const nextStatus = current.reward_status === 'used' ? 'valid' : 'used';
  db.prepare(`
    UPDATE design_feedback
    SET reward_status = ?
    WHERE id = ?
  `).run(nextStatus, id);

  const updated = db.prepare(`
    SELECT id, autor, feedback, selected_brand, skin_tone, estilo_detectado, reward_code, reward_amount, reward_status, created_at
    FROM design_feedback
    WHERE id = ?
    LIMIT 1
  `).get(id);

  res.json({ ok: true, item: updated });
});

module.exports = router;
