const express = require('express');
const { db } = require('../db');
const { auth } = require('../middleware/auth');
const { getTienda } = require('../services/tiendaScope');
const { canAccessSection } = require('../middleware/access');
const { getOrders, getOrderStates, getOrderDetails, getProducts, syncPrestashopAnalytics } = require('../services/prestashop');

const router = express.Router();

function buildActivityMessage(item) {
  const usuario = item.usuario || 'Alguien';
  const tabla = item.tabla || '';
  const accion = item.accion || '';

  if (tabla === 'pedidos' && accion === 'crear') return `${usuario} dejo un pedido nuevo listo para revisar`;
  if (tabla === 'pedidos' && accion === 'editar') return `${usuario} retoco un pedido y lo dejo mas fino`;
  if (tabla === 'pedidos' && accion === 'cambiar_estado') return `${usuario} movio un pedido de estado`;
  if (tabla === 'tareas' && accion === 'crear') return `${usuario} apunto una tarea nueva`;
  if (tabla === 'tareas' && accion === 'editar') return `${usuario} ordeno una tarea`;
  if (tabla === 'tareas' && accion === 'estado') return `${usuario} actualizo una tarea`;
  if (tabla === 'caja_dias' && accion === 'abrir') return `${usuario} abrio la caja del dia`;
  if (tabla === 'caja_dias' && accion === 'cerrar') return `${usuario} cerro la caja del dia`;
  if (tabla === 'salidas_dinero' && accion === 'crear') return `${usuario} apunto una salida de dinero`;
  if (tabla === 'rutas_comerciales' && accion === 'crear') return `${usuario} metio una parada nueva en rutas`;
  if (tabla === 'rutas_comerciales' && accion === 'estado') return `${usuario} marco una parada como resuelta`;

  return `${usuario} hizo un movimiento en ${tabla.replaceAll('_', ' ')}`;
}

function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isDoneState(name) {
  const lower = normalize(name);
  return ['enviado', 'expedido', 'entregado', 'completado'].some((token) => lower.includes(token));
}

router.get('/', auth, async (req, res) => {
  const hoy = new Date().toISOString().split('T')[0];
  const tienda = getTienda(req.user);

  const pedidosPendientes = db.prepare(`SELECT COUNT(*) as n FROM pedidos WHERE tienda = ? AND estado = 'pendiente'`).get(tienda).n;
  const pedidosPreparando = db.prepare(`SELECT COUNT(*) as n FROM pedidos WHERE tienda = ? AND estado = 'preparando'`).get(tienda).n;
  const pedidosListos = db.prepare(`SELECT COUNT(*) as n FROM pedidos WHERE tienda = ? AND estado = 'listo'`).get(tienda).n;
  const pedidosEnviados = db.prepare(`SELECT COUNT(*) as n FROM pedidos WHERE tienda = ? AND estado = 'enviado'`).get(tienda).n;
  const pedidosUrgentes = db.prepare(`SELECT COUNT(*) as n FROM pedidos WHERE tienda = ? AND urgente = 1 AND estado NOT IN ('entregado','cancelado')`).get(tienda).n;

  const tareasHoy = db.prepare(`SELECT COUNT(*) as n FROM tareas WHERE tienda = ? AND estado = 'pendiente' AND (fecha_limite = ? OR fecha_limite IS NULL)`).get(tienda, hoy).n;
  const tareasAtrasadas = db.prepare(`SELECT COUNT(*) as n FROM tareas WHERE tienda = ? AND estado = 'pendiente' AND fecha_limite < ?`).get(tienda, hoy).n;

  const stockBajo = db.prepare(`SELECT COUNT(*) as n FROM productos WHERE tienda = ? AND stock_actual <= stock_minimo`).get(tienda).n;
  const incidenciasAbiertas = db.prepare(`SELECT COUNT(*) as n FROM incidencias WHERE tienda = ? AND estado = 'abierta'`).get(tienda).n;

  const caja = db.prepare(`SELECT * FROM caja_dias WHERE fecha = ? AND tienda = ?`).get(hoy, tienda);
  let cajaHoy = null;
  if (caja) {
    const movs = db.prepare(`SELECT tipo, SUM(importe) as total FROM caja_movimientos WHERE caja_id = ? GROUP BY tipo`).all(caja.id);
    const ingresos = movs.find((m) => m.tipo === 'ingreso')?.total || 0;
    const gastos = movs.find((m) => m.tipo === 'gasto')?.total || 0;
    cajaHoy = {
      estado: caja.estado,
      apertura: caja.apertura_importe,
      ingresos,
      gastos,
      saldo: caja.apertura_importe + ingresos - gastos,
    };
  }

  const notasPinned = db.prepare(`
    SELECT n.*, u.nombre as autor FROM notas n
    LEFT JOIN users u ON n.autor_id = u.id
    WHERE n.tienda = ? AND n.pinned = 1
    ORDER BY n.created_at DESC LIMIT 5
  `).all(tienda);

  const actividadReciente = db.prepare(`
    SELECT a.*, u.nombre as usuario FROM actividad a
    LEFT JOIN users u ON a.usuario_id = u.id
    WHERE a.tienda = ?
      AND a.accion NOT IN ('crear_desde_chat')
    ORDER BY a.created_at DESC LIMIT 3
  `).all(tienda).map((item) => ({
    ...item,
    mensaje: buildActivityMessage(item),
  }));

  const pedidosUrgentesDetalle = db.prepare(`
    SELECT p.*, u.nombre as responsable FROM pedidos p
    LEFT JOIN users u ON p.responsable_id = u.id
    WHERE p.tienda = ? AND p.urgente = 1 AND p.estado NOT IN ('entregado','cancelado')
    ORDER BY p.created_at DESC LIMIT 5
  `).all(tienda);

  const fichajesActivos = db.prepare(`
    SELECT f.*, u.nombre
    FROM fichajes f
    JOIN users u ON u.id = f.user_id
    WHERE f.tienda = ? AND f.fecha = ? AND f.finished_at IS NULL
    ORDER BY u.nombre ASC
  `).all(tienda, hoy).map((item) => ({
    ...item,
    descanso_restante_min: Math.max((item.descanso_max_min || 0) - (item.pausa_total_min || 0), 0),
  }));

  let prestashop = null;
  if (canAccessSection(req.user, 'prestashop')) {
    try {
      const [orders, states, products] = await Promise.all([
        getOrders({ limit: 20 }),
        getOrderStates(),
        getProducts({ limit: 120 }),
      ]);
      const stateMap = Object.fromEntries(states.map((item) => [item.id, item.nombre]));
      const withState = orders.map((item) => ({
        ...item,
        stateName: stateMap[item.current_state] || `Estado ${item.current_state}`,
      }));
      const pendingOrders = withState.filter((item) => !isDoneState(item.stateName));
      const pendingDetails = await getOrderDetails(pendingOrders.slice(0, 12).map((item) => item.id));
      syncPrestashopAnalytics({
        orders,
        orderDetails: pendingDetails,
        products,
        statesMap: stateMap,
      });
      prestashop = {
        pendientes: pendingOrders.slice(0, 10),
        totalPendientes: pendingOrders.length,
      };
    } catch (error) {
      prestashop = {
        pendientes: [],
        enviados: [],
        totalPendientes: 0,
        totalEnviados: 0,
        error: error.message,
      };
    }
  }

  res.json({
    pedidos: {
      pendientes: pedidosPendientes,
      preparando: pedidosPreparando,
      listos: pedidosListos,
      enviados: pedidosEnviados,
      urgentes: pedidosUrgentes,
    },
    tareas: { hoy: tareasHoy, atrasadas: tareasAtrasadas },
    stockBajo,
    incidenciasAbiertas,
    cajaHoy,
    notasPinned,
    actividadReciente,
    pedidosUrgentesDetalle,
    fichajesActivos,
    prestashop,
  });
});

module.exports = router;
