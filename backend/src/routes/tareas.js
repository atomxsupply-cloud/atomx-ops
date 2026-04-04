const express = require('express');
const { db, log, notify } = require('../db');
const { auth } = require('../middleware/auth');
const { getTienda } = require('../services/tiendaScope');
const { desarrollarIdeaTarea } = require('../services/atomBrain');

const router = express.Router();

router.get('/', auth, (req, res) => {
  const { estado, asignado_a, prioridad, categoria } = req.query;
  db.prepare(`
    DELETE FROM tareas
    WHERE tienda = ?
      AND origen = 'asistente'
      AND estado = 'pendiente'
      AND expira_at IS NOT NULL
      AND datetime(expira_at) <= datetime('now')
  `).run(getTienda(req.user));

  const where = ['t.tienda = ?'];
  const params = [getTienda(req.user)];

  if (estado) { where.push('t.estado = ?'); params.push(estado); }
  if (asignado_a) { where.push('t.asignado_a = ?'); params.push(asignado_a); }
  if (prioridad) { where.push('t.prioridad = ?'); params.push(prioridad); }
  if (categoria) { where.push('t.categoria = ?'); params.push(categoria); }

  const tareas = db.prepare(`
    SELECT t.*, u.nombre as asignado_nombre, c.nombre as creador_nombre
    FROM tareas t
    LEFT JOIN users u ON t.asignado_a = u.id
    LEFT JOIN users c ON t.created_by = c.id
    WHERE ${where.join(' AND ')}
    ORDER BY CASE t.prioridad WHEN 'alta' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
             t.fecha_limite ASC, t.created_at DESC
  `).all(...params);

  res.json(tareas);
});

router.post('/', auth, async (req, res) => {
  const { titulo, descripcion, asignado_a, categoria, prioridad, fecha_limite, recurrente, dias_recurrencia, origen, expira_at } = req.body;
  if (!titulo) return res.status(400).json({ error: 'Titulo requerido' });

  let tareaFinal = { titulo, descripcion: descripcion || '' };
  try {
    const asignado = asignado_a ? db.prepare('SELECT nombre FROM users WHERE id = ?').get(asignado_a) : null;
    tareaFinal = await desarrollarIdeaTarea({
      titulo,
      descripcion: descripcion || '',
      asignadoNombre: asignado?.nombre || '',
      tienda: getTienda(req.user),
      creadorNombre: req.user.nombre || '',
    });
  } catch {}

  const r = db.prepare(`
    INSERT INTO tareas (titulo, tienda, descripcion, asignado_a, categoria, prioridad, fecha_limite, origen, expira_at, recurrente, dias_recurrencia, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    tareaFinal.titulo,
    getTienda(req.user),
    tareaFinal.descripcion || null,
    asignado_a || null,
    categoria || 'general',
    prioridad || 'normal',
    fecha_limite || null,
    origen || 'manual',
    expira_at || null,
    recurrente ? 1 : 0,
    dias_recurrencia || null,
    req.user.id
  );

  log('tareas', r.lastInsertRowid, 'crear', req.user.id, { titulo: tareaFinal.titulo });

  if (asignado_a) {
    notify(
      asignado_a,
      'tarea',
      'Nueva tarea asignada',
      `${req.user.nombre} te ha asignado: ${tareaFinal.titulo}`,
      '/tareas'
    );
  }

  res.status(201).json(
    db.prepare('SELECT * FROM tareas WHERE id = ? AND tienda = ?').get(r.lastInsertRowid, getTienda(req.user))
  );
});

router.patch('/:id/estado', auth, (req, res) => {
  const { estado } = req.body;
  db.prepare(`UPDATE tareas SET estado = ?, updated_at = datetime('now','localtime') WHERE id = ? AND tienda = ?`).run(
    estado,
    req.params.id,
    getTienda(req.user)
  );
  log('tareas', parseInt(req.params.id, 10), 'cambiar_estado', req.user.id, { estado });
  res.json({ ok: true });
});

router.patch('/:id/promote', auth, (req, res) => {
  db.prepare(`
    UPDATE tareas
    SET origen = 'manual',
        expira_at = NULL,
        updated_at = datetime('now','localtime')
    WHERE id = ? AND tienda = ?
  `).run(req.params.id, getTienda(req.user));
  log('tareas', parseInt(req.params.id, 10), 'promote', req.user.id, {});
  res.json({ ok: true });
});

router.put('/:id', auth, (req, res) => {
  const { titulo, descripcion, asignado_a, categoria, prioridad, fecha_limite, recurrente, dias_recurrencia } = req.body;
  const anterior = db.prepare(`SELECT asignado_a, titulo FROM tareas WHERE id = ? AND tienda = ?`).get(req.params.id, getTienda(req.user));
  db.prepare(`
    UPDATE tareas
    SET titulo=?, descripcion=?, asignado_a=?, categoria=?, prioridad=?, fecha_limite=?,
        recurrente=?, dias_recurrencia=?, updated_at=datetime('now','localtime')
    WHERE id=? AND tienda=?
  `).run(
    titulo,
    descripcion,
    asignado_a,
    categoria || 'general',
    prioridad,
    fecha_limite,
    recurrente ? 1 : 0,
    dias_recurrencia,
    req.params.id,
    getTienda(req.user)
  );

  if (asignado_a && anterior?.asignado_a !== asignado_a) {
    notify(
      asignado_a,
      'tarea',
      'Tarea reasignada',
      `${req.user.nombre} te ha asignado: ${titulo || anterior?.titulo || 'Tarea'}`,
      '/tareas'
    );
  }

  res.json({ ok: true });
});

router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM tareas WHERE id = ? AND tienda = ?').run(req.params.id, getTienda(req.user));
  res.json({ ok: true });
});

module.exports = router;
