const fs = require('fs');
const path = require('path');
const express = require('express');
const { auth } = require('../middleware/auth');
const { interpretarMensajeEquipo, preguntarCerebro, organizarAccionTrabajador, organizarReporteApp, getRecentMemory, detectNonSeriousMessage, buildNonSeriousReply } = require('../services/atomBrain');
const { executeOperationalCommand } = require('../services/operacionesChat');
const { db } = require('../db');

const router = express.Router();
const ACCIONES_DIR = path.join(__dirname, '..', '..', 'cerebro-bot', 'acciones-trabajadores-necesarias');
const REPORTES_APP_DIR = path.join(__dirname, '..', '..', 'cerebro-bot', 'mejoras-app-reportadas');

function ensureAccionesDir() {
  fs.mkdirSync(ACCIONES_DIR, { recursive: true });
}

function ensureReportesDir() {
  fs.mkdirSync(REPORTES_APP_DIR, { recursive: true });
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'nota';
}

router.post('/interpretar', auth, async (req, res) => {
  const { texto } = req.body;
  if (!texto || texto.trim().length < 3) {
    return res.status(400).json({ error: 'Texto demasiado corto' });
  }

  try {
    const parsed = await interpretarMensajeEquipo(texto, req.user.tienda || 'murcia');
    res.json(parsed);
  } catch (err) {
    console.error('Error IA interpretar:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/preguntar', auth, async (req, res) => {
  const { pregunta } = req.body;
  if (!pregunta) return res.status(400).json({ error: 'Pregunta requerida' });

  try {
    if (detectNonSeriousMessage(pregunta)) {
      const mensaje = buildNonSeriousReply(req.user.tienda || 'murcia');
      db.prepare(`
        INSERT INTO ia_memoria (user_id, tienda, rol, mensaje)
        VALUES (?, ?, 'user', ?), (?, ?, 'assistant', ?)
      `).run(req.user.id, req.user.tienda || 'murcia', pregunta, req.user.id, req.user.tienda || 'murcia', mensaje);
      return res.json({ respuesta: mensaje, accionEjecutada: false });
    }

    const op = await executeOperationalCommand(pregunta, req.user);
    if (op?.handled) {
      db.prepare(`
        INSERT INTO ia_memoria (user_id, tienda, rol, mensaje)
        VALUES (?, ?, 'user', ?), (?, ?, 'assistant', ?)
      `).run(req.user.id, req.user.tienda || 'murcia', pregunta, req.user.id, req.user.tienda || 'murcia', op.mensaje);
      return res.json({ respuesta: op.mensaje, accionEjecutada: true });
    }

    const respuesta = await preguntarCerebro(
      pregunta,
      req.user.tienda || 'murcia',
      req.user.nombre || '',
      req.user.id
    );
    res.json({ respuesta });
  } catch (err) {
    console.error('Error IA preguntar:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/historial', auth, async (req, res) => {
  try {
    const items = getRecentMemory(req.user.id, 24);
    res.json({ items });
  } catch (err) {
    console.error('Error IA historial:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/historial', auth, async (req, res) => {
  try {
    db.prepare('DELETE FROM ia_memoria WHERE user_id = ?').run(req.user.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error IA borrar historial:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/accion-trabajador', auth, async (req, res) => {
  const { trabajador, texto } = req.body;
  if (!trabajador || !texto || texto.trim().length < 5) {
    return res.status(400).json({ error: 'Trabajador y texto requeridos' });
  }

  try {
    const organizado = await organizarAccionTrabajador(
      texto.trim(),
      trabajador,
      req.user.tienda || 'murcia',
      req.user.nombre || ''
    );

    ensureAccionesDir();
    const ahora = new Date();
    const stamp = ahora.toISOString().replace(/[:.]/g, '-');
    const trabajadorSlug = slugify(trabajador);
    const fileName = `${stamp}-${trabajadorSlug}.md`;
    const filePath = path.join(ACCIONES_DIR, fileName);

    const contenido = [
      `# Accion trabajador - ${trabajador}`,
      '',
      `- Fecha: ${ahora.toISOString()}`,
      `- Tienda: ${req.user.tienda || 'murcia'}`,
      `- Apuntado por: ${req.user.nombre || 'equipo'}`,
      `- Prioridad: ${organizado.prioridad || 'normal'}`,
      `- Categoria: ${organizado.categoria || 'otro'}`,
      '',
      '## Texto original',
      texto.trim(),
      '',
      '## Resumen',
      organizado.resumen || '',
      '',
      '## Problema',
      organizado.problema || '',
      '',
      '## Acciones propuestas',
      ...(organizado.acciones || []).map((accion) => `- ${accion}`),
      '',
    ].join('\n');

    fs.writeFileSync(filePath, contenido, 'utf-8');

    res.json({
      ok: true,
      archivo: fileName,
      ruta: filePath,
      organizado,
    });
  } catch (err) {
    console.error('Error IA accion-trabajador:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/reporte-app', auth, async (req, res) => {
  const { trabajador, texto, screenshot } = req.body;
  if (!trabajador || !texto || texto.trim().length < 5) {
    return res.status(400).json({ error: 'Trabajador y texto requeridos' });
  }

  try {
    const organizado = await organizarReporteApp(
      texto.trim(),
      trabajador,
      req.user.tienda || 'murcia',
      req.user.nombre || ''
    );

    ensureReportesDir();
    const ahora = new Date();
    const stamp = ahora.toISOString().replace(/[:.]/g, '-');
    const trabajadorSlug = slugify(trabajador);
    const fileName = `${stamp}-${trabajadorSlug}.md`;
    const filePath = path.join(REPORTES_APP_DIR, fileName);
    let screenshotName = null;

    if (screenshot && typeof screenshot === 'string' && screenshot.startsWith('data:image/png;base64,')) {
      const pngBase64 = screenshot.replace('data:image/png;base64,', '');
      screenshotName = `${stamp}-${trabajadorSlug}.png`;
      const screenshotPath = path.join(REPORTES_APP_DIR, screenshotName);
      fs.writeFileSync(screenshotPath, pngBase64, 'base64');
    }

    const contenido = [
      `# Reporte app - ${trabajador}`,
      '',
      `- Fecha: ${ahora.toISOString()}`,
      `- Tienda: ${req.user.tienda || 'murcia'}`,
      `- Apuntado por: ${req.user.nombre || 'equipo'}`,
      `- Prioridad: ${organizado.prioridad || 'normal'}`,
      `- Area: ${organizado.area || 'otro'}`,
      `- Captura: ${screenshotName || 'no'}`,
      '',
      '## Texto original',
      texto.trim(),
      '',
      '## Resumen',
      organizado.resumen || '',
      '',
      '## Problema',
      organizado.problema || '',
      '',
      '## Acciones propuestas',
      ...(organizado.acciones || []).map((accion) => `- ${accion}`),
      '',
    ].join('\n');

    fs.writeFileSync(filePath, contenido, 'utf-8');

    res.json({
      ok: true,
      archivo: fileName,
      captura: screenshotName,
      ruta: filePath,
      organizado,
    });
  } catch (err) {
    console.error('Error IA reporte-app:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
