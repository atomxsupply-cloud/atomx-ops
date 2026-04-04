const { db, log, notify } = require('../db');
const { interpretarMensajeEquipo, desarrollarIdeaTarea } = require('./atomBrain');
const { registerSalida } = require('./salidas');

const TOWN_FALLBACKS = {
  murcia: { label: 'Murcia', lat: 37.9922, lng: -1.1307 },
  cartagena: { label: 'Cartagena', lat: 37.6257, lng: -0.9966 },
  benidorm: { label: 'Benidorm', lat: 38.5411, lng: -0.1225 },
  alicante: { label: 'Alicante', lat: 38.3452, lng: -0.4810 },
  valencia: { label: 'Valencia', lat: 39.4699, lng: -0.3763 },
  palma: { label: 'Palma', lat: 39.5696, lng: 2.6502 },
  mallorca: { label: 'Mallorca', lat: 39.6953, lng: 3.0176 },
  'san javier': { label: 'San Javier', lat: 37.8063, lng: -0.8374 },
  'san pedro': { label: 'San Pedro del Pinatar', lat: 37.8357, lng: -0.7910 },
  'torre pacheco': { label: 'Torre Pacheco', lat: 37.7429, lng: -0.9539 },
  mazarron: { label: 'Mazarron', lat: 37.5992, lng: -1.3149 },
  aguilas: { label: 'Aguilas', lat: 37.4063, lng: -1.5826 },
  benissa: { label: 'Benissa', lat: 38.7167, lng: 0.0500 },
  calpe: { label: 'Calpe', lat: 38.6446, lng: 0.0445 },
  villajoyosa: { label: 'Villajoyosa', lat: 38.5075, lng: -0.2328 },
};

function getHoy() {
  return new Date().toISOString().split('T')[0];
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getUserByName(nombre) {
  return db.prepare('SELECT * FROM users WHERE lower(nombre) = lower(?) AND activo = 1 LIMIT 1').get(nombre);
}

function getUserByAlias(alias) {
  const map = {
    juanje: 'Juanje',
    papi: 'Papi',
    juanfran: 'Juanfran',
    lida: 'Lida',
    maria: 'Maria',
  };
  return getUserByName(map[normalize(alias)] || alias);
}

async function createTask({ titulo, descripcion, asignadoA, categoria, prioridad, createdBy, origen = 'manual', expiraAt = null }) {
  const tienda = db.prepare('SELECT tienda FROM users WHERE id = ?').get(createdBy)?.tienda || 'murcia';
  const asignado = asignadoA ? db.prepare('SELECT nombre FROM users WHERE id = ?').get(asignadoA) : null;
  let tareaFinal = { titulo, descripcion: descripcion || '' };

  try {
    const creador = db.prepare('SELECT nombre FROM users WHERE id = ?').get(createdBy);
    tareaFinal = await desarrollarIdeaTarea({
      titulo,
      descripcion: descripcion || '',
      asignadoNombre: asignado?.nombre || '',
      tienda,
      creadorNombre: creador?.nombre || '',
    });
  } catch {}

  const r = db.prepare(`
    INSERT INTO tareas (titulo, tienda, descripcion, asignado_a, categoria, prioridad, fecha_limite, origen, expira_at, recurrente, dias_recurrencia, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    tareaFinal.titulo,
    tienda,
    tareaFinal.descripcion || null,
    asignadoA || null,
    categoria || 'general',
    prioridad || 'normal',
    null,
    origen,
    expiraAt,
    0,
    null,
    createdBy
  );

  log('tareas', r.lastInsertRowid, 'crear_desde_chat', createdBy, { titulo: tareaFinal.titulo, categoria, prioridad });

  if (asignadoA) {
    const actor = db.prepare('SELECT nombre FROM users WHERE id = ?').get(createdBy);
    notify(asignadoA, 'tarea', 'Nueva tarea desde chat', `${actor?.nombre || 'Sistema'} te ha asignado: ${tareaFinal.titulo}`, '/tareas');
  }

  return r.lastInsertRowid;
}

function buildAssistantExpiryHours(hours = 6) {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function parseAmount(texto) {
  const match = String(texto || '').match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?)/i) || String(texto || '').match(/(?:de|por)\s+(\d+(?:[.,]\d{1,2})?)/i);
  if (!match) return null;
  return parseFloat(match[1].replace(',', '.'));
}

function detectCajaSalida(texto) {
  const lower = normalize(texto);
  const triggers = [
    'salida de dinero',
    'salida de caja',
    'apunta salida',
    'apunta una salida',
    'registra salida',
    'sacar de caja',
    'gasto de caja',
    'hemos sacado',
    'saca ',
    'sacar ',
  ];
  return triggers.some((t) => lower.includes(t));
}

function detectStockRojo(texto) {
  const lower = normalize(texto);
  return lower.includes('stock rojo') || lower.includes('stock a 0') || lower.includes('mira el stock rojo');
}

function detectConsultaStock(texto) {
  const lower = normalize(texto);
  return (
    lower.includes('tenemos ') ||
    lower.includes('hay stock') ||
    lower.includes('hay en tienda') ||
    lower.includes('queda de ') ||
    lower.includes('tenemos en tienda') ||
    lower.includes('hay de ')
  );
}

function detectCorreoORecogida(texto) {
  const lower = normalize(texto);
  return lower.includes('mandar dinero') || lower.includes('mandar un correo') || lower.includes('recoger algo') || lower.includes('recogida') || lower.includes('nacex');
}

function detectRutaComercial(texto) {
  const lower = normalize(texto);
  return (
    lower.includes('parada') ||
    lower.includes('visita') ||
    lower.includes('ruta') ||
    lower.includes('pin') ||
    lower.includes('pines') ||
    lower.includes('chincheta') ||
    lower.includes('meter en mapa') ||
    lower.includes('apunta en rutas') ||
    lower.includes('estudio ')
  );
}

function detectDestinoTienda(texto, tiendaActor) {
  const lower = normalize(texto);
  if (lower.includes('mallorca')) return 'Mallorca';
  if (lower.includes('murcia')) return 'Murcia';
  return tiendaActor === 'mallorca' ? 'Mallorca' : 'Murcia';
}

function detectHora(texto) {
  const match = String(texto || '').match(/\b([01]?\d|2[0-3])[:.][0-5]\d\b/);
  return match ? match[0].replace('.', ':') : null;
}

function detectAssignedUser(texto) {
  const lower = normalize(texto);
  for (const alias of ['juanje', 'papi', 'juanfran', 'maria', 'lida']) {
    if (lower.includes(alias)) return getUserByAlias(alias);
  }
  return null;
}

function detectDirectedTask(texto) {
  const lower = normalize(texto);
  const assignedUser = detectAssignedUser(texto);
  if (!assignedUser) return null;

  const triggers = [
    'ponle',
    'ponme',
    'apuntale',
    'apuntame',
    'dile a',
    'dile que',
    'recuerdale',
    'que haga',
    'que revise',
    'que mire',
    'que llame',
    'que mande',
    'que prepare',
    'que lleve',
    'que pase',
    'que vaya',
    'para juanje',
    'para papi',
    'para juanfran',
    'para maria',
    'para lida',
  ];

  if (!triggers.some((trigger) => lower.includes(trigger))) return null;
  return assignedUser;
}

function cleanTaskTitle(texto, assignedUser) {
  let title = String(texto || '').trim();
  const nombre = assignedUser?.nombre || '';

  const patterns = [
    new RegExp(`^.*?\\b${nombre}\\b[:,\\s-]*`, 'i'),
    /^.*?\b(ponle|ponme|apuntale|apuntame|dile a|dile que|recuerdale)\b[:,\s-]*/i,
    /^.*?\b(que haga|que revise|que mire|que llame|que mande|que prepare|que lleve|que pase|que vaya)\b[:,\s-]*/i,
  ];

  for (const pattern of patterns) {
    title = title.replace(pattern, '').trim();
  }

  title = title
    .replace(/\s+/g, ' ')
    .replace(/^(el|la|los|las)\s+/i, '')
    .trim();

  if (!title) return `Tarea para ${nombre}`;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function detectTaskCategory(texto) {
  const lower = normalize(texto);
  if (lower.includes('stock')) return 'stock';
  if (lower.includes('correo') || lower.includes('mail') || lower.includes('nacex') || lower.includes('factura') || lower.includes('albaran')) return 'admin';
  if (lower.includes('reparto') || lower.includes('ruta') || lower.includes('parada') || lower.includes('visita')) return 'reparto';
  if (lower.includes('caja') || lower.includes('dinero')) return 'caja';
  return 'general';
}

function detectTaskPriority(texto) {
  const lower = normalize(texto);
  if (lower.includes('urgente') || lower.includes('ya') || lower.includes('ahora') || lower.includes('hoy')) return 'alta';
  if (lower.includes('cuando puedas') || lower.includes('sin prisa') || lower.includes('manana') || lower.includes('mañana')) return 'baja';
  return 'normal';
}

async function executeDirectedTask(texto, actorUser, assignedUser) {
  const titulo = cleanTaskTitle(texto, assignedUser);
  const categoria = detectTaskCategory(texto);
  const prioridad = detectTaskPriority(texto);

  await createTask({
    titulo,
    descripcion: `Creada desde chat.\n\n${texto.trim()}`,
    asignadoA: assignedUser.id,
    categoria,
    prioridad,
    createdBy: actorUser.id,
    origen: 'asistente',
    expiraAt: buildAssistantExpiryHours(6),
  });

  return {
    handled: true,
    mensaje: `Hecho, se lo he dejado a ${assignedUser.nombre} en ${categoria === 'reparto' ? 'rutas/tareas' : 'tareas'} para que no se pierda.`,
  };
}

function detectTown(texto) {
  const lower = normalize(texto);
  const towns = Object.keys(TOWN_FALLBACKS).sort((a, b) => b.length - a.length);
  return towns.find((town) => lower.includes(town)) || null;
}

function extractEstudio(texto) {
  const raw = String(texto || '');
  const quoted = raw.match(/["“](.+?)["”]/);
  if (quoted) return quoted[1].trim();

  const patterns = [
    /(?:parada|visita|estudio|ruta)\s+(?:en|para|de)?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ0-9&.\-\s]{4,80})/i,
    /(?:apunta|mete|guardar)\s+(?:a|en)?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ0-9&.\-\s]{4,80})/i,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) {
      return match[1]
        .replace(/\s+(para|con|manana|mañana|hoy|a las|a la|murcia|mallorca|cartagena|benidorm).*$/i, '')
        .trim();
    }
  }

  return '';
}

async function findGenericPlaceByTown(estudio, townKey) {
  const town = TOWN_FALLBACKS[townKey];
  if (!town) return null;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return {
      nombre: estudio || town.label,
      direccion: town.label,
      lat: town.lat,
      lng: town.lng,
      generic: true,
      townLabel: town.label,
    };
  }

  try {
    const query = estudio ? `${estudio} ${town.label} tattoo beauty micropigmentacion` : town.label;
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location',
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: 'es',
        regionCode: 'ES',
        maxResultCount: 1,
      }),
    });

    const data = await response.json();
    const place = data?.places?.[0];
    if (response.ok && place?.location) {
      return {
        nombre: place.displayName?.text || estudio || town.label,
        direccion: place.formattedAddress || town.label,
        lat: place.location.latitude,
        lng: place.location.longitude,
        generic: !place.formattedAddress,
        townLabel: town.label,
      };
    }
  } catch {}

  return {
    nombre: estudio || town.label,
    direccion: town.label,
    lat: town.lat,
    lng: town.lng,
    generic: true,
    townLabel: town.label,
  };
}

async function executeRutaComercial(texto, actorUser) {
  const estudio = extractEstudio(texto);
  const townKey = detectTown(texto);
  const hora = detectHora(texto);
  const assignedUser = detectAssignedUser(texto);

  if (!estudio && !townKey) {
    return {
      handled: true,
      mensaje: 'Acho, para apuntarte la parada dime al menos el estudio o el pueblo y te la dejo en el mapa.',
    };
  }

  const place = await findGenericPlaceByTown(estudio, townKey);
  const zonaDetectada = townKey ? TOWN_FALLBACKS[townKey]?.label || 'OTRA' : 'OTRA';
  const descripcionNota = [
    `Creada desde chat: ${texto.trim()}`,
    place?.generic ? `Pin generico por pueblo: ${place.townLabel}` : null,
  ].filter(Boolean).join('\n');

  const r = db.prepare(`
    INSERT INTO rutas_comerciales
    (fecha, tienda, estudio, direccion, lat, lng, hora, zona_detectada, nota, asignado_a, created_by, estado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')
  `).run(
    getHoy(),
    actorUser.tienda || 'murcia',
    place?.nombre || estudio || (TOWN_FALLBACKS[townKey]?.label || 'Parada'),
    place?.direccion || (TOWN_FALLBACKS[townKey]?.label || ''),
    place?.lat ?? null,
    place?.lng ?? null,
    hora || null,
    zonaDetectada,
    descripcionNota,
    assignedUser?.id || null,
    actorUser.id
  );

  log('rutas_comerciales', r.lastInsertRowid, 'crear', actorUser.id, {
    estudio: place?.nombre || estudio,
    zona_detectada: zonaDetectada,
  });

  if (assignedUser?.id) {
    notify(
      assignedUser.id,
      'ruta',
      'Nueva parada en rutas',
      `${actorUser.nombre || 'Equipo'} te ha dejado una parada: ${place?.nombre || estudio || TOWN_FALLBACKS[townKey]?.label}`,
      '/rutas'
    );
  }

  return {
    handled: true,
    mensaje: place?.generic
      ? `Ya esta rey, te he metido la parada en rutas con una chincheta generica en ${place.townLabel} para ir organizandoos.`
      : `Hecho, te he metido la parada en rutas y te la he colocado en el mapa.`,
  };
}

function buildRecogidaEmail(texto, tiendaActor) {
  const destino = detectDestinoTienda(texto, tiendaActor);
  const hora = detectHora(texto);
  const estudioMatch = String(texto || '').match(/(?:estudio|para|de)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s&.-]{3,60})/);
  const estudio = estudioMatch ? estudioMatch[1].trim() : 'ESTUDIO PENDIENTE DE CONFIRMAR';

  const lineas = [
    'Asunto: Solicitud de recogida',
    '',
    'Hola,',
    '',
    'Necesitamos gestionar una recogida.',
    '',
    `Estudio: ${estudio}`,
    `Destino: Tienda ATOM X ${destino}`,
    `Hora solicitada: ${hora || 'PENDIENTE DE CONFIRMAR'}`,
    '',
    'Quedo pendiente de confirmacion.',
    '',
    'Gracias.',
  ];

  return lineas.join('\n');
}

function executeCajaSalida(texto, actorUser) {
  const caja = db.prepare(`SELECT * FROM caja_dias WHERE fecha = ? AND tienda = ? AND estado = 'abierta'`).get(getHoy(), actorUser.tienda || 'murcia');
  if (!caja) {
    return { handled: true, mensaje: 'No hay caja abierta ahora mismo. Abrela antes de registrar la salida.' };
  }

  const importe = parseAmount(texto);
  if (!importe) {
    return { handled: true, mensaje: 'He detectado salida de dinero, pero no el importe. Dime la cantidad en euros y te la registro.' };
  }

  const concepto = texto.trim().slice(0, 160);
  const result = registerSalida({
    concepto,
    importe,
    tienda: actorUser.tienda || 'murcia',
    createdBy: actorUser.id,
    notifyUserId: actorUser.id,
    source: 'gasto_desde_chat',
  });

  return {
    handled: true,
    mensaje: `Salida registrada: ${importe.toFixed(2)}EUR. Ya esta apuntada en Salidas y descontada de la caja del dia.`,
    movimientoId: result.cajaMovimientoId,
  };
}

function executeStockRojo(actorUser) {
  const rojos = db.prepare(`
    SELECT *
    FROM productos
    WHERE tienda = ? AND stock_actual <= 0
    ORDER BY nombre ASC
  `).all(actorUser.tienda || 'murcia');

  const juanje = getUserByAlias('juanje');
  const papi = getUserByAlias('papi');
  const detalle = rojos.length
    ? `Productos a 0: ${rojos.slice(0, 8).map((p) => p.nombre).join(', ')}${rojos.length > 8 ? '...' : ''}`
    : 'No hay productos a 0, pero revisad el stock rojo y Factusol igualmente.';

  if (juanje?.id) {
    createTask({
      titulo: 'Revisar stock rojo y corregir Factusol',
      descripcion: detalle,
      asignadoA: juanje.id,
      categoria: 'stock',
      prioridad: 'alta',
      createdBy: actorUser.id,
      origen: 'asistente',
      expiraAt: buildAssistantExpiryHours(6),
    });
  }

  if (papi?.id) {
    createTask({
      titulo: 'Tocar stock rojo y validar Factusol',
      descripcion: detalle,
      asignadoA: papi.id,
      categoria: 'stock',
      prioridad: 'alta',
      createdBy: actorUser.id,
      origen: 'asistente',
      expiraAt: buildAssistantExpiryHours(6),
    });
  }

  notify(actorUser.id, 'stock', 'Aviso de stock rojo lanzado', `He avisado a Juanje y Papi. ${detalle}`, '/stock?bajo_minimo=1');
  return {
    handled: true,
    mensaje: `He dejado tarea urgente a Juanje y Papi para revisar el stock rojo en Factusol. ${rojos.length ? `Hay ${rojos.length} productos a 0.` : ''}`,
  };
}

function executeConsultaStock(texto, actorUser) {
  const juanje = getUserByAlias('juanje');
  const papi = getUserByAlias('papi');
  const descripcion = `Revisar stock real en tienda y Factusol.\n\nConsulta recibida:\n${texto.trim()}`;

  if (juanje?.id) {
    createTask({
      titulo: 'Revisar stock real solicitado',
      descripcion,
      asignadoA: juanje.id,
      categoria: 'stock',
      prioridad: 'alta',
      createdBy: actorUser.id,
      origen: 'asistente',
      expiraAt: buildAssistantExpiryHours(6),
    });
  }

  if (papi?.id) {
    createTask({
      titulo: 'Confirmar stock real para tienda',
      descripcion,
      asignadoA: papi.id,
      categoria: 'stock',
      prioridad: 'normal',
      createdBy: actorUser.id,
      origen: 'asistente',
      expiraAt: buildAssistantExpiryHours(6),
    });
  }

  return {
    handled: true,
    mensaje: 'Acho, como no tiro del stock real en vivo todavia, he dejado tarea a Juanje y Papi para que lo revisen en tienda y en Factusol y te lo confirmen bien.',
  };
}

function executeCorreoORecogida(texto, actorUser) {
  const lower = normalize(texto);
  const juanje = getUserByAlias('juanje');
  const papi = getUserByAlias('papi');

  if (lower.includes('correo') || lower.includes('nacex') || lower.includes('mandar dinero')) {
    const titulo = lower.includes('nacex') ? 'Mandar correo a operativa de Nacex' : 'Mandar correo operativo a empresa';
    const borrador = buildRecogidaEmail(texto, actorUser.tienda || 'murcia');
    createTask({
      titulo,
      descripcion: `${texto.trim()}\n\nBORRADOR DE CORREO:\n${borrador}`,
      asignadoA: juanje?.id || null,
      categoria: 'admin',
      prioridad: 'alta',
      createdBy: actorUser.id,
      origen: 'asistente',
      expiraAt: buildAssistantExpiryHours(6),
    });

    notify(actorUser.id, 'admin', 'Correo operativo preparado', `${titulo}. Se ha creado tarea para ${juanje?.nombre || 'operativa'}.`, '/tareas');
    return { handled: true, mensaje: `Hecho rey, te he dejado la tarea del correo con un borrador ya redactado para operativa.` };
  }

  if (lower.includes('recoger algo') || lower.includes('recogida')) {
    const destino = detectDestinoTienda(texto, actorUser.tienda || 'murcia');
    const hora = detectHora(texto);
    const borrador = buildRecogidaEmail(texto, actorUser.tienda || 'murcia');
    createTask({
      titulo: 'Gestionar recogida pendiente',
      descripcion: `${texto.trim()}\n\nDestino: ${destino}\nHora: ${hora || 'PENDIENTE'}\n\nBORRADOR DE CORREO:\n${borrador}`,
      asignadoA: papi?.id || null,
      categoria: 'reparto',
      prioridad: 'alta',
      createdBy: actorUser.id,
      origen: 'asistente',
      expiraAt: buildAssistantExpiryHours(6),
    });

    notify(actorUser.id, 'reparto', 'Recogida apuntada', 'He creado la tarea de recogida para reparto.', '/tareas');
    return { handled: true, mensaje: `Ya esta, te he creado la recogida para ${destino} y le he dejado el texto preparado al equipo.` };
  }

  return { handled: false };
}

async function executeInterpretedTasksOrPedido(texto, actorUser) {
  const parsed = await interpretarMensajeEquipo(texto, actorUser.tienda || 'murcia');
  const created = [];

  for (const tarea of parsed.tareas || []) {
    if (!tarea?.titulo) continue;
    const assigned = tarea.asignado_a ? getUserByAlias(tarea.asignado_a) : null;
    createTask({
      titulo: tarea.titulo,
      descripcion: `Creada desde chat IA.\n\n${texto.trim()}`,
      asignadoA: assigned?.id || null,
      categoria: 'general',
      prioridad: tarea.prioridad || 'normal',
      createdBy: actorUser.id,
      origen: 'asistente',
      expiraAt: buildAssistantExpiryHours(6),
    });
    created.push(tarea.titulo);
  }

  if (created.length) {
    notify(actorUser.id, 'tarea', 'Tareas creadas desde chat', `He creado ${created.length} tarea(s): ${created.join(', ')}`, '/tareas');
    return { handled: true, mensaje: `He creado ${created.length} tarea${created.length > 1 ? 's' : ''} desde el chat.` };
  }

  return { handled: false };
}

async function executeOperationalCommand(texto, actorUser) {
  if (detectCajaSalida(texto)) return executeCajaSalida(texto, actorUser);
  if (detectStockRojo(texto)) return executeStockRojo(actorUser);
  if (detectConsultaStock(texto)) return executeConsultaStock(texto, actorUser);
  if (detectCorreoORecogida(texto)) return executeCorreoORecogida(texto, actorUser);
  if (detectRutaComercial(texto)) return executeRutaComercial(texto, actorUser);

  const directedUser = detectDirectedTask(texto);
  if (directedUser) return executeDirectedTask(texto, actorUser, directedUser);

  const lower = normalize(texto);
  if (lower.includes('crea tarea') || lower.includes('apunta tarea') || lower.includes('haz tarea') || lower.includes('asigna')) {
    return executeInterpretedTasksOrPedido(texto, actorUser);
  }

  return { handled: false };
}

module.exports = { executeOperationalCommand };
