'use strict';

// ======================================================
// AULA-AI | HU-11
// GENERACIÓN SEGURA DE RECOMENDACIONES ACADÉMICAS
// INTELIGENCIA ARTIFICIAL: GOOGLE GEMINI FLASH-LITE
// ======================================================

const {
  verificarAccesoRecomendacionesEstudiante,
} = require(
  '../services/academicRecommendationAuthorizationService'
);

const {
  obtenerContextoAcademicoEstudiante,
} = require(
  '../services/academicStudentContextService'
);

// ======================================================
// MOTOR DE INTELIGENCIA ARTIFICIAL GEMINI
// ======================================================

const {
  generarRecomendacionesAcademicas,
} = require('../services/academicGeminiService');

// ======================================================
// PERSISTENCIA DE RECOMENDACIONES
// ======================================================

const {
  guardarRecomendacionAcademica,
} = require(
  '../services/academicRecommendationPersistenceService'
);

// ======================================================
// VALIDACIONES
// ======================================================

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const enteroSeguro = (valor) => {
  return Number.isSafeInteger(valor) && valor >= 0
    ? valor
    : 0;
};

const numeroSeguro = (valor) => {
  return typeof valor === 'number' &&
    Number.isFinite(valor)
    ? valor
    : null;
};

// ======================================================
// PREPARAR CONTEXTO ACADÉMICO PARA GEMINI
// ======================================================
//
// Solo se envían indicadores académicos agregados.
//
// No se incluyen:
// - Identificadores del estudiante
// - Nombres o apellidos
// - Documentos
// - Correos electrónicos
// - Teléfonos
// - Observaciones libres
//
// ======================================================

const prepararContextoIA = (indicadores) => {
  const calificaciones =
    indicadores.calificaciones || {};

  const actividades =
    indicadores.actividades || {};

  const asistencia =
    indicadores.asistencia || {};

  const riesgos =
    indicadores.riesgos || {};

  return {
    calificaciones: {
      cantidadCalificaciones: enteroSeguro(
        calificaciones.cantidadCalificaciones
      ),

      promedioCalificacionesDisponibles:
        numeroSeguro(
          calificaciones
            .promedioCalificacionesDisponibles
        ),
    },

    actividades: {
      totalPendientes: enteroSeguro(
        actividades.totalPendientes
      ),

      totalVencidas: enteroSeguro(
        actividades.totalVencidas
      ),

      totalEnPlazo: enteroSeguro(
        actividades.totalEnPlazo
      ),
    },

    asistencia: {
      hayRegistros:
        enteroSeguro(asistencia.totalRegistros) > 0,

      totalAusencias: enteroSeguro(
        asistencia.totalAusencias
      ),

      totalLlegadasTarde: enteroSeguro(
        asistencia.totalLlegadasTarde
      ),
    },

    riesgos: {
      totalPendientesAtencion: enteroSeguro(
        riesgos.totalPendientesAtencion
      ),

      pendientesPorNivel: {
        alta: enteroSeguro(
          riesgos.alertasPendientesPorNivel?.alta
        ),

        media: enteroSeguro(
          riesgos.alertasPendientesPorNivel?.media
        ),

        baja: enteroSeguro(
          riesgos.alertasPendientesPorNivel?.baja
        ),
      },
    },
  };
};

// ======================================================
// GENERAR RECOMENDACIÓN ACADÉMICA
// ======================================================

const generarRecomendacionEstudiante = async (
  req,
  res
) => {
  try {
    const { estudianteId } = req.params;

    // --------------------------------------------------
    // 1. VALIDAR IDENTIFICADOR
    // --------------------------------------------------

    if (
      typeof estudianteId !== 'string' ||
      !UUID_REGEX.test(estudianteId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'El identificador del estudiante es inválido.',
      });
    }

    // --------------------------------------------------
    // 2. VERIFICAR AUTENTICACIÓN
    // --------------------------------------------------

    if (!req.usuario) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado.',
      });
    }

    // --------------------------------------------------
    // 3. VERIFICAR AUTORIZACIÓN
    // --------------------------------------------------

    const autorizacion =
      await verificarAccesoRecomendacionesEstudiante({
        usuario: req.usuario,
        estudianteId,
      });

    if (!autorizacion.autorizado) {
      return res.status(403).json({
        success: false,
        message:
          'No tiene autorización para generar recomendaciones de este estudiante.',
      });
    }

    // --------------------------------------------------
    // 4. CONSULTAR INDICADORES ACADÉMICOS
    // --------------------------------------------------

    const contexto =
      await obtenerContextoAcademicoEstudiante({
        estudianteId,
      });

    if (!contexto.encontrado) {
      return res.status(404).json({
        success: false,
        message:
          'No se encontró información académica del estudiante.',
      });
    }

    // --------------------------------------------------
    // 5. PREPARAR INDICADORES ANONIMIZADOS
    // --------------------------------------------------

    const contextoIA = prepararContextoIA(
      contexto.indicadores
    );

    // --------------------------------------------------
    // 6. GENERAR MEDIANTE GEMINI O RESPALDO
    // --------------------------------------------------

    const resultado =
      await generarRecomendacionesAcademicas(
        contextoIA
      );

    // --------------------------------------------------
    // 7. VALIDAR RESULTADO
    // --------------------------------------------------

    if (
      !resultado ||
      !Array.isArray(resultado.recomendaciones) ||
      resultado.recomendaciones.length === 0
    ) {
      return res.status(422).json({
        success: false,
        message:
          'No existen indicadores suficientes para generar recomendaciones académicas.',
      });
    }

    // --------------------------------------------------
    // 8. GUARDAR EN SUPABASE
    // --------------------------------------------------

    const recomendacion =
      await guardarRecomendacionAcademica({
        estudianteId,
        alertaId: null,
        contextoIA,
        resultado,
      });

    // --------------------------------------------------
    // 9. RESPONDER A LA APLICACIÓN MÓVIL
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      message: recomendacion.registroExistente
        ? 'Se recuperó una recomendación previamente almacenada.'
        : resultado.origen === 'ia'
          ? 'Recomendación generada con Gemini y guardada correctamente.'
          : 'Se generó una recomendación académica mediante el sistema de respaldo.',

      data: recomendacion,
    });

  } catch (error) {
    console.error(
      '[HU-11] Fallo al generar recomendación:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        'No fue posible generar o guardar la recomendación académica.',
    });
  }
};

module.exports = {
  generarRecomendacionEstudiante,
};
