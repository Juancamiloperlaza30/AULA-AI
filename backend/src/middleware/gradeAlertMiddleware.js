'use strict';

// ======================================================
// AULA-AI | HU-08
// MIDDLEWARE DE INTEGRACIÓN DE ALERTAS POR NOTAS
//
// Se coloca ANTES de los controladores de guardado.
//
// - No modifica la lógica de calificaciones.
// - Solo evalúa operaciones HTTP exitosas.
// - Procesa registros docentes masivos.
// - Procesa correcciones administrativas.
// - Evita convertir errores de alertas en
//   errores de guardado de calificaciones.
// - No envía notificaciones push todavía.
//
// IMPORTANTE:
// La ejecución tras la respuesta HTTP es una
// integración inicial. No sustituye una cola
// persistente de eventos con reintentos.
// ======================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  procesarAlertasDeActividad,
} = require('../services/gradeAlertIntegrationService');

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ======================================================
// UTILIDADES
// ======================================================

function idValido(valor) {
  const numero = Number(valor);

  return Number.isSafeInteger(numero) &&
    numero > 0
    ? numero
    : null;
}

function uuidValido(valor) {
  return typeof valor === 'string' &&
    UUID_REGEX.test(valor);
}

function registrarError(error, contexto) {
  console.error(
    '[AULA-AI][HU-08] Error procesando alertas:',
    {
      contexto,
      mensaje:
        error?.message || 'Error desconocido',
    }
  );
}

async function procesarEvento({
  actividadId,
  estudiantesIds,
  contexto,
}) {
  try {
    const resultado =
      await procesarAlertasDeActividad({
        actividadId,
        estudiantesIds,
      });

    console.info(
      '[AULA-AI][HU-08] Evaluación académica:',
      {
        contexto,
        actividadId,
        procesados: resultado.procesados,
        exitosos: resultado.exitosos,
        fallidos: resultado.fallidos,
      }
    );

    if (resultado.fallidos > 0) {
      console.warn(
        '[AULA-AI][HU-08] Algunas alertas no pudieron evaluarse.',
        {
          contexto,
          fallidos: resultado.fallidos,
        }
      );
    }
  } catch (error) {
    registrarError(error, contexto);
  }
}

// ======================================================
// REGISTRO MASIVO DEL DOCENTE
//
// Antes de:
// registrarCalificacionesMasivas
// ======================================================

function alertasTrasRegistroDocente(
  req,
  res,
  next
) {
  const actividadId = idValido(
    req.body?.actividadId
  );

  const recibidas = req.body?.calificaciones;

  if (
    !actividadId ||
    !Array.isArray(recibidas) ||
    recibidas.length === 0
  ) {
    return next();
  }

  const estudiantesIds = [
    ...new Set(
      recibidas
        .map((item) => item?.estudianteId)
        .filter(uuidValido)
    ),
  ];

  if (estudiantesIds.length === 0) {
    return next();
  }

  // Solo se ejecuta al finalizar una respuesta
  // exitosa del controlador de calificaciones.
  res.once('finish', () => {
    if (
      res.statusCode < 200 ||
      res.statusCode >= 300
    ) {
      return;
    }

    // Se inicia sin bloquear la respuesta HTTP.
    // La siguiente fase incorporará una cola
    // persistente para garantizar reintentos.
    void procesarEvento({
      actividadId,
      estudiantesIds,
      contexto: 'registro_docente',
    });
  });

  return next();
}

// ======================================================
// CORRECCIÓN ADMINISTRATIVA
//
// Antes de:
// actualizarCalificacionAdministrativa
//
// El middleware consulta solamente la relación
// entre calificación, actividad y estudiante.
//
// El controlador original conserva todas las
// validaciones de permisos y realiza el guardado.
// ======================================================

async function alertasTrasCorreccionAdministrativa(
  req,
  res,
  next
) {
  try {
    const calificacionId = idValido(
      req.params?.calificacionId
    );

    if (!calificacionId) {
      return next();
    }

    const { data, error } = await supabaseAdmin
      .from('calificaciones')
      .select(`
        id,
        actividad_id,
        estudiante_id
      `)
      .eq('id', calificacionId)
      .maybeSingle();

    if (error) {
      // No impedir que el controlador original
      // procese o rechace la solicitud.
      registrarError(
        error,
        'consulta_previa_administrativa'
      );

      return next();
    }

    if (
      !data ||
      !idValido(data.actividad_id) ||
      !uuidValido(data.estudiante_id)
    ) {
      return next();
    }

    const actividadId = Number(
      data.actividad_id
    );

    const estudianteId =
      data.estudiante_id;

    res.once('finish', () => {
      if (
        res.statusCode < 200 ||
        res.statusCode >= 300
      ) {
        return;
      }

      void procesarEvento({
        actividadId,
        estudiantesIds: [
          estudianteId,
        ],
        contexto:
          'correccion_administrativa',
      });
    });

    return next();
  } catch (error) {
    registrarError(
      error,
      'middleware_administrativo'
    );

    return next();
  }
}

// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {
  alertasTrasRegistroDocente,
  alertasTrasCorreccionAdministrativa,
};
