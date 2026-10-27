'use strict';

// ======================================================
// AULA-AI | HU-12
// SERVICIO DE PROCESAMIENTO DE NOTIFICACIONES FCM
//
// ETAPA 1:
// - Consultar un envío institucional.
// - Validar su notificación.
// - Validar su dispositivo.
// - Comprobar que el destinatario corresponde.
// - Preparar los datos necesarios para Firebase.
//
// IMPORTANTE:
// Esta versión NO realiza envíos a Firebase.
// Tampoco modifica registros de Supabase.
// ======================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

// ======================================================
// VALIDAR IDENTIFICADOR
// ======================================================

function validarIdEnvio(valor) {
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
      'El identificador del envío no es válido.'
    );

    error.statusCode = 400;

    throw error;
  }

  return numero;
}

// ======================================================
// CONSULTAR ENVÍO INSTITUCIONAL
// ======================================================

async function consultarEnvioInstitucional(envioId) {
  const id = validarIdEnvio(envioId);

  const {
    data: envio,
    error: errorEnvio,
  } = await supabaseAdmin
    .from('notificaciones_envios')
    .select(
      [
        'id',
        'notificacion_id',
        'dispositivo_id',
        'estado',
        'intentos',
        'ultimo_error',
        'identificador_fcm',
        'fecha_ultimo_intento',
        'fecha_aceptacion',
      ].join(',')
    )
    .eq('id', id)
    .maybeSingle();

  if (errorEnvio) {
    throw errorEnvio;
  }

  if (!envio) {
    const error = new Error(
      'El envío institucional no existe.'
    );

    error.statusCode = 404;

    throw error;
  }

  return envio;
}

// ======================================================
// CONSULTAR NOTIFICACIÓN ASOCIADA
// ======================================================

async function consultarNotificacionAsociada(
  notificacionId
) {
  const {
    data: notificacion,
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
    .eq('id', notificacionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!notificacion) {
    const errorNoEncontrada = new Error(
      'La notificación asociada no existe.'
    );

    errorNoEncontrada.statusCode = 404;

    throw errorNoEncontrada;
  }

  if (
    notificacion.tipo !== 'comunicado' ||
    notificacion.comunicado_id === null
  ) {
    const errorTipo = new Error(
      'La notificación no corresponde a un comunicado institucional.'
    );

    errorTipo.statusCode = 400;

    throw errorTipo;
  }

  return notificacion;
}

// ======================================================
// CONSULTAR DISPOSITIVO ASOCIADO
// ======================================================

async function consultarDispositivoAsociado(
  dispositivoId
) {
  const {
    data: dispositivo,
    error,
  } = await supabaseAdmin
    .from('dispositivos_push')
    .select(
      [
        'id',
        'usuario_id',
        'token_fcm',
        'plataforma',
        'activo',
      ].join(',')
    )
    .eq('id', dispositivoId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!dispositivo) {
    const errorNoEncontrado = new Error(
      'El dispositivo asociado no existe.'
    );

    errorNoEncontrado.statusCode = 404;

    throw errorNoEncontrado;
  }

  return dispositivo;
}

// ======================================================
// PREPARAR DATOS DEL ENVÍO
// ======================================================

async function prepararDatosEnvioInstitucional({
  envioId,
} = {}) {
  const envio =
    await consultarEnvioInstitucional(envioId);

  const notificacion =
    await consultarNotificacionAsociada(
      envio.notificacion_id
    );

  const dispositivo =
    await consultarDispositivoAsociado(
      envio.dispositivo_id
    );

  // --------------------------------------------------
  // VALIDAR QUE EL DISPOSITIVO PERTENECE AL DESTINATARIO
  // --------------------------------------------------

  if (
    dispositivo.usuario_id !==
    notificacion.usuario_id
  ) {
    const error = new Error(
      'El dispositivo no pertenece al destinatario de la notificación.'
    );

    error.statusCode = 409;

    throw error;
  }

  // --------------------------------------------------
  // VALIDAR ESTADO DEL DISPOSITIVO
  // --------------------------------------------------

  if (!dispositivo.activo) {
    const error = new Error(
      'El dispositivo destinatario está inactivo.'
    );

    error.statusCode = 409;

    throw error;
  }

  // --------------------------------------------------
  // VALIDAR TOKEN FCM
  // --------------------------------------------------

  if (
    typeof dispositivo.token_fcm !== 'string' ||
    dispositivo.token_fcm.trim().length === 0
  ) {
    const error = new Error(
      'El dispositivo no tiene un token FCM válido.'
    );

    error.statusCode = 409;

    throw error;
  }

  // --------------------------------------------------
  // VALIDAR QUE EL ENVÍO CONTINÚA PENDIENTE
  // --------------------------------------------------

  if (envio.estado !== 'pendiente') {
    const error = new Error(
      `El envío no está pendiente. Estado actual: ${envio.estado}.`
    );

    error.statusCode = 409;

    throw error;
  }

  // --------------------------------------------------
  // DEVOLVER INFORMACIÓN PREPARADA
  // --------------------------------------------------

  return {
    envioId: envio.id,

    notificacionId: notificacion.id,

    comunicadoId: notificacion.comunicado_id,

    usuarioId: notificacion.usuario_id,

    dispositivoId: dispositivo.id,

    plataforma: dispositivo.plataforma,

    titulo: notificacion.titulo,

    mensaje: notificacion.mensaje,

    tokenFcm: dispositivo.token_fcm,

    estadoEnvio: envio.estado,

    intentos: envio.intentos,

    data: {
      tipo: 'comunicado',
      comunicadoId: String(
        notificacion.comunicado_id
      ),
      notificacionId: String(
        notificacion.id
      ),
    },
  };
}

// ======================================================
// AULA-AI | HU-12
// PROCESAMIENTO CONTROLADO DE ENVIOS FCM
// ======================================================

const {
  enviarNotificacionPush,
} = require('./pushService');

// ======================================================
// RESERVAR ENVIO
// ======================================================

async function reservarEnvioInstitucional(envioId) {
  const id = validarIdEnvio(envioId);

  const { data, error } = await supabaseAdmin.rpc(
    'reservar_envio_institucional_hu12',
    {
      p_envio_id: id,
    }
  );

  if (error) {
    throw error;
  }

  return Array.isArray(data) && data.length > 0
    ? data[0]
    : null;
}

// ======================================================
// FINALIZAR ENVIO
// ======================================================

async function finalizarEnvioInstitucional({
  envioId,
  intento,
  exitoso,
  identificadorFcm = null,
  errorMensaje = null,
}) {
  const { data, error } = await supabaseAdmin.rpc(
    'finalizar_envio_institucional_hu12',
    {
      p_envio_id: validarIdEnvio(envioId),
      p_intento: intento,
      p_exitoso: exitoso,
      p_identificador_fcm: identificadorFcm,
      p_error: errorMensaje,
    }
  );

  if (error) {
    throw error;
  }

  return Array.isArray(data) && data.length > 0
    ? data[0]
    : null;
}

// ======================================================
// AULA-AI | HU-12
// PROCESAMIENTO SEGURO DE NOTIFICACIONES FCM
// ======================================================

async function procesarEnvioInstitucional({
  envioId,
  simulacion = true,
} = {}) {

  // --------------------------------------------------
  // 1. VALIDAR Y PREPARAR INFORMACION
  // --------------------------------------------------

  const datos = await prepararDatosEnvioInstitucional({
    envioId,
  });

  // --------------------------------------------------
  // 2. MODO SIMULACION
  // --------------------------------------------------

  if (simulacion) {
    return {
      simulacion: true,
      envioId: datos.envioId,
      notificacionId: datos.notificacionId,
      comunicadoId: datos.comunicadoId,
      dispositivoId: datos.dispositivoId,
      estado: datos.estadoEnvio,
      titulo: datos.titulo,
      mensaje: datos.mensaje,
      tokenDisponible: Boolean(datos.tokenFcm),
      mensajeResultado:
        'Simulación completada. No se enviaron mensajes a Firebase.',
    };
  }

  // --------------------------------------------------
  // 3. RESERVAR ENVIO ATOMICAMENTE
  // --------------------------------------------------

  const reserva = await reservarEnvioInstitucional(
    datos.envioId
  );

  if (!reserva) {
    return {
      envioId: datos.envioId,
      procesado: false,
      motivo:
        'El envío ya fue reservado o no se encuentra pendiente.',
    };
  }

  // --------------------------------------------------
  // 4. VERIFICAR NUEVAMENTE EL DISPOSITIVO
  // --------------------------------------------------

  const dispositivoActual =
    await consultarDispositivoAsociado(
      datos.dispositivoId
    );

  if (
    dispositivoActual.usuario_id !== datos.usuarioId ||
    dispositivoActual.activo !== true ||
    typeof dispositivoActual.token_fcm !== 'string' ||
    dispositivoActual.token_fcm.trim() === ''
  ) {
    const resultado = await finalizarEnvioInstitucional({
      envioId: datos.envioId,
      intento: reserva.intentos,
      exitoso: false,
      errorMensaje:
        'El dispositivo dejó de estar disponible antes del envío.',
    });

    return {
      envioId: datos.envioId,
      procesado: true,
      aceptadoPorFirebase: false,
      resultado,
      motivo: 'Dispositivo no disponible.',
    };
  }

  // --------------------------------------------------
  // 5. REALIZAR UN UNICO INTENTO FCM
  // --------------------------------------------------

  let identificadorFcm;

  try {
    identificadorFcm =
      await enviarNotificacionPush({
        tokenFcm: dispositivoActual.token_fcm,
        titulo: datos.titulo,
        mensaje: datos.mensaje,
        data: datos.data,
      });
  } catch (errorFirebase) {
    const codigoFirebase = String(
      errorFirebase.code || ''
    ).toLowerCase();

    const mensajeFirebase = String(
      errorFirebase.message ||
      'Firebase no confirmó el resultado del envío.'
    );

    // Estos errores permiten identificar un rechazo
    // explícito del token por parte de Firebase.
    const erroresDefinitivos = new Set([
      'messaging/invalid-registration-token',
      'messaging/registration-token-not-registered',
      'messaging/invalid-argument',
      'messaging/mismatched-credential',
      'messaging/sender-id-mismatch',
    ]);

    const rechazoConfirmado =
      erroresDefinitivos.has(codigoFirebase);

    if (!rechazoConfirmado) {
      // El resultado puede ser incierto.
      // Conservamos el estado "procesando" para
      // impedir reintentos automáticos.

      return {
        envioId: datos.envioId,
        procesado: true,
        aceptadoPorFirebase: null,
        estado: 'procesando',
        requiereRevisionManual: true,
        reintentoAutomatico: false,
        codigoFirebase: codigoFirebase || 'NO_DISPONIBLE',
        mensajeResultado:
          'Firebase no confirmó el resultado. El envío permanece reservado para revisión manual.',
      };
    }

    // Firebase confirmó un rechazo.
    const resultadoError =
      await finalizarEnvioInstitucional({
        envioId: datos.envioId,
        intento: reserva.intentos,
        exitoso: false,
        errorMensaje: mensajeFirebase.slice(0, 2000),
      });

    if (!resultadoError) {
      throw new Error(
        'Firebase rechazó el envío, pero Supabase no confirmó el registro del error.'
      );
    }

    return {
      envioId: datos.envioId,
      procesado: true,
      aceptadoPorFirebase: false,
      estado: 'error',
      resultado: resultadoError,
      reintentoAutomatico: false,
      codigoFirebase,
      mensajeResultado:
        'Firebase rechazó el mensaje y el error fue registrado.',
    };
  }

  // --------------------------------------------------
  // 6. FIREBASE ACEPTO EL MENSAJE
  // --------------------------------------------------

  // Esta operación está fuera del catch de Firebase.
  // Un error de Supabase no debe registrarse como
  // un fallo de envío de Firebase.

  const resultadoFinal =
    await finalizarEnvioInstitucional({
      envioId: datos.envioId,
      intento: reserva.intentos,
      exitoso: true,
      identificadorFcm,
    });

  if (!resultadoFinal) {
    const error = new Error(
      'Firebase aceptó el mensaje, pero Supabase no confirmó el registro. Requiere revisión manual.'
    );

    error.statusCode = 409;

    throw error;
  }

  // --------------------------------------------------
  // 7. RESULTADO EXITOSO
  // --------------------------------------------------

  return {
    envioId: datos.envioId,
    procesado: true,
    aceptadoPorFirebase: true,
    resultado: resultadoFinal,
    mensajeResultado:
      'Firebase aceptó la notificación y Supabase registró el resultado.',
  };
}

// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {
  validarIdEnvio,
  consultarEnvioInstitucional,
  consultarNotificacionAsociada,
  consultarDispositivoAsociado,
  prepararDatosEnvioInstitucional,
  reservarEnvioInstitucional,
  finalizarEnvioInstitucional,
  procesarEnvioInstitucional,
};
