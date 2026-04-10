const express = require('express');
const { getEternalCatalog, searchEternalCatalog } = require('../services/eternalCatalog');
const { getTintasCatalog, searchTintasCatalog } = require('../services/tintasCatalog');

const router = express.Router();

function jsonError(res, status, error, detalle = undefined) {
  return res.status(status).json(detalle ? { error, detalle } : { error });
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

module.exports = router;
