const express = require('express');
const { db, log, notify } = require('../db');
const { interpretarMensajeEquipo, preguntarCerebro } = require('../services/atomBrain');

const router = express.Router();

const ZONAS = ['ZONA PLAYA', 'ZONA CARTAGENA', 'ZONA NORTE', 'ZONA MURCIA'];

function getSystemUser() {
  return (
    db.prepare(`SELECT * FROM users WHERE rol = 'admin' AND activo = 1 ORDER BY id ASC LIMIT 1`).get() ||
    db.prepare(`SELECT * FROM users WHERE activo = 1 ORDER BY id ASC LIMIT 1`).get()
  );
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d]/g, '');
}

function getUserByWhatsApp(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const users = db.prepare(`SELECT * FROM users WHERE activo = 1`).all();
  return users.find((u) => normalizePhone(u.whatsapp_numero) === normalized) || null;
}

function getUserByAlias(alias) {
  if (!alias) return null;
  const map = { juanje: 'Juanje', papi: 'Papi', juanfran: 'Juanfran' };
  return db.prepare(`SELECT * FROM users WHERE activo = 1 AND lower(nombre) = lower(?) LIMIT 1`).get(map[alias] || alias) || null;
}

function nextNumero() {
  const last = db.prepare(`SELECT numero FROM pedidos ORDER BY id DESC LIMIT 1`).get();
  if (!last) return 'PED-0001';
  const n = parseInt(last.numero.split('-')[1], 10) + 1;
  return `PED-${String(n).padStart(4, '0')}`;
}

function detectZona(text) {
  const upper = text.toUpperCase();
  return ZONAS.find((zona) => upper.includes(zona)) || (upper.includes('PLAYA') ? 'ZONA PLAYA' : upper.includes('CARTAGENA') ? 'ZONA CARTAGENA' : upper.includes('NORTE') ? 'ZONA NORTE' : upper.includes('MURCIA') ? 'ZONA MURCIA' : 'ZONA MURCIA');
}

function shouldExecute(text) {
  const lower = String(text || '').toLowerCase();
  const triggers = ['tarea', 'pedido', 'asigna', 'crear', 'apunta', 'reparto', 'zona ', 'recordar', 'recuerda', 'haz', 'prepara'];
  return triggers.some((token) => lower.includes(token));
}

function saveWhatsAppMessage({ waMessageId, from, name, direction, type, textBody, payload, processed }) {
  db.prepare(`
    INSERT INTO whatsapp_messages (wa_message_id, wa_from, wa_name, direction, type, text_body, payload, processed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    waMessageId || null,
    from || '',
    name || null,
    direction,
    type || 'text',
    textBody || null,
    payload ? JSON.stringify(payload) : null,
    processed ? 1 : 0
  );
}

async function sendWhatsAppText(to, body) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    throw new Error('Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID');
  }

  const resp = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: body.slice(0, 4096) },
    }),
  });

  if (!resp.ok) {
    throw new Error(`WhatsApp API error: ${await resp.text()}`);
  }

  return resp.json();
}

function createPedidoFromInterpretation(result, actorUser, originalText) {
  const pedido = result.pedido || {};
  const items = (pedido.items || []).filter((item) => item?.producto_nombre);
  if (!items.length && !pedido.cliente_nombre) return null;

  const responsable = items.length ? actorUser : null;
  const numero = nextNumero();
  const zona = detectZona(`${originalText}\n${pedido.notas || ''}`);

  const insert = db.prepare(`
    INSERT INTO pedidos (numero, tienda, cliente_nombre, cliente_dni, cliente_email, cliente_telefono,
      cliente_direccion, cliente_cp, zona_reparto, tipo_documento, descuento, metodo_envio,
      urgente, notas, responsable_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const r = insert.run(
    numero,
    actorUser.tienda || 'murcia',
    pedido.cliente_nombre || 'Pedido desde WhatsApp',
    pedido.cliente_dni || null,
    pedido.cliente_email || null,
    pedido.cliente_telefono || null,
    pedido.cliente_direccion || null,
    pedido.cliente_cp || null,
    zona,
    pedido.tipo_documento || 'factura',
    Math.min(parseInt(pedido.descuento || 0, 10) || 0, 100),
    pedido.metodo_envio || 'envio',
    pedido.urgente ? 1 : 0,
    pedido.notas || originalText,
    responsable?.id || null,
    actorUser.id
  );

  const itemStmt = db.prepare(`
    INSERT INTO pedido_items (pedido_id, producto_nombre, cantidad, precio_unitario)
    VALUES (?, ?, ?, ?)
  `);
  items.forEach((item) => itemStmt.run(r.lastInsertRowid, item.producto_nombre, item.cantidad || 1, item.precio_unitario || 0));

  log('pedidos', r.lastInsertRowid, 'crear_whatsapp', actorUser.id, { numero });
  return { id: r.lastInsertRowid, numero, zona, items: items.length };
}

function createTasksFromInterpretation(result, actorUser) {
  const tareas = Array.isArray(result.tareas) ? result.tareas.filter((t) => t?.titulo) : [];
  const insert = db.prepare(`
    INSERT INTO tareas (titulo, tienda, descripcion, asignado_a, prioridad, fecha_limite, recurrente, dias_recurrencia, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  return tareas.map((tarea) => {
    const assignedUser = getUserByAlias(tarea.asignado_a);
    const r = insert.run(
      tarea.titulo,
      actorUser.tienda || 'murcia',
      `Creada desde WhatsApp por ${actorUser.nombre}`,
      assignedUser?.id || null,
      tarea.prioridad || 'normal',
      null,
      0,
      null,
      actorUser.id
    );

    log('tareas', r.lastInsertRowid, 'crear_whatsapp', actorUser.id, { titulo: tarea.titulo });
    if (assignedUser?.id) {
      notify(assignedUser.id, 'tarea', 'Nueva tarea desde WhatsApp', `${actorUser.nombre} te ha asignado: ${tarea.titulo}`, '/tareas');
    }

    return { id: r.lastInsertRowid, titulo: tarea.titulo, asignado: assignedUser?.nombre || null };
  });
}

async function processTextMessage({ from, name, textBody }) {
  const actorUser = getUserByWhatsApp(from) || getSystemUser();
  if (!actorUser) {
    return 'No hay usuario interno configurado para procesar mensajes.';
  }

  if (!shouldExecute(textBody)) {
    const respuesta = await preguntarCerebro(textBody, actorUser.tienda || 'murcia', actorUser.nombre || '');
    return respuesta;
  }

  const interpreted = await interpretarMensajeEquipo(textBody, actorUser.tienda || 'murcia');
  const createdTasks = createTasksFromInterpretation(interpreted, actorUser);
  const createdPedido = createPedidoFromInterpretation(interpreted, actorUser, textBody);

  if (!createdTasks.length && !createdPedido) {
    return interpreted.resumen || 'He leido el mensaje pero no he creado nada claro. Si quieres accion, dilo mas directo.';
  }

  const parts = [];
  if (createdTasks.length) {
    parts.push(`He creado ${createdTasks.length} tarea${createdTasks.length > 1 ? 's' : ''}.`);
  }
  if (createdPedido) {
    parts.push(`He creado el pedido ${createdPedido.numero} en ${createdPedido.zona}.`);
  }
  if (createdTasks.some((t) => t.asignado)) {
    parts.push(`Ya he avisado a: ${createdTasks.filter((t) => t.asignado).map((t) => t.asignado).join(', ')}.`);
  }
  return parts.join(' ');
}

router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

router.post('/webhook', async (req, res) => {
  try {
    const entries = req.body.entry || [];

    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const contact = value.contacts?.[0];
        const messages = value.messages || [];

        for (const message of messages) {
          const textBody = message.text?.body || '';
          const type = message.type || 'unknown';
          saveWhatsAppMessage({
            waMessageId: message.id,
            from: message.from,
            name: contact?.profile?.name,
            direction: 'in',
            type,
            textBody,
            payload: message,
            processed: false,
          });

          if (type !== 'text' || !textBody.trim()) {
            await sendWhatsAppText(message.from, 'Ahora mismo leo texto. Los audios los dejo preparados para la siguiente fase.');
            continue;
          }

          const reply = await processTextMessage({
            from: message.from,
            name: contact?.profile?.name,
            textBody,
          });

          await sendWhatsAppText(message.from, reply);
          saveWhatsAppMessage({
            waMessageId: null,
            from: message.from,
            name: contact?.profile?.name,
            direction: 'out',
            type: 'text',
            textBody: reply,
            payload: { replyTo: message.id },
            processed: true,
          });
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('WhatsApp webhook error:', err);
    res.sendStatus(500);
  }
});

module.exports = router;
