'use strict';

const {
  supabaseAdmin,
} = require('../config/supabase');

const ESTADOS_PERMITIDOS = new Set([
  'generada',
  'revisada',
  'archivada',
]);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Consulta las recomendaciones académicas de un estudiante.
 *
 * IMPORTANTE:
 * Esta función es interna del backend.
 * El controlador deberá comprobar previamente
 * que el usuario tiene autorización para
 * consultar al estudiante solicitado.
 */
const consultarRecomendacionesEstudiante = async ({
  estudianteId,
  estado = null,
  limite = 20,
}) => {
  // Validar el identificador del estudiante.
  if (
    typeof estudianteId !== 'string' ||
    !UUID_REGEX.test(estudianteId)
  ) {
    throw new Error(
      'El identificador del estudiante es inválido.'
    );
  }

  // Validar el estado, cuando se proporciona.
  if (
    estado !== null &&
    !ESTADOS_PERMITIDOS.has(estado)
  ) {
    throw new Error(
      'El estado de recomendación es inválido.'
    );
  }

  // Limitar la cantidad de registros consultados.
  if (
    !Number.isInteger(limite) ||
    limite < 1 ||
    limite > 100
  ) {
    throw new Error(
      'El límite debe estar entre 1 y 100.'
    );
  }

  // Construir consulta.
  let consulta = supabaseAdmin
    .from('recomendaciones')
    .select(
      [
        'id',
        'estudiante_id',
        'alerta_id',
        'origen',
        'version',
        'indicadores',
        'contenido',
        'modelo_ia',
        'estado',
        'revisada_por',
        'revisada_at',
        'created_at',
        'updated_at',
      ].join(',')
    )
    .eq('estudiante_id', estudianteId)
    .order('created_at', {
      ascending: false,
    })
    .order('id', {
      ascending: false,
    })
    .limit(limite);

  // Aplicar filtro opcional.
  if (estado !== null) {
    consulta = consulta.eq(
      'estado',
      estado
    );
  }

  // Ejecutar consulta.
  const { data, error } = await consulta;

  if (error) {
    console.error(
      '[HU-11] Error al consultar recomendaciones:',
      error.message
    );

    throw new Error(
      'No fue posible consultar las recomendaciones académicas.'
    );
  }

  return {
    estudianteId,
    totalDevuelto: (data || []).length,
    recomendaciones: data || [],
  };
};

/**
 * Consulta una recomendación específica.
 *
 * Se exige estudianteId para impedir
 * consultas basadas únicamente en un ID
 * global de recomendación.
 *
 * La autorización por rol deberá verificarse
 * antes de invocar esta función.
 */
const consultarRecomendacionPorId = async ({
  estudianteId,
  recomendacionId,
}) => {
  if (
    typeof estudianteId !== 'string' ||
    !UUID_REGEX.test(estudianteId)
  ) {
    throw new Error(
      'El identificador del estudiante es inválido.'
    );
  }

  const id = Number(recomendacionId);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    throw new Error(
      'El identificador de la recomendación es inválido.'
    );
  }

  const { data, error } = await supabaseAdmin
    .from('recomendaciones')
    .select('*')
    .eq('id', id)
    .eq('estudiante_id', estudianteId)
    .maybeSingle();

  if (error) {
    console.error(
      '[HU-11] Error al consultar recomendación:',
      error.message
    );

    throw new Error(
      'No fue posible consultar la recomendación académica.'
    );
  }

  return data;
};

module.exports = {
  consultarRecomendacionesEstudiante,
  consultarRecomendacionPorId,
};
