'use strict';

// ============================================================
// AULA-AI
// HU-12 - COMUNICADOS INSTITUCIONALES
// SERVICIO DE CONSULTA INDIVIDUAL
// ============================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

// ============================================================
// VALIDAR IDENTIFICADOR DEL COMUNICADO
// ============================================================

function validarIdComunicado(valor) {
  if (
    typeof valor !== 'string' &&
    typeof valor !== 'number'
  ) {
    return null;
  }

  if (
    typeof valor === 'string' &&
    !/^[1-9]\d*$/.test(valor)
  ) {
    return null;
  }

  const comunicadoId = Number(valor);

  return Number.isSafeInteger(comunicadoId) &&
    comunicadoId > 0
    ? comunicadoId
    : null;
}

// ============================================================
// CONSULTAR DETALLE DISPONIBLE PARA EL DESTINATARIO
// ============================================================

async function consultarDetalleComunicado({
  comunicadoId,
  usuarioId,
}) {
  const idValidado = validarIdComunicado(
    comunicadoId
  );

  if (idValidado === null) {
    throw new Error(
      'El identificador del comunicado no es válido.'
    );
  }

  if (
    typeof usuarioId !== 'string' ||
    !usuarioId.trim()
  ) {
    throw new Error(
      'El identificador del usuario es obligatorio.'
    );
  }

  const {
    data: relacion,
    error,
  } = await supabaseAdmin
    .from('comunicados_destinatarios')
    .select(`
      comunicados!inner (
        id,
        titulo,
        contenido,
        alcance_tipo,
        estado,
        fecha_publicacion,
        publicado_por
      )
    `)
    .eq('comunicado_id', idValidado)
    .eq('usuario_id', usuarioId)
    .eq('comunicados.estado', 'publicado')
    .maybeSingle();

  if (error) {
    console.error(
      '[HU-12] Error consultando detalle del comunicado:',
      error.message
    );

    throw error;
  }

  if (!relacion?.comunicados) {
    return null;
  }

  const comunicado = Array.isArray(
    relacion.comunicados
  )
    ? relacion.comunicados[0]
    : relacion.comunicados;

  if (
    !comunicado ||
    comunicado.estado !== 'publicado'
  ) {
    return null;
  }

  // ----------------------------------------------------------
  // 4. CONSULTAR ESTADO DE LECTURA DEL USUARIO
  // ----------------------------------------------------------

  const {
    data: lectura,
    error: errorLectura,
  } = await supabaseAdmin
    .from('comunicados_lecturas')
    .select(
      'leido, fecha_lectura'
    )
    .eq('comunicado_id', idValidado)
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  if (errorLectura) {
    console.error(
      '[HU-12] Error consultando lectura del comunicado:',
      errorLectura.message
    );

    throw errorLectura;
  }

  // ----------------------------------------------------------
  // 5. NORMALIZAR ESTADO DE LECTURA
  // ----------------------------------------------------------

  const leido = lectura?.leido === true;

  const fechaLectura = leido
    ? lectura.fecha_lectura
    : null;

  // ----------------------------------------------------------
  // 6. DEVOLVER DETALLE DEL COMUNICADO
  // ----------------------------------------------------------

  return {
    id: comunicado.id,
    titulo: comunicado.titulo,
    contenido: comunicado.contenido,
    alcanceTipo: comunicado.alcance_tipo,
    fechaPublicacion:
      comunicado.fecha_publicacion,
    publicadoPor: comunicado.publicado_por,

    // Estado de lectura HU-12
    leido,
    fechaLectura,
  };
}

// ============================================================
// EXPORTACIONES
// ============================================================

module.exports = {
  consultarDetalleComunicado,
  validarIdComunicado,
};
