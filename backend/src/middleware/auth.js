const jwt = require('jsonwebtoken');
const { db } = require('../db');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Sin token' });
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    // Actualizar last_seen sin bloquear la petición
    try {
      db.prepare(`UPDATE users SET last_seen = datetime('now','localtime') WHERE id = ?`).run(req.user.id);
    } catch {}
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function soloAdmin(req, res, next) {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  next();
}

module.exports = { auth, soloAdmin };
