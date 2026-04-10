const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const { db } = require('../db');

const CLIENTES_XLSX_PATH = path.join(__dirname, '..', '..', '..', 'datos', 'Listado de clientes.XLSX');

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function inferZoneFromCliente({ direccion, cp, poblacion, provincia }) {
  const value = normalizeText([direccion, cp, poblacion, provincia].filter(Boolean).join(' '));
  if (!value) return 'ZONA MURCIA';
  if (/(cartagena|la union|mazarron)/.test(value)) return 'ZONA CARTAGENA';
  if (/(san pedro|san javier|torre pacheco|los alcazares|aguilas)/.test(value)) return 'ZONA PLAYA';
  if (/(alicante|san vicente|campello|mutxamel)/.test(value)) return 'ZONA ALICANTE';
  if (/(elche|crevillente|santa pola)/.test(value)) return 'ZONA ELCHE';
  if (/(benidorm|altea|calpe|villajoyosa|finestrat)/.test(value)) return 'ZONA BENIDORM';
  if (/(valencia|gandia|sagunto|torrent)/.test(value)) return 'ZONA VALENCIA';
  if (/(yecla|jumilla|villena|albacete)/.test(value)) return 'ZONA NORTE';
  return 'ZONA MURCIA';
}

function isInternalClient(name) {
  const value = normalizeText(name);
  return value.startsWith('ventas tienda') || value.startsWith('tattoo ');
}

function readClientesFactusol() {
  if (!fs.existsSync(CLIENTES_XLSX_PATH)) return [];

  const workbook = xlsx.readFile(CLIENTES_XLSX_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rows.length < 4) return [];

  return rows
    .slice(3)
    .map((row) => {
      const codigo = String(row[0] || '').trim();
      const nombre = String(row[1] || '').trim();
      const direccion = String(row[2] || '').trim();
      const cp = String(row[3] || '').trim();
      const poblacion = String(row[4] || '').trim();
      const provincia = String(row[5] || '').trim();
      const telefono = String(row[6] || '').trim();
      const nif = String(row[7] || '').trim();

      if (!nombre) return null;

      return {
        codigo_externo: codigo || null,
        nombre,
        direccion: direccion || null,
        cp: cp || null,
        poblacion: poblacion || null,
        provincia: provincia || null,
        telefono: telefono || null,
        nif: nif || null,
        zona_reparto: inferZoneFromCliente({ direccion, cp, poblacion, provincia }),
        es_interno: isInternalClient(nombre) ? 1 : 0,
        origen: 'factusol',
      };
    })
    .filter(Boolean);
}

function importClientesFactusol() {
  const clientes = readClientesFactusol();
  if (!clientes.length) return { imported: 0, skipped: 0 };

  const findByExternal = db.prepare(`
    SELECT id
    FROM clientes
    WHERE codigo_externo = ?
    LIMIT 1
  `);

  const findByNameAndNif = db.prepare(`
    SELECT id
    FROM clientes
    WHERE nombre = ?
      AND COALESCE(nif, '') = COALESCE(?, '')
    LIMIT 1
  `);

  const findByNameOnly = db.prepare(`
    SELECT id
    FROM clientes
    WHERE nombre = ?
    LIMIT 1
  `);

  const updateByExternal = db.prepare(`
    UPDATE clientes
    SET nombre = ?,
        direccion = ?,
        cp = ?,
        poblacion = ?,
        provincia = ?,
        telefono = ?,
        nif = ?,
        zona_reparto = ?,
        es_interno = ?,
        origen = ?,
        updated_at = datetime('now','localtime')
    WHERE id = ?
  `);

  const insertCliente = db.prepare(`
    INSERT INTO clientes (
      codigo_externo, nombre, direccion, cp, poblacion, provincia, telefono, nif,
      zona_reparto, es_interno, origen, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
  `);

  let imported = 0;
  for (const cliente of clientes) {
    const existing =
      (cliente.codigo_externo ? findByExternal.get(cliente.codigo_externo) : null) ||
      findByNameAndNif.get(cliente.nombre, cliente.nif || '') ||
      findByNameOnly.get(cliente.nombre);
    if (existing?.id) {
      updateByExternal.run(
        cliente.nombre,
        cliente.direccion,
        cliente.cp,
        cliente.poblacion,
        cliente.provincia,
        cliente.telefono,
        cliente.nif,
        cliente.zona_reparto,
        cliente.es_interno,
        cliente.origen,
        existing.id
      );
    } else {
      insertCliente.run(
        cliente.codigo_externo,
        cliente.nombre,
        cliente.direccion,
        cliente.cp,
        cliente.poblacion,
        cliente.provincia,
        cliente.telefono,
        cliente.nif,
        cliente.zona_reparto,
        cliente.es_interno,
        cliente.origen
      );
    }
    imported += 1;
  }

  return { imported, skipped: 0 };
}

module.exports = {
  CLIENTES_XLSX_PATH,
  importClientesFactusol,
  inferZoneFromCliente,
};
