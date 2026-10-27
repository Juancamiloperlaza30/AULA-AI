'use strict';

// ======================================================
// AULA-AI
// HU-11: ACTUALIZACIÓN DE PLANES DE ACOMPAÑAMIENTO
//
// Funcionalidades:
// - Validación de identificadores.
// - Control de permisos.
// - Consulta del plan existente.
// - Validación de transiciones.
// - Validación del cierre académico.
// - Protección de planes finalizados.
// - Actualización en Supabase.
// - Control básico de concurrencia.
// ======================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  prepararPlanAcompanamiento,
  validarFechaSeguimientoNueva,
} = require('./academicPlanPersistenceService');

const {
  verificarPermisoGestionPlan,
} = require('./academicPlanAuthorizationService');

// ======================================================
// ESTADOS Y TRANSICIONES PERMITIDAS
// ======================================================

const TRANSICIONES = {
  propuesto: [
    'en_seguimiento',
    'cancelado',
  ],

  en_seguimiento: [
    'completado',
    'cancelado',
  ],

  completado: [],

  cancelado: [],
};

// ======================================================
// CAMPOS QUE PUEDEN MODIFICARSE
// ======================================================

const CAMPOS_PERMITIDOS = new Set([
  'objetivo',
  'acciones',
  'indicadoresProgreso',
  'prioridad',
  'estado',
  'fechaSeguimiento',
  'observacionesOrientador',
]);

// ======================================================
// UTILIDADES
// ======================================================

const crearError = (mensaje, codigo) => {
  const error = new Error(mensaje);

  error.codigo = codigo;

  return error;
};

const esTextoValido = (valor) => {
  return (
    typeof valor === 'string' &&
    valor.trim().length > 0
  );
};

const tieneElementosValidos = (valor) => {
  return (
    Array.isArray(valor) &&
    valor.length > 0 &&
    valor.every((elemento) => {
      if (typeof elemento === 'string') {
        return elemento.trim().length > 0;
      }

      if (
        elemento !== null &&
        typeof elemento === 'object' &&
        !Array.isArray(elemento)
      ) {
        return Object.keys(elemento).length > 0;
      }

      return false;
    })
  );
};

// ======================================================
// VALIDACIÓN DE CIERRE ACADÉMICO
// ======================================================

/**
 * Verifica que un plan tenga información suficiente
 * antes de cambiar su estado a "completado".
 *
 * Se valida el registro preparado, de modo que
 * se consideran tanto los datos existentes como
 * los cambios enviados en la solicitud.
 *
 * Esta función no realiza operaciones de escritura.
 */
const validarCierrePlan = (registro) => {
  const faltantes = [];

  // ------------------------------------------
  // 1. Objetivo académico
  // ------------------------------------------

  if (!esTextoValido(registro.objetivo)) {
    faltantes.push(
      'un objetivo académico definido'
    );
  }

  // ------------------------------------------
  // 2. Acciones de acompañamiento
  // ------------------------------------------

  if (!tieneElementosValidos(registro.acciones)) {
    faltantes.push(
      'al menos una acción de acompañamiento'
    );
  }

  // ------------------------------------------
  // 3. Indicadores de progreso
  // ------------------------------------------

  if (
    !tieneElementosValidos(
      registro.indicadores_progreso
    )
  ) {
    faltantes.push(
      'al menos un indicador de progreso'
    );
  }

  // ------------------------------------------
  // 4. Fecha de seguimiento
  // ------------------------------------------

  if (!registro.fecha_seguimiento) {
    faltantes.push(
      'una fecha de seguimiento'
    );
  }

  // ------------------------------------------
  // 5. Observaciones finales
  // ------------------------------------------

  if (
    !esTextoValido(
      registro.observaciones_orientador
    )
  ) {
    faltantes.push(
      'una observación final del Orientador'
    );
  }

  // ------------------------------------------
  // 6. Resultado de validación
  // ------------------------------------------

  if (faltantes.length > 0) {
    throw crearError(
      'No es posible completar el plan. ' +
      'Debe registrar: ' +
      faltantes.join('; ') +
      '.',
      'CIERRE_INCOMPLETO'
    );
  }

  return true;
};

// ======================================================
// ACTUALIZAR PLAN DE ACOMPAÑAMIENTO
// ======================================================

const actualizarPlanAcompanamiento = async ({
  usuario,
  estudianteId,
  planId,
  cambios,
}) => {

  // ====================================================
  // 1. VALIDAR IDENTIFICADOR
  // ====================================================

  if (
    !Number.isSafeInteger(planId) ||
    planId <= 0
  ) {
    throw crearError(
      'El identificador del plan es inválido.',
      'DATOS_INVALIDOS'
    );
  }

  // ====================================================
  // 2. VALIDAR CAMBIOS
  // ====================================================

  if (
    !cambios ||
    typeof cambios !== 'object' ||
    Array.isArray(cambios)
  ) {
    throw crearError(
      'Los cambios del plan son inválidos.',
      'DATOS_INVALIDOS'
    );
  }

  const campos = Object.keys(cambios);

  if (
    campos.length === 0 ||
    campos.some(
      (campo) => !CAMPOS_PERMITIDOS.has(campo)
    )
  ) {
    throw crearError(
      'La actualización contiene campos no permitidos.',
      'DATOS_INVALIDOS'
    );
  }

  // ====================================================
  // 3. VERIFICAR AUTORIZACIÓN
  // ====================================================

  const permiso = await verificarPermisoGestionPlan({
    usuario,
    estudianteId,
  });

  if (!permiso.autorizado) {
    throw crearError(
      'No tiene permisos para actualizar este plan.',
      'ACCESO_DENEGADO'
    );
  }

  // ====================================================
  // 4. CONSULTAR PLAN ACTUAL
  // ====================================================

  const {
    data: planActual,
    error: errorConsulta,
  } = await supabaseAdmin
    .from('planes_acompanamiento')
    .select('*')
    .eq('id', planId)
    .eq('estudiante_id', estudianteId)
    .maybeSingle();

  if (errorConsulta) {
    throw crearError(
      'No fue posible consultar el plan.',
      'ERROR_BASE_DATOS'
    );
  }

  if (!planActual) {
    throw crearError(
      'El plan no fue encontrado.',
      'PLAN_NO_ENCONTRADO'
    );
  }

  // ====================================================
  // 5. PROTEGER PLANES FINALIZADOS
  // ====================================================

  if (
    planActual.estado === 'completado' ||
    planActual.estado === 'cancelado'
  ) {
    throw crearError(
      'No se puede modificar un plan finalizado.',
      'PLAN_FINALIZADO'
    );
  }

  // ====================================================
  // 6. DETERMINAR NUEVO ESTADO
  // ====================================================

  const nuevoEstado =
    cambios.estado === undefined
      ? planActual.estado
      : cambios.estado;

  // ====================================================
  // 7. VALIDAR TRANSICIÓN DE ESTADO
  // ====================================================

  if (nuevoEstado !== planActual.estado) {
    const estadosPermitidos =
      TRANSICIONES[planActual.estado] || [];

    if (!estadosPermitidos.includes(nuevoEstado)) {
      throw crearError(
        'La transición de estado no está permitida.',
        'TRANSICION_INVALIDA'
      );
    }
  }

  // ====================================================
  // 8. PREPARAR INFORMACIÓN ACTUALIZADA
  // ====================================================

  // ====================================================
  // VALIDAR FECHA DE SEGUIMIENTO MODIFICADA
  // ====================================================

  if (
    Object.prototype.hasOwnProperty.call(
      cambios,
      'fechaSeguimiento'
    )
  ) {
    validarFechaSeguimientoNueva(
      cambios.fechaSeguimiento
    );
  }

  const registro = prepararPlanAcompanamiento({

    estudianteId:
      planActual.estudiante_id,

    recomendacionId:
      planActual.recomendacion_id,

    alertaId:
      planActual.alerta_id,

    objetivo:
      cambios.objetivo === undefined
        ? planActual.objetivo
        : cambios.objetivo,

    acciones:
      cambios.acciones === undefined
        ? planActual.acciones
        : cambios.acciones,

    indicadoresProgreso:
      cambios.indicadoresProgreso === undefined
        ? planActual.indicadores_progreso
        : cambios.indicadoresProgreso,

    prioridad:
      cambios.prioridad === undefined
        ? planActual.prioridad
        : cambios.prioridad,

    estado:
      nuevoEstado,

    fechaSeguimiento:
      cambios.fechaSeguimiento === undefined
        ? planActual.fecha_seguimiento
        : cambios.fechaSeguimiento,

    observacionesOrientador:
      cambios.observacionesOrientador === undefined
        ? planActual.observaciones_orientador
        : cambios.observacionesOrientador,

    orientadorId:
      planActual.orientador_id,

    // La fecha nueva ya se validó anteriormente.
    // Se permite conservar una fecha histórica.
    validarFechaFutura: false,

  });

  // ====================================================
  // 9. VALIDAR CIERRE DEL PLAN
  // ====================================================

  /**
   * La validación se aplica cuando el plan
   * pasa al estado "completado".
   *
   * No se exige esta información para:
   * - Planes propuestos.
   * - Planes en seguimiento.
   * - Planes cancelados.
   */

  if (
    nuevoEstado === 'completado' &&
    planActual.estado !== 'completado'
  ) {
    validarCierrePlan(registro);
  }

  // ====================================================
  // 10. PREPARAR ACTUALIZACIÓN
  // ====================================================

  const actualizacion = {

    objetivo:
      registro.objetivo,

    acciones:
      registro.acciones,

    indicadores_progreso:
      registro.indicadores_progreso,

    prioridad:
      registro.prioridad,

    estado:
      registro.estado,

    fecha_seguimiento:
      registro.fecha_seguimiento,

    observaciones_orientador:
      registro.observaciones_orientador,

    updated_at:
      new Date().toISOString(),

  };

  // ====================================================
  // 11. GUARDAR CAMBIOS EN SUPABASE
  // ====================================================

  /**
   * Se comprueba el estado original del plan
   * para evitar sobrescribir una transición
   * realizada durante esta operación.
   */

  const {
    data: planActualizado,
    error: errorActualizacion,
  } = await supabaseAdmin
    .from('planes_acompanamiento')
    .update(actualizacion)
    .eq('id', planId)
    .eq('estudiante_id', estudianteId)
    .eq('estado', planActual.estado)
    .select()
    .maybeSingle();

  if (errorActualizacion) {
    throw crearError(
      'No fue posible actualizar el plan.',
      'ERROR_BASE_DATOS'
    );
  }

  if (!planActualizado) {
    throw crearError(
      'El plan cambió durante la actualización. ' +
      'Consulte nuevamente.',
      'CONFLICTO_ACTUALIZACION'
    );
  }

  // ====================================================
  // 12. DEVOLVER PLAN ACTUALIZADO
  // ====================================================

  return planActualizado;
};

// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {
  actualizarPlanAcompanamiento,
};