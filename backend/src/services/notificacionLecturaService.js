'use strict';

// ======================================================
// AULA-AI | HU-12
// SERVICIO DE LECTURA DE NOTIFICACIONES
// ======================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

// ======================================================
// 1. VALIDAR IDENTIFICADOR DE NOTIFICACION
// ======================================================

function validarIdNotificacion(valor) {
  if (
    valor === null ||
    valor === undefined ||
    typeof valor === 'boolean' ||
    typeof valor === 'object' ||
    (typeof valor === 'string' && valor.trim() === '')
  ) {
    const error = new Error(
      'El identificador de la notificación no es válido.'
    );

    error.statusCode = 400;

    throw error;
  }

  const numero = Number(valor);

  if (
    !Number.isSafeInteger(numero) ||
    numero <= 0
  ) {
    const error = new Error(
      'El identificador de la notificación no es válido.'
    );

    error.statusCode = 400;

    throw error;
  }

  return numero;
}

// ======================================================
// 2. CONSULTAR NOTIFICACION DEL USUARIO
// ======================================================

async function obtenerNotificacionPropia(
  notificacionId,
  usuarioId
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from('notificaciones')
    .select(
      [
        'id',
        'usuario_id',
        'tipo',
        'titulo',
        'mensaje',
        'comunicado_id',
        'estado',
        'fecha_creacion',
        'fecha_lectura',
      ].join(',')
    )
    .eq('id', notificacionId)
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

// ======================================================
// 3. NORMALIZAR RESPUESTA
// ======================================================

function normalizarNotificacion(registro) {
  return {
    id: registro.id,
    tipo: registro.tipo,
    titulo: registro.titulo,
    mensaje: registro.mensaje,
    comunicadoId: registro.comunicado_id,
    estado: registro.estado,
    fechaCreacion: registro.fecha_creacion,
    fechaLectura: registro.fecha_lectura,
    leida: registro.fecha_lectura !== null,
  };
}

// ======================================================
// 4. REGISTRAR LECTURA DE NOTIFICACION
// ======================================================

async function registrarLecturaNotificacion({
  notificacionId,
  usuarioId,
} = {}) {
  // ----------------------------------------------------
  // VALIDAR IDENTIFICADOR
  // ----------------------------------------------------

  const id = validarIdNotificacion(
    notificacionId
  );

  if (
    typeof usuarioId !== 'string' ||
    !usuarioId.trim()
  ) {
    const error = new Error(
      'El usuario autenticado es obligatorio.'
    );

    error.statusCode = 401;

    throw error;
  }

  // ----------------------------------------------------
  // CONSULTAR NOTIFICACION PROPIA
  // ----------------------------------------------------

  const notificacionActual =
    await obtenerNotificacionPropia(
      id,
      usuarioId
    );

  if (!notificacionActual) {
    const error = new Error(
      'La notificación no existe o no está disponible.'
    );

    error.statusCode = 404;

    throw error;
  }

  // ----------------------------------------------------
  // SI YA ESTA LEIDA, CONSERVAR PRIMERA LECTURA
  // ----------------------------------------------------

  if (notificacionActual.fecha_lectura !== null) {
    return normalizarNotificacion(
      notificacionActual
    );
  }

  // ----------------------------------------------------
  // ACTUALIZACION CONDICIONAL
  // ----------------------------------------------------

  const fechaActual = new Date().toISOString();

  const {
    data: notificacionActualizada,
    error: errorActualizacion,
  } = await supabaseAdmin
    .from('notificaciones')
    .update({
      estado: 'leida',
      fecha_lectura: fechaActual,
      updated_at: fechaActual,
    })
    .eq('id', id)
    .eq('usuario_id', usuarioId)
    .is('fecha_lectura', null)
    .select(
      [
        'id',
        'usuario_id',
        'tipo',
        'titulo',
        'mensaje',
        'comunicado_id',
        'estado',
        'fecha_creacion',
        'fecha_lectura',
      ].join(',')
    )
    .maybeSingle();

  if (errorActualizacion) {
    throw errorActualizacion;
  }

  // ----------------------------------------------------
  // SI OTRA SOLICITUD REGISTRO LA LECTURA PRIMERO
  // ----------------------------------------------------

  if (!notificacionActualizada) {
    const notificacionReciente =
      await obtenerNotificacionPropia(
        id,
        usuarioId
      );

    if (!notificacionReciente) {
      const error = new Error(
        'La notificación no existe o no está disponible.'
      );

      error.statusCode = 404;

      throw error;
    }

    return normalizarNotificacion(
      notificacionReciente
    );
  }

  // ----------------------------------------------------
  // RESPUESTA EXITOSA
  // ----------------------------------------------------

  return normalizarNotificacion(
    notificacionActualizada
  );
}

// ======================================================
// 5. EXPORTACIONES
// ======================================================

module.exports = {
  registrarLecturaNotificacion,
  validarIdNotificacion,
};
