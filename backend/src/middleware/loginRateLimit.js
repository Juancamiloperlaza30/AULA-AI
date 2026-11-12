'use strict';

const {
  rateLimit,
} = require('express-rate-limit');

const limitarLogin = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 10,

  standardHeaders: 'draft-8',

  legacyHeaders: false,

  skipSuccessfulRequests: true,

  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      code: 'LOGIN_RATE_LIMIT_EXCEEDED',
      message:
        'Demasiados intentos de inicio de sesión. Espere unos minutos antes de intentarlo nuevamente.',
    });
  },
});

module.exports = {
  limitarLogin,
};
