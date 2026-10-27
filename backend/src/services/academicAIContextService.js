'use strict';

/**
 * HU-11
 * Preparación de indicadores académicos para IA.
 *
 * IMPORTANTE:
 * - No consulta Supabase.
 * - No llama a OpenAI.
 * - No modifica registros.
 * - No envía identificadores personales.
 * - No incluye nombres, correos, documentos,
 *   títulos de actividades ni observaciones.
 *
 * Construye un objeto nuevo mediante una
 * lista explícita de campos permitidos.
 */

const numeroValido = (valor) => {
  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    return null;
  }

  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : null;
};

const contador = (valor) => {
  const numero = numeroValido(valor);

  return numero !== null && numero >= 0
    ? Math.floor(numero)
    : 0;
};

const prepararContextoParaIA = (contexto) => {
  if (
    !contexto ||
    contexto.encontrado !== true ||
    !contexto.indicadores
  ) {
    throw new Error(
      'El contexto académico no es válido.'
    );
  }

  const {
    calificaciones = {},
    actividades = {},
    asistencia = {},
    riesgos = {},
  } = contexto.indicadores;

  // 1. Resumen de calificaciones.
  const resumenCalificaciones = {
    cantidadCalificaciones: contador(
      calificaciones.cantidadCalificaciones
    ),

    promedioDisponible: numeroValido(
      calificaciones.promedioCalificacionesDisponibles
    ),
  };

  // 2. Materias sin nombres ni identificadores.
  const materias = Array.isArray(
    calificaciones.materias
  )
    ? calificaciones.materias
    : [];

  const resumenMaterias = materias.map(
    (materia, indice) => ({
      referencia: `materia_${indice + 1}`,

      cantidadCalificaciones: contador(
        materia.cantidadCalificaciones
      ),

      promedioDisponible: numeroValido(
        materia.promedioCalificacionesDisponibles
      ),
    })
  );

  // 3. Actividades sin títulos ni fechas exactas.
  const resumenActividades = {
    totalPendientes: contador(
      actividades.totalPendientes
    ),

    totalVencidas: contador(
      actividades.totalVencidas
    ),

    totalEnPlazo: contador(
      actividades.totalEnPlazo
    ),
  };

  // 4. Asistencia sin datos personales.
  const resumenAsistencia = {
    hayRegistros: contador(
      asistencia.totalRegistros
    ) > 0,

    totalRegistros: contador(
      asistencia.totalRegistros
    ),

    totalAusencias: contador(
      asistencia.totalAusencias
    ),

    totalLlegadasTarde: contador(
      asistencia.totalLlegadasTarde
    ),
  };

  // 5. Alertas: solo cantidades y niveles.
  const resumenRiesgos = {
    totalActivas: contador(
      riesgos.totalActivas
    ),

    totalEnSeguimiento: contador(
      riesgos.totalEnSeguimiento
    ),

    totalPendientesAtencion: contador(
      riesgos.totalPendientesAtencion
    ),

    pendientesPorNivel: {
      baja: contador(
        riesgos.alertasPendientesPorNivel?.baja
      ),

      media: contador(
        riesgos.alertasPendientesPorNivel?.media
      ),

      alta: contador(
        riesgos.alertasPendientesPorNivel?.alta
      ),
    },
  };

  // 6. Devolver exclusivamente datos permitidos.
  return {
    versionContexto: 1,

    calificaciones: resumenCalificaciones,

    materias: resumenMaterias,

    actividades: resumenActividades,

    asistencia: resumenAsistencia,

    riesgos: resumenRiesgos,

    restricciones: {
      promedioEsOficial: false,

      clasificacionAprobacionDisponible: false,

      porcentajeAsistenciaDisponible: false,

      usarSoloDatosProporcionados: true,

      noInventarCalificaciones: true,

      noInventarFechas: true,

      noEmitirDecisionesDefinitivas: true,
    },
  };
};

module.exports = {
  prepararContextoParaIA,
};
