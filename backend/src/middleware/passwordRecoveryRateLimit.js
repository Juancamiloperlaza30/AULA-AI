'use strict';

const {
  rateLimit,
} = require('express-rate-limit');

const VENTANA_MS = 15 * 60 * 1000;

const respuestaLimite = (req, res) => {
  return res.status(429).json({
    success: false,
    message:
      'Demasiadas solicitudes. Espere unos minutos antes de intentarlo nuevamente.',
    code: 'RATE_LIMIT_EXCEEDED',
  });
};

const configuracionBase = {
  windowMs: VENTANA_MS,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: respuestaLimite,
};

const limitarSolicitudRecuperacion = rateLimit({
  ...configuracionBase,
  limit: 5,
});

const limitarCompletarRecuperacion = rateLimit({
  ...configuracionBase,
  limit: 10,
});

module.exports = {
  limitarSolicitudRecuperacion,
  limitarCompletarRecuperacion,
};