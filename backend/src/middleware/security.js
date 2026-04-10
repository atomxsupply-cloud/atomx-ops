const loginAttempts = new Map();

function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

function loginRateLimit(req, res, next) {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const key = `${getClientIp(req)}|${email}`;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 7;
  const blockMs = 20 * 60 * 1000;

  for (const [attemptKey, value] of loginAttempts.entries()) {
    if (now - value.lastSeen > blockMs) loginAttempts.delete(attemptKey);
  }

  const current = loginAttempts.get(key);
  if (current?.blockedUntil && current.blockedUntil > now) {
    const remaining = Math.ceil((current.blockedUntil - now) / 60000);
    return res.status(429).json({ error: `Demasiados intentos. Espera ${remaining} min.` });
  }

  req.loginRateLimitKey = key;
  req.loginRateLimitConfig = { windowMs, maxAttempts, blockMs, now };
  next();
}

function registerLoginFailure(req) {
  const key = req?.loginRateLimitKey || null;
  if (!key) return;
  const { windowMs, maxAttempts, blockMs, now } = req.loginRateLimitConfig || {};
  const existing = loginAttempts.get(key);

  if (!existing || now - existing.firstSeen > windowMs) {
    loginAttempts.set(key, {
      count: 1,
      firstSeen: now,
      lastSeen: now,
      blockedUntil: null,
    });
    return;
  }

  existing.count += 1;
  existing.lastSeen = now;
  if (existing.count >= maxAttempts) {
    existing.blockedUntil = now + blockMs;
  }
  loginAttempts.set(key, existing);
}

function clearLoginFailures(req) {
  const key = req?.loginRateLimitKey || null;
  if (!key) return;
  loginAttempts.delete(key);
}

module.exports = {
  securityHeaders,
  loginRateLimit,
  registerLoginFailure,
  clearLoginFailures,
};
