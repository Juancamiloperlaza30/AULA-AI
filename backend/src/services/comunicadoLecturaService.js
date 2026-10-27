'use strict';

// ======================================================
// AULA-AI | HU-12
// SERVICIO DE REGISTRO DE LECTURA DE COMUNICADOS
// ======================================================

const { supabaseAdmin } = require('../config/supabase');

const {
  consultarDetalleComunicado,
  validarIdComunicado,
} = require('./comunicadoDetalleService');

// ======================================================
// REGISTRAR LECTURA DE UN COMUNICADO
// ======================================================

async function registrarLecturaComunicado({
  comunicadoId,
  usuarioId,
}) {
  // --------------------------------------------------
  // 1. VALIDAR IDENTIFICADOR DEL COMUNICADO
  // --------------------------------------------------

  const id = validarIdComunicado(comunicadoId);

  if (!id) {
    const error = new Error(
      'El identificador del comunicado no es válido.'
    );

    error.codigo = 400;
    throw error;
  }

  // --------------------------------------------------
  // 2. VALIDAR USUARIO AUTENTICADO
  // --------------------------------------------------

  if (
    typeof usuarioId !== 'string' ||
    !usuarioId.trim()
  ) {
    const error = new Error(
      'No se pudo identificar al usuario autenticado.'
    );

    error.codigo = 401;
    throw error;
  }

  // --------------------------------------------------
  // 3. VERIFICAR ACCESO AL COMUNICADO
  // --------------------------------------------------

  // Solo se permite registrar la lectura si:
  //
  // - El comunicado existe.
  // - Está publicado.
  // - El usuario es destinatario autorizado.

  const comunicado = await consultarDetalleComunicado({
    comunicadoId: id,
    usuarioId,
  });

  if (!comunicado) {
    const error = new Error(
      'El comunicado no existe o no está disponible.'
    );

    error.codigo = 404;
    throw error;
  }

  // --------------------------------------------------
  // 4. CONSULTAR LECTURA EXISTENTE
  // --------------------------------------------------

  const {
    data: lecturaExistente,
    error: errorConsulta,
  } = await supabaseAdmin
    .from('comunicados_lecturas')
    .select(
      'id, comunicado_id, usuario_id, leido, fecha_lectura'
    )
    .eq('comunicado_id', id)
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  if (errorConsulta) {
    console.error(
      '[HU-12] Error consultando lectura:',
      errorConsulta.message
    );

    throw errorConsulta;
  }

  // --------------------------------------------------
  // 5. SI YA ESTÁ LEÍDO, NO DUPLICAR
  // --------------------------------------------------

  if (
    lecturaExistente &&
    lecturaExistente.leido === true
  ) {
    return {
      comunicadoId: id,
      usuarioId,
      leido: true,
      fechaLectura: lecturaExistente.fecha_lectura,
      lecturaRegistrada: false,
    };
  }

  // --------------------------------------------------
  // 6. REGISTRAR O ACTUALIZAR LECTURA
  // --------------------------------------------------

  // Se utiliza UPSERT con la restricción única:
  //
  // UNIQUE (comunicado_id, usuario_id)
  //
  // Esto impide crear registros duplicados.
  //
  // Si ya existía una fila con leido=false,
  // se actualizará a true.

  const {
    data: lectura,
    error: errorRegistro,
  } = await supabaseAdmin
    .from('comunicados_lecturas')
    .upsert(
      {
        comunicado_id: id,
        usuario_id: usuarioId,
        leido: true,
      },
      {
        onConflict: 'comunicado_id,usuario_id',
      }
    )
    .select(
      'id, comunicado_id, usuario_id, leido, fecha_lectura'
    )
    .single();

  if (errorRegistro) {
    console.error(
      '[HU-12] Error registrando lectura:',
      errorRegistro.message
    );

    throw errorRegistro;
  }

  // --------------------------------------------------
  // 7. DEVOLVER RESULTADO
  // --------------------------------------------------

  return {
    comunicadoId: lectura.comunicado_id,
    usuarioId: lectura.usuario_id,
    leido: lectura.leido,
    fechaLectura: lectura.fecha_lectura,
    lecturaRegistrada: true,
  };
}

// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {
  registrarLecturaComunicado,
};
