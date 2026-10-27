'use strict';

const { supabaseAdmin } = require('../config/supabase');
const {
  enviarNotificacionesMultiples,
} = require('../services/pushService');

const ESTADO_PENDIENTE = 'pendiente_revision';

function obtenerIdExcusa(req, res) {
  const id = Number(req.params.excusaId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({
      ok: false,
      mensaje: 'El identificador de la excusa no es válido.',
    });
    return null;
  }

  return id;
}

function responderError(res, error, mensaje) {
  console.error(`[HU-09] ${mensaje}:`, error);

  return res.status(500).json({
    ok: false,
    mensaje,
  });
}

// Determina si el usuario puede revisar la excusa.
// Coordinador: acceso institucional.
// Docente: debe haber registrado la asistencia.
async function verificarAcceso(usuario, excusa) {
  if (usuario.rol === 'coordinador') {
    return true;
  }

  if (usuario.rol !== 'docente') {
    return false;
  }

  const { data: asistencia, error } = await supabaseAdmin
    .from('asistencias')
    .select('id, docente_id, estudiante_id')
    .eq('id', excusa.asistencia_id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (
    asistencia?.docente_id === usuario.id &&
    asistencia?.estudiante_id === excusa.estudiante_id
  );
}

async function buscarExcusa(id) {
  const { data, error } = await supabaseAdmin
    .from('excusas')
    .select(`
      id,
      asistencia_id,
      estudiante_id,
      acudiente_id,
      motivo,
      estado,
      observacion_revision,
      revisado_por,
      revisado_at,
      vista_at,
      vista_por,
      revision_asignada_a,
      revision_iniciada_at,
      created_at,
      updated_at
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function obtenerExcusaAutorizada(req, res) {
  const id = obtenerIdExcusa(req, res);

  if (id === null) {
    return null;
  }

  const excusa = await buscarExcusa(id);

  if (!excusa) {
    res.status(404).json({
      ok: false,
      mensaje: 'No se encontró la excusa.',
    });
    return null;
  }

  const autorizado = await verificarAcceso(
    req.usuario,
    excusa
  );

  if (!autorizado) {
    res.status(403).json({
      ok: false,
      mensaje: 'No tienes permiso para revisar esta excusa.',
    });
    return null;
  }

  return excusa;
}

// ======================================================
// GET /api/excuse-review
// ======================================================

async function listarExcusasRevision(req, res) {
  try {
    let consulta = supabaseAdmin
      .from('excusas')
      .select(`
        id,
        asistencia_id,
        estudiante_id,
        acudiente_id,
        motivo,
        estado,
        vista_at,
        revision_asignada_a,
        revision_iniciada_at,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    if (req.usuario.rol === 'docente') {
      const { data: asistencias, error } =
        await supabaseAdmin
          .from('asistencias')
          .select('id')
          .eq('docente_id', req.usuario.id);

      if (error) {
        throw error;
      }

      const ids = (asistencias || []).map(
        (asistencia) => asistencia.id
      );

      if (ids.length === 0) {
        return res.json({
          ok: true,
          excusas: [],
        });
      }

      consulta = consulta.in('asistencia_id', ids);
    }

    const { data, error } = await consulta;

    if (error) {
      throw error;
    }

    return res.json({
      ok: true,
      excusas: data || [],
    });
  } catch (error) {
    return responderError(
      res,
      error,
      'No fue posible consultar las excusas.'
    );
  }
}

// ======================================================
// GET /api/excuse-review/:excusaId
// ======================================================

async function obtenerDetalleExcusa(req, res) {
  try {
    const excusa = await obtenerExcusaAutorizada(
      req,
      res
    );

    if (!excusa) {
      return;
    }

    // Registro de primera visualización.
    // La condición evita reemplazar al primer usuario.
    if (!excusa.vista_at) {
      const { error } = await supabaseAdmin
        .from('excusas')
        .update({
          vista_at: new Date().toISOString(),
          vista_por: req.usuario.id,
        })
        .eq('id', excusa.id)
        .is('vista_at', null);

      if (error) {
        throw error;
      }
    }

    const actualizada = await buscarExcusa(excusa.id);

    return res.json({
      ok: true,
      excusa: actualizada,
    });
  } catch (error) {
    return responderError(
      res,
      error,
      'No fue posible consultar el detalle.'
    );
  }
}

// ======================================================
// POST /api/excuse-review/:excusaId/asumir
// ======================================================

async function asumirRevisionExcusa(req, res) {
  try {
    const excusa = await obtenerExcusaAutorizada(
      req,
      res
    );

    if (!excusa) {
      return;
    }

    if (excusa.estado !== ESTADO_PENDIENTE) {
      return res.status(409).json({
        ok: false,
        mensaje: 'Esta excusa ya no está pendiente.',
      });
    }

    if (
      excusa.revision_asignada_a &&
      excusa.revision_asignada_a !== req.usuario.id
    ) {
      return res.status(409).json({
        ok: false,
        mensaje: 'Otro responsable ya asumió esta revisión.',
      });
    }

    // Actualización condicional para evitar que dos
    // responsables asuman una excusa simultáneamente.
    const { data, error } = await supabaseAdmin
      .from('excusas')
      .update({
        revision_asignada_a: req.usuario.id,
        revision_iniciada_at: new Date().toISOString(),
      })
      .eq('id', excusa.id)
      .eq('estado', ESTADO_PENDIENTE)
      .is('revision_asignada_a', null)
      .select('id, revision_asignada_a')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      const actualizada = await buscarExcusa(excusa.id);

      if (
        actualizada?.estado === ESTADO_PENDIENTE &&
        actualizada?.revision_asignada_a === req.usuario.id
      ) {
        return res.json({
          ok: true,
          mensaje: 'Ya tienes asignada esta revisión.',
          excusa: actualizada,
        });
      }

      return res.status(409).json({
        ok: false,
        mensaje: 'La excusa fue asumida o modificada por otro responsable.',
      });
    }

    return res.json({
      ok: true,
      mensaje: 'Has asumido la revisión de esta excusa.',
      excusa: await buscarExcusa(excusa.id),
    });
  } catch (error) {
    return responderError(
      res,
      error,
      'No fue posible asumir la revisión.'
    );
  }
}

// ======================================================
// NOTIFICACION AL ACUDIENTE
// ======================================================

async function notificarDecision(excusa, decision) {
  const { data: dispositivos, error } =
    await supabaseAdmin
      .from('dispositivos_push')
      .select('token_fcm')
      .eq('usuario_id', excusa.acudiente_id)
      .eq('activo', true);

  if (error) {
    throw error;
  }

  const tokens = [
    ...new Set(
      (dispositivos || [])
        .map((dispositivo) => dispositivo.token_fcm)
        .filter(Boolean)
    ),
  ];

  console.log('[HU-09 PUSH] Preparando notificación:', {
    excusaId: excusa.id,
    acudienteId: excusa.acudiente_id,
    decision,
    dispositivosEncontrados: tokens.length,
  });

  if (tokens.length === 0) {
    console.warn(
      '[HU-09 PUSH] No hay dispositivos activos para el acudiente.'
    );

    return false;
  }

  const respuesta = await enviarNotificacionesMultiples({
    tokens,
    titulo: 'Actualización de excusa académica',
    mensaje:
      decision === 'aprobada'
        ? 'La institución aprobó una excusa académica.'
        : 'La institución rechazó una excusa académica.',
    data: {
      tipo: 'excusa_revision',
      excusaId: String(excusa.id),
      estado: decision,
    },
  });

  const enviados = respuesta?.successCount ?? 0;
  const fallidos = respuesta?.failureCount ?? 0;

  console.log('[HU-09 PUSH] Resultado de Firebase:', {
    excusaId: excusa.id,
    enviados,
    fallidos,
  });

  if (fallidos > 0) {
    (respuesta.responses || []).forEach((resultado, indice) => {
      if (!resultado.success) {
        console.error('[HU-09 PUSH] Error de Firebase:', {
          indice,
          codigo: resultado.error?.code || 'desconocido',
          mensaje: resultado.error?.message || 'Sin detalle',
        });
      }
    });
  }

  return enviados > 0;
}

// ======================================================
// POST /api/excuse-review/:excusaId/resolver
// ======================================================

async function resolverExcusa(req, res) {
  try {
    const excusa = await obtenerExcusaAutorizada(
      req,
      res
    );

    if (!excusa) {
      return;
    }

    const decision = req.body?.decision;
    const observacion = req.body?.observacion;

    if (!['aprobada', 'rechazada'].includes(decision)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'La decisión debe ser aprobada o rechazada.',
      });
    }

    if (
      typeof observacion !== 'string' ||
      observacion.trim().length === 0 ||
      observacion.length > 2000
    ) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Debes escribir una observación válida.',
      });
    }

    // La función SQL bloquea la fila, verifica
    // permisos y registra la decisión atómicamente.
    const { data, error } = await supabaseAdmin.rpc(
      'hu09_resolver_excusa',
      {
        p_excusa_id: excusa.id,
        p_responsable_id: req.usuario.id,
        p_decision: decision,
        p_observacion: observacion.trim(),
      }
    );

    if (error) {
      console.error('[HU-09] Error al resolver:', error);

      return res.status(409).json({
        ok: false,
        mensaje:
          'No se pudo resolver la excusa. Comprueba que siga pendiente y que tengas autorización.',
      });
    }

    const resultado = Array.isArray(data)
      ? data[0]
      : data;

    if (!resultado) {
      return res.status(500).json({
        ok: false,
        mensaje: 'No se recibió la decisión registrada.',
      });
    }

    // La decisión ya está guardada. Una falla de
    // Firebase no debe revertirla.
    let notificacionEnviada = false;

    try {
      notificacionEnviada = await notificarDecision(
        excusa,
        decision
      );
    } catch (errorPush) {
      console.error(
        '[HU-09] No se pudo enviar la notificación:',
        errorPush
      );
    }

    return res.json({
      ok: true,
      mensaje:
        decision === 'aprobada'
          ? 'La excusa fue aprobada correctamente.'
          : 'La excusa fue rechazada correctamente.',
      resultado,
      notificacionEnviada,
    });
  } catch (error) {
    return responderError(
      res,
      error,
      'Ocurrió un error al resolver la excusa.'
    );
  }
}

module.exports = {
  listarExcusasRevision,
  obtenerDetalleExcusa,
  asumirRevisionExcusa,
  resolverExcusa,
};
