'use strict';

const {
  obtenerIndicadoresAcademicos,
} = require('./academicRecommendationIndicatorsService');

const {
  obtenerActividadesPendientes,
} = require('./academicPendingActivitiesService');

const {
  obtenerIndicadoresAsistencia,
} = require('./academicAttendanceIndicatorsService');

const {
  obtenerIndicadoresRiesgo,
} = require('./academicRiskIndicatorsService');

/**
 * HU-11
 * Contexto académico unificado del estudiante.
 *
 * Integra:
 * - Calificaciones y materias.
 * - Actividades pendientes.
 * - Asistencia y puntualidad.
 * - Alertas académicas de HU-10.
 *
 * No genera recomendaciones.
 * No utiliza OpenAI.
 * No modifica información académica.
 */

const obtenerContextoAcademicoEstudiante = async ({
  estudianteId,
}) => {
  if (
    typeof estudianteId !== 'string' ||
    !estudianteId.trim()
  ) {
    throw new Error(
      'El identificador del estudiante es obligatorio.'
    );
  }

  // 1. Consultar calificaciones y materias.
  const indicadoresAcademicos =
    await obtenerIndicadoresAcademicos({
      estudianteId,
    });

  if (!indicadoresAcademicos.encontrado) {
    return {
      encontrado: false,
      motivo:
        indicadoresAcademicos.motivo ||
        'ESTUDIANTE_NO_ENCONTRADO',
    };
  }

  // 2. Consultar actividades pendientes.
  const actividadesPendientes =
    await obtenerActividadesPendientes({
      estudianteId,
    });

  if (!actividadesPendientes.encontrado) {
    return {
      encontrado: false,
      motivo:
        actividadesPendientes.motivo ||
        'ESTUDIANTE_NO_ENCONTRADO',
    };
  }

  // 3. Consultar asistencia y puntualidad.
  const asistencia =
    await obtenerIndicadoresAsistencia({
      estudianteId,
    });

  if (!asistencia.encontrado) {
    return {
      encontrado: false,
      motivo:
        asistencia.motivo ||
        'ESTUDIANTE_NO_ENCONTRADO',
    };
  }

  // 4. Consultar alertas académicas.
  const riesgos =
    await obtenerIndicadoresRiesgo({
      estudianteId,
    });

  if (!riesgos.encontrado) {
    return {
      encontrado: false,
      motivo:
        riesgos.motivo ||
        'ESTUDIANTE_NO_ENCONTRADO',
    };
  }

  // 5. Construir contexto académico unificado.
  return {
    encontrado: true,

    estudianteId,

    indicadores: {
      calificaciones:
        indicadoresAcademicos.indicadores,

      actividades: {
        totalPendientes:
          actividadesPendientes.totalPendientes,

        totalVencidas:
          actividadesPendientes.totalVencidas,

        totalEnPlazo:
          actividadesPendientes.totalEnPlazo,

        detalle:
          actividadesPendientes.actividades,
      },

      asistencia:
        asistencia.indicadores,

      riesgos:
        riesgos.indicadores,
    },

    informacionDisponible: {
      tieneCalificaciones:
        indicadoresAcademicos.informacionDisponible
          .tieneCalificaciones,

      tieneMaterias:
        indicadoresAcademicos.informacionDisponible
          .tieneMaterias,

      tieneActividadesPendientes:
        actividadesPendientes.totalPendientes > 0,

      tieneRegistrosAsistencia:
        asistencia.informacionDisponible
          .tieneRegistrosAsistencia,

      tieneAlertasRegistradas:
        riesgos.informacionDisponible
          .tieneAlertasRegistradas,

      tieneAlertasPendientes:
        riesgos.informacionDisponible
          .tieneAlertasPendientes,
    },
  };
};

module.exports = {
  obtenerContextoAcademicoEstudiante,
};
