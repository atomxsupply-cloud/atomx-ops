const express = require('express');
const { db } = require('../db');
const { getEternalCatalog, searchEternalCatalog } = require('../services/eternalCatalog');
const { getTintasCatalog, searchTintasCatalog } = require('../services/tintasCatalog');

const router = express.Router();

function jsonError(res, status, error, detalle = undefined) {
  return res.status(status).json(detalle ? { error, detalle } : { error });
}

function normalizeShortText(value, fallback = '') {
  return String(value || fallback).trim().slice(0, 120);
}

function generateRewardCode() {
  for (let i = 0; i < 10; i += 1) {
    const code = String(Math.floor(10000 + Math.random() * 90000));
    const exists = db.prepare('SELECT id FROM design_feedback WHERE reward_code = ? LIMIT 1').get(code);
    if (!exists) return code;
  }
  return `${Date.now()}`.slice(-5);
}

router.get('/eternal/catalogo', async (_req, res) => {
  try {
    const catalog = await getEternalCatalog();
    res.json(catalog);
  } catch (error) {
    console.error('Error catalogo Eternal publico:', error);
    jsonError(res, 500, 'No he podido cargar el catalogo Eternal');
  }
});

router.get('/eternal/buscar', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return jsonError(res, 400, 'Parametro q requerido');

    const results = await searchEternalCatalog(q, 12);
    res.json({ q, total: results.length, items: results });
  } catch (error) {
    console.error('Error busqueda Eternal publica:', error);
    jsonError(res, 500, 'No he podido buscar en Eternal');
  }
});

// ATOMX Design: solo tintas (negra/blanca/color) para no exponer todo el catalogo de PrestaShop
router.get('/design/tintas', async (_req, res) => {
  try {
    const catalog = await getTintasCatalog();
    res.json(catalog);
  } catch (error) {
    console.error('Error catalogo Tintas publico:', error);
    jsonError(res, 500, 'No he podido cargar el catalogo de tintas');
  }
});

router.get('/design/tintas/buscar', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return jsonError(res, 400, 'Parametro q requerido');

    const results = await searchTintasCatalog(q, 12);
    res.json({ q, total: results.length, items: results });
  } catch (error) {
    console.error('Error busqueda Tintas publica:', error);
    jsonError(res, 500, 'No he podido buscar en tintas');
  }
});

router.post('/design/analyze', async (req, res) => {
  const { image, prompt, mediaType } = req.body || {};
  if (!image || !prompt) {
    return jsonError(res, 400, 'Faltan datos');
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError(res, 503, 'ANTHROPIC_API_KEY no configurada');
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 7000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      console.error('Error public design analyze:', data);
      return jsonError(res, 500, 'Error IA', data);
    }

    return res.json(data);
  } catch (error) {
    console.error('Error public design analyze:', error);
    return jsonError(res, 500, error.message || 'Error interno');
  }
});

router.get('/design/feedback', (_req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(_req.query.limit || '5', 10), 1), 12);
    const rows = db.prepare(`
      SELECT id, autor, feedback, selected_brand, estilo_detectado, reward_code, reward_amount, created_at
      FROM design_feedback
      ORDER BY id DESC
      LIMIT ?
    `).all(limit);

    res.json({
      items: rows.map((row) => ({
        ...row,
        feedback_preview: String(row.feedback || '').slice(0, 180),
      })),
    });
  } catch (error) {
    console.error('Error feedback publico design:', error);
    jsonError(res, 500, 'No he podido cargar el feedback');
  }
});

router.post('/design/feedback', (req, res) => {
  try {
    const {
      autor,
      feedback,
      selectedBrand,
      skinTone,
      analysis,
    } = req.body || {};

    const feedbackText = String(feedback || '').trim();
    if (feedbackText.length < 8) {
      return jsonError(res, 400, 'El feedback es demasiado corto');
    }

    const rewardAmount = feedbackText.length >= 500 ? 8 : feedbackText.length >= 250 ? 5 : 0;
    const rewardEligible = rewardAmount > 0;
    const rewardCode = rewardEligible ? generateRewardCode() : null;
    const rewardStatus = rewardEligible ? 'valid' : 'none';

    const result = db.prepare(`
      INSERT INTO design_feedback (
        tienda,
        autor,
        feedback,
        selected_brand,
        skin_tone,
        estilo_detectado,
        analysis_summary,
        detected_colors_json,
        recommended_inks_json,
        reward_code,
        reward_amount,
        reward_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'murcia',
      normalizeShortText(autor, 'tatuador'),
      feedbackText,
      normalizeShortText(selectedBrand),
      normalizeShortText(skinTone),
      normalizeShortText(analysis?.estilo),
      normalizeShortText(analysis?.descripcion_estilo, ''),
      JSON.stringify(analysis?.colores_detectados || []),
      JSON.stringify(analysis?.tintas_recomendadas || []),
      rewardCode,
      rewardAmount,
      rewardStatus
    );

    res.status(201).json({
      ok: true,
      id: result.lastInsertRowid,
      reward: rewardEligible
        ? {
            earned: true,
            amount: rewardAmount,
            code: rewardCode,
            message: `Has ganado ${rewardAmount} EUR en ATOM X por un feedback util.`,
          }
        : {
            earned: false,
            amount: 0,
            code: null,
            message: 'Gracias. Si tu feedback supera 250 caracteres, te llevas 5 EUR. Si supera 500, te llevas 8 EUR.',
          },
    });
  } catch (error) {
    console.error('Error guardando feedback publico design:', error);
    jsonError(res, 500, 'No he podido guardar el feedback');
  }
});

module.exports = router;
