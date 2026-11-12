'use strict';

/**
 * AULA-AI
 * Acceso seguro a funcionalidades institucionales.
 *
 * Orden:
 * 1. Validar token y perfil institucional.
 * 2. Exigir cambio obligatorio de contrasena.
 *
 * No modifica los permisos por rol existentes.
 */

const {
  verificarToken,
} = require('./authMiddleware');

const {
  requirePasswordChangeCompleted,
} = require('./requirePasswordChangeCompleted');

const requireAcademicAccess = [
  verificarToken,
  requirePasswordChangeCompleted,
];

module.exports = {
  requireAcademicAccess,
};