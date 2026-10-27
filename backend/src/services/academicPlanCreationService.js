'use strict';

// ======================================================
// AULA-AI
// HU-11: PLANES DE ACOMPAÑAMIENTO ACADÉMICO
// Servicio de creación de planes
// ======================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  verificarPermisoGestionPlan,
} = require('./academicPlanAuthorizationService');

const {
  prepararPlanAcompanamiento,
} = require('./academicPlanPersistenceService');

/**
 * Crea un plan de acompañamiento académico.
 *
 * IMPORTANTE:
 * - usuario debe provenir de req.usuario.
 * - El orientador responsable se obtiene del token.
 * - No permite crear planes sin autorización.
 */
const crearPlanAcompanamiento = async ({
  usuario,
  estudianteId,
  recomendacionId,
  alertaId = null,
  objetivo,
  acciones = [],
  indicadoresProgreso = [],
  prioridad = 'media',
  fechaSeguimiento = null,
  observacionesOrientador = null,
}) => {
  // ------------------------------------------
  // 1. Validar y preparar los datos
  // ------------------------------------------

  const registro = prepararPlanAcompanamiento({
    estudianteId,
    recomendacionId,
    alertaId,
    objetivo,
    acciones,
    indicadoresProgreso,
    prioridad,
    estado: 'propuesto',
    fechaSeguimiento,
    observacionesOrientador,
    orientadorId: usuario?.id || null,
  });

  // ------------------------------------------
  // 2. Verificar permisos del orientador
  // ------------------------------------------

  const permiso = await verificarPermisoGestionPlan({
    usuario,
    estudianteId,
  });

  if (!permiso.autorizado) {
    const error = new Error(
      'No tiene permisos para crear este plan.'
    );

    error.codigo = 'ACCESO_DENEGADO';

    throw error;
  }

  // ------------------------------------------
  // 3. Verificar recomendación del estudiante
  // ------------------------------------------

  const {
    data: recomendacion,
    error: errorRecomendacion,
  } = await supabaseAdmin
    .from('recomendaciones')
    .select('id, estudiante_id, alerta_id')
    .eq('id', recomendacionId)
    .eq('estudiante_id', estudianteId)
    .maybeSingle();

  if (errorRecomendacion) {
    throw new Error(
      'No fue posible verificar la recomendación académica.'
    );
  }

  if (!recomendacion) {
    const error = new Error(
      'La recomendación no existe o no pertenece al estudiante.'
    );

    error.codigo = 'RECOMENDACION_NO_ENCONTRADA';

    throw error;
  }

  // ------------------------------------------
  // 4. Verificar alerta académica opcional
  // ------------------------------------------

  if (alertaId !== null) {
    const {
      data: alerta,
      error: errorAlerta,
    } = await supabaseAdmin
      .from('alertas_academicas')
      .select('id, estudiante_id')
      .eq('id', alertaId)
      .eq('estudiante_id', estudianteId)
      .maybeSingle();

    if (errorAlerta) {
      throw new Error(
        'No fue posible verificar la alerta académica.'
      );
    }

    if (!alerta) {
      const error = new Error(
        'La alerta no existe o no pertenece al estudiante.'
      );

      error.codigo = 'ALERTA_NO_ENCONTRADA';

      throw error;
    }
  }

  // ------------------------------------------
  // 5. Guardar plan en Supabase
  // ------------------------------------------

  const {
    data: plan,
    error: errorInsercion,
  } = await supabaseAdmin
    .from('planes_acompanamiento')
    .insert(registro)
    .select()
    .single();

  if (errorInsercion) {
    console.error(
      '[HU-11] Error al crear plan:',
      errorInsercion.message
    );

    throw new Error(
      'No fue posible guardar el plan de acompañamiento.'
    );
  }

  return plan;
};

module.exports = {
  crearPlanAcompanamiento,
};
