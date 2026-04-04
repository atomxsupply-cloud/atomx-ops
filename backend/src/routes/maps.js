const express = require('express');

const router = express.Router();

router.post('/places-search', async (req, res) => {
  const query = String(req.body?.query || '').trim();
  if (query.length < 3) {
    return res.status(400).json({ error: 'Escribe al menos 3 caracteres' });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: 'Falta GOOGLE_MAPS_API_KEY en el servidor' });
  }

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: 'es',
        regionCode: 'ES',
        maxResultCount: 5,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'No he podido buscar estudios en Google Maps',
      });
    }

    const places = (data.places || []).map((place) => ({
      id: place.id,
      nombre: place.displayName?.text || '',
      direccion: place.formattedAddress || '',
      lat: place.location?.latitude ?? null,
      lng: place.location?.longitude ?? null,
    }));

    res.json({ places });
  } catch (err) {
    console.error('Error buscando estudios en Google Maps:', err);
    res.status(500).json({ error: 'Error buscando estudios en Google Maps' });
  }
});

module.exports = router;
