const express = require('express');
const {
  ensureConfig,
  getProducts,
  getOrders,
  getOrderStates,
  getOrderDetails,
  getCustomers,
  getDuplicateProducts,
  getStockByProductId,
  updateStockAvailable,
  syncPrestashopAnalytics,
} = require('../services/prestashop');
const { db, notify } = require('../db');

const router = express.Router();

router.get('/health', async (_req, res) => {
  try {
    ensureConfig();
    res.json({ ok: true });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get('/products', async (req, res) => {
  try {
    const products = await getProducts({
      limit: Number(req.query.limit || 50),
      search: req.query.search || '',
    });
    if (!req.query.search) {
      syncPrestashopAnalytics({ products });
    }
    res.json(products);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message, details: error.details || null });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const orders = await getOrders({ limit: Number(req.query.limit || 25) });
    if (orders.length) {
      syncPrestashopAnalytics({ orders });
    }
    res.json(orders);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message, details: error.details || null });
  }
});

router.get('/order-states', async (_req, res) => {
  try {
    const states = await getOrderStates();
    res.json(states);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message, details: error.details || null });
  }
});

router.get('/order-details', async (req, res) => {
  try {
    const ids = String(req.query.order_ids || '')
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item));
    const details = await getOrderDetails(ids);
    if (details.length) {
      syncPrestashopAnalytics({ orderDetails: details });
    }
    res.json(details);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message, details: error.details || null });
  }
});

router.get('/customers', async (req, res) => {
  try {
    const customers = await getCustomers({
      limit: Number(req.query.limit || 25),
      search: req.query.search || '',
    });
    res.json(customers);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message, details: error.details || null });
  }
});

router.get('/duplicates', async (req, res) => {
  try {
    const duplicates = await getDuplicateProducts({
      limitGroups: Number(req.query.limit || 40),
    });
    res.json(duplicates);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message, details: error.details || null });
  }
});

router.get('/stock/:productId', async (req, res) => {
  try {
    const item = await getStockByProductId(req.params.productId);
    if (!item) return res.status(404).json({ error: 'No he encontrado stock para ese producto' });
    res.json(item);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message, details: error.details || null });
  }
});

router.get('/poll-nuevos', async (req, res) => {
  try {
    const orders = await getOrders({ limit: 30 });
    if (!orders.length) return res.json({ nuevos: 0 });

    const states = await getOrderStates();
    const statesMap = Object.fromEntries(states.map((s) => [s.id, s.nombre]));
    syncPrestashopAnalytics({ orders, statesMap });

    const orderIds = orders.map((o) => Number(o.id));
    const placeholders = orderIds.map(() => '?').join(',');
    const pendingNotify = db.prepare(`
      SELECT order_id, reference, total_paid
      FROM prestashop_orders_cache
      WHERE order_id IN (${placeholders}) AND notified_at IS NULL
    `).all(...orderIds);

    if (!pendingNotify.length) return res.json({ nuevos: 0 });

    const hoy = new Date().toISOString().slice(0, 10);
    const activeWorkers = db.prepare(`
      SELECT f.user_id, u.nombre
      FROM fichajes f
      JOIN users u ON u.id = f.user_id
      WHERE f.fecha = ? AND f.estado = 'trabajando' AND f.finished_at IS NULL
    `).all(hoy);

    const toNotify = activeWorkers.filter((w) => {
      const n = String(w.nombre || '').toLowerCase();
      return n.includes('juanje') || n.includes('papi') || n.includes('juanfran');
    });

    for (const order of pendingNotify) {
      for (const worker of toNotify) {
        notify(
          worker.user_id,
          'prestashop_nuevo',
          'Pedido web nuevo',
          `Pedido #${order.order_id}${order.reference ? ` (${order.reference})` : ''} · ${Number(order.total_paid || 0).toFixed(2)}€`,
          '/prestashop'
        );
      }
      db.prepare(`UPDATE prestashop_orders_cache SET notified_at = datetime('now','localtime') WHERE order_id = ?`).run(order.order_id);
    }

    res.json({ nuevos: pendingNotify.length, notificados: toNotify.length });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message, details: error.details || null });
  }
});

router.patch('/stock/:stockAvailableId', async (req, res) => {
  try {
    if (req.body.confirm_web_change !== true) {
      return res.status(409).json({
        error: 'Esto va a cambiar stock en la web real de PrestaShop. Confirma antes de seguir.',
        requires_confirmation: true,
      });
    }
    const quantity = Number(req.body.quantity);
    if (!Number.isFinite(quantity)) {
      return res.status(400).json({ error: 'Cantidad invalida' });
    }
    const result = await updateStockAvailable(req.params.stockAvailableId, quantity);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message, details: error.details || null });
  }
});

module.exports = router;
