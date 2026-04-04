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
