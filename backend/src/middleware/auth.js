const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { getProfile } = require('./access');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Sin token' });
  const token = header.split(' ')[1];
  try {
    const tokenUser = jwt.verify(token, process.env.JWT_SECRET);
    const dbUser = db.prepare(`
      SELECT id, nombre, email, rol, activo, COALESCE(tienda, 'murcia') as tienda
      FROM users
      WHERE id = ?
    `).get(tokenUser.id);
    if (!dbUser || Number(dbUser.activo) !== 1) {
      return res.status(401).json({ error: 'Usuario inactivo o no encontrado' });
    }
    req.user = {
      ...tokenUser,
      ...dbUser,
      perfil: getProfile(dbUser),
    };
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
