'use strict';

// ======================================================
// AULA-AI | HU-11
// CONTROLADOR DE RECOMENDACIONES ACADÉMICAS
// ======================================================

const {
  verificarAccesoRecomendacionesEstudiante,
} = require('../services/academicRecommendationAuthorizationService');

const {
  consultarRecomendacionesEstudiante,
  consultarRecomendacionPorId,
} = require('../services/academicRecommendationQueryService');

// ======================================================
// VALIDACIONES
// ======================================================

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validarEstudianteId = (estudianteId) => {
  return (
    typeof estudianteId === 'string' &&
    UUID_REGEX.test(estudianteId)
  );
};

const validarRecomendacionId = (recomendacionId) => {
  const id = Number(recomendacionId);

  return (
    Number.isSafeInteger(id) &&
    id > 0
  );
};

// ======================================================
// AUTORIZACIÓN
// ======================================================

const comprobarAutorizacion = async ({
  usuario,
  estudianteId,
}) => {
  return verificarAccesoRecomendacionesEstudiante({
    usuario,
    estudianteId,
  });
};

// ======================================================
// CONSULTAR HISTORIAL DE RECOMENDACIONES
// ======================================================

const listarRecomendacionesEstudiante = async (
  req,
  res
) => {
  try {
    const { estudianteId } = req.params;

    if (!validarEstudianteId(estudianteId)) {
      return res.status(400).json({
        success: false,
        message:
          'El identificador del estudiante es inválido.',
      });
    }

    // La identidad debe provenir de verificarToken.
    if (!req.usuario) {
      return res.status(401).json({
        success: false,
        message:
          'Usuario no autenticado.',
      });
    }

    // Verificar autorización antes de consultar.
    const autorizacion =
      await comprobarAutorizacion({
        usuario: req.usuario,
        estudianteId,
      });

    if (!autorizacion.autorizado) {
      return res.status(403).json({
        success: false,
        message:
          'No tiene permisos para consultar estas recomendaciones.',
      });
    }

    // Consultar historial en Supabase.
    const resultado =
      await consultarRecomendacionesEstudiante({
        estudianteId,
        limite: 20,
      });

    return res.status(200).json({
      success: true,
      message:
        'Recomendaciones académicas consultadas correctamente.',
      data: resultado,
    });
  } catch (error) {
    console.error(
      '[HU-11] Error consultando recomendaciones:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'No fue posible consultar las recomendaciones académicas.',
    });
  }
};

// ======================================================
// CONSULTAR UNA RECOMENDACIÓN ESPECÍFICA
// ======================================================

const obtenerRecomendacionEstudiante = async (
  req,
  res
) => {
  try {
    const {
      estudianteId,
      recomendacionId,
    } = req.params;

    if (!validarEstudianteId(estudianteId)) {
      return res.status(400).json({
        success: false,
        message:
          'El identificador del estudiante es inválido.',
      });
    }

    if (!validarRecomendacionId(recomendacionId)) {
      return res.status(400).json({
        success: false,
        message:
          'El identificador de la recomendación es inválido.',
      });
    }

    if (!req.usuario) {
      return res.status(401).json({
        success: false,
        message:
          'Usuario no autenticado.',
      });
    }

    // Verificar autorización antes de consultar.
    const autorizacion =
      await comprobarAutorizacion({
        usuario: req.usuario,
        estudianteId,
      });

    if (!autorizacion.autorizado) {
      return res.status(403).json({
        success: false,
        message:
          'No tiene permisos para consultar esta recomendación.',
      });
    }

    const recomendacion =
      await consultarRecomendacionPorId({
        estudianteId,
        recomendacionId,
      });

    if (!recomendacion) {
      return res.status(404).json({
        success: false,
        message:
          'La recomendación académica no fue encontrada.',
      });
    }

    return res.status(200).json({
      success: true,
      message:
        'Recomendación académica consultada correctamente.',
      data: recomendacion,
    });
  } catch (error) {
    console.error(
      '[HU-11] Error consultando recomendación:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'No fue posible consultar la recomendación académica.',
    });
  }
};

// ======================================================
// EXPORTACIÓN
// ======================================================

module.exports = {
  listarRecomendacionesEstudiante,
  obtenerRecomendacionEstudiante,
};
