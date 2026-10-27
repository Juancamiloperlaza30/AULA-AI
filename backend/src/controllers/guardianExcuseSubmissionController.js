'use strict';

// =====================================================
// AULA-AI | HU-09 | PASO 52.23
// ENVIO DE EXCUSAS CON SOPORTE PRIVADO
//
// REQUIERE:
// - verificarToken y permitirRoles en guardianRoutes
// - recibirSoporteExcusa antes del controlador
// - RPC hu09_crear_excusa_con_soporte
//
// NO habilitar la ruta POST hasta completar las
// verificaciones del siguiente paso.
// =====================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  guardarSoporteExcusa,
  eliminarSoporteExcusa,
} = require('../services/excuseStorageService');

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ESTADOS_ACTIVOS = [
  'pendiente_revision',
  'aprobada',
  'requiere_correccion',
];

function responderError(res, codigo, mensaje) {
  return res.status(codigo).json({
    success: false,
    message: mensaje,
  });
}

function convertirId(valor) {
  const texto = String(valor ?? '');

  if (!/^[1-9]\d*$/.test(texto)) {
    return null;
  }

  const numero = Number(texto);

  return Number.isSafeInteger(numero)
    ? numero
    : null;
}

async function buscarPorClave(acudienteId, clave) {
  const { data, error } = await supabaseAdmin
    .from('excusas')
    .select(`
      id,
      estudiante_id,
      asistencia_id,
      motivo,
      estado,
      created_at
    `)
    .eq('acudiente_id', acudienteId)
    .eq('clave_idempotencia', clave)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function buscarSoporte(excusaId) {
  const { data, error } = await supabaseAdmin
    .from('excusas_soportes')
    .select('id, storage_bucket, storage_path')
    .eq('excusa_id', excusaId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function verificarAutorizacion(
  acudienteId,
  estudianteId
) {
  const { data: vinculacion, error: errorVinculacion } =
    await supabaseAdmin
      .from('acudiente_estudiante')
      .select('id')
      .eq('acudiente_id', acudienteId)
      .eq('estudiante_id', estudianteId)
      .eq('activo', true)
      .eq('verificado', true)
      .maybeSingle();

  if (errorVinculacion) {
    throw errorVinculacion;
  }

  if (!vinculacion) {
    return false;
  }

  const { data: estudiante, error: errorEstudiante } =
    await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('id', estudianteId)
      .eq('rol', 'estudiante')
      .eq('activo', true)
      .maybeSingle();

  if (errorEstudiante) {
    throw errorEstudiante;
  }

  return Boolean(estudiante);
}

function coincideSolicitud(
  excusa,
  estudianteId,
  asistenciaId,
  motivo
) {
  return (
    excusa.estudiante_id === estudianteId &&
    Number(excusa.asistencia_id) === asistenciaId &&
    excusa.motivo === motivo
  );
}

async function confirmarEnvioExistente(
  acudienteId,
  clave,
  estudianteId,
  asistenciaId,
  motivo
) {
  const existente = await buscarPorClave(
    acudienteId,
    clave
  );

  if (!existente) {
    return null;
  }

  if (!coincideSolicitud(
    existente,
    estudianteId,
    asistenciaId,
    motivo
  )) {
    return {
      conflicto: true,
    };
  }

  const soporte = await buscarSoporte(existente.id);

  if (!soporte) {
    return {
      incompleta: true,
    };
  }

  return {
    excusa: existente,
    soporte,
  };
}

// =====================================================
// POST /api/guardian/estudiantes/:estudianteId/excusas
// =====================================================

async function crearExcusaAcudiente(req, res) {
  let soporteSubido = null;
  let referenciaConfirmada = false;
  let resultadoIncierto = false;

  const acudienteId = req.usuario?.id;
  const estudianteId = req.params.estudianteId;

  try {
    // 1. Verificar identidad y rol.
    if (
      !UUID_REGEX.test(String(acudienteId || '')) ||
      req.usuario?.rol !== 'acudiente'
    ) {
      return responderError(
        res,
        403,
        'No está autorizado para registrar excusas.'
      );
    }

    if (
      typeof estudianteId !== 'string' ||
      !UUID_REGEX.test(estudianteId)
    ) {
      return responderError(
        res,
        400,
        'El identificador del estudiante no es válido.'
      );
    }

    const asistenciaId = convertirId(
      req.body?.asistenciaId
    );

    const motivo = typeof req.body?.motivo === 'string'
      ? req.body.motivo.trim()
      : '';

    const claveIdempotencia =
      req.body?.claveIdempotencia;

    // 2. Validar el formulario.
    if (!asistenciaId) {
      return responderError(
        res,
        400,
        'Debe seleccionar una inasistencia válida.'
      );
    }

    if (
      motivo.length < 10 ||
      motivo.length > 2000
    ) {
      return responderError(
        res,
        400,
        'El motivo debe contener entre 10 y 2000 caracteres.'
      );
    }

    if (
      typeof claveIdempotencia !== 'string' ||
      !UUID_REGEX.test(claveIdempotencia)
    ) {
      return responderError(
        res,
        400,
        'La clave de envío no es válida.'
      );
    }

    if (!req.soporteValidado) {
      return responderError(
        res,
        400,
        'Debes adjuntar un soporte válido.'
      );
    }

    // 3. Comprobar autorización vigente.
    const autorizado = await verificarAutorizacion(
      acudienteId,
      estudianteId
    );

    if (!autorizado) {
      return responderError(
        res,
        403,
        'No tiene autorización vigente sobre este estudiante.'
      );
    }

    // 4. Reconocer reintentos ya confirmados.
    const anterior = await confirmarEnvioExistente(
      acudienteId,
      claveIdempotencia,
      estudianteId,
      asistenciaId,
      motivo
    );

    if (anterior?.conflicto) {
      return responderError(
        res,
        409,
        'Esta clave de envío pertenece a otra solicitud.'
      );
    }

    if (anterior?.incompleta) {
      return responderError(
        res,
        409,
        'Existe una solicitud sin soporte confirmado. Contacte a la institución.'
      );
    }

    if (anterior?.excusa) {
      return res.status(200).json({
        success: true,
        yaRegistrada: true,
        excusa: {
          id: anterior.excusa.id,
          estado: anterior.excusa.estado,
          createdAt: anterior.excusa.created_at,
        },
        message:
          'La solicitud ya estaba registrada.',
      });
    }

    // 5. Verificar que la ausencia siga registrada.
    const { data: asistencia, error: errorAsistencia } =
      await supabaseAdmin
        .from('asistencias')
        .select('id')
        .eq('id', asistenciaId)
        .eq('estudiante_id', estudianteId)
        .eq('estado', 'ausente')
        .maybeSingle();

    if (errorAsistencia) {
      throw errorAsistencia;
    }

    if (!asistencia) {
      return responderError(
        res,
        404,
        'No existe una inasistencia válida para justificar.'
      );
    }

    // 6. Comprobar solicitudes activas.
    const { data: activa, error: errorActiva } =
      await supabaseAdmin
        .from('excusas')
        .select('id')
        .eq('asistencia_id', asistenciaId)
        .in('estado', ESTADOS_ACTIVOS)
        .limit(1)
        .maybeSingle();

    if (errorActiva) {
      throw errorActiva;
    }

    if (activa) {
      return responderError(
        res,
        409,
        'Esta inasistencia ya tiene una solicitud activa.'
      );
    }

    // 7. Cargar soporte en Storage privado.
    soporteSubido = await guardarSoporteExcusa({
      acudienteId,
      estudianteId,
      soporte: req.soporteValidado,
    });

    // 8. Registrar en una unica transaccion PostgreSQL.
    // El RPC repite las validaciones de vinculacion,
    // inasistencia, duplicados y estado inicial.
    const { data: registros, error: errorRPC } =
      await supabaseAdmin.rpc(
        'hu09_crear_excusa_con_soporte',
        {
          p_acudiente_id: acudienteId,
          p_estudiante_id: estudianteId,
          p_asistencia_id: asistenciaId,
          p_motivo: motivo,
          p_clave_idempotencia:
            claveIdempotencia,
          p_storage_path:
            soporteSubido.storagePath,
          p_nombre_archivo:
            soporteSubido.nombreArchivo,
          p_tipo_mime:
            soporteSubido.tipoMime,
          p_tamano_bytes:
            soporteSubido.tamanoBytes,
        }
      );

    if (errorRPC) {
      // Si hubo un error HTTP o de red, el servidor
      // podria haber confirmado la transaccion.
      // No eliminamos nada sin verificar primero.
      if (
        !errorRPC.code ||
        String(errorRPC.code).startsWith('PGRST')
      ) {
        resultadoIncierto = true;
      }

      throw errorRPC;
    }

    const registro = Array.isArray(registros)
      ? registros[0]
      : registros;

    if (
      !registro?.excusa_id ||
      !registro?.estado
    ) {
      resultadoIncierto = true;
      throw new Error(
        'RPC_SIN_CONFIRMACION_COMPLETA'
      );
    }

    if (registro.ya_registrada === true) {
      // Se cargo un archivo nuevo innecesario por
      // un reintento simultaneo. El registro ya
      // existia y conserva su soporte original.
      try {
        await eliminarSoporteExcusa(
          soporteSubido.storagePath
        );
      } catch (errorLimpieza) {
        console.error(
          'HU-09 - Limpieza pendiente de soporte duplicado:',
          errorLimpieza.message
        );
      }
    } else {
      referenciaConfirmada = true;
    }

    return res.status(
      registro.ya_registrada ? 200 : 201
    ).json({
      success: true,
      yaRegistrada:
        registro.ya_registrada === true,
      excusa: {
        id: registro.excusa_id,
        estado: registro.estado,
        createdAt: registro.fecha_registro,
      },
      message:
        'Excusa académica enviada correctamente. Tu solicitud está pendiente de revisión.',
    });

  } catch (error) {
    console.error(
      'HU-09 - Error enviando excusa:',
      error?.message || error
    );

    // 9. Recuperación después de un error.
    if (
      soporteSubido &&
      !referenciaConfirmada
    ) {
      let confirmacion = null;

      try {
        const clave = req.body?.claveIdempotencia;
        const asistenciaId = convertirId(
          req.body?.asistenciaId
        );
        const motivo =
          String(req.body?.motivo || '').trim();

        if (
          UUID_REGEX.test(String(acudienteId || '')) &&
          UUID_REGEX.test(String(clave || ''))
        ) {
          confirmacion = await confirmarEnvioExistente(
            acudienteId,
            clave,
            estudianteId,
            asistenciaId,
            motivo
          );
        }

        if (confirmacion?.excusa) {
          // La solicitud ya existe; no afirmar un fallo.
          // El nuevo archivo puede ser sobrante.
          if (
            confirmacion.soporte.storage_path !==
            soporteSubido.storagePath
          ) {
            try {
              await eliminarSoporteExcusa(
                soporteSubido.storagePath
              );
            } catch (errorLimpieza) {
              console.error(
                'HU-09 - Limpieza pendiente:',
                errorLimpieza.message
              );
            }
          }

          return res.status(200).json({
            success: true,
            yaRegistrada: true,
            excusa: {
              id: confirmacion.excusa.id,
              estado: confirmacion.excusa.estado,
              createdAt:
                confirmacion.excusa.created_at,
            },
            message:
              'La solicitud ya estaba registrada.',
          });
        }

        if (
          !resultadoIncierto &&
          !confirmacion?.incompleta &&
          !confirmacion?.conflicto
        ) {
          await eliminarSoporteExcusa(
            soporteSubido.storagePath
          );
        }
      } catch (errorRecuperacion) {
        console.error(
          'HU-09 - Estado pendiente de conciliacion:',
          errorRecuperacion.message
        );
      }
    }

    return responderError(
      res,
      resultadoIncierto ? 503 : 409,
      'No fue posible confirmar el envío. Consulte el estado de la solicitud antes de reintentar.'
    );
  }
}

module.exports = {
  crearExcusaAcudiente,
};
