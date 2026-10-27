'use strict';

// ======================================================
// AULA-AI
// HU-11: PLANES DE ACOMPANAMIENTO ACADEMICO
// Autorizacion de consulta de planes
// ======================================================

const {
  verificarAccesoRecomendacionesEstudiante,
} = require('./academicRecommendationAuthorizationService');

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verifica si un usuario puede consultar los planes
 * de acompanamiento de un estudiante.
 *
 * Reutiliza las reglas de autorizacion de recomendaciones.
 *
 * Este servicio debe recibir un usuario autenticado
 * desde el middleware JWT, nunca desde req.body.
 */
const verificarPermisoConsultaPlan = async ({
  usuario,
  estudianteId,
}) => {
  if (
    !usuario ||
    typeof usuario !== 'object' ||
    !UUID_REGEX.test(usuario.id || '')
  ) {
    return {
      autorizado: false,
      motivo: 'USUARIO_INVALIDO',
    };
  }

  if (
    typeof estudianteId !== 'string' ||
    !UUID_REGEX.test(estudianteId)
  ) {
    return {
      autorizado: false,
      motivo: 'ESTUDIANTE_INVALIDO',
    };
  }

  const rolesPermitidos = [
    'estudiante',
    'orientador',
    'coordinador',
  ];

  if (!rolesPermitidos.includes(usuario.rol)) {
    return {
      autorizado: false,
      motivo: 'ROL_NO_AUTORIZADO',
    };
  }

  const resultado =
    await verificarAccesoRecomendacionesEstudiante({
      usuario,
      estudianteId,
    });

  return {
    autorizado: resultado.autorizado === true,
    motivo:
      resultado.motivo ||
      (resultado.autorizado
        ? 'ACCESO_AUTORIZADO'
        : 'ACCESO_DENEGADO'),
  };
};

module.exports = {
  verificarPermisoConsultaPlan,
};
