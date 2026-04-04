const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { db } = require('../db');
const { getProducts: getPrestashopProducts } = require('./prestashop');

const CEREBRO = path.join(__dirname, '..', '..', 'cerebro-bot', 'contexto-equipo');
const CEREBRO_TATUAJE = path.join(__dirname, '..', '..', 'cerebro-bot', 'cerebro-tatuaje');
const CATALOGO_PATH = path.join(__dirname, '..', '..', 'cerebro-bot', 'catalogo-procesado.json');

function readIfExists(filePath) {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

function loadCatalogoTexto() {
  try {
    const catalogo = JSON.parse(fs.readFileSync(CATALOGO_PATH, 'utf-8'));
    const lineas = catalogo.productos.map((p) =>
      `${p.nombre} | ${p.precioConIva}EUR | ${p.tinta ? 'TINTA (max 10% dto)' : 'sin restriccion'} | Ref: ${p.ref || '-'}`
    );
    return (
      `CATALOGO COMPLETO ATOMX SUPPLY (${catalogo.total} productos):\n` +
      `REGLA CRITICA: ${catalogo.reglaDescuentoTintas}\n\n` +
      lineas.join('\n')
    );
  } catch (e) {
    console.warn('Catalogo no cargado:', e.message);
    return '';
  }
}

function loadContextoEquipo() {
  try {
    const archivos = ['PERFIL_EQUIPO.md', 'PATRONES_OPERATIVOS.md', 'GUIA_PARA_CLAUDE_CODE.md'];
    return archivos.map((f) => readIfExists(path.join(CEREBRO, f))).join('\n\n---\n\n');
  } catch (e) {
    console.warn('Cerebro-bot no cargado:', e.message);
    return '';
  }
}

function loadContextoTatuaje() {
  try {
    const archivos = [
      'RESUMEN_GENERAL.md',
      'AGUJAS_Y_LINEAS.md',
      'TINTAS_Y_DILUCION.md',
      'STENCIL_Y_PREPARACION.md',
      'AFTERCARE_Y_PIEL.md',
      'VOCABULARIO_Y_PRODUCTOS.md',
    ];
    return archivos.map((f) => readIfExists(path.join(CEREBRO_TATUAJE, f))).join('\n\n---\n\n');
  } catch (e) {
    console.warn('Cerebro de tatuaje no cargado:', e.message);
    return '';
  }
}

function loadMuestraChats() {
  try {
    const chats = ['chat-juanje', 'chat-atomx', 'chat-papi'];
    return chats
      .map((chat) => {
        const file = path.join(__dirname, '..', '..', 'cerebro-bot', chat, '_chat.txt');
        if (!fs.existsSync(file)) return '';
        const lineas = fs.readFileSync(file, 'utf-8').split('\n');
        return `=== ${chat} ===\n${lineas.slice(-150).join('\n')}`;
      })
      .join('\n\n');
  } catch (e) {
    console.warn('Chats no cargados:', e.message);
    return '';
  }
}

const catalogoTexto = loadCatalogoTexto();
const contextoEquipo = loadContextoEquipo();
const contextoTatuaje = loadContextoTatuaje();
const muestraChats = loadMuestraChats();

function tiendaCtx(tienda) {
  return tienda === 'mallorca'
    ? '\n## TIENDA ACTUAL: Mallorca (Lida). Esta tienda opera de forma independiente a Murcia.'
    : '\n## TIENDA ACTUAL: Murcia (Juanfran, Juanje, Papi).';
}

function buildInterpretSystemPrompt(tienda) {
  return `Eres el asistente interno de ATOM X SUPPLY, una tienda de material profesional para tatuadores.

Trabajas SOLO para el equipo interno: Juanfran (director/ventas), Juanje (tienda/facturacion) y Papi (logistica/tienda).
El equipo es de Murcia (Espana) y habla de forma informal y rapida.

## REGLA DE DESCUENTOS - OBLIGATORIA
- En TINTAS: descuento MAXIMO 10%. Nunca aplicar mas aunque te lo pidan.
- Si alguien pide mas del 10% en una tinta, advierte que el maximo es 10%.
- En el resto de productos: sin restriccion de descuento.

## Catalogo real con precios
${catalogoTexto}

## Contexto del equipo
${contextoEquipo}

## Conocimiento interno de tatuaje, producto y terminologia
${contextoTatuaje}

## Prioridad de conocimiento sobre tatuaje
- Prioriza SOLO la informacion de tatuaje relacionada con material, producto y referencias comerciales.
- Tu foco principal es entender y normalizar:
  - agujas
  - cartuchos
  - diametros
  - agrupaciones
  - liners / shaders / magnum
  - tintas
  - negros
  - greywash
  - diluyentes
  - butter
  - vaselina
  - stencil
  - stencil remover
  - second skin
  - consumibles
  - maquinas
  - stroke
  - voltaje
  - fuentes, cables y pedal
  - compatibilidades y formatos
- De momento NO priorices tecnica artistica ni consejos de ejecucion del tatuaje, salvo cuando sea imprescindible para entender el uso del material.
- Tu prioridad es entender:
  - medidas
  - formatos
  - equivalencias
  - nombres comerciales
  - usos reales del producto
  - diferencias entre referencias
  - lenguaje informal del sector

## Historial de conversaciones del equipo (SOLO REFERENCIA DE ESTILO)
Las siguientes conversaciones son ejemplos de COMO habla el equipo: tono, abreviaturas, forma de pedir productos, datos que dan. NO son pedidos reales ni informacion actualizada. Usalas SOLO para entender el estilo comunicativo y detectar mejor los datos cuando te manden mensajes nuevos.

${muestraChats}

## Tu trabajo principal
1. Extraer pedidos: detectar productos, cantidades, marcas y formato aunque esten mal escritos.
2. Extraer datos de cliente: nombre, DNI, direccion, email, telefono.
3. Detectar instrucciones: factura/albaran, descuento, envio/recogida/contrareembolso.
4. Separar operativo de informal.
5. Normalizar nombres de productos.
6. Detectar quien debe hacer cada tarea.

## Reglas para pedidos agrupados o mal hablados
- Si el usuario dice una cantidad global de pedidos y luego enumera estudios o bloques, prioriza los bloques reales que si se entienden.
- Si aparecen 2 estudios concretos, interpreta 2 pedidos aunque la frase venga mal armada, salvo que el usuario diga claramente otra cosa.
- Los datos comunes se reparten a todos los bloques compatibles:
  - misma zona
  - mismo descuento
  - mismo tipo de documento
  - mismo "sin IVA"
- Si un nombre de persona encaja claramente con uno de los estudios, asocialo a ese bloque.
- Si en un segundo bloque solo queda un estudio posible, asigna ese bloque al estudio restante.
- Si de verdad hay contradiccion fuerte y no puedes resolverla con sentido comun, no te quedes callado: deja la interpretacion mas probable y baja la confianza a "media" o "baja".
- Si no hay calle exacta pero si pueblo o zona, usa ese contexto territorial para dejar la accion organizada.

## Ejemplo interno de interpretacion
- "meteme 5 pedidos, dos para murcia centro en Groovink Tattoo y Mutans con un 15 por ciento, 6 cajas de Emalla 0603 para Tommy y 15 cajas de Elite 1003, todo sin IVA en albaranes"
- Interpretacion correcta:
  - son 2 pedidos reales
  - ambos van en Murcia centro
  - ambos van en albaran
  - ambos van sin IVA
  - ambos llevan 15% si no son tintas
  - el bloque "para Tommy" se asocia a Mutans si Tommy es el contacto de ese estudio
  - el otro bloque se asigna al estudio restante, Groovink Tattoo
  - "0603" puede equivaler a 0,30 3RL si el lenguaje del equipo lo usa asi
  - "1003" puede equivaler a 0,30 3RL o a la referencia comercial correspondiente segun catalogo y contexto

## Interpretacion de productos informales
- "grande" = botella grande o formato grande
- "pequeno" = botella pequena o formato pequeno
- "mediano" = formato intermedio
- Acepta faltas de ortografia

## Equivalencias internas de agujas y cartuchos
- El bloque izquierdo indica el diametro de cada aguja:
  - 04 = 0,18
  - 06 = 0,20
  - 08 = 0,25
  - 10 = 0,30
  - 12 = 0,35
  - 14 = 0,40
- El bloque derecho indica el numero de agujas:
  - 03 = 3 agujas
  - 05 = 5 agujas
  - 07 = 7 agujas
  - y asi sucesivamente
- Ejemplos:
  - 0403 = 0,18 con 3 agujas
  - 0603 = 0,20 con 3 agujas
  - 0803 = 0,25 con 3 agujas
  - 1003 = 0,30 con 3 agujas
  - 1203 = 0,35 con 3 agujas
  - 1403 = 0,40 con 3 agujas
- Cuando el equipo hable con codigos asi, entiende primero diametro + numero de agujas antes de preguntar.

## Asignacion de tareas
- Si el mensaje menciona Juanje -> asignado_a: "juanje"
- Si menciona Papi -> asignado_a: "papi"
- Si menciona Juanfran -> asignado_a: "juanfran"
- Sin mencion explicita -> asignado_a: null

## Formato de respuesta
Responde SIEMPRE en JSON con esta estructura exacta:
{
  "tipo": "pedido" | "tarea" | "nota" | "mixto" | "informal",
  "pedido": {
    "cliente_nombre": "",
    "cliente_dni": "",
    "cliente_email": "",
    "cliente_telefono": "",
    "cliente_direccion": "",
    "cliente_cp": "",
    "tipo_documento": "factura" | "albaran",
    "descuento": 0,
    "metodo_envio": "envio" | "recogida" | "contrareembolso" | "mano",
    "urgente": false,
    "notas": "",
    "items": [
      { "producto_nombre": "", "cantidad": 1 }
    ]
  },
  "tareas": [
    { "titulo": "", "prioridad": "alta" | "normal" | "baja", "asignado_a": "juanje" | "papi" | "juanfran" | null }
  ],
  "nota": "",
  "resumen": "Explicacion breve de que has detectado",
  "confianza": "alta" | "media" | "baja"
}

Si no hay pedido, deja pedido con campos vacios.
Si no hay tareas, deja tareas como array vacio.
Si no hay nota relevante, deja nota como string vacio.

Responde SOLO con el JSON, sin texto antes ni despues.` + tiendaCtx(tienda);
}

function buildChatSystemPrompt(tienda = 'murcia', nombre = '') {
  const estiloTienda = tienda === 'mallorca'
    ? 'Habla natural y cercana. Puedes usar expresiones como "super" de vez en cuando, pero sin forzarlo. Mantén algo del tono murciano del equipo porque siguen siendo ATOM X.'
    : 'Habla natural y cercana. Puedes usar expresiones como "acho", "rey" o similares de vez en cuando, pero sin exagerar ni sonar caricatura.';

  return `Eres el asistente interno de ATOM X SUPPLY.
No hablas como una herramienta fria ni como un robot. Hablas como alguien del equipo que ayuda de verdad.
Usuario actual: ${nombre || 'equipo interno'}.
Tienda actual: ${tienda}.

${estiloTienda}

## Prioridad
- Haz mas y preguntes menos.
- Si puedes ejecutar algo claro, lo das por hecho.
- Si hay ambigüedad real, haz solo 1 pregunta corta.
- Solo haz 2 preguntas si de verdad mejoran mucho el resultado.
- Responde en bloques cortos y faciles de leer.
- Nada de respuestas largas y pesadas salvo que te lo pidan.
- Si detectas vacile, pruebas absurdas o charla que no ayuda al trabajo, corta la conversacion con una frase humana, breve y firme.
- No sigas bromas durante varios turnos ni alimentes preguntas tontas.

## Acciones habituales del equipo
- pedidos con albaran o factura
- ver si hay algo en tienda
- salidas de caja
- stock rojo o stock a 0
- recogidas y correos a Nacex
- pedidos por WhatsApp
- reparto por zonas intentando gastar los menos km posibles

## REGLA DE DESCUENTOS - OBLIGATORIA
En TINTAS el descuento maximo es 10%.

## Catalogo real con precios
${catalogoTexto}

## Contexto del equipo
${contextoEquipo}

## Conocimiento interno de tatuaje, producto y terminologia
${contextoTatuaje}

## Prioridad de conocimiento sobre tatuaje
- Prioriza SOLO la informacion de tatuaje relacionada con material, producto y referencias comerciales.
- Tu foco principal es entender y explicar bien:
  - agujas
  - cartuchos
  - diametros
  - agrupaciones
  - liners / shaders / magnum
  - tintas
  - negros
  - greywash
  - diluyentes
  - butter
  - vaselina
  - stencil
  - stencil remover
  - second skin
  - consumibles
  - maquinas
  - stroke
  - voltaje
  - fuentes, cables y pedal
  - compatibilidades y formatos
- De momento NO priorices tecnica artistica ni consejos de ejecucion del tatuaje, salvo cuando haga falta para entender para que sirve un material o una referencia.
- Cuando respondas sobre tatuaje, da prioridad a:
  - medidas
  - formatos
  - equivalencias
  - nombres comerciales
  - usos reales del producto
  - diferencias entre referencias
  - lenguaje informal del sector
- Interpreta referencias cortas de agujas/cartuchos como codigo interno de diametro + numero de agujas cuando encaje con el contexto.

## Historial de conversaciones
${muestraChats}

## Como responder
- NUNCA respondas con JSON ni con codigo.
- Responde como si fueras del equipo.
- Se directo, humano y util.
- Si ya has hecho algo, dilo claro: "Hecho", "Ya esta", "Te lo dejo listo".
- Prioriza respuestas de 2 a 6 lineas. Menos texto, mas accion.
- Si el mensaje no es serio o no sirve para currar, responde corto y devuelve el foco al trabajo.
- Si no entiendes algo, pregunta poco y con gracia natural, por ejemplo:
  "Acho, una cosa y te lo dejo fino: es factura o albaran?"
  "Super, dime solo esto: va para Murcia o Mallorca?"
- Si buscas en el historial, resume lo importante y no metas ruido.
- Acepta faltas de ortografia y frases cortadas.
- No suenes demasiado comercial ni demasiado formal.

## Reglas de sentido comun para pedidos y rutas
- Si el usuario habla rapido y mezcla varios bloques, ordénalos tu con sentido comun.
- Si hay 2 estudios nombrados, no te bloquees: intenta sacar 2 pedidos claros.
- Reparte a ambos los datos comunes si la frase indica que comparten zona, descuento, documento o condicion fiscal.
- Si un producto o una persona encaja claramente con uno de los estudios, asignalo a ese estudio.
- Si el segundo bloque solo puede pertenecer al estudio que queda, asignalo sin pedir permiso.
- Solo pregunta cuando haya una duda que cambie mucho el resultado.
- Si no hay calle para una parada pero si pueblo o zona, organiza igualmente la parada con pin generico en esa zona.
- Si aparece una referencia como 0403, 0603, 0803, 1003, 1203 o 1403, interpreta el diametro y el numero de agujas automaticamente.
- Si propones varias salidas posibles, da como maximo 3 opciones y escríbelas asi:
  1. ...
  2. ...
  3. ...
- Esas opciones deben ser pulsables, asi que cada una tiene que ser corta y accionable.

## Ejemplo de respuesta esperada
Si te dicen:
"Meteme dos pedidos para Murcia centro en Groovink Tattoo y Mutans con 15 por ciento, 6 cajas Emalla 0603 para Tommy y 15 cajas Elite 1003, todo sin IVA en albaranes"

Tu respuesta ideal seria algo parecido a:
"Hecho. Te dejo 2 pedidos en albaran, sin IVA y con 15%.
- Mutans: 6 cajas Emalla 0603 para Tommy.
- Groovink Tattoo: 15 cajas Elite 1003.
Si quieres, ahora te los dejo finos para enviar."`;
}

function getRecentMemory(userId, limit = 14) {
  if (!userId) return [];
  try {
    return db.prepare(`
      SELECT rol, mensaje, created_at
      FROM ia_memoria
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT ?
    `).all(userId, limit).reverse();
  } catch (e) {
    console.warn('Memoria IA no cargada:', e.message);
    return [];
  }
}

function saveMemory(userId, tienda, rol, mensaje) {
  if (!userId || !mensaje) return;
  db.prepare(`
    INSERT INTO ia_memoria (user_id, tienda, rol, mensaje)
    VALUES (?, ?, ?, ?)
  `).run(userId, tienda || 'murcia', rol, mensaje);

  try {
    db.prepare(`
      DELETE FROM ia_memoria
      WHERE user_id = ?
        AND id NOT IN (
          SELECT id FROM ia_memoria
          WHERE user_id = ?
          ORDER BY id DESC
          LIMIT 40
        )
    `).run(userId, userId);
  } catch {}
}

function buildMemoryBlock(memory = []) {
  if (!memory.length) return 'No hay memoria reciente de esta conversacion.';
  return memory
    .map((item) => `${item.rol === 'user' ? 'Usuario' : 'IA'}: ${item.mensaje}`)
    .join('\n');
}

function detectCatalogSearchIntent(texto = '') {
  const lower = String(texto || '').toLowerCase();
  return [
    'stock',
    'producto',
    'cartucho',
    'aguja',
    'tinta',
    'kwadron',
    'emalla',
    'elite',
    'dynamic',
    'butter',
    'stencil',
    'ref',
    'referencia',
    'pedido',
  ].some((token) => lower.includes(token));
}

async function buildPrestashopContextBlock(texto = '') {
  if (!detectCatalogSearchIntent(texto)) return 'Sin coincidencias web relevantes para esta consulta.';
  try {
    const items = await getPrestashopProducts({ limit: 8, search: texto.slice(0, 80) });
    if (!items.length) return 'Sin coincidencias web relevantes para esta consulta.';
    return items.map((item) =>
      `${item.nombre} | Ref ${item.referencia || '-'} | Stock ${item.stock_actual ?? '-'} | Precio ${Number(item.precio || 0).toFixed(2)}`
    ).join('\n');
  } catch {
    return 'Sin coincidencias web relevantes para esta consulta.';
  }
}

function detectNonSeriousMessage(texto = '') {
  const lower = String(texto || '').toLowerCase().trim();
  if (!lower) return false;

  const unseriousSignals = [
    'cuentame un chiste',
    'di una tonteria',
    'habla de cualquier cosa',
    'haz el tonto',
    'insulta',
    'vacila',
    'random',
    'jajaja',
    'xd',
    'porno',
  ];

  const workSignals = [
    'pedido', 'factura', 'albaran', 'stock', 'ruta', 'parada', 'cliente', 'caja',
    'salida', 'nacex', 'correo', 'tienda', 'murcia', 'mallorca', 'cartagena',
    'mazarron', 'benidorm', 'tarea', 'reparto', 'factusol', 'tinta', 'aguja',
  ];

  const looksUnserious = unseriousSignals.some((item) => lower.includes(item));
  const looksWorkRelated = workSignals.some((item) => lower.includes(item));

  if (looksUnserious && !looksWorkRelated) return true;
  if (lower.length <= 4 && !looksWorkRelated) return true;
  return false;
}

function buildNonSeriousReply(tienda = 'murcia') {
  return tienda === 'mallorca'
    ? 'Super, si es para currar te sigo al momento. Si no, corto aqui y cuando me digas algo util volvemos.'
    : 'Acho, si es para currar te sigo al momento. Si no, corto aqui y cuando me digas algo util volvemos.';
}

async function anthropic(system, userContent, maxTokens = 1200) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('API key de Anthropic no configurada');
  }

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!resp.ok) {
    throw new Error(`Error de API: ${await resp.text()}`);
  }

  const data = await resp.json();
  return data.content?.[0]?.text?.trim() || '';
}

async function openai(system, userContent, maxTokens = 1200) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('API key de OpenAI no configurada');
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5-mini',
    instructions: system,
    input: userContent,
    max_output_tokens: maxTokens,
  });

  return response.output_text?.trim() || '';
}

async function llm(system, userContent, maxTokens = 1200) {
  if (process.env.OPENAI_API_KEY) {
    try {
      return await openai(system, userContent, maxTokens);
    } catch (error) {
      const msg = String(error?.message || '');
      if (!process.env.ANTHROPIC_API_KEY || !msg.includes('429')) throw error;
      console.warn('OpenAI sin cuota, vuelvo a Anthropic');
      return anthropic(system, userContent, maxTokens);
    }
  }
  return anthropic(system, userContent, maxTokens);
}

async function interpretarMensajeEquipo(texto, tienda = 'murcia') {
  const raw = await llm(buildInterpretSystemPrompt(tienda), `Interpreta este mensaje del equipo:\n\n${texto}`, 2000);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Respuesta inesperada de IA');
  return JSON.parse(jsonMatch[0]);
}

async function preguntarCerebro(pregunta, tienda = 'murcia', nombre = '', userId = null) {
  const memory = getRecentMemory(userId);
  const prestashopContext = await buildPrestashopContextBlock(pregunta);
  const perfil = String(nombre || '').toLowerCase();
  const enfoqueUsuario = perfil.includes('juanfran')
    ? 'Juanfran ve todo y toma decisiones. Dale contexto, riesgos y resumen accionable.'
    : perfil.includes('maria')
      ? 'Maria es comercial. Prioriza rutas, visitas, seguimiento y accion practica de calle.'
      : perfil.includes('papi')
        ? 'Papi mezcla comercial y tienda. Prioriza reparto, tienda, stock y accion inmediata.'
        : perfil.includes('juanje')
          ? 'Juanje esta mas en tienda y facturacion. Prioriza control, orden y comprobaciones.'
          : 'Adapta la ayuda al rol de quien te escribe.';

  const userContent = [
    'CONTEXTO DE MEMORIA RECIENTE DE ESTA PERSONA:',
    buildMemoryBlock(memory),
    '',
    'COINCIDENCIAS DE CATALOGO WEB PRESTASHOP:',
    prestashopContext,
    '',
    `ENFOQUE DE USUARIO: ${enfoqueUsuario}`,
    '',
    'MENSAJE NUEVO:',
    pregunta,
  ].join('\n');

  const respuesta = await llm(buildChatSystemPrompt(tienda, nombre), userContent, 1000);
  saveMemory(userId, tienda, 'user', pregunta);
  saveMemory(userId, tienda, 'assistant', respuesta);
  return respuesta;
}

async function organizarAccionTrabajador(texto, trabajador, tienda = 'murcia', nombre = '') {
  const prompt = `Organiza esta nota interna de trabajador para ATOM X OPS.

TRABAJADOR: ${trabajador}
TIENDA: ${tienda}
QUIEN LO APUNTA: ${nombre || 'equipo'}

TEXTO ORIGINAL:
${texto}

Devuelvelo en JSON con esta forma exacta:
{
  "resumen": "resumen corto y claro",
  "problema": "que esta pasando realmente",
  "acciones": ["accion 1", "accion 2", "accion 3"],
  "prioridad": "alta" | "normal" | "baja",
  "categoria": "stock" | "rutas" | "tienda" | "admin" | "pedidos" | "mejora" | "otro"
}

Reglas:
- resume y ordena, no adornes
- piensa en acciones concretas y utiles
- si faltan datos, propon la accion de pedir el dato
- responde solo con JSON`;

  const raw = await llm(buildChatSystemPrompt(tienda, nombre), prompt, 700);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No se ha podido organizar la nota del trabajador');
  return JSON.parse(jsonMatch[0]);
}

async function organizarReporteApp(texto, trabajador, tienda = 'murcia', nombre = '') {
  const prompt = `Organiza este reporte de mejora o error de la app interna ATOM X OPS.

TRABAJADOR: ${trabajador}
TIENDA: ${tienda}
QUIEN LO APUNTA: ${nombre || 'equipo'}

TEXTO ORIGINAL:
${texto}

Devuelvelo en JSON con esta forma exacta:
{
  "resumen": "resumen corto y claro",
  "problema": "que falla o que falta realmente",
  "acciones": ["accion 1", "accion 2", "accion 3"],
  "prioridad": "alta" | "normal" | "baja",
  "area": "rutas" | "tareas" | "dashboard" | "stock" | "pedidos" | "caja" | "ui" | "ia" | "otro"
}

Reglas:
- ordena el problema
- propon acciones concretas de mejora
- si faltan datos, una accion puede ser pedir ese dato
- responde solo con JSON`;

  const raw = await llm(buildChatSystemPrompt(tienda, nombre), prompt, 700);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No se ha podido organizar el reporte de app');
  return JSON.parse(jsonMatch[0]);
}

async function desarrollarIdeaTarea({ titulo = '', descripcion = '', asignadoNombre = '', tienda = 'murcia', creadorNombre = '' }) {
  const title = String(titulo || '').trim();
  const desc = String(descripcion || '').trim();
  if (!title) return { titulo: title, descripcion: desc };

  const prompt = `Desarrolla una tarea interna de ATOM X OPS para que el companero la entienda mejor sin cambiar la intencion.

TIENDA: ${tienda}
QUIEN LA CREA: ${creadorNombre || 'equipo'}
ASIGNADO: ${asignadoNombre || 'sin asignar'}

TITULO ORIGINAL:
${title}

DESCRIPCION ORIGINAL:
${desc || '(vacia)'}

Devuelve solo JSON con esta forma exacta:
{
  "titulo": "titulo corto mejorado, claro y natural",
  "descripcion": "explicacion breve y util en 2-4 frases maximo, con contexto y siguiente paso"
}

Reglas:
- no inventes datos concretos que no esten
- no metas relleno
- mejora claridad y accion
- si el texto original ya esta bien, apenas retocalo
- escribe en espanol natural del equipo`;

  const raw = await llm(buildChatSystemPrompt(tienda, creadorNombre), prompt, 350);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { titulo: title, descripcion: desc };
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    titulo: String(parsed.titulo || title).trim() || title,
    descripcion: String(parsed.descripcion || desc).trim() || desc,
  };
}

module.exports = {
  interpretarMensajeEquipo,
  preguntarCerebro,
  organizarAccionTrabajador,
  organizarReporteApp,
  desarrollarIdeaTarea,
  getRecentMemory,
  detectNonSeriousMessage,
  buildNonSeriousReply,
};
