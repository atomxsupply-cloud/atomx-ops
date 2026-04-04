const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Faltan campos' });

  const user = db.prepare('SELECT * FROM users WHERE email = ? AND activo = 1').get(email.toLowerCase().trim());
  if (!user) return res.status(401).json({ error: 'Email o contraseña incorrectos' });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Email o contraseña incorrectos' });

  const token = jwt.sign(
    { id: user.id, nombre: user.nombre, rol: user.rol, tienda: user.tienda || 'murcia' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({ token, user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol, tienda: user.tienda || 'murcia' } });
});

router.get('/me', auth, (req, res) => {
  const user = db.prepare('SELECT id, nombre, email, rol, tienda FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

router.get('/users', auth, (req, res) => {
  const users = db.prepare('SELECT id, nombre, email, rol, tienda FROM users WHERE activo = 1 AND tienda = ?').all(req.user.tienda || 'murcia');
  res.json(users);
});

// Usuarios activos en los últimos 5 minutos
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
    WHERE u.activo = 1 AND u.tienda = ? AND u.last_seen >= datetime('now', '-5 minutes', 'localtime')
    ORDER BY last_seen DESC
  `).all(req.user.tienda || 'murcia');
  res.json(users);
});

module.exports = router;
