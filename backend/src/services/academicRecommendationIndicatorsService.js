'use strict';

const {
  supabaseAdmin,
} = require('../config/supabase');

/**
 * HU-11
 * Servicio de indicadores académicos.
 *
 * Segunda implementación:
 * - Verificar estudiante.
 * - Consultar calificaciones registradas.
 * - Identificar materias y periodos.
 * - Calcular promedios simples.
 *
 * No genera recomendaciones todavía.
 * No llama a OpenAI.
 * No modifica registros.
 */

const obtenerIndicadoresAcademicos = async ({
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

  // 1. Verificar estudiante.
  const {
    data: estudiante,
    error: errorEstudiante,
  } = await supabaseAdmin
    .from('estudiantes')
    .select('usuario_id, grado_id, grupo_id')
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

  // 2. Consultar calificaciones registradas.
  const {
    data: calificaciones,
    error: errorCalificaciones,
  } = await supabaseAdmin
    .from('calificaciones')
    .select('id, actividad_id, valor, estado')
    .eq('estudiante_id', estudianteId)
    .eq('estado', 'registrada');

  if (errorCalificaciones) {
    throw new Error(
      `Error consultando calificaciones: ${errorCalificaciones.message}`
    );
  }

  const registrosValidos = (calificaciones || [])
    .filter(
      (registro) =>
        registro.valor !== null &&
        registro.valor !== undefined &&
        registro.valor !== '' &&
        Number.isFinite(Number(registro.valor))
    )
    .map((registro) => ({
      actividadId: registro.actividad_id,
      valor: Number(registro.valor),
    }));

  const promedioSimple = (valores) => {
    if (!valores.length) {
      return null;
    }

    const suma = valores.reduce(
      (acumulado, valor) => acumulado + valor,
      0
    );

    return Number((suma / valores.length).toFixed(2));
  };

  // 3. Consultar actividades asociadas.
  const actividadIds = [
    ...new Set(
      registrosValidos.map(
        (registro) => registro.actividadId
      )
    ),
  ];

  let actividades = [];

  if (actividadIds.length > 0) {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from('actividades_academicas')
      .select('id, materia_grupo_periodo_id')
      .in('id', actividadIds);

    if (error) {
      throw new Error(
        `Error consultando actividades: ${error.message}`
      );
    }

    actividades = data || [];
  }

  // 4. Consultar asignaciones académicas.
  const asignacionIds = [
    ...new Set(
      actividades.map(
        (actividad) =>
          actividad.materia_grupo_periodo_id
      )
    ),
  ];

  let asignaciones = [];

  if (asignacionIds.length > 0) {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from('materia_grupo_periodo')
      .select('id, materia_id, periodo_id, grado_id, grupo_id')
      .in('id', asignacionIds);

    if (error) {
      throw new Error(
        `Error consultando asignaciones: ${error.message}`
      );
    }

    asignaciones = data || [];
  }

  // 5. Consultar nombres de materias.
  const materiaIds = [
    ...new Set(
      asignaciones.map(
        (asignacion) => asignacion.materia_id
      )
    ),
  ];

  let materias = [];

  if (materiaIds.length > 0) {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from('materias')
      .select('id, nombre')
      .in('id', materiaIds);

    if (error) {
      throw new Error(
        `Error consultando materias: ${error.message}`
      );
    }

    materias = data || [];
  }

  // 6. Consultar periodos académicos.
  const periodoIds = [
    ...new Set(
      asignaciones.map(
        (asignacion) => asignacion.periodo_id
      )
    ),
  ];

  let periodos = [];

  if (periodoIds.length > 0) {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from('periodos_academicos')
      .select('id, nombre')
      .in('id', periodoIds);

    if (error) {
      throw new Error(
        `Error consultando periodos: ${error.message}`
      );
    }

    periodos = data || [];
  }

  // 7. Construir mapas de consulta.
  const actividadesMap = new Map(
    actividades.map((item) => [item.id, item])
  );

  const asignacionesMap = new Map(
    asignaciones.map((item) => [item.id, item])
  );

  const materiasMap = new Map(
    materias.map((item) => [item.id, item])
  );

  const periodosMap = new Map(
    periodos.map((item) => [item.id, item])
  );

  // 8. Agrupar calificaciones por materia y periodo.
  const agrupaciones = new Map();

  for (const registro of registrosValidos) {
    const actividad = actividadesMap.get(
      registro.actividadId
    );

    if (!actividad) {
      continue;
    }

    const asignacion = asignacionesMap.get(
      actividad.materia_grupo_periodo_id
    );

    if (!asignacion) {
      continue;
    }

    // Verificar que la asignación corresponda
    // al grado y grupo actual del estudiante.
    if (
      asignacion.grado_id !== estudiante.grado_id ||
      asignacion.grupo_id !== estudiante.grupo_id
    ) {
      continue;
    }

    const materia = materiasMap.get(
      asignacion.materia_id
    );

    const periodo = periodosMap.get(
      asignacion.periodo_id
    );

    if (!materia || !periodo) {
      continue;
    }

    const clave = `${materia.id}:${periodo.id}`;

    if (!agrupaciones.has(clave)) {
      agrupaciones.set(clave, {
        materiaId: materia.id,
        materia: materia.nombre,
        periodoId: periodo.id,
        periodo: periodo.nombre,
        valores: [],
      });
    }

    agrupaciones.get(clave).valores.push(
      registro.valor
    );
  }

  const resumenMaterias = Array.from(
    agrupaciones.values()
  ).map((grupo) => ({
    materiaId: grupo.materiaId,
    materia: grupo.materia,
    periodoId: grupo.periodoId,
    periodo: grupo.periodo,
    cantidadCalificaciones: grupo.valores.length,
    promedioCalificacionesDisponibles:
      promedioSimple(grupo.valores),
  }));

  // 9. Calcular el promedio simple de todas
  // las calificaciones registradas.
  const valoresGenerales = registrosValidos.map(
    (registro) => registro.valor
  );

  return {
    encontrado: true,
    estudianteId: estudiante.usuario_id,

    indicadores: {
      cantidadCalificaciones: registrosValidos.length,

      promedioCalificacionesDisponibles:
        promedioSimple(valoresGenerales),

      materias: resumenMaterias,
    },

    informacionDisponible: {
      tieneCalificaciones: registrosValidos.length > 0,
      tieneMaterias: resumenMaterias.length > 0,
    },
  };
};

module.exports = {
  obtenerIndicadoresAcademicos,
};
