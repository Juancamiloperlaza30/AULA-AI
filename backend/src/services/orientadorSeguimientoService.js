'use strict';

// ======================================================
// AULA-AI | HU-10
// SERVICIO DE SEGUIMIENTOS DEL ORIENTADOR
// ======================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  verificarAccesoOrientadorAlerta,
} = require('./orientadorAuthorizationService');

const TIPOS_INTERVENCION = Object.freeze([
  'observacion',
  'entrevista',
  'contacto_acudiente',
  'plan_mejora',
  'remision',
  'cierre',
]);

const MAX_OBSERVACION = 3000;

function validarIdPositivo(valor) {
  const texto = String(valor ?? '');

  if (!/^[1-9]\d*$/.test(texto)) {
    return null;
  }

  const numero = Number(texto);

  return Number.isSafeInteger(numero)
    ? numero
    : null;
}

function validarFechaRevision(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    return null;
  }

  if (
    typeof valor !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(valor)
  ) {
    throw new Error(
      'La próxima revisión debe tener formato AAAA-MM-DD.'
    );
  }

  const fecha = new Date(`${valor}T00:00:00Z`);

  if (
    Number.isNaN(fecha.getTime()) ||
    fecha.toISOString().slice(0, 10) !== valor
  ) {
    throw new Error(
      'La fecha de próxima revisión no es válida.'
    );
  }

  return valor;
}

function validarDatosSeguimiento(datos) {
  if (
    !datos ||
    typeof datos !== 'object' ||
    Array.isArray(datos)
  ) {
    return {
      valido: false,
      mensaje: 'Los datos del seguimiento no son válidos.',
    };
  }

  const tipo = datos.tipo_intervencion;

  if (!TIPOS_INTERVENCION.includes(tipo)) {
    return {
      valido: false,
      mensaje: 'El tipo de intervención no está permitido.',
    };
  }

  if (typeof datos.observacion !== 'string') {
    return {
      valido: false,
      mensaje: 'La observación es obligatoria.',
    };
  }

  const observacion = datos.observacion.trim();

  if (
    observacion.length < 1 ||
    observacion.length > MAX_OBSERVACION
  ) {
    return {
      valido: false,
      mensaje:
        'La observación debe tener entre 1 y 3000 caracteres.',
    };
  }

  let proximaRevision;

  try {
    proximaRevision = validarFechaRevision(
      datos.proxima_revision
    );
  } catch (error) {
    return {
      valido: false,
      mensaje: error.message,
    };
  }

  return {
    valido: true,
    datos: {
      tipo_intervencion: tipo,
      observacion,
      proxima_revision: proximaRevision,
    },
  };
}

// ======================================================
// REGISTRAR UNA INTERVENCIÓN
// ======================================================

async function registrarSeguimientoOrientador({
  orientadorId,
  alertaId,
  datos,
}) {
  const idAlerta = validarIdPositivo(alertaId);

  if (!idAlerta) {
    return {
      status: 400,
      mensaje: 'El identificador de la alerta no es válido.',
    };
  }

  const validacion = validarDatosSeguimiento(datos);

  if (!validacion.valido) {
    return {
      status: 400,
      mensaje: validacion.mensaje,
    };
  }

  // Verificar autorización académica antes
  // de consultar o modificar información.

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

  // Confirmar que la alerta sigue disponible.

  const {
    data: alerta,
    error: errorAlerta,
  } = await supabaseAdmin
    .from('alertas_academicas')
    .select('id, estudiante_id, estado')
    .eq('id', idAlerta)
    .eq('estudiante_id', acceso.estudianteId)
    .maybeSingle();

  if (errorAlerta) {
    throw errorAlerta;
  }

  if (!alerta) {
    return {
      status: 404,
      mensaje: 'Alerta no encontrada o no autorizada.',
    };
  }

  // En esta primera implementación no permitimos
  // intervenciones nuevas sobre alertas resueltas.
  // Tampoco permitimos registrar un cierre hasta
  // implementar la transición de estados.

  if (alerta.estado === 'resuelta') {
    return {
      status: 409,
      mensaje:
        'No se pueden registrar intervenciones sobre una alerta resuelta.',
    };
  }

  if (validacion.datos.tipo_intervencion === 'cierre') {
    return {
      status: 409,
      mensaje:
        'Para cerrar una alerta, utilice la operación de cierre manual del orientador.',
    };
  }

  const {
    data: seguimiento,
    error: errorSeguimiento,
  } = await supabaseAdmin
    .from('alertas_seguimientos')
    .insert({
      alerta_id: idAlerta,
      orientador_id: orientadorId,
      tipo_intervencion:
        validacion.datos.tipo_intervencion,
      observacion:
        validacion.datos.observacion,
      proxima_revision:
        validacion.datos.proxima_revision,
    })
    .select(`
      id,
      alerta_id,
      orientador_id,
      tipo_intervencion,
      observacion,
      proxima_revision,
      created_at,
      updated_at
    `)
    .single();

  if (errorSeguimiento) {
    throw errorSeguimiento;
  }

  return {
    status: 201,
    seguimiento,
  };
}

async function listarSeguimientosOrientador({
  orientadorId,
  alertaId,
}) {
  const idAlerta = validarIdPositivo(alertaId);

  if (!idAlerta) {
    return {
      status: 400,
      mensaje: 'El identificador de la alerta no es válido.',
    };
  }

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

  const {
    data,
    error,
  } = await supabaseAdmin
    .from('alertas_seguimientos')
    .select(`
      id,
      alerta_id,
      orientador_id,
      tipo_intervencion,
      observacion,
      proxima_revision,
      created_at,
      updated_at
    `)
    .eq('alerta_id', idAlerta)
    .order('created_at', {
      ascending: false,
    })
    .order('id', {
      ascending: false,
    })
    .limit(100);

  if (error) {
    throw error;
  }

  return {
    status: 200,
    seguimientos: data || [],
  };
}

module.exports = {
  TIPOS_INTERVENCION,
  registrarSeguimientoOrientador,
  listarSeguimientosOrientador,
};
