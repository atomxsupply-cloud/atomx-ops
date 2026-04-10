const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { auth } = require('../middleware/auth');
const { loginRateLimit, registerLoginFailure, clearLoginFailures } = require('../middleware/security');
const { getProfile } = require('../middleware/access');

const router = express.Router();
const ROLE_OPTIONS = new Set(['admin_full', 'ops_core', 'store_commercial', 'commercial_only', 'mallorca_store', 'store_default', 'admin', 'encargado', 'empleado']);

function requireAdminFull(req, res, next) {
  if (getProfile(req.user) !== 'admin_full') {
    return res.status(403).json({ error: 'Sin permisos para gestionar usuarios' });
  }
  next();
}

router.post('/login', loginRateLimit, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Faltan campos' });

  const user = db.prepare('SELECT * FROM users WHERE email = ? AND activo = 1').get(email.toLowerCase().trim());
  if (!user) {
    registerLoginFailure(req);
    return res.status(401).json({ error: 'Email o contraseña incorrectos' });
  }

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) {
    registerLoginFailure(req);
    return res.status(401).json({ error: 'Email o contraseña incorrectos' });
  }

  clearLoginFailures(req);

  const token = jwt.sign(
    { id: user.id, nombre: user.nombre, rol: user.rol, tienda: user.tienda || 'murcia' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      tienda: user.tienda || 'murcia',
    },
  });
});

router.get('/me', auth, (req, res) => {
  const user = db.prepare('SELECT id, nombre, email, rol, tienda FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

router.get('/users', auth, (req, res) => {
  const users = db.prepare('SELECT id, nombre, email, rol, tienda FROM users WHERE activo = 1 AND tienda = ?').all(req.user.tienda || 'murcia');
  res.json(users);
});

router.get('/users/manage', auth, requireAdminFull, (req, res) => {
  const users = db.prepare(`
    SELECT id, nombre, email, rol, activo, COALESCE(tienda, 'murcia') as tienda, created_at, last_seen
    FROM users
    ORDER BY activo DESC, nombre COLLATE NOCASE ASC
  `).all();
  res.json(users.map((user) => ({
    ...user,
    perfil: getProfile(user),
  })));
});

router.patch('/users/:id', auth, requireAdminFull, (req, res) => {
  const targetId = Number(req.params.id);
  const current = db.prepare('SELECT id, nombre, email, rol, activo, COALESCE(tienda, \'murcia\') as tienda FROM users WHERE id = ?').get(targetId);
  if (!current) return res.status(404).json({ error: 'Usuario no encontrado' });

  const nextRole = req.body.rol ?? current.rol;
  const nextActivo = req.body.activo === undefined ? current.activo : (req.body.activo ? 1 : 0);
  const nextTienda = String(req.body.tienda || current.tienda || 'murcia').trim() || 'murcia';

  if (!ROLE_OPTIONS.has(String(nextRole || ''))) {
    return res.status(400).json({ error: 'Rol no valido' });
  }

  db.prepare(`
    UPDATE users
    SET rol = ?, activo = ?, tienda = ?
    WHERE id = ?
  `).run(nextRole, nextActivo, nextTienda, targetId);

  const updated = db.prepare(`
    SELECT id, nombre, email, rol, activo, COALESCE(tienda, 'murcia') as tienda, created_at, last_seen
    FROM users
    WHERE id = ?
  `).get(targetId);

  res.json({
    ...updated,
    perfil: getProfile(updated),
  });
});

router.get('/online', auth, (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.nombre, u.rol, u.last_seen, u.tienda,
           f.estado as fichaje_estado,
           f.pausa_total_min,
           f.descanso_max_min
    FROM users u
    LEFT JOIN fichajes f
      ON f.user_id = u.id
     AND f.tienda = u.tienda
     AND f.fecha = date('now')
     AND f.finished_at IS NULL
    WHERE u.activo = 1
      AND u.tienda = ?
      AND u.last_seen >= datetime('now', '-5 minutes', 'localtime')
    ORDER BY last_seen DESC
  `).all(req.user.tienda || 'murcia');
  res.json(users);
});

module.exports = router;
