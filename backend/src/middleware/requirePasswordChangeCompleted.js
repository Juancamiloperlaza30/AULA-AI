'use strict';

/**
 * AULA-AI
 * Protección del cambio obligatorio de contraseña.
 *
 * IMPORTANTE:
 * Debe ejecutarse después de verificarToken.
 */
const requirePasswordChangeCompleted = (req, res, next) => {
  if (!req.usuario) {
    return res.status(401).json({
      success: false,
      message: 'Se requiere una sesión válida.',
    });
  }

  if (req.usuario.debe_cambiar_password !== false) {
    return res.status(403).json({
      success: false,
      code: 'PASSWORD_CHANGE_REQUIRED',
      message:
        'Debes completar el cambio obligatorio de contraseña antes de continuar.',
    });
  }

  return next();
};

module.exports = {
  requirePasswordChangeCompleted,
};
