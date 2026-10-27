'use strict';

// ======================================================
// AULA-AI
// HU-11: PLANES DE ACOMPAÑAMIENTO ACADÉMICO
// Validación y preparación de registros
// ======================================================

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PRIORIDADES_PERMITIDAS = new Set([
  'baja',
  'media',
  'alta',
]);

const ESTADOS_PERMITIDOS = new Set([
  'propuesto',
  'en_seguimiento',
  'completado',
  'cancelado',
]);

const esEnteroPositivo = (valor) => {
  return (
    Number.isSafeInteger(valor) &&
    valor > 0
  );
};

const esUUID = (valor) => {
  return (
    typeof valor === 'string' &&
    UUID_REGEX.test(valor)
  );
};

const esFechaValida = (valor) => {
  if (valor === null) {
    return true;
  }

  if (
    typeof valor !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(valor)
  ) {
    return false;
  }

  const fecha = new Date(`${valor}T00:00:00Z`);

  return (
    !Number.isNaN(fecha.getTime()) &&
    fecha.toISOString().slice(0, 10) === valor
  );
};

/**
 * Obtiene la fecha actual según la zona horaria
 * institucional de Colombia.
 */
const obtenerFechaActualColombia = () => {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const obtenerParte = (tipo) =>
    partes.find((parte) => parte.type === tipo)?.value;

  return [
    obtenerParte('year'),
    obtenerParte('month'),
    obtenerParte('day'),
  ].join('-');
};

/**
 * Valida que una fecha de seguimiento nueva
 * no sea anterior a la fecha actual.
 *
 * Se permite null porque el seguimiento
 * es opcional durante la creación del plan.
 */
const validarFechaSeguimientoNueva = (fechaSeguimiento) => {
  if (!esFechaValida(fechaSeguimiento)) {
    throw new Error(
      'La fecha de seguimiento es inválida.'
    );
  }

  if (fechaSeguimiento === null) {
    return true;
  }

  const fechaActual = obtenerFechaActualColombia();

  if (fechaSeguimiento < fechaActual) {
    throw new Error(
      'La fecha de seguimiento no puede ser anterior a la fecha actual.'
    );
  }

  return true;
};

/**
 * Valida y prepara un plan de acompañamiento.
 *
 * validarFechaFutura:
 * - true: valida una fecha nueva de seguimiento.
 * - false: permite conservar fechas históricas.
 *
 * Esta función NO realiza operaciones de escritura.
 */
const prepararPlanAcompanamiento = ({
  estudianteId,
  recomendacionId,
  alertaId = null,
  objetivo,
  acciones = [],
  indicadoresProgreso = [],
  prioridad = 'media',
  estado = 'propuesto',
  fechaSeguimiento = null,
  observacionesOrientador = null,
  orientadorId = null,
  validarFechaFutura = true,
}) => {

  // ------------------------------------------
  // 1. Validar estudiante
  // ------------------------------------------

  if (!esUUID(estudianteId)) {
    throw new Error(
      'El identificador del estudiante es inválido.'
    );
  }

  // ------------------------------------------
  // 2. Validar recomendación
  // ------------------------------------------

  if (!esEnteroPositivo(recomendacionId)) {
    throw new Error(
      'El identificador de la recomendación es inválido.'
    );
  }

  // ------------------------------------------
  // 3. Validar alerta opcional
  // ------------------------------------------

  if (
    alertaId !== null &&
    !esEnteroPositivo(alertaId)
  ) {
    throw new Error(
      'El identificador de la alerta es inválido.'
    );
  }

  // ------------------------------------------
  // 4. Validar objetivo
  // ------------------------------------------

  if (
    typeof objetivo !== 'string' ||
    !objetivo.trim()
  ) {
    throw new Error(
      'El objetivo del plan es obligatorio.'
    );
  }

  // ------------------------------------------
  // 5. Validar acciones e indicadores
  // ------------------------------------------

  if (!Array.isArray(acciones)) {
    throw new Error(
      'Las acciones deben ser un arreglo.'
    );
  }

  if (!Array.isArray(indicadoresProgreso)) {
    throw new Error(
      'Los indicadores de progreso deben ser un arreglo.'
    );
  }

  // ------------------------------------------
  // 6. Validar prioridad y estado
  // ------------------------------------------

  if (!PRIORIDADES_PERMITIDAS.has(prioridad)) {
    throw new Error(
      'La prioridad del plan es inválida.'
    );
  }

  if (!ESTADOS_PERMITIDOS.has(estado)) {
    throw new Error(
      'El estado del plan es inválido.'
    );
  }

  // ------------------------------------------
  // 7. Validar fecha de seguimiento
  // ------------------------------------------

  if (!esFechaValida(fechaSeguimiento)) {
    throw new Error(
      'La fecha de seguimiento es inválida.'
    );
  }

  if (validarFechaFutura) {
    validarFechaSeguimientoNueva(fechaSeguimiento);
  }

  // ------------------------------------------
  // 8. Validar orientador opcional
  // ------------------------------------------

  if (
    orientadorId !== null &&
    !esUUID(orientadorId)
  ) {
    throw new Error(
      'El identificador del orientador es inválido.'
    );
  }

  // ------------------------------------------
  // 9. Validar observaciones
  // ------------------------------------------

  if (
    observacionesOrientador !== null &&
    typeof observacionesOrientador !== 'string'
  ) {
    throw new Error(
      'Las observaciones del orientador son inválidas.'
    );
  }

  // ------------------------------------------
  // 10. Preparar registro para Supabase
  // ------------------------------------------

  return {
    estudiante_id: estudianteId,
    recomendacion_id: recomendacionId,
    alerta_id: alertaId,
    objetivo: objetivo.trim(),
    acciones,
    indicadores_progreso: indicadoresProgreso,
    prioridad,
    estado,
    fecha_seguimiento: fechaSeguimiento,
    observaciones_orientador:
      observacionesOrientador === null
        ? null
        : observacionesOrientador.trim(),
    orientador_id: orientadorId,
  };
};

module.exports = {
  prepararPlanAcompanamiento,
  validarFechaSeguimientoNueva,
};