'use strict';

// ======================================================
// AULA-AI
// HU-11: PLANES DE ACOMPAÑAMIENTO ACADEMICO
// Servicio de consulta de planes
// ======================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ESTADOS_PERMITIDOS = new Set([
  'propuesto',
  'en_seguimiento',
  'completado',
  'cancelado',
]);

const COLUMNAS_PLAN = [
  'id',
  'estudiante_id',
  'recomendacion_id',
  'alerta_id',
  'objetivo',
  'acciones',
  'indicadores_progreso',
  'prioridad',
  'estado',
  'fecha_seguimiento',
  'observaciones_orientador',
  'orientador_id',
  'created_at',
  'updated_at',
].join(',');

const validarEstudianteId = (estudianteId) => {
  if (
    typeof estudianteId !== 'string' ||
    !UUID_REGEX.test(estudianteId)
  ) {
    throw new Error(
      'El identificador del estudiante es invalido.'
    );
  }
};

const validarPlanId = (planId) => {
  if (
    !Number.isSafeInteger(planId) ||
    planId <= 0
  ) {
    throw new Error(
      'El identificador del plan es invalido.'
    );
  }
};

/**
 * Consulta los planes de un estudiante.
 *
 * IMPORTANTE:
 * Este servicio no verifica permisos de usuario.
 * La autorizacion debe realizarse antes de llamarlo.
 */
const consultarPlanesEstudiante = async ({
  estudianteId,
  estado = null,
  limite = 20,
}) => {
  validarEstudianteId(estudianteId);

  if (
    estado !== null &&
    !ESTADOS_PERMITIDOS.has(estado)
  ) {
    throw new Error(
      'El estado solicitado es invalido.'
    );
  }

  if (
    !Number.isSafeInteger(limite) ||
    limite < 1 ||
    limite > 100
  ) {
    throw new Error(
      'El limite de consulta debe estar entre 1 y 100.'
    );
  }

  let consulta = supabaseAdmin
    .from('planes_acompanamiento')
    .select(COLUMNAS_PLAN)
    .eq('estudiante_id', estudianteId)
    .order('created_at', {
      ascending: false,
    })
    .order('id', {
      ascending: false,
    })
    .limit(limite);

  if (estado !== null) {
    consulta = consulta.eq('estado', estado);
  }

  const {
    data,
    error,
  } = await consulta;

  if (error) {
    console.error(
      '[HU-11] Error al consultar planes:',
      error.message
    );

    throw new Error(
      'No fue posible consultar los planes de acompanamiento.'
    );
  }

  return data || [];
};

/**
 * Consulta un plan especifico de un estudiante.
 *
 * Se filtra simultaneamente por plan y estudiante
 * para evitar recuperar planes de otro estudiante.
 *
 * IMPORTANTE:
 * La autorizacion debe realizarse antes de llamarlo.
 */
const consultarPlanPorId = async ({
  estudianteId,
  planId,
}) => {
  validarEstudianteId(estudianteId);
  validarPlanId(planId);

  const {
    data,
    error,
  } = await supabaseAdmin
    .from('planes_acompanamiento')
    .select(COLUMNAS_PLAN)
    .eq('id', planId)
    .eq('estudiante_id', estudianteId)
    .maybeSingle();

  if (error) {
    console.error(
      '[HU-11] Error al consultar plan:',
      error.message
    );

    throw new Error(
      'No fue posible consultar el plan de acompanamiento.'
    );
  }

  return data || null;
};

module.exports = {
  consultarPlanesEstudiante,
  consultarPlanPorId,
};
