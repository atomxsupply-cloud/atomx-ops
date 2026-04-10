const express = require('express');
const { db, log } = require('../db');
const { auth } = require('../middleware/auth');
const { getTienda } = require('../services/tiendaScope');

const router = express.Router();

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeTurno(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'manana' || text === 'mañana') return 'manana';
  if (text === 'tarde') return 'tarde';
  return null;
}

function detectZona({ direccion = '', lat = null, lng = null }) {
  const text = String(direccion || '').toLowerCase();

  if (text.includes('cartagena')) return 'CARTAGENA';
  if (text.includes('benidorm')) return 'BENIDORM';
  if (text.includes('mallorca') || text.includes('palma')) return 'MALLORCA';
  if (text.includes('murcia')) return 'MURCIA';
  if (text.includes('san pedro') || text.includes('san javier') || text.includes('torre pacheco') || text.includes('mazarron') || text.includes('aguilas')) return 'PLAYA';
  if (text.includes('alicante') || text.includes('valencia') || text.includes('castellon')) return 'NORTE';

  if (typeof lat === 'number' && typeof lng === 'number') {
    if (lat > 39.0 && lng > 2.0) return 'MALLORCA';
    if (lat > 38.4 && lat < 39.0 && lng > -0.8 && lng < 0.4) return 'BENIDORM';
    if (lat > 37.45 && lat < 37.75 && lng > -1.2 && lng < -0.8) return 'CARTAGENA';
    if (lat > 37.8 && lat < 38.2 && lng > -1.3 && lng < -1.0) return 'MURCIA';
  }

  return 'OTRA';
}

router.get('/', auth, (req, res) => {
  const fecha = String(req.query.fecha || today());
  const estado = String(req.query.estado || 'pendiente');
  const tienda = getTienda(req.user);

  const rutas = db.prepare(`
    SELECT r.*, 
      u.nombre as asignado_nombre,
      c.nombre as creador_nombre
    FROM rutas_comerciales r
    LEFT JOIN users u ON r.asignado_a = u.id
    LEFT JOIN users c ON r.created_by = c.id
    WHERE r.fecha = ? AND r.tienda = ? AND r.estado = ?
    ORDER BY CASE COALESCE(r.hora, '')
      WHEN 'manana' THEN 0
      WHEN 'tarde' THEN 1
      ELSE 9
    END ASC, r.created_at ASC
  `).all(fecha, tienda, estado);

  res.json({ rutas });
});

router.get('/resumen-dia', auth, (req, res) => {
  const fecha = String(req.query.fecha || today());
  const tienda = getTienda(req.user);

  const pendientes = db.prepare(`
    SELECT zona_detectada, COUNT(*) as total
    FROM rutas_comerciales
    WHERE fecha = ? AND tienda = ? AND estado = 'pendiente'
    GROUP BY zona_detectada
    ORDER BY total DESC
  `).all(fecha, tienda);

  const pagadas = db.prepare(`
    SELECT COUNT(*) as total
    FROM rutas_comerciales
    WHERE fecha = ? AND tienda = ? AND estado = 'pagado'
  `).get(fecha, tienda)?.total || 0;

  res.json({ pendientes, pagadas });
});

router.post('/', auth, (req, res) => {
  const tienda = getTienda(req.user);
  const fecha = String(req.body?.fecha || today());
  const estudio = String(req.body?.estudio || '').trim();
  const direccion = String(req.body?.direccion || '').trim();
  const hora = normalizeTurno(req.body?.turno || req.body?.hora);
  const nota = String(req.body?.nota || '').trim();
  const lat = req.body?.lat ?? null;
  const lng = req.body?.lng ?? null;
  const asignado_a = req.body?.asignado_a || null;

  if (!estudio) return res.status(400).json({ error: 'Estudio requerido' });

  const zona_detectada = detectZona({ direccion, lat, lng });

  const r = db.prepare(`
    INSERT INTO rutas_comerciales
    (fecha, tienda, estudio, direccion, lat, lng, hora, zona_detectada, nota, asignado_a, created_by, estado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')
  `).run(
    fecha,
    tienda,
    estudio,
    direccion || null,
    typeof lat === 'number' ? lat : null,
    typeof lng === 'number' ? lng : null,
    hora,
    zona_detectada,
    nota || null,
    asignado_a,
    req.user.id
  );

  const ruta = db.prepare(`
    SELECT r.*, u.nombre as asignado_nombre
    FROM rutas_comerciales r
    LEFT JOIN users u ON r.asignado_a = u.id
    WHERE r.id = ?
  `).get(r.lastInsertRowid);

  log('rutas_comerciales', r.lastInsertRowid, 'crear', req.user.id, { estudio, zona_detectada });
  res.status(201).json(ruta);
});

router.put('/:id', auth, (req, res) => {
  const tienda = getTienda(req.user);
  const id = Number(req.params.id);
  const estudio = String(req.body?.estudio || '').trim();
  const direccion = String(req.body?.direccion || '').trim();
  const hora = normalizeTurno(req.body?.turno || req.body?.hora);
  const nota = String(req.body?.nota || '').trim();
  const lat = req.body?.lat ?? null;
  const lng = req.body?.lng ?? null;
  const asignado_a = req.body?.asignado_a || null;

  const actual = db.prepare(`SELECT * FROM rutas_comerciales WHERE id = ? AND tienda = ?`).get(id, tienda);
  if (!actual) return res.status(404).json({ error: 'Ruta no encontrada' });

  const zona_detectada = detectZona({ direccion, lat, lng });

  db.prepare(`
    UPDATE rutas_comerciales
    SET estudio = ?, direccion = ?, lat = ?, lng = ?, hora = ?, zona_detectada = ?, nota = ?, asignado_a = ?, updated_at = datetime('now','localtime')
    WHERE id = ? AND tienda = ?
  `).run(
    estudio || actual.estudio,
    direccion || null,
    typeof lat === 'number' ? lat : null,
    typeof lng === 'number' ? lng : null,
    hora,
    zona_detectada,
    nota || null,
    asignado_a,
    id,
    tienda
  );

  log('rutas_comerciales', id, 'editar', req.user.id, { estudio: estudio || actual.estudio, zona_detectada });
  res.json({ ok: true });
});

router.patch('/:id/estado', auth, (req, res) => {
  const tienda = getTienda(req.user);
  const id = Number(req.params.id);
  const estado = req.body?.estado === 'pagado' ? 'pagado' : 'pendiente';

  const actual = db.prepare(`SELECT * FROM rutas_comerciales WHERE id = ? AND tienda = ?`).get(id, tienda);
  if (!actual) return res.status(404).json({ error: 'Ruta no encontrada' });

  db.prepare(`
    UPDATE rutas_comerciales
    SET estado = ?, paid_at = ?, updated_at = datetime('now','localtime')
    WHERE id = ? AND tienda = ?
  `).run(
    estado,
    estado === 'pagado' ? new Date().toISOString() : null,
    id,
    tienda
  );

  log('rutas_comerciales', id, 'estado', req.user.id, { estado });
  res.json({ ok: true });
});

router.delete('/:id', auth, (req, res) => {
  const tienda = getTienda(req.user);
  const id = Number(req.params.id);
  db.prepare(`DELETE FROM rutas_comerciales WHERE id = ? AND tienda = ?`).run(id, tienda);
  log('rutas_comerciales', id, 'borrar', req.user.id, {});
  res.json({ ok: true });
});

module.exports = router;
