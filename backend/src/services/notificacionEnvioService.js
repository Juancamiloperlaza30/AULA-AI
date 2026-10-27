'use strict';

// ======================================================
// AULA-AI | HU-12
// SERVICIO DE PREPARACION DE ENVIOS PUSH
// ======================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

// ======================================================
// 1. VALIDAR IDENTIFICADOR
// ======================================================

function validarIdNotificacion(valor) {
  const numero = Number(valor);

  if (
    valor === null ||
    valor === undefined ||
    typeof valor === 'boolean' ||
    typeof valor === 'object' ||
    (typeof valor === 'string' && valor.trim() === '') ||
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
// 2. CONSULTAR NOTIFICACION INSTITUCIONAL
// ======================================================

async function obtenerNotificacionInstitucional(
  notificacionId
) {
  const id = validarIdNotificacion(
    notificacionId
  );

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
      ].join(',')
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    const errorNoEncontrada = new Error(
      'La notificación no existe.'
    );

    errorNoEncontrada.statusCode = 404;

    throw errorNoEncontrada;
  }

  if (
    data.tipo !== 'comunicado' ||
    data.comunicado_id === null
  ) {
    const errorTipo = new Error(
      'La notificación no corresponde a un comunicado institucional.'
    );

    errorTipo.statusCode = 400;

    throw errorTipo;
  }

  return data;
}

// ======================================================
// 3. CONSULTAR DISPOSITIVOS ACTIVOS
// ======================================================

async function obtenerDispositivosActivos(
  usuarioId
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from('dispositivos_push')
    .select(
      [
        'id',
        'usuario_id',
        'plataforma',
        'activo',
      ].join(',')
    )
    .eq('usuario_id', usuarioId)
    .eq('activo', true)
    .order('id', {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return Array.isArray(data)
    ? data
    : [];
}

// ======================================================
// 4. PREPARAR ENVIOS PENDIENTES
// ======================================================

async function prepararEnviosNotificacion({
  notificacionId,
} = {}) {
  const notificacion =
    await obtenerNotificacionInstitucional(
      notificacionId
    );

  const dispositivos =
    await obtenerDispositivosActivos(
      notificacion.usuario_id
    );

  // Una notificacion interna sigue siendo valida
  // aunque el usuario no tenga dispositivos.

  if (dispositivos.length === 0) {
    return {
      notificacionId: notificacion.id,
      comunicadoId: notificacion.comunicado_id,
      usuarioId: notificacion.usuario_id,
      dispositivosActivos: 0,
      enviosPreparados: 0,
      mensaje:
        'El destinatario no tiene dispositivos push activos.',
    };
  }

  const fechaActual =
    new Date().toISOString();

  const registros = dispositivos.map(
    (dispositivo) => ({
      notificacion_id:
        notificacion.id,

      dispositivo_id:
        dispositivo.id,

      estado:
        'pendiente',

      intentos:
        0,

      updated_at:
        fechaActual,
    })
  );

  // La restriccion UNIQUE evita duplicar
  // la combinacion notificacion-dispositivo.
  //
  // ignoreDuplicates evita modificar envios
  // que ya se hayan procesado anteriormente.

  const {
    error,
  } = await supabaseAdmin
    .from('notificaciones_envios')
    .upsert(registros, {
      onConflict:
        'notificacion_id,dispositivo_id',

      ignoreDuplicates:
        true,
    });

  if (error) {
    throw error;
  }

  // Consultar los registros resultantes.

  const idsDispositivos =
    dispositivos.map(
      (dispositivo) => dispositivo.id
    );

  const {
    data: envios,
    error: errorConsulta,
  } = await supabaseAdmin
    .from('notificaciones_envios')
    .select(
      [
        'id',
        'notificacion_id',
        'dispositivo_id',
        'estado',
        'intentos',
      ].join(',')
    )
    .eq(
      'notificacion_id',
      notificacion.id
    )
    .in(
      'dispositivo_id',
      idsDispositivos
    )
    .order('id', {
      ascending: true,
    });

  if (errorConsulta) {
    throw errorConsulta;
  }

  const registrosEncontrados =
    Array.isArray(envios)
      ? envios
      : [];

  return {
    notificacionId:
      notificacion.id,

    comunicadoId:
      notificacion.comunicado_id,

    usuarioId:
      notificacion.usuario_id,

    dispositivosActivos:
      dispositivos.length,

    enviosPreparados:
      registrosEncontrados.length,

    envios:
      registrosEncontrados,

    mensaje:
      'Preparación de envíos institucionales finalizada.',
  };
}

// ======================================================
// 5. EXPORTACIONES
// ======================================================

module.exports = {
  validarIdNotificacion,
  obtenerNotificacionInstitucional,
  obtenerDispositivosActivos,
  prepararEnviosNotificacion,
};
