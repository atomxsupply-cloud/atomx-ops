const express = require('express');
const { db } = require('../db');
const { auth } = require('../middleware/auth');
const { importClientesFactusol, CLIENTES_XLSX_PATH } = require('../services/clientesFactusol');
const fs = require('fs');

const router = express.Router();

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function buildDuplicateGroups() {
  const clientes = db.prepare(`
    SELECT *
    FROM clientes
    WHERE es_interno = 0
      AND nombre IS NOT NULL
      AND trim(nombre) <> ''
    ORDER BY updated_at DESC, id DESC
  `).all();

  const groups = new Map();

  clientes.forEach((cliente) => {
    const nif = normalizeText(cliente.nif);
    const telefono = normalizePhone(cliente.telefono);
    const nombre = normalizeText(cliente.nombre);

    let key = '';
    let reason = 'nombre';
    let matchValue = '';

    if (nif) {
      key = `nif:${nif}`;
      reason = 'nif';
      matchValue = cliente.nif || '';
    } else if (telefono && telefono.length >= 9) {
      key = `telefono:${telefono}`;
      reason = 'telefono';
      matchValue = cliente.telefono || '';
    } else if (nombre) {
      key = `nombre:${nombre}`;
      reason = 'nombre';
      matchValue = cliente.nombre || '';
    }

    if (!key) return;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        reason,
        matchValue,
        total: 0,
        clientes: [],
      });
    }

    const group = groups.get(key);
    group.total += 1;
    group.clientes.push(cliente);
  });

  return Array.from(groups.values())
    .filter((group) => group.total > 1)
    .map((group) => ({
      ...group,
      clientes: group.clientes.sort((a, b) => {
        const score = (item) =>
          (item.telefono ? 1 : 0) +
          (item.direccion ? 1 : 0) +
          (item.cp ? 1 : 0) +
          (item.nif ? 1 : 0) +
          (item.codigo_externo ? 1 : 0);
        return score(b) - score(a) || String(b.updated_at || '').localeCompare(String(a.updated_at || '')) || a.id - b.id;
      }),
    }))
    .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key))
    .slice(0, 30);
}

router.get('/overview', auth, (_req, res) => {
  const total = db.prepare('SELECT COUNT(*) as total FROM clientes WHERE es_interno = 0').get()?.total || 0;
  const internos = db.prepare('SELECT COUNT(*) as total FROM clientes WHERE es_interno = 1').get()?.total || 0;
  const sinTelefono = db.prepare('SELECT COUNT(*) as total FROM clientes WHERE es_interno = 0 AND (telefono IS NULL OR telefono = \'\')').get()?.total || 0;
  const sinZona = db.prepare('SELECT COUNT(*) as total FROM clientes WHERE es_interno = 0 AND (zona_reparto IS NULL OR zona_reparto = \'\')').get()?.total || 0;
  const duplicados = buildDuplicateGroups().length;
  const porZona = db.prepare(`
    SELECT COALESCE(zona_reparto, 'Sin zona') as zona, COUNT(*) as total
    FROM clientes
    WHERE es_interno = 0
    GROUP BY COALESCE(zona_reparto, 'Sin zona')
    ORDER BY total DESC, zona ASC
    LIMIT 8
  `).all();

  let excel = null;
  if (fs.existsSync(CLIENTES_XLSX_PATH)) {
    const stat = fs.statSync(CLIENTES_XLSX_PATH);
    excel = {
      path: CLIENTES_XLSX_PATH,
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
    };
  }

  res.json({
    total,
    internos,
    sinTelefono,
    sinZona,
    duplicados,
    porZona,
    excel,
  });
});

router.get('/duplicates', auth, (_req, res) => {
  res.json({ groups: buildDuplicateGroups() });
});

router.get('/:id/history', auth, (req, res) => {
  const id = Number(req.params.id);
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(id);
  if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

  const pedidos = db.prepare(`
    SELECT id, numero, estado, urgente, zona_reparto, created_at
    FROM pedidos
    WHERE cliente_nombre = ?
    ORDER BY datetime(created_at) DESC
    LIMIT 8
  `).all(cliente.nombre);

  const productos = db.prepare(`
    SELECT pi.producto_nombre, SUM(pi.cantidad) as total_cantidad, COUNT(*) as veces
    FROM pedido_items pi
    INNER JOIN pedidos p ON p.id = pi.pedido_id
    WHERE p.cliente_nombre = ?
    GROUP BY pi.producto_nombre
    ORDER BY veces DESC, total_cantidad DESC, pi.producto_nombre ASC
    LIMIT 8
  `).all(cliente.nombre);

  res.json({
    cliente,
    pedidos,
    productos,
  });
});

router.get('/', auth, (req, res) => {
  const search = String(req.query.search || '').trim();
  const limit = Math.min(parseInt(req.query.limit || '12', 10), 30);
  const includeInternal = req.query.include_internal === '1';

  const whereBase = includeInternal ? '1=1' : 'es_interno = 0';

  if (!search) {
    const recientes = db.prepare(`
      SELECT *
      FROM clientes
      WHERE ${whereBase}
      ORDER BY updated_at DESC, nombre ASC
      LIMIT ?
    `).all(limit);
    return res.json({ clientes: recientes });
  }

  const text = `%${search}%`;
  const clientes = db.prepare(`
    SELECT *
    FROM clientes
    WHERE ${whereBase}
      AND (
        nombre LIKE ?
        OR telefono LIKE ?
        OR nif LIKE ?
        OR direccion LIKE ?
        OR poblacion LIKE ?
      )
    ORDER BY
      CASE
        WHEN lower(nombre) = lower(?) THEN 0
        WHEN lower(nombre) LIKE lower(?) THEN 1
        WHEN replace(ifnull(telefono, ''), ' ', '') LIKE ? THEN 2
        WHEN lower(ifnull(direccion, '')) LIKE lower(?) THEN 3
        WHEN lower(ifnull(poblacion, '')) LIKE lower(?) THEN 4
        ELSE 5
      END,
      datetime(updated_at) DESC,
      nombre ASC
    LIMIT ?
  `).all(
    text,
    text,
    text,
    text,
    text,
    search,
    `${search}%`,
    `%${String(search).replace(/\s+/g, '')}%`,
    text,
    text,
    limit
  );

  res.json({ clientes });
});

router.post('/import/factusol-local', auth, (_req, res) => {
  try {
    const result = importClientesFactusol();
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message || 'No he podido importar clientes desde Factusol local',
    });
  }
});

router.post('/merge', auth, (req, res) => {
  const primaryId = Number(req.body?.primaryId);
  const duplicateIds = Array.isArray(req.body?.duplicateIds)
    ? req.body.duplicateIds.map((id) => Number(id)).filter(Boolean)
    : [];
  const sanitizedDuplicateIds = duplicateIds.filter((id) => id !== primaryId);

  if (!primaryId || !sanitizedDuplicateIds.length) {
    return res.status(400).json({ error: 'Faltan ids para fusionar clientes' });
  }

  const primary = db.prepare('SELECT * FROM clientes WHERE id = ?').get(primaryId);
  if (!primary) return res.status(404).json({ error: 'Cliente principal no encontrado' });

  const duplicates = db.prepare(`
    SELECT *
    FROM clientes
    WHERE id IN (${sanitizedDuplicateIds.map(() => '?').join(',')})
  `).all(...sanitizedDuplicateIds);

  if (!duplicates.length) {
    return res.status(404).json({ error: 'No he encontrado duplicados para fusionar' });
  }

  const merged = { ...primary };
  const pick = (current, candidate) => current || candidate || null;

  duplicates.forEach((item) => {
    merged.codigo_externo = pick(merged.codigo_externo, item.codigo_externo);
    merged.telefono = pick(merged.telefono, item.telefono);
    merged.email = pick(merged.email, item.email);
    merged.direccion = pick(merged.direccion, item.direccion);
    merged.cp = pick(merged.cp, item.cp);
    merged.poblacion = pick(merged.poblacion, item.poblacion);
    merged.provincia = pick(merged.provincia, item.provincia);
    merged.nif = pick(merged.nif, item.nif);
    merged.zona_reparto = pick(merged.zona_reparto, item.zona_reparto) || 'ZONA MURCIA';
    merged.es_interno = merged.es_interno || item.es_interno ? 1 : 0;
    merged.origen = pick(merged.origen, item.origen) || 'manual';
  });

  db.prepare(`
    UPDATE clientes
    SET codigo_externo = ?, telefono = ?, email = ?, direccion = ?, cp = ?, poblacion = ?, provincia = ?, nif = ?, zona_reparto = ?, es_interno = ?, origen = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(
    merged.codigo_externo,
    merged.telefono,
    merged.email,
    merged.direccion,
    merged.cp,
    merged.poblacion,
    merged.provincia,
    merged.nif,
    merged.zona_reparto,
    merged.es_interno,
    merged.origen,
    primaryId
  );

  db.prepare(`DELETE FROM clientes WHERE id IN (${sanitizedDuplicateIds.map(() => '?').join(',')})`).run(...sanitizedDuplicateIds);

  res.json({
    ok: true,
    mergedInto: primaryId,
    removed: sanitizedDuplicateIds.length,
    cliente: db.prepare('SELECT * FROM clientes WHERE id = ?').get(primaryId),
  });
});

router.patch('/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  const actual = db.prepare('SELECT * FROM clientes WHERE id = ?').get(id);
  if (!actual) return res.status(404).json({ error: 'Cliente no encontrado' });

  const payload = {
    nombre: String(req.body?.nombre ?? actual.nombre).trim() || actual.nombre,
    telefono: String(req.body?.telefono ?? actual.telefono ?? '').trim() || null,
    email: String(req.body?.email ?? actual.email ?? '').trim() || null,
    direccion: String(req.body?.direccion ?? actual.direccion ?? '').trim() || null,
    cp: String(req.body?.cp ?? actual.cp ?? '').trim() || null,
    poblacion: String(req.body?.poblacion ?? actual.poblacion ?? '').trim() || null,
    provincia: String(req.body?.provincia ?? actual.provincia ?? '').trim() || null,
    nif: String(req.body?.nif ?? actual.nif ?? '').trim() || null,
    zona_reparto: String(req.body?.zona_reparto ?? actual.zona_reparto ?? 'ZONA MURCIA').trim() || 'ZONA MURCIA',
    es_interno: req.body?.es_interno != null ? (req.body.es_interno ? 1 : 0) : actual.es_interno,
  };

  db.prepare(`
    UPDATE clientes
    SET nombre = ?, telefono = ?, email = ?, direccion = ?, cp = ?, poblacion = ?, provincia = ?, nif = ?, zona_reparto = ?, es_interno = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(
    payload.nombre,
    payload.telefono,
    payload.email,
    payload.direccion,
    payload.cp,
    payload.poblacion,
    payload.provincia,
    payload.nif,
    payload.zona_reparto,
    payload.es_interno,
    id
  );

  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(id);
  res.json(cliente);
});

module.exports = router;
