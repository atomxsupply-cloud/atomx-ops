const express = require('express');
const { getFactusolStatus, syncFactusolClientes } = require('../services/factusolCloud');
const { db } = require('../db');
const { importClientesFactusol, CLIENTES_XLSX_PATH } = require('../services/clientesFactusol');
const fs = require('fs');

const router = express.Router();

router.get('/status', (_req, res) => {
  res.json(getFactusolStatus());
});

router.get('/overview', (_req, res) => {
  const status = getFactusolStatus();
  const totalClientes = db.prepare('SELECT COUNT(*) as total FROM clientes WHERE es_interno = 0').get()?.total || 0;
  const totalArticulos = db.prepare('SELECT COUNT(*) as total FROM productos').get()?.total || 0;
  const totalPedidos = db.prepare('SELECT COUNT(*) as total FROM pedidos').get()?.total || 0;

  let excel = null;
  if (fs.existsSync(CLIENTES_XLSX_PATH)) {
    const stat = fs.statSync(CLIENTES_XLSX_PATH);
    excel = {
      ready: true,
      path: CLIENTES_XLSX_PATH,
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
    };
  }

  res.json({
    status,
    excel,
    metrics: {
      clientes: totalClientes,
      articulos: totalArticulos,
      pedidos: totalPedidos,
    },
    checklist: [
      { label: 'Manufacturer code', done: Boolean(status.fields?.manufacturerCode) },
      { label: 'Client ID', done: Boolean(status.fields?.clientId) },
      { label: 'Client secret', done: Boolean(status.fields?.clientSecret) },
      { label: 'Database ID', done: Boolean(status.fields?.databaseId) },
      { label: 'Excel clientes cargado', done: Boolean(excel?.ready) },
    ],
  });
});

router.post('/sync/clientes', async (_req, res) => {
  try {
    const result = await syncFactusolClientes();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message || 'No he podido preparar la sincronizacion de Factusol',
      detalle: error.data || null,
    });
  }
});

router.post('/sync/clientes-local', (_req, res) => {
  try {
    const result = importClientesFactusol();
    res.json({
      ok: true,
      source: 'excel_local',
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message || 'No he podido importar clientes desde el Excel local',
    });
  }
});

module.exports = router;
