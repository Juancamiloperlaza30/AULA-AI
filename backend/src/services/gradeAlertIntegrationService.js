
'use strict';

// ======================================================
// AULA-AI | HU-08
// RECÁLCULO DE ALERTAS POR CALIFICACIONES
//
// Responsabilidades:
// - Identificar la materia y el período reales.
// - Consultar notas registradas en Supabase.
// - Recalcular el promedio de la materia.
// - Ejecutar el motor de alertas académicas.
// - Procesar múltiples estudiantes.
// - Aislar errores por estudiante.
//
// No modifica calificaciones.
// No calcula una probabilidad de perder el año.
// No envía notificaciones push directamente.
// ======================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  evaluarRendimientoMateria,
  clasificarRendimiento,
} = require('./academicAlertService');

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TAMANO_PAGINA = 500;

// ======================================================
// UTILIDADES
// ======================================================

function obtenerRelacion(valor) {
  if (Array.isArray(valor)) {
    return valor[0] || null;
  }

  return valor || null;
}

function validarId(valor, campo) {
  const numero = Number(valor);

  if (
    !Number.isSafeInteger(numero) ||
    numero <= 0
  ) {
    throw new Error(
      `${campo} debe ser un entero positivo.`
    );
  }

  return numero;
}

function validarEstudiante(valor) {
  if (
    typeof valor !== 'string' ||
    !UUID.test(valor)
  ) {
    throw new Error(
      'El identificador del estudiante es inválido.'
    );
  }

  return valor;
}

function validarValorNota(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    throw new Error(
      'Se encontró una calificación sin valor.'
    );
  }

  const numero = Number(valor);

  if (
    !Number.isFinite(numero) ||
    numero < 0 ||
    numero > 5
  ) {
    throw new Error(
      'Se encontró una calificación fuera de la escala 0-5.'
    );
  }

  return numero;
}

function redondear(valor) {
  return Math.round(
    (valor + Number.EPSILON) * 100
  ) / 100;
}

// ======================================================
// IDENTIFICAR ASIGNACIÓN ACADÉMICA
// ======================================================

async function consultarAsignacionDeActividad(
  actividadId
) {
  const id = validarId(
    actividadId,
    'actividadId'
  );

  const {
    data,
    error,
  } = await supabaseAdmin
    .from('actividades_academicas')
    .select(`
      id,
      materia_grupo_periodo_id,
      materia_grupo_periodo:materia_grupo_periodo_id(
        id,
        periodo_id,
        materia:materias(
          id,
          nombre
        )
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      'La actividad académica no existe.'
    );
  }

  const asignacion = obtenerRelacion(
    data.materia_grupo_periodo
  );

  const materia = obtenerRelacion(
    asignacion?.materia
  );

  if (
    !asignacion ||
    !materia?.id ||
    !materia?.nombre ||
    !asignacion.periodo_id
  ) {
    throw new Error(
      'La actividad no tiene una materia y período válidos.'
    );
  }

  return {
    actividadId: id,
    asignacionId: validarId(
      data.materia_grupo_periodo_id,
      'asignacionId'
    ),
    materiaId: validarId(
      materia.id,
      'materiaId'
    ),
    materiaNombre: materia.nombre,
    periodoId: validarId(
      asignacion.periodo_id,
      'periodoId'
    ),
  };
}

// ======================================================
// CONSULTAR LAS CALIFICACIONES REGISTRADAS
// EN LA MISMA ASIGNACIÓN
// ======================================================

async function consultarNotasMateria({
  estudianteId,
  asignacionId,
}) {
  const estudiante = validarEstudiante(
    estudianteId
  );

  const asignacion = validarId(
    asignacionId,
    'asignacionId'
  );

  const notas = [];
  let inicio = 0;

  // Se consultan páginas para evitar que el
  // límite de resultados de Supabase produzca
  // promedios incompletos.
  while (true) {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from('calificaciones')
      .select(`
        id,
        valor,
        actividad:actividades_academicas!inner(
          id,
          materia_grupo_periodo_id,
          estado,
          es_evaluable
        )
      `)
      .eq('estudiante_id', estudiante)
      .eq('estado', 'registrada')
      .eq(
        'actividad.materia_grupo_periodo_id',
        asignacion
      )
      // HU-08: solo las actividades publicadas
      // y evaluables intervienen en el promedio
      // que activa las alertas.
      .eq('actividad.estado', 'publicada')
      .eq('actividad.es_evaluable', true)
      .order('id', {
        ascending: true,
      })
      .range(
        inicio,
        inicio + TAMANO_PAGINA - 1
      );

    if (error) {
      throw error;
    }

    const pagina = data || [];

    // Comprobación adicional: ninguna nota
    // debe pertenecer a otra asignación ni
    // a una actividad no calificable.
    for (const registro of pagina) {
      const actividad = obtenerRelacion(
        registro.actividad
      );

      if (
        Number(
          actividad?.materia_grupo_periodo_id
        ) !== asignacion ||
        actividad?.estado !== 'publicada' ||
        actividad?.es_evaluable !== true
      ) {
        throw new Error(
          'La consulta devolvió una nota fuera de la asignación o de una actividad no calificable.'
        );
      }

      notas.push(
        validarValorNota(registro.valor)
      );
    }

    if (pagina.length < TAMANO_PAGINA) {
      break;
    }

    inicio += TAMANO_PAGINA;
  }

  return notas;
}

// ======================================================
// RECALCULAR PROMEDIO REAL DE MATERIA
// ======================================================

async function recalcularPromedioMateria({
  estudianteId,
  asignacion,
}) {
  validarEstudiante(estudianteId);

  if (!asignacion?.asignacionId) {
    throw new Error(
      'La asignación académica es obligatoria.'
    );
  }

  const notas = await consultarNotasMateria({
    estudianteId,
    asignacionId: asignacion.asignacionId,
  });

  const cantidadNotas = notas.length;

  if (cantidadNotas === 0) {
    return {
      estudianteId,
      materiaId: asignacion.materiaId,
      materiaNombre:
        asignacion.materiaNombre,
      periodoId: asignacion.periodoId,
      cantidadNotas: 0,
      promedio: null,
      clasificacion: clasificarRendimiento({
        promedio: null,
        cantidadNotas: 0,
      }),
    };
  }

  const suma = notas.reduce(
    (total, valor) => total + valor,
    0
  );

  const promedio = redondear(
    suma / cantidadNotas
  );

  return {
    estudianteId,
    materiaId: asignacion.materiaId,
    materiaNombre:
      asignacion.materiaNombre,
    periodoId: asignacion.periodoId,
    cantidadNotas,
    promedio,
    clasificacion: clasificarRendimiento({
      promedio,
      cantidadNotas,
    }),
  };
}

// ======================================================
// EVALUAR ALERTAS DE UN ESTUDIANTE
// ======================================================

async function evaluarEstudiante({
  estudianteId,
  asignacion,
}) {
  const resultado =
    await recalcularPromedioMateria({
      estudianteId,
      asignacion,
    });

  const alerta =
    await evaluarRendimientoMateria({
      estudianteId,
      materiaId: resultado.materiaId,
      materiaNombre:
        resultado.materiaNombre,
      periodoId: resultado.periodoId,
      promedio: resultado.promedio,
      cantidadNotas:
        resultado.cantidadNotas,
    });

  return {
    ...resultado,
    alerta: {
      accion: alerta.accion,
      id: alerta.alerta?.id || null,
      estado:
        alerta.alerta?.estado || null,
      requiereNotificacion:
        alerta.requiereNotificacion === true,
    },
  };
}

// ======================================================
// PROCESAR ESTUDIANTES DE UNA ACTIVIDAD
// ======================================================

async function procesarAlertasDeActividad({
  actividadId,
  estudiantesIds,
}) {
  if (
    !Array.isArray(estudiantesIds) ||
    estudiantesIds.length === 0
  ) {
    return {
      procesados: 0,
      exitosos: 0,
      fallidos: 0,
      resultados: [],
    };
  }

  const asignacion =
    await consultarAsignacionDeActividad(
      actividadId
    );

  // Evita evaluar dos veces al mismo estudiante
  // si llega repetido en el lote.
  const idsUnicos = [
    ...new Set(
      estudiantesIds.map(validarEstudiante)
    ),
  ];

  const resultados = [];

  // Ejecución secuencial para evitar una
  // ráfaga de operaciones concurrentes
  // sobre Supabase durante el registro masivo.
  for (const estudianteId of idsUnicos) {
    try {
      const resultado =
        await evaluarEstudiante({
          estudianteId,
          asignacion,
        });

      resultados.push({
        success: true,
        ...resultado,
      });
    } catch (error) {
      console.error(
        '[AULA-AI] Error evaluando alerta:',
        {
          estudianteId,
          actividadId,
          error:
            error?.message ||
            'Error desconocido',
        }
      );

      resultados.push({
        success: false,
        estudianteId,
        error:
          'No fue posible evaluar las alertas académicas.',
      });
    }
  }

  const exitosos = resultados.filter(
    (item) => item.success
  ).length;

  return {
    actividadId: asignacion.actividadId,
    asignacionId: asignacion.asignacionId,
    materiaId: asignacion.materiaId,
    materiaNombre:
      asignacion.materiaNombre,
    periodoId: asignacion.periodoId,

    procesados: resultados.length,
    exitosos,
    fallidos: resultados.length - exitosos,

    resultados,
  };
}

// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {
  consultarAsignacionDeActividad,
  consultarNotasMateria,
  recalcularPromedioMateria,
  procesarAlertasDeActividad,
};
