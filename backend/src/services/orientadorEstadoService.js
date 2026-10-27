'use strict';

// ======================================================
// AULA-AI | HU-10
// GESTIÓN DE ESTADOS POR EL ORIENTADOR
// ======================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  verificarAccesoOrientadorAlerta,
} = require('./orientadorAuthorizationService');

async function iniciarSeguimientoOrientador({
  orientadorId,
  alertaId,
}) {
  // 1. Validar identificador.
  const textoId = String(alertaId ?? '');

  if (!/^[1-9]\d*$/.test(textoId)) {
    return {
      status: 400,
      mensaje: 'El identificador de la alerta no es válido.',
    };
  }

  const idAlerta = Number(textoId);

  if (!Number.isSafeInteger(idAlerta)) {
    return {
      status: 400,
      mensaje: 'El identificador de la alerta no es válido.',
    };
  }

  // 2. Verificar que el orientador tenga acceso.
  const acceso = await verificarAccesoOrientadorAlerta({
    orientadorId,
    alertaId: idAlerta,
  });

  if (!acceso.autorizado) {
    return {
      status: 404,
      mensaje: 'Alerta no encontrada o no autorizada.',
    };
  }

  // 3. Consultar el estado actual.
  const {
    data: alerta,
    error: errorConsulta,
  } = await supabaseAdmin
    .from('alertas_academicas')
    .select(`
      id,
      estudiante_id,
      estado,
      seguimiento_iniciado_at,
      seguimiento_iniciado_por
    `)
    .eq('id', idAlerta)
    .eq('estudiante_id', acceso.estudianteId)
    .maybeSingle();

  if (errorConsulta) {
    throw errorConsulta;
  }

  if (!alerta) {
    return {
      status: 404,
      mensaje: 'Alerta no encontrada o no autorizada.',
    };
  }

  // 4. No iniciar seguimiento de alertas resueltas.
  if (alerta.estado === 'resuelta') {
    return {
      status: 409,
      mensaje:
        'No se puede iniciar seguimiento de una alerta resuelta.',
    };
  }

  // 5. Evitar iniciar el mismo seguimiento dos veces.
  if (alerta.estado === 'en_seguimiento') {
    return {
      status: 409,
      mensaje:
        'La alerta ya se encuentra en seguimiento.',
    };
  }

  if (alerta.estado !== 'activa') {
    return {
      status: 409,
      mensaje:
        'La alerta no permite iniciar seguimiento.',
    };
  }

  // 6. Registrar responsable y fecha de inicio.
  const fechaInicio = new Date().toISOString();

  const {
    data: actualizada,
    error: errorActualizacion,
  } = await supabaseAdmin
    .from('alertas_academicas')
    .update({
      estado: 'en_seguimiento',
      seguimiento_iniciado_at: fechaInicio,
      seguimiento_iniciado_por: orientadorId,
    })
    .eq('id', idAlerta)
    .eq('estudiante_id', acceso.estudianteId)
    .eq('estado', 'activa')
    .is('seguimiento_iniciado_at', null)
    .select(`
      id,
      estudiante_id,
      tipo,
      nivel,
      titulo,
      estado,
      seguimiento_iniciado_at,
      seguimiento_iniciado_por,
      resuelta_at
    `)
    .maybeSingle();

  if (errorActualizacion) {
    throw errorActualizacion;
  }

  if (!actualizada) {
    return {
      status: 409,
      mensaje:
        'La alerta fue modificada por otro proceso. Consulte su estado actual.',
    };
  }

  return {
    status: 200,
    alerta: actualizada,
  };
}

async function cerrarAlertaOrientador({
  orientadorId,
  alertaId,
  motivo,
}) {
  const textoId = String(alertaId ?? '');

  if (!/^[1-9]\d*$/.test(textoId)) {
    return {
      status: 400,
      mensaje: 'El identificador de la alerta no es válido.',
    };
  }

  const idAlerta = Number(textoId);

  if (!Number.isSafeInteger(idAlerta)) {
    return {
      status: 400,
      mensaje: 'El identificador de la alerta no es válido.',
    };
  }

  if (typeof motivo !== 'string') {
    return {
      status: 400,
      mensaje: 'El motivo de cierre es obligatorio.',
    };
  }

  const motivoLimpio = motivo.trim();

  if (
    motivoLimpio.length < 10 ||
    motivoLimpio.length > 2000
  ) {
    return {
      status: 400,
      mensaje:
        'El motivo debe tener entre 10 y 2000 caracteres.',
    };
  }

  // Verificar autorización del orientador.
  const acceso = await verificarAccesoOrientadorAlerta({
    orientadorId,
    alertaId: idAlerta,
  });

  if (!acceso.autorizado) {
    return {
      status: 404,
      mensaje: 'Alerta no encontrada o no autorizada.',
    };
  }

  // Consultar el estado actual.
  const { data: alerta, error: errorConsulta } =
    await supabaseAdmin
      .from('alertas_academicas')
      .select(`
        id,
        estudiante_id,
        estado,
        seguimiento_iniciado_at,
        cierre_manual_at
      `)
      .eq('id', idAlerta)
      .eq('estudiante_id', acceso.estudianteId)
      .maybeSingle();

  if (errorConsulta) {
    throw errorConsulta;
  }

  if (!alerta) {
    return {
      status: 404,
      mensaje: 'Alerta no encontrada o no autorizada.',
    };
  }

  if (alerta.estado !== 'en_seguimiento') {
    return {
      status: 409,
      mensaje:
        'Solo se pueden cerrar alertas que estén en seguimiento.',
    };
  }

  if (!alerta.seguimiento_iniciado_at) {
    return {
      status: 409,
      mensaje:
        'La alerta no tiene un seguimiento formal iniciado.',
    };
  }

  if (alerta.cierre_manual_at) {
    return {
      status: 409,
      mensaje: 'Esta alerta ya tiene un cierre manual.',
    };
  }

  const fechaCierre = new Date().toISOString();

  // Registrar el cierre sin eliminar las intervenciones.
  const { data: actualizada, error: errorActualizacion } =
    await supabaseAdmin
      .from('alertas_academicas')
      .update({
        estado: 'resuelta',
        resuelta_at: fechaCierre,
        cierre_manual_at: fechaCierre,
        cierre_manual_por: orientadorId,
        motivo_cierre: motivoLimpio,
      })
      .eq('id', idAlerta)
      .eq('estudiante_id', acceso.estudianteId)
      .eq('estado', 'en_seguimiento')
      .is('cierre_manual_at', null)
      .select(`
        id,
        estudiante_id,
        estado,
        nivel,
        resuelta_at,
        cierre_manual_at,
        cierre_manual_por,
        motivo_cierre
      `)
      .maybeSingle();

  if (errorActualizacion) {
    throw errorActualizacion;
  }

  if (!actualizada) {
    return {
      status: 409,
      mensaje:
        'La alerta cambió durante la operación. Consulte su estado actual.',
    };
  }

  return {
    status: 200,
    alerta: actualizada,
  };
}

module.exports = {
  iniciarSeguimientoOrientador,
  cerrarAlertaOrientador,
};
