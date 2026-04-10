const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'atomx.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'empleado',
      activo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT UNIQUE NOT NULL,
      tienda TEXT NOT NULL DEFAULT 'murcia',
      cliente_nombre TEXT NOT NULL,
      cliente_dni TEXT,
      cliente_email TEXT,
      cliente_telefono TEXT,
      cliente_direccion TEXT,
      cliente_cp TEXT,
      zona_reparto TEXT DEFAULT 'ZONA MURCIA',
      tipo_documento TEXT DEFAULT 'factura',
      descuento INTEGER DEFAULT 0,
      metodo_envio TEXT DEFAULT 'envio',
      estado TEXT DEFAULT 'pendiente',
      urgente INTEGER DEFAULT 0,
      notas TEXT,
      responsable_id INTEGER REFERENCES users(id),
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_externo TEXT,
      nombre TEXT NOT NULL,
      direccion TEXT,
      cp TEXT,
      poblacion TEXT,
      provincia TEXT,
      telefono TEXT,
      email TEXT,
      nif TEXT,
      zona_reparto TEXT DEFAULT 'ZONA MURCIA',
      es_interno INTEGER DEFAULT 0,
      origen TEXT DEFAULT 'manual',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE(nombre, nif)
    );

    CREATE TABLE IF NOT EXISTS pedido_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
      producto_nombre TEXT NOT NULL,
      cantidad INTEGER DEFAULT 1,
      precio_unitario REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tareas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      tienda TEXT NOT NULL DEFAULT 'murcia',
      descripcion TEXT,
      asignado_a INTEGER REFERENCES users(id),
      categoria TEXT DEFAULT 'general',
      prioridad TEXT DEFAULT 'normal',
      fecha_limite TEXT,
      estado TEXT DEFAULT 'pendiente',
      origen TEXT DEFAULT 'manual',
      expira_at TEXT,
      recurrente INTEGER DEFAULT 0,
      dias_recurrencia TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS notas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tienda TEXT NOT NULL DEFAULT 'murcia',
      contenido TEXT NOT NULL,
      autor_id INTEGER REFERENCES users(id),
      categoria TEXT DEFAULT 'general',
      prioridad TEXT DEFAULT 'normal',
      estado TEXT DEFAULT 'abierta',
      pinned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tienda TEXT NOT NULL DEFAULT 'murcia',
      nombre TEXT NOT NULL,
      categoria TEXT,
      proveedor TEXT,
      stock_actual INTEGER DEFAULT 0,
      stock_minimo INTEGER DEFAULT 5,
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      updated_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS caja_dias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      tienda TEXT NOT NULL DEFAULT 'murcia',
      apertura_importe REAL DEFAULT 0,
      manana_apertura REAL DEFAULT 0,
      manana_cierre REAL,
      tarde_apertura REAL,
      tarde_cierre REAL,
      factusol_ajuste_tarde REAL DEFAULT 0,
      cierre_importe REAL,
      total_ingresos REAL DEFAULT 0,
      total_gastos REAL DEFAULT 0,
      observaciones TEXT,
      estado TEXT DEFAULT 'abierta',
      created_by INTEGER REFERENCES users(id),
      closed_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE(fecha, tienda)
    );

    CREATE TABLE IF NOT EXISTS caja_movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caja_id INTEGER NOT NULL REFERENCES caja_dias(id),
      tipo TEXT NOT NULL,
      concepto TEXT NOT NULL,
      importe REAL NOT NULL,
      metodo_pago TEXT DEFAULT 'efectivo',
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS incidencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tienda TEXT NOT NULL DEFAULT 'murcia',
      tipo TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      pedido_id INTEGER REFERENCES pedidos(id),
      responsable_id INTEGER REFERENCES users(id),
      estado TEXT DEFAULT 'abierta',
      fecha_apertura TEXT DEFAULT (datetime('now','localtime')),
      fecha_resolucion TEXT,
      created_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS actividad (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tienda TEXT NOT NULL DEFAULT 'murcia',
      tabla TEXT NOT NULL,
      registro_id INTEGER,
      accion TEXT NOT NULL,
      usuario_id INTEGER REFERENCES users(id),
      datos TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS notificaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL,
      titulo TEXT NOT NULL,
      mensaje TEXT,
      link TEXT,
      leida INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wa_message_id TEXT,
      wa_from TEXT NOT NULL,
      wa_name TEXT,
      direction TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      text_body TEXT,
      payload TEXT,
      processed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS salidas_dinero (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      tienda TEXT NOT NULL DEFAULT 'murcia',
      concepto TEXT NOT NULL,
      importe REAL NOT NULL,
      caja_movimiento_id INTEGER REFERENCES caja_movimientos(id) ON DELETE SET NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS checklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      texto TEXT NOT NULL,
      orden INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS checklist_registros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER REFERENCES checklist_items(id),
      fecha TEXT NOT NULL,
      tienda TEXT NOT NULL DEFAULT 'murcia',
      completado INTEGER DEFAULT 0,
      usuario_id INTEGER REFERENCES users(id),
      hora TEXT
    );

    CREATE TABLE IF NOT EXISTS rutas_comerciales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      tienda TEXT NOT NULL DEFAULT 'murcia',
      estudio TEXT NOT NULL,
      direccion TEXT,
      lat REAL,
      lng REAL,
      hora TEXT,
      zona_detectada TEXT,
      nota TEXT,
      asignado_a INTEGER REFERENCES users(id),
      created_by INTEGER REFERENCES users(id),
      estado TEXT NOT NULL DEFAULT 'pendiente',
      paid_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS ia_memoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tienda TEXT NOT NULL DEFAULT 'murcia',
      rol TEXT NOT NULL,
      mensaje TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS fichajes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tienda TEXT NOT NULL DEFAULT 'murcia',
      fecha TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'trabajando',
      started_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      pausa_desde TEXT,
      pausa_total_min INTEGER DEFAULT 0,
      descanso_max_min INTEGER DEFAULT 30,
      finished_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS prestashop_orders_cache (
      order_id INTEGER PRIMARY KEY,
      reference TEXT,
      current_state TEXT,
      state_name TEXT,
      customer_id INTEGER,
      payment TEXT,
      total_paid REAL DEFAULT 0,
      date_add TEXT,
      raw_json TEXT,
      first_seen_at TEXT DEFAULT (datetime('now','localtime')),
      last_seen_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS prestashop_order_items_cache (
      row_id INTEGER PRIMARY KEY,
      order_id INTEGER NOT NULL,
      product_id INTEGER,
      product_attribute_id INTEGER DEFAULT 0,
      product_name TEXT,
      product_reference TEXT,
      product_quantity INTEGER DEFAULT 0,
      total_price_tax_incl REAL DEFAULT 0,
      total_price_tax_excl REAL DEFAULT 0,
      stock_actual INTEGER,
      first_seen_at TEXT DEFAULT (datetime('now','localtime')),
      last_seen_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS prestashop_products_cache (
      product_id INTEGER PRIMARY KEY,
      stock_id INTEGER,
      product_attribute_id INTEGER DEFAULT 0,
      nombre TEXT,
      referencia TEXT,
      precio_sin_iva REAL DEFAULT 0,
      precio_con_iva REAL DEFAULT 0,
      activo INTEGER DEFAULT 0,
      stock_actual INTEGER,
      raw_json TEXT,
      first_seen_at TEXT DEFAULT (datetime('now','localtime')),
      last_seen_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS prestashop_daily_metrics (
      fecha TEXT PRIMARY KEY,
      total_orders INTEGER DEFAULT 0,
      total_pending INTEGER DEFAULT 0,
      total_done INTEGER DEFAULT 0,
      total_sales REAL DEFAULT 0,
      total_products INTEGER DEFAULT 0,
      total_active_products INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // Migraciones
  try { db.exec(`ALTER TABLE users ADD COLUMN last_seen TEXT`); } catch {}
  try { db.exec(`ALTER TABLE users ADD COLUMN tienda TEXT DEFAULT 'murcia'`); } catch {}
  try { db.exec(`ALTER TABLE users ADD COLUMN whatsapp_numero TEXT`); } catch {}
  try { db.exec(`ALTER TABLE clientes ADD COLUMN codigo_externo TEXT`); } catch {}
  try { db.exec(`ALTER TABLE clientes ADD COLUMN direccion TEXT`); } catch {}
  try { db.exec(`ALTER TABLE clientes ADD COLUMN cp TEXT`); } catch {}
  try { db.exec(`ALTER TABLE clientes ADD COLUMN poblacion TEXT`); } catch {}
  try { db.exec(`ALTER TABLE clientes ADD COLUMN provincia TEXT`); } catch {}
  try { db.exec(`ALTER TABLE clientes ADD COLUMN telefono TEXT`); } catch {}
  try { db.exec(`ALTER TABLE clientes ADD COLUMN email TEXT`); } catch {}
  try { db.exec(`ALTER TABLE clientes ADD COLUMN nif TEXT`); } catch {}
  try { db.exec(`ALTER TABLE clientes ADD COLUMN zona_reparto TEXT DEFAULT 'ZONA MURCIA'`); } catch {}
  try { db.exec(`ALTER TABLE clientes ADD COLUMN es_interno INTEGER DEFAULT 0`); } catch {}
  try { db.exec(`ALTER TABLE clientes ADD COLUMN origen TEXT DEFAULT 'manual'`); } catch {}
  try { db.exec(`ALTER TABLE clientes ADD COLUMN updated_at TEXT DEFAULT (datetime('now','localtime'))`); } catch {}
  try {
    db.exec(`
      DELETE FROM clientes
      WHERE codigo_externo IS NOT NULL
        AND codigo_externo <> ''
        AND id NOT IN (
          SELECT MIN(id)
          FROM clientes
          WHERE codigo_externo IS NOT NULL AND codigo_externo <> ''
          GROUP BY codigo_externo
        )
    `);
  } catch {}
  try {
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_codigo_externo
      ON clientes(codigo_externo)
      WHERE codigo_externo IS NOT NULL AND codigo_externo <> ''
    `);
  } catch {}
  try { db.exec(`ALTER TABLE pedidos ADD COLUMN zona_reparto TEXT DEFAULT 'ZONA MURCIA'`); } catch {}
  try { db.exec(`ALTER TABLE pedidos ADD COLUMN tienda TEXT NOT NULL DEFAULT 'murcia'`); } catch {}
  try { db.exec(`ALTER TABLE tareas ADD COLUMN categoria TEXT DEFAULT 'general'`); } catch {}
  try { db.exec(`ALTER TABLE tareas ADD COLUMN tienda TEXT NOT NULL DEFAULT 'murcia'`); } catch {}
  try { db.exec(`ALTER TABLE tareas ADD COLUMN origen TEXT DEFAULT 'manual'`); } catch {}
  try { db.exec(`ALTER TABLE tareas ADD COLUMN expira_at TEXT`); } catch {}
  try { db.exec(`ALTER TABLE notas ADD COLUMN tienda TEXT NOT NULL DEFAULT 'murcia'`); } catch {}
  try { db.exec(`ALTER TABLE productos ADD COLUMN tienda TEXT NOT NULL DEFAULT 'murcia'`); } catch {}
  try { db.exec(`ALTER TABLE caja_dias ADD COLUMN tienda TEXT NOT NULL DEFAULT 'murcia'`); } catch {}
  try { db.exec(`ALTER TABLE caja_dias ADD COLUMN manana_apertura REAL DEFAULT 0`); } catch {}
  try { db.exec(`ALTER TABLE caja_dias ADD COLUMN manana_cierre REAL`); } catch {}
  try { db.exec(`ALTER TABLE caja_dias ADD COLUMN tarde_apertura REAL`); } catch {}
  try { db.exec(`ALTER TABLE caja_dias ADD COLUMN tarde_cierre REAL`); } catch {}
  try { db.exec(`ALTER TABLE caja_dias ADD COLUMN factusol_ajuste_tarde REAL DEFAULT 0`); } catch {}
  try { db.exec(`ALTER TABLE incidencias ADD COLUMN tienda TEXT NOT NULL DEFAULT 'murcia'`); } catch {}
  try { db.exec(`ALTER TABLE actividad ADD COLUMN tienda TEXT NOT NULL DEFAULT 'murcia'`); } catch {}
  try { db.exec(`ALTER TABLE salidas_dinero ADD COLUMN caja_movimiento_id INTEGER REFERENCES caja_movimientos(id) ON DELETE SET NULL`); } catch {}
  try { db.exec(`ALTER TABLE salidas_dinero ADD COLUMN tienda TEXT NOT NULL DEFAULT 'murcia'`); } catch {}
  try { db.exec(`ALTER TABLE checklist_registros ADD COLUMN tienda TEXT NOT NULL DEFAULT 'murcia'`); } catch {}
  try { db.exec(`ALTER TABLE rutas_comerciales ADD COLUMN tienda TEXT NOT NULL DEFAULT 'murcia'`); } catch {}

  try {
    db.exec(`ALTER TABLE notas ADD COLUMN categoria TEXT DEFAULT 'general'`);
  } catch {}
  try {
    db.exec(`ALTER TABLE notas ADD COLUMN prioridad TEXT DEFAULT 'normal'`);
  } catch {}
  try {
    db.exec(`ALTER TABLE notas ADD COLUMN estado TEXT DEFAULT 'abierta'`);
  } catch {}
  try {
    db.exec(`ALTER TABLE notas ADD COLUMN updated_at TEXT DEFAULT (datetime('now','localtime'))`);
  } catch {}

  try {
    const cajaDiasSql = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'caja_dias'`).get()?.sql || '';
    if (!cajaDiasSql.includes('UNIQUE(fecha, tienda)')) {
      db.exec(`
        ALTER TABLE caja_dias RENAME TO caja_dias_old;

        CREATE TABLE caja_dias (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fecha TEXT NOT NULL,
          tienda TEXT NOT NULL DEFAULT 'murcia',
          apertura_importe REAL DEFAULT 0,
          manana_apertura REAL DEFAULT 0,
          manana_cierre REAL,
          tarde_apertura REAL,
          tarde_cierre REAL,
          factusol_ajuste_tarde REAL DEFAULT 0,
          cierre_importe REAL,
          total_ingresos REAL DEFAULT 0,
          total_gastos REAL DEFAULT 0,
          observaciones TEXT,
          estado TEXT DEFAULT 'abierta',
          created_by INTEGER REFERENCES users(id),
          closed_by INTEGER REFERENCES users(id),
          created_at TEXT DEFAULT (datetime('now','localtime')),
          UNIQUE(fecha, tienda)
        );

        INSERT INTO caja_dias (
          id, fecha, tienda, apertura_importe, manana_apertura, manana_cierre, tarde_apertura, tarde_cierre,
          factusol_ajuste_tarde, cierre_importe, total_ingresos, total_gastos, observaciones, estado, created_by, closed_by, created_at
        )
        SELECT
          id,
          fecha,
          COALESCE(tienda, 'murcia'),
          apertura_importe,
          COALESCE(manana_apertura, apertura_importe),
          manana_cierre,
          tarde_apertura,
          tarde_cierre,
          COALESCE(factusol_ajuste_tarde, 0),
          cierre_importe,
          COALESCE(total_ingresos, 0),
          COALESCE(total_gastos, 0),
          observaciones,
          COALESCE(estado, 'abierta'),
          created_by,
          closed_by,
          created_at
        FROM caja_dias_old;

        DROP TABLE caja_dias_old;
      `);
    }
  } catch {}

  try {
    const cajaMovimientosSql = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'caja_movimientos'`).get()?.sql || '';
    const cajaMovimientosFk = db.prepare(`PRAGMA foreign_key_list(caja_movimientos)`).all();
    const fkApuntaATablaVieja = cajaMovimientosFk.some((fk) => fk.table === 'caja_dias_old');

    if (cajaMovimientosSql.includes('caja_dias_old') || fkApuntaATablaVieja) {
      db.exec(`
        PRAGMA foreign_keys = OFF;

        ALTER TABLE caja_movimientos RENAME TO caja_movimientos_old;

        CREATE TABLE caja_movimientos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          caja_id INTEGER NOT NULL REFERENCES caja_dias(id),
          tipo TEXT NOT NULL,
          concepto TEXT NOT NULL,
          importe REAL NOT NULL,
          metodo_pago TEXT DEFAULT 'efectivo',
          created_by INTEGER REFERENCES users(id),
          created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        INSERT INTO caja_movimientos (
          id, caja_id, tipo, concepto, importe, metodo_pago, created_by, created_at
        )
        SELECT
          id, caja_id, tipo, concepto, importe, metodo_pago, created_by, created_at
        FROM caja_movimientos_old
        WHERE EXISTS (SELECT 1 FROM caja_dias c WHERE c.id = caja_movimientos_old.caja_id);

        DROP TABLE caja_movimientos_old;

        PRAGMA foreign_keys = ON;
      `);
    }
  } catch {}

  try {
    const salidasSql = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'salidas_dinero'`).get()?.sql || '';
    const salidasFk = db.prepare(`PRAGMA foreign_key_list(salidas_dinero)`).all();
    const fkCajaVieja = salidasFk.some((fk) => fk.table === 'caja_movimientos_old');

    if (salidasSql.includes('caja_movimientos_old') || fkCajaVieja) {
      db.exec(`
        PRAGMA foreign_keys = OFF;

        ALTER TABLE salidas_dinero RENAME TO salidas_dinero_old;

        CREATE TABLE salidas_dinero (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fecha TEXT NOT NULL,
          tienda TEXT NOT NULL DEFAULT 'murcia',
          concepto TEXT NOT NULL,
          importe REAL NOT NULL,
          caja_movimiento_id INTEGER REFERENCES caja_movimientos(id) ON DELETE SET NULL,
          created_by INTEGER REFERENCES users(id),
          created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        INSERT INTO salidas_dinero (
          id, fecha, tienda, concepto, importe, caja_movimiento_id, created_by, created_at
        )
        SELECT
          s.id,
          s.fecha,
          COALESCE(s.tienda, 'murcia'),
          s.concepto,
          s.importe,
          CASE
            WHEN s.caja_movimiento_id IS NULL THEN NULL
            WHEN EXISTS (SELECT 1 FROM caja_movimientos cm WHERE cm.id = s.caja_movimiento_id) THEN s.caja_movimiento_id
            ELSE NULL
          END,
          s.created_by,
          s.created_at
        FROM salidas_dinero_old s;

        DROP TABLE salidas_dinero_old;

        PRAGMA foreign_keys = ON;
      `);
    }
  } catch {}

  // Seed Lida si no existe (migración para servidores existentes)
  const existingLida = db.prepare('SELECT id FROM users WHERE email = ?').get('lida@atomx.com');
  if (!existingLida) {
    const hash = require('bcryptjs').hashSync('atomx2024', 10);
    db.prepare(`INSERT INTO users (nombre, email, password_hash, rol, tienda) VALUES (?, ?, ?, ?, ?)`).run('Lida', 'lida@atomx.com', hash, 'encargado', 'mallorca');
  }

  // Seed: usuarios por defecto
  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get('juanfran@atomx.com');
  if (!existingUser) {
    const hash = bcrypt.hashSync('atomx2024', 10);
    db.prepare(`INSERT INTO users (nombre, email, password_hash, rol, tienda) VALUES (?, ?, ?, ?, ?)`).run('Juanfran', 'juanfran@atomx.com', hash, 'admin', 'murcia');
    db.prepare(`INSERT INTO users (nombre, email, password_hash, rol, tienda) VALUES (?, ?, ?, ?, ?)`).run('Juanje', 'juanje@atomx.com', hash, 'encargado', 'murcia');
    db.prepare(`INSERT INTO users (nombre, email, password_hash, rol, tienda) VALUES (?, ?, ?, ?, ?)`).run('Papi', 'papi@atomx.com', hash, 'empleado', 'murcia');
    db.prepare(`INSERT INTO users (nombre, email, password_hash, rol, tienda) VALUES (?, ?, ?, ?, ?)`).run('Lida', 'lida@atomx.com', hash, 'encargado', 'mallorca');

    // Checklist apertura
    const apertura = ['Abrir caja y contar efectivo', 'Revisar pedidos pendientes', 'Revisar stock bajo mínimos', 'Comprobar mensajes/WhatsApp', 'Preparar pedidos del día'];
    apertura.forEach((texto, i) => db.prepare(`INSERT INTO checklist_items (tipo, texto, orden) VALUES (?, ?, ?)`).run('apertura', texto, i));

    // Checklist cierre
    const cierre = ['Cerrar caja y cuadrar', 'Registrar pedidos enviados', 'Anotar incidencias del día', 'Preparar pedidos para mañana', 'Apagar y asegurar local'];
    cierre.forEach((texto, i) => db.prepare(`INSERT INTO checklist_items (tipo, texto, orden) VALUES (?, ?, ?)`).run('cierre', texto, i));

    // Demo stock
    const productos = [
      ['Kwadron 9RL 0.30', 'Agujas', 'Kwadron', 3, 10],
      ['Kwadron 7RL 0.25', 'Agujas', 'Kwadron', 8, 10],
      ['Emalla 9RS 0.35', 'Agujas', 'Emalla', 2, 5],
      ['Bishop 5RL 0.25', 'Agujas', 'Bishop', 12, 10],
      ['Dynamic Black Grande', 'Tintas', 'Dynamic', 5, 3],
      ['Derm-X', 'Cuidado', 'Derm-X', 4, 5],
      ['Spirit Normal (paquete)', 'Stencil', 'Spirit', 2, 5],
      ['Guantes L (caja)', 'Higiene', 'Varios', 6, 3],
    ];
    productos.forEach(([nombre, cat, prov, stock, min]) =>
      db.prepare(`INSERT INTO productos (nombre, categoria, proveedor, stock_actual, stock_minimo) VALUES (?, ?, ?, ?, ?)`).run(nombre, cat, prov, stock, min)
    );
  }

  const existingMaria = db.prepare('SELECT id FROM users WHERE email = ?').get('maria@atomx.com');
  if (!existingMaria) {
    const hash = bcrypt.hashSync('atomx2024', 10);
    db.prepare(`INSERT INTO users (nombre, email, password_hash, rol, tienda) VALUES (?, ?, ?, ?, ?)`).run('Maria', 'maria@atomx.com', hash, 'empleado', 'murcia');
  }

  const existingAndrea = db.prepare('SELECT id FROM users WHERE email = ?').get('andrea@atomx.com');
  if (!existingAndrea) {
    const hash = bcrypt.hashSync('atomx2024', 10);
    db.prepare(`INSERT INTO users (nombre, email, password_hash, rol, tienda) VALUES (?, ?, ?, ?, ?)`).run('Andrea', 'andrea@atomx.com', hash, 'empleado', 'murcia');
  }

  try {
    const { importClientesFactusol } = require('./services/clientesFactusol');
    importClientesFactusol();
  } catch {}
}

function log(tabla, registro_id, accion, usuario_id, datos) {
  let tienda = 'murcia';
  if (usuario_id) {
    try {
      tienda = db.prepare(`SELECT tienda FROM users WHERE id = ?`).get(usuario_id)?.tienda || 'murcia';
    } catch {}
  }
  db.prepare(`INSERT INTO actividad (tabla, registro_id, accion, usuario_id, datos) VALUES (?, ?, ?, ?, ?)`).run(
    tabla, registro_id, accion, usuario_id, datos ? JSON.stringify(datos) : null
  );
  try {
    db.prepare(`UPDATE actividad SET tienda = ? WHERE id = last_insert_rowid()`).run(tienda);
  } catch {}
}

function notify(userId, tipo, titulo, mensaje, link) {
  if (!userId) return;
  db.prepare(`
    INSERT INTO notificaciones (user_id, tipo, titulo, mensaje, link)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, tipo, titulo, mensaje || null, link || null);
}

module.exports = { db, init, log, notify };
