'use strict';

const { supabaseAdmin } = require('../config/supabase');

/**
 * HU-11
 * Indicadores académicos de asistencia y puntualidad.
 *
 * Funcionalidades:
 * - Verificar la existencia del estudiante.
 * - Consultar sus registros de asistencia.
 * - Contar asistencias, ausencias y llegadas tarde.
 * - Identificar el intervalo de fechas registrado.
 *
 * No modifica información.
 * No utiliza OpenAI.
 * No establece porcentajes ni umbrales de riesgo.
 */

const obtenerIndicadoresAsistencia = async ({
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

  // 1. Verificar que el estudiante exista.
  const {
    data: estudiante,
    error: errorEstudiante,
  } = await supabaseAdmin
    .from('estudiantes')
    .select('usuario_id')
    .eq('usuario_id', estudianteId)
    .maybeSingle();

  if (errorEstudiante) {
    throw new Error(
      `Error consultando estudiante: ${errorEstudiante.message}`
    );
  }

  if (!estudiante) {
    return {
      encontrado: false,
      motivo: 'ESTUDIANTE_NO_ENCONTRADO',
    };
  }

  // 2. Consultar registros de asistencia.
  const {
    data: asistencias,
    error: errorAsistencias,
  } = await supabaseAdmin
    .from('asistencias')
    .select('id, fecha, estado')
    .eq('estudiante_id', estudianteId)
    .order('fecha', { ascending: true });

  if (errorAsistencias) {
    throw new Error(
      `Error consultando asistencias: ${errorAsistencias.message}`
    );
  }

  const registros = asistencias || [];

  // 3. Inicializar contadores.
  const resumen = {
    presente: 0,
    ausente: 0,
    tarde: 0,
    otrosEstados: 0,
  };

  // 4. Contar los registros según su estado.
  for (const registro of registros) {
    const estado = String(
      registro.estado || ''
    )
      .trim()
      .toLowerCase();

    if (estado === 'presente') {
      resumen.presente += 1;
    } else if (estado === 'ausente') {
      resumen.ausente += 1;
    } else if (estado === 'tarde') {
      resumen.tarde += 1;
    } else {
      resumen.otrosEstados += 1;
    }
  }

  // 5. Identificar fechas disponibles.
  const fechas = registros
    .map((registro) => registro.fecha)
    .filter(Boolean);

  const primeraFecha = fechas.length
    ? fechas[0]
    : null;

  const ultimaFecha = fechas.length
    ? fechas[fechas.length - 1]
    : null;

  // 6. Devolver indicadores académicos.
  return {
    encontrado: true,

    estudianteId: estudiante.usuario_id,

    indicadores: {
      totalRegistros: registros.length,

      totalPresentes: resumen.presente,

      totalAusencias: resumen.ausente,

      totalLlegadasTarde: resumen.tarde,

      totalOtrosEstados: resumen.otrosEstados,

      primeraFecha,

      ultimaFecha,
    },

    informacionDisponible: {
      tieneRegistrosAsistencia:
        registros.length > 0,
    },
  };
};

module.exports = {
  obtenerIndicadoresAsistencia,
};
