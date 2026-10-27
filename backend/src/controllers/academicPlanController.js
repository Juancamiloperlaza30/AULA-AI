'use strict';

// ======================================================
// AULA-AI | HU-11
// CONTROLADOR DE PLANES DE ACOMPAÑAMIENTO
// ======================================================

const {
  verificarPermisoConsultaPlan,
} = require('../services/academicPlanReadAuthorizationService');

const {
  consultarPlanesEstudiante,
  consultarPlanPorId,
} = require('../services/academicPlanQueryService');

const {
  crearPlanAcompanamiento,
} = require('../services/academicPlanCreationService');

const {
  actualizarPlanAcompanamiento,
} = require('../services/academicPlanUpdateService');

// ======================================================
// VALIDACIONES
// ======================================================

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validarEstudianteId = (valor) =>
  typeof valor === 'string' &&
  UUID_REGEX.test(valor);

const convertirIdPositivo = (valor) => {
  if (
    typeof valor !== 'string' ||
    !/^[1-9]\d*$/.test(valor)
  ) {
    return null;
  }

  const numero = Number(valor);

  return Number.isSafeInteger(numero)
    ? numero
    : null;
};

const esObjeto = (valor) =>
  valor !== null &&
  typeof valor === 'object' &&
  !Array.isArray(valor);

// ======================================================
// MANEJO DE ERRORES
// ======================================================

const responderError = (res, error, operacion) => {
  const codigo = error.codigo;

  let estado = 500;
  let mensaje =
    'Ocurrió un error al gestionar el plan académico.';

  if (codigo === 'ACCESO_DENEGADO') {
    estado = 403;
    mensaje =
      'No tiene permisos para realizar esta operación.';
  } else if (codigo === 'DATOS_INVALIDOS') {
    estado = 400;
    mensaje = error.message;
  } else if (
    codigo === 'RECOMENDACION_NO_ENCONTRADA' ||
    codigo === 'ALERTA_NO_ENCONTRADA' ||
    codigo === 'PLAN_NO_ENCONTRADO'
  ) {
    estado = 404;
    mensaje = error.message;
  } else if (
    codigo === 'TRANSICION_INVALIDA' ||
    codigo === 'PLAN_FINALIZADO' ||
    codigo === 'CONFLICTO_ACTUALIZACION' ||
    codigo === 'CIERRE_INCOMPLETO'
  ) {
    estado = 409;
    mensaje = error.message;
  } else if (
    typeof error.message === 'string' &&
    (
      error.message.includes('inválid') ||
      error.message.includes('invalido') ||
      error.message.includes('obligatorio') ||
      error.message.includes('arreglo') ||
      error.message.includes(
        'La fecha de seguimiento no puede ser anterior'
      )
    )
  ) {
    estado = 400;
    mensaje = error.message;
  }

  if (estado === 500) {
    console.error(
      `[HU-11] Error en ${operacion}:`,
      error
    );
  }

  return res.status(estado).json({
    success: false,
    message: mensaje,
  });
};

// ======================================================
// CONSULTAR PLANES DE UN ESTUDIANTE
// ======================================================

const listarPlanesEstudiante = async (req, res) => {
  try {
    const { estudianteId } = req.params;

    if (!validarEstudianteId(estudianteId)) {
      return res.status(400).json({
        success: false,
        message:
          'El identificador del estudiante es inválido.',
      });
    }

    if (!req.usuario) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado.',
      });
    }

    const permiso =
      await verificarPermisoConsultaPlan({
        usuario: req.usuario,
        estudianteId,
      });

    if (!permiso.autorizado) {
      return res.status(403).json({
        success: false,
        message:
          'No tiene permisos para consultar estos planes.',
      });
    }

    const estado = req.query.estado ?? null;

    if (
      estado !== null &&
      ![
        'propuesto',
        'en_seguimiento',
        'completado',
        'cancelado',
      ].includes(estado)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'El filtro de estado es inválido.',
      });
    }

    const planes = await consultarPlanesEstudiante({
      estudianteId,
      estado,
      limite: 20,
    });

    return res.status(200).json({
      success: true,
      message:
        'Planes académicos consultados correctamente.',
      data: planes,
    });

  } catch (error) {
    return responderError(
      res,
      error,
      'consulta de planes'
    );
  }
};

// ======================================================
// CONSULTAR UN PLAN ESPECÍFICO
// ======================================================

const obtenerPlanEstudiante = async (req, res) => {
  try {
    const {
      estudianteId,
      planId: planIdTexto,
    } = req.params;

    if (!validarEstudianteId(estudianteId)) {
      return res.status(400).json({
        success: false,
        message:
          'El identificador del estudiante es inválido.',
      });
    }

    const planId = convertirIdPositivo(planIdTexto);

    if (planId === null) {
      return res.status(400).json({
        success: false,
        message:
          'El identificador del plan es inválido.',
      });
    }

    if (!req.usuario) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado.',
      });
    }

    const permiso =
      await verificarPermisoConsultaPlan({
        usuario: req.usuario,
        estudianteId,
      });

    if (!permiso.autorizado) {
      return res.status(403).json({
        success: false,
        message:
          'No tiene permisos para consultar este plan.',
      });
    }

    const plan = await consultarPlanPorId({
      estudianteId,
      planId,
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message:
          'El plan académico no fue encontrado.',
      });
    }

    return res.status(200).json({
      success: true,
      message:
        'Plan académico consultado correctamente.',
      data: plan,
    });

  } catch (error) {
    return responderError(
      res,
      error,
      'consulta de plan'
    );
  }
};

// ======================================================
// CREAR PLAN DE ACOMPAÑAMIENTO
// ======================================================

const registrarPlanAcompanamiento = async (req, res) => {
  try {
    const { estudianteId } = req.params;

    if (!validarEstudianteId(estudianteId)) {
      return res.status(400).json({
        success: false,
        message:
          'El identificador del estudiante es inválido.',
      });
    }

    if (!req.usuario) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado.',
      });
    }

    if (!esObjeto(req.body)) {
      return res.status(400).json({
        success: false,
        message:
          'Debe proporcionar los datos del plan.',
      });
    }

    const {
      recomendacionId,
      alertaId = null,
      objetivo,
      acciones = [],
      indicadoresProgreso = [],
      prioridad = 'media',
      fechaSeguimiento = null,
      observacionesOrientador = null,
    } = req.body;

    const plan = await crearPlanAcompanamiento({
      usuario: req.usuario,
      estudianteId,
      recomendacionId,
      alertaId,
      objetivo,
      acciones,
      indicadoresProgreso,
      prioridad,
      fechaSeguimiento,
      observacionesOrientador,
    });

    return res.status(201).json({
      success: true,
      message:
        'Plan de acompañamiento creado correctamente.',
      data: plan,
    });

  } catch (error) {
    return responderError(
      res,
      error,
      'creación de plan'
    );
  }
};

// ======================================================
// ACTUALIZAR PLAN DE ACOMPAÑAMIENTO
// ======================================================

const modificarPlanAcompanamiento = async (req, res) => {
  try {
    const {
      estudianteId,
      planId: planIdTexto,
    } = req.params;

    if (!validarEstudianteId(estudianteId)) {
      return res.status(400).json({
        success: false,
        message:
          'El identificador del estudiante es inválido.',
      });
    }

    const planId = convertirIdPositivo(planIdTexto);

    if (planId === null) {
      return res.status(400).json({
        success: false,
        message:
          'El identificador del plan es inválido.',
      });
    }

    if (!req.usuario) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado.',
      });
    }

    if (!esObjeto(req.body)) {
      return res.status(400).json({
        success: false,
        message:
          'Debe proporcionar los cambios del plan.',
      });
    }

    const plan = await actualizarPlanAcompanamiento({
      usuario: req.usuario,
      estudianteId,
      planId,
      cambios: req.body,
    });

    return res.status(200).json({
      success: true,
      message:
        'Plan de acompañamiento actualizado correctamente.',
      data: plan,
    });

  } catch (error) {
    return responderError(
      res,
      error,
      'actualización de plan'
    );
  }
};

// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {
  listarPlanesEstudiante,
  obtenerPlanEstudiante,
  registrarPlanAcompanamiento,
  modificarPlanAcompanamiento,
};
