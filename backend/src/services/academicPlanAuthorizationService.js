'use strict';

// ======================================================
// AULA-AI
// HU-11: PLANES DE ACOMPAÑAMIENTO ACADÉMICO
// Servicio de autorización
// ======================================================

const {
  verificarAccesoOrientadorEstudiante,
} = require('./orientadorAuthorizationService');

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verifica si un orientador autenticado puede
 * crear o actualizar planes de acompañamiento
 * de un estudiante.
 *
 * El usuario debe provenir del middleware
 * verificarToken, mediante req.usuario.
 *
 * Esta función no modifica la base de datos.
 */
const verificarPermisoGestionPlan = async ({
  usuario,
  estudianteId,
}) => {
  // ------------------------------------------
  // 1. Validar parámetros
  // ------------------------------------------

  if (
    !usuario ||
    typeof usuario.id !== 'string' ||
    !UUID_REGEX.test(usuario.id) ||
    typeof usuario.rol !== 'string' ||
    typeof estudianteId !== 'string' ||
    !UUID_REGEX.test(estudianteId)
  ) {
    return {
      autorizado: false,
      motivo: 'PARAMETROS_INVALIDOS',
    };
  }

  // ------------------------------------------
  // 2. Restringir operaciones de escritura
  // ------------------------------------------

  if (usuario.rol !== 'orientador') {
    return {
      autorizado: false,
      motivo: 'ROL_NO_AUTORIZADO_PARA_GESTION',
    };
  }

  // ------------------------------------------
  // 3. Comprobar ámbito del orientador
  // ------------------------------------------

  const resultado =
    await verificarAccesoOrientadorEstudiante({
      orientadorId: usuario.id,
      estudianteId,
    });

  return {
    autorizado: resultado.autorizado === true,
    motivo:
      resultado.motivo ||
      'ACCESO_NO_AUTORIZADO',
  };
};

module.exports = {
  verificarPermisoGestionPlan,
};
