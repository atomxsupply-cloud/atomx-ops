const fs = require('fs');
const path = require('path');
const express = require('express');
const { db, log } = require('../db');
const { auth } = require('../middleware/auth');
const { getTienda } = require('../services/tiendaScope');

const router = express.Router();
const EXPORT_DIR = path.join(__dirname, '..', '..', 'cerebro-bot', 'fichajes-contable');

function hoy() {
  return new Date().toISOString().slice(0, 10);
}

function descansoMaxPorUsuario(nombre = '') {
  const lower = String(nombre).toLowerCase();
  if (['juanje', 'papi'].includes(lower)) return 30;
  if (lower === 'lida') return 20;
  return 30;
}

function getActiveShift(userId, tienda) {
  return db.prepare(`
    SELECT *
    FROM fichajes
    WHERE user_id = ? AND tienda = ? AND fecha = ? AND finished_at IS NULL
    ORDER BY id DESC
    LIMIT 1
  `).get(userId, tienda, hoy());
}

function ensureExportDir() {
  fs.mkdirSync(EXPORT_DIR, { recursive: true });
}

function formatDateForFile(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}`;
}

function toDateValue(value) {
  if (!value) return null;
  return new Date(String(value).replace(' ', 'T'));
}

function computeWorkedSeconds(item) {
  const start = toDateValue(item.started_at);
  const end = toDateValue(item.finished_at) || new Date();
  if (!start || !end) return 0;
  const total = Math.max(Math.round((end.getTime() - start.getTime()) / 1000), 0);
  return Math.max(total - ((item.pausa_total_min || 0) * 60), 0);
}

function cleanupOldExports() {
  ensureExportDir();
  const limit = Date.now() - 90 * 24 * 60 * 60 * 1000;
  for (const file of fs.readdirSync(EXPORT_DIR)) {
    const fullPath = path.join(EXPORT_DIR, file);
    const stat = fs.statSync(fullPath);
    if (stat.mtimeMs < limit) fs.rmSync(fullPath, { force: true });
  }
}

function isJuanfran(user) {
  return String(user?.nombre || '').toLowerCase().includes('juanfran') || user?.rol === 'admin';
}

router.get('/estado', auth, (req, res) => {
  const tienda = getTienda(req.user);
  const activos = db.prepare(`
    SELECT f.*, u.nombre
    FROM fichajes f
    JOIN users u ON u.id = f.user_id
    WHERE f.tienda = ? AND f.fecha = ? AND f.finished_at IS NULL
    ORDER BY u.nombre ASC
  `).all(tienda, hoy());

  res.json(activos.map((item) => ({
    ...item,
    descanso_restante_min: Math.max((item.descanso_max_min || 0) - (item.pausa_total_min || 0), 0),
    seg_trabajados: computeWorkedSeconds(item.estado === 'pausa' && item.pausa_desde ? { ...item, finished_at: item.pausa_desde } : item),
  })));
});

router.get('/historial', auth, (req, res) => {
  const tienda = getTienda(req.user);
  const requestedUserId = Number(req.query.user_id || req.user.id);
  const targetUserId = isJuanfran(req.user) && requestedUserId ? requestedUserId : req.user.id;

  const rows = db.prepare(`
    SELECT f.*, u.nombre, u.email
    FROM fichajes f
    JOIN users u ON u.id = f.user_id
    WHERE f.tienda = ?
      AND f.user_id = ?
      AND date(f.fecha) >= date('now', '-3 months')
    ORDER BY f.fecha DESC, f.started_at DESC
  `).all(tienda, targetUserId).map((item) => {
    const workedSeconds = computeWorkedSeconds(item);
    const workedMinutes = Math.floor(workedSeconds / 60);
    return {
      ...item,
      seg_trabajados: workedSeconds,
      min_trabajados: workedMinutes,
      horas_trabajadas: (workedMinutes / 60).toFixed(2),
      editable: isJuanfran(req.user),
    };
  });

  res.json({ items: rows, canViewAll: isJuanfran(req.user) });
});

router.post('/start', auth, (req, res) => {
  const tienda = getTienda(req.user);
  const actual = getActiveShift(req.user.id, tienda);
  if (actual) return res.json({ ok: true, estado: actual.estado, fichaje: actual });

  const descansoMax = descansoMaxPorUsuario(req.user.nombre);
  const r = db.prepare(`
    INSERT INTO fichajes (user_id, tienda, fecha, estado, started_at, descanso_max_min)
    VALUES (?, ?, ?, 'trabajando', datetime('now','localtime'), ?)
  `).run(req.user.id, tienda, hoy(), descansoMax);

  log('fichajes', r.lastInsertRowid, 'start', req.user.id, { tienda });
  res.status(201).json({ ok: true, fichaje: db.prepare('SELECT * FROM fichajes WHERE id = ?').get(r.lastInsertRowid) });
});

router.post('/pause', auth, (req, res) => {
  const tienda = getTienda(req.user);
  const actual = getActiveShift(req.user.id, tienda);
  if (!actual) return res.status(404).json({ error: 'No hay jornada activa' });
  if (actual.estado === 'pausa') return res.json({ ok: true, fichaje: actual });

  db.prepare(`
    UPDATE fichajes
    SET estado = 'pausa', pausa_desde = datetime('now','localtime'), updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(actual.id);

  log('fichajes', actual.id, 'pause', req.user.id, {});
  res.json({ ok: true });
});

router.post('/resume', auth, (req, res) => {
  const tienda = getTienda(req.user);
  const actual = getActiveShift(req.user.id, tienda);
  if (!actual) return res.status(404).json({ error: 'No hay jornada activa' });
  if (actual.estado !== 'pausa' || !actual.pausa_desde) return res.json({ ok: true, fichaje: actual });

  const pausaInicio = new Date(actual.pausa_desde.replace(' ', 'T'));
  const ahora = new Date();
  const minutosPausa = Math.max(Math.round((ahora.getTime() - pausaInicio.getTime()) / 60000), 0);
  const pausaTotal = (actual.pausa_total_min || 0) + minutosPausa;

  db.prepare(`
    UPDATE fichajes
    SET estado = 'trabajando',
        pausa_desde = NULL,
        pausa_total_min = ?,
        updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(pausaTotal, actual.id);

  log('fichajes', actual.id, 'resume', req.user.id, { pausa_total_min: pausaTotal });
  res.json({ ok: true, pausa_total_min: pausaTotal, descanso_restante_min: Math.max((actual.descanso_max_min || 0) - pausaTotal, 0) });
});

router.post('/stop', auth, (req, res) => {
  const tienda = getTienda(req.user);
  const actual = getActiveShift(req.user.id, tienda);
  if (!actual) return res.status(404).json({ error: 'No hay jornada activa' });

  let pausaTotal = actual.pausa_total_min || 0;
  if (actual.estado === 'pausa' && actual.pausa_desde) {
    const pausaInicio = new Date(actual.pausa_desde.replace(' ', 'T'));
    const ahora = new Date();
    pausaTotal += Math.max(Math.round((ahora.getTime() - pausaInicio.getTime()) / 60000), 0);
  }

  db.prepare(`
    UPDATE fichajes
    SET estado = 'terminado',
        pausa_total_min = ?,
        pausa_desde = NULL,
        finished_at = datetime('now','localtime'),
        updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(pausaTotal, actual.id);

  log('fichajes', actual.id, 'stop', req.user.id, { pausa_total_min: pausaTotal });
  res.json({ ok: true });
});

router.get('/export-3m', auth, (req, res) => {
  const tienda = getTienda(req.user);
  ensureExportDir();
  cleanupOldExports();

  const rows = db.prepare(`
    SELECT f.*, u.nombre, u.email
    FROM fichajes f
    JOIN users u ON u.id = f.user_id
    WHERE f.tienda = ?
      AND date(f.fecha) >= date('now', '-3 months')
    ORDER BY f.fecha DESC, u.nombre ASC, f.started_at ASC
  `).all(tienda);

  const headers = [
    'fecha',
    'tienda',
    'usuario',
    'email',
    'estado',
    'inicio',
    'pausa_desde',
    'fin',
    'pausa_total_min',
    'descanso_max_min',
    'seg_trabajados',
    'min_trabajados',
    'horas_trabajadas',
  ];

  const lines = rows.map((item) => {
    const workedSeconds = computeWorkedSeconds(item);
    const workedMinutes = Math.floor(workedSeconds / 60);
    const workedHours = (workedMinutes / 60).toFixed(2);
    return [
      item.fecha,
      item.tienda,
      item.nombre,
      item.email,
      item.estado,
      item.started_at || '',
      item.pausa_desde || '',
      item.finished_at || '',
      item.pausa_total_min || 0,
      item.descanso_max_min || 0,
      workedSeconds,
      workedMinutes,
      workedHours,
    ].map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';');
  });

  const filename = `fichajes-3-meses-${tienda}-${formatDateForFile()}.csv`;
  const filepath = path.join(EXPORT_DIR, filename);
  const content = `\uFEFF${headers.join(';')}\n${lines.join('\n')}\n`;
  fs.writeFileSync(filepath, content, 'utf-8');

  log('fichajes', null, 'export', req.user.id, { tienda, archivo: filename });

  res.json({
    ok: true,
    archivo: filename,
    carpeta: EXPORT_DIR,
    registros: rows.length,
  });
});

module.exports = router;
