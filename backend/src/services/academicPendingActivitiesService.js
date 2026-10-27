'use strict';

const { supabaseAdmin } = require('../config/supabase');

/**
 * HU-11
 * Consulta actividades publicadas del estudiante
 * y clasifica las que no tienen una entrega válida.
 *
 * No modifica registros.
 * No utiliza OpenAI.
 */

const obtenerActividadesPendientes = async ({
  estudianteId,
}) => {
  if (!estudianteId || typeof estudianteId !== 'string') {
    throw new Error('El identificador del estudiante es obligatorio.');
  }

  // 1. Consultar grado y grupo del estudiante.
  const { data: estudiante, error: errorEstudiante } =
    await supabaseAdmin
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

  // 2. Consultar periodos activos y en curso.
  const { data: periodos, error: errorPeriodos } =
    await supabaseAdmin
      .from('periodos_academicos')
      .select('id')
      .eq('activo', true)
      .eq('estado_academico', 'en_curso');

  if (errorPeriodos) {
    throw new Error(
      `Error consultando periodos: ${errorPeriodos.message}`
    );
  }

  const periodoIds = (periodos || []).map((p) => p.id);

  if (!periodoIds.length) {
    return {
      encontrado: true,
      totalPendientes: 0,
      totalVencidas: 0,
      totalEnPlazo: 0,
      actividades: [],
    };
  }

  // 3. Consultar asignaciones del grado y grupo.
  const { data: asignaciones, error: errorAsignaciones } =
    await supabaseAdmin
      .from('materia_grupo_periodo')
      .select('id, materia_id')
      .eq('grado_id', estudiante.grado_id)
      .eq('grupo_id', estudiante.grupo_id)
      .in('periodo_id', periodoIds);

  if (errorAsignaciones) {
    throw new Error(
      `Error consultando asignaciones: ${errorAsignaciones.message}`
    );
  }

  const asignacionIds = (asignaciones || []).map((a) => a.id);

  if (!asignacionIds.length) {
    return {
      encontrado: true,
      totalPendientes: 0,
      totalVencidas: 0,
      totalEnPlazo: 0,
      actividades: [],
    };
  }

  // 4. Consultar tareas publicadas.
  const { data: actividades, error: errorActividades } =
    await supabaseAdmin
      .from('actividades_academicas')
      .select(
        'id, titulo, fecha_entrega, materia_grupo_periodo_id'
      )
      .in('materia_grupo_periodo_id', asignacionIds)
      .eq('estado', 'publicada')
      .eq('tipo', 'tarea');

  if (errorActividades) {
    throw new Error(
      `Error consultando actividades: ${errorActividades.message}`
    );
  }

  if (!actividades || !actividades.length) {
    return {
      encontrado: true,
      totalPendientes: 0,
      totalVencidas: 0,
      totalEnPlazo: 0,
      actividades: [],
    };
  }

  // 5. Consultar entregas válidas del estudiante.
  const actividadIds = actividades.map((a) => a.id);

  const { data: entregas, error: errorEntregas } =
    await supabaseAdmin
      .from('entregas_actividades')
      .select('actividad_id')
      .eq('estudiante_id', estudianteId)
      .eq('estado', 'entregada')
      .in('actividad_id', actividadIds);

  if (errorEntregas) {
    throw new Error(
      `Error consultando entregas: ${errorEntregas.message}`
    );
  }

  const actividadesEntregadas = new Set(
    (entregas || []).map((e) => e.actividad_id)
  );

  // 6. Identificar materias.
  const materiaIds = [
    ...new Set((asignaciones || []).map((a) => a.materia_id)),
  ];

  const { data: materias, error: errorMaterias } =
    await supabaseAdmin
      .from('materias')
      .select('id, nombre')
      .in('id', materiaIds);

  if (errorMaterias) {
    throw new Error(
      `Error consultando materias: ${errorMaterias.message}`
    );
  }

  const materiasMap = new Map(
    (materias || []).map((m) => [m.id, m.nombre])
  );

  const asignacionesMap = new Map(
    (asignaciones || []).map((a) => [a.id, a.materia_id])
  );

  // 7. Clasificar actividades sin entrega.
  const ahora = new Date();

  const pendientes = actividades
    .filter((a) => !actividadesEntregadas.has(a.id))
    .map((a) => {
      const fechaLimite = a.fecha_entrega
        ? new Date(a.fecha_entrega)
        : null;

      const vencida =
        fechaLimite !== null && fechaLimite < ahora;

      const materiaId = asignacionesMap.get(
        a.materia_grupo_periodo_id
      );

      return {
        actividadId: a.id,
        titulo: a.titulo,
        materia: materiasMap.get(materiaId) || 'Sin materia',
        fechaLimite: a.fecha_entrega,
        situacion: vencida
          ? 'SIN_ENTREGA_VENCIDA'
          : 'SIN_ENTREGA_EN_PLAZO',
      };
    });

  return {
    encontrado: true,
    totalPendientes: pendientes.length,
    totalVencidas: pendientes.filter(
      (a) => a.situacion === 'SIN_ENTREGA_VENCIDA'
    ).length,
    totalEnPlazo: pendientes.filter(
      (a) => a.situacion === 'SIN_ENTREGA_EN_PLAZO'
    ).length,
    actividades: pendientes,
  };
};

module.exports = {
  obtenerActividadesPendientes,
};
