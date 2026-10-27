'use strict';

// ======================================================
// AULA-AI | HU-12
// CONTROLADOR DE NOTIFICACIONES INSTITUCIONALES
// ======================================================

// ======================================================
// SERVICIOS
// ======================================================

const {
  consultarMisNotificaciones,
} = require('../services/notificacionConsultaService');

const {
  registrarLecturaNotificacion,
} = require('../services/notificacionLecturaService');

// ======================================================
// RESPUESTAS DE ERROR
// ======================================================

const responderError = (res, codigo, mensaje) => {
  return res.status(codigo).json({
    success: false,
    message: mensaje,
  });
};

// ======================================================
// 1. CONSULTAR MIS NOTIFICACIONES
//
// GET /api/notificaciones
// ======================================================

const listarMisNotificaciones = async (req, res) => {
  try {
    const usuarioId = req.usuario?.id;

    if (!usuarioId) {
      return responderError(
        res,
        401,
        'Debes iniciar sesión para consultar tus notificaciones.'
      );
    }

    const {
      pagina = 1,
      limite = 20,
    } = req.query;

    const resultado = await consultarMisNotificaciones({
      usuarioId,
      pagina,
      limite,
    });

    return res.status(200).json({
      success: true,
      message: 'Notificaciones consultadas correctamente.',
      data: resultado.notificaciones,
      paginacion: resultado.paginacion,
    });
  } catch (error) {
    console.error(
      '[HU-12] Error consultando notificaciones:',
      error.message
    );

    if (error.statusCode === 400) {
      return responderError(
        res,
        400,
        error.message
      );
    }

    return responderError(
      res,
      500,
      'Ocurrió un error al consultar las notificaciones.'
    );
  }
};

// ======================================================
// 2. MARCAR NOTIFICACION COMO LEIDA
//
// POST /api/notificaciones/:id/lectura
// ======================================================

const marcarNotificacionComoLeida = async (req, res) => {
  try {
    // --------------------------------------------------
    // VALIDAR USUARIO AUTENTICADO
    // --------------------------------------------------

    const usuarioId = req.usuario?.id;

    if (!usuarioId) {
      return responderError(
        res,
        401,
        'Debes iniciar sesión para marcar una notificación como leída.'
      );
    }

    // --------------------------------------------------
    // OBTENER IDENTIFICADOR DE NOTIFICACION
    // --------------------------------------------------

    const notificacionId = req.params.id;

    // --------------------------------------------------
    // REGISTRAR LECTURA
    // --------------------------------------------------

    const notificacion = await registrarLecturaNotificacion({
      notificacionId,
      usuarioId,
    });

    // --------------------------------------------------
    // RESPUESTA EXITOSA
    // --------------------------------------------------

    return res.status(200).json({
      success: true,
      message: 'Notificación marcada como leída correctamente.',
      data: notificacion,
    });
  } catch (error) {
    console.error(
      '[HU-12] Error registrando lectura de notificación:',
      error.message
    );

    if (error.statusCode === 400) {
      return responderError(
        res,
        400,
        error.message
      );
    }

    if (error.statusCode === 401) {
      return responderError(
        res,
        401,
        error.message
      );
    }

    if (error.statusCode === 404) {
      return responderError(
        res,
        404,
        error.message
      );
    }

    return responderError(
      res,
      500,
      'Ocurrió un error al registrar la lectura de la notificación.'
    );
  }
};

// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {
  listarMisNotificaciones,
  marcarNotificacionComoLeida,
};
