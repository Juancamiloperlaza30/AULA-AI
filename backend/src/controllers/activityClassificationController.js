
'use strict';

const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  procesarAlertasDeActividad,
} = require('../services/gradeAlertIntegrationService');

// =====================================================
// AULA-AI | HU-08
// CLASIFICACION DE ACTIVIDADES ACADEMICAS
//
// Funciones:
// - Consultar clasificacion e historial.
// - Actualizar clasificacion con autorizacion.
// - Ejecutar RPC transaccional de Supabase.
// - Recalcular alertas del grupo correspondiente.
//
// IMPORTANTE:
// - No elimina notas.
// - No elimina actividades ni entregas.
// - No permite modificar periodos cerrados.
// - La identidad procede del token verificado.
// =====================================================

const TAMANO_PAGINA = 500;

// =====================================================
// UTILIDADES
// =====================================================

function obtenerRelacion(valor) {
  if (Array.isArray(valor)) {
    return valor[0] || null;
  }

  return valor || null;
}

function validarActividadId(valor) {
  const numero = Number(valor);

  if (
    !Number.isSafeInteger(numero) ||
    numero <= 0
  ) {
    return null;
  }

  return numero;
}

// =====================================================
// CONSULTAR ACTIVIDAD
// =====================================================

async function obtenerActividad(actividadId) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from('actividades_academicas')
    .select(`
      id,
      titulo,
      estado,
      es_evaluable,
      materia_grupo_periodo_id,
      materia_grupo_periodo:materia_grupo_periodo_id (
        id,
        grado_id,
        grupo_id,
        periodo_id,
        periodo:periodos_academicos (
          id,
          nombre,
          estado_academico
        )
      )
    `)
    .eq('id', actividadId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

// =====================================================
// VALIDAR AMBITO DEL COORDINADOR
// =====================================================

async function verificarAmbitoCoordinador({
  coordinadorId,
  gradoId,
  grupoId,
}) {
  if (
    !coordinadorId ||
    !gradoId ||
    !grupoId
  ) {
    return false;
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from('coordinador_ambito')
    .select('id')
    .eq('coordinador_id', coordinadorId)
    .eq('grado_id', gradoId)
    .eq('grupo_id', grupoId)
    .eq('activo', true)
    .limit(1);

  if (error) {
    throw error;
  }

  return Array.isArray(data) && data.length > 0;
}

// =====================================================
// CONSULTAR ESTUDIANTES DEL GRADO Y GRUPO
// =====================================================

async function consultarEstudiantesGrupo({
  gradoId,
  grupoId,
}) {
  const estudiantes = [];
  let inicio = 0;

  while (true) {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from('estudiantes')
      .select('usuario_id')
      .eq('grado_id', gradoId)
      .eq('grupo_id', grupoId)
      .order('usuario_id', {
        ascending: true,
      })
      .range(
        inicio,
        inicio + TAMANO_PAGINA - 1
      );

    if (error) {
      throw error;
    }

    const pagina = data || [];

    for (const estudiante of pagina) {
      if (estudiante.usuario_id) {
        estudiantes.push(estudiante.usuario_id);
      }
    }

    if (pagina.length < TAMANO_PAGINA) {
      break;
    }

    inicio += TAMANO_PAGINA;
  }

  return [...new Set(estudiantes)];
}

// =====================================================
// CONSULTAR CLASIFICACION E HISTORIAL
// GET /api/activities/:id/clasificacion
// =====================================================

const consultarClasificacionActividad = async (
  req,
  res
) => {
  try {
    if (
      !['coordinador', 'administrador'].includes(
        req.usuario?.rol
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          'No tiene permisos para esta consulta.',
      });
    }

    const actividadId = validarActividadId(
      req.params.id
    );

    if (!actividadId) {
      return res.status(400).json({
        success: false,
        message:
          'El identificador de actividad no es valido.',
      });
    }

    const actividad = await obtenerActividad(
      actividadId
    );

    if (!actividad) {
      return res.status(404).json({
        success: false,
        message:
          'La actividad no existe.',
      });
    }

    const asignacion = obtenerRelacion(
      actividad.materia_grupo_periodo
    );

    if (!asignacion) {
      return res.status(409).json({
        success: false,
        message:
          'La actividad no tiene una asignacion academica valida.',
      });
    }

    if (req.usuario.rol === 'coordinador') {
      const autorizado =
        await verificarAmbitoCoordinador({
          coordinadorId: req.usuario.id,
          gradoId: asignacion.grado_id,
          grupoId: asignacion.grupo_id,
        });

      if (!autorizado) {
        return res.status(403).json({
          success: false,
          message:
            'No tiene acceso a esta actividad.',
        });
      }
    }

    const {
      data: historial,
      error: errorHistorial,
    } = await supabaseAdmin
      .from('actividades_clasificacion_historial')
      .select(`
        id,
        actividad_id,
        es_evaluable_anterior,
        es_evaluable_nuevo,
        usuario_id,
        justificacion,
        created_at
      `)
      .eq('actividad_id', actividadId)
      .order('created_at', {
        ascending: false,
      });

    if (errorHistorial) {
      throw errorHistorial;
    }

    return res.status(200).json({
      success: true,
      actividad,
      historial: historial || [],
    });
  } catch (error) {
    console.error(
      '[AULA-AI] Error consultando clasificacion:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'No fue posible consultar la clasificacion academica.',
    });
  }
};

// =====================================================
// ACTUALIZAR CLASIFICACION
// PATCH /api/activities/:id/clasificacion
// =====================================================

const actualizarClasificacionActividad = async (
  req,
  res
) => {
  try {
    // La reclasificacion corresponde al Coordinador.
    // No se permite utilizar un usuarioId recibido
    // desde el cuerpo de la solicitud.
    if (
      req.usuario?.rol !== 'coordinador' ||
      !req.usuario?.id
    ) {
      return res.status(403).json({
        success: false,
        message:
          'Solo un coordinador autorizado puede reclasificar actividades.',
      });
    }

    const actividadId = validarActividadId(
      req.params.id
    );

    if (!actividadId) {
      return res.status(400).json({
        success: false,
        message:
          'El identificador de actividad no es valido.',
      });
    }

    const {
      es_evaluable,
      justificacion,
    } = req.body || {};

    if (typeof es_evaluable !== 'boolean') {
      return res.status(400).json({
        success: false,
        message:
          'es_evaluable debe ser true o false.',
      });
    }

    if (
      typeof justificacion !== 'string' ||
      justificacion.trim().length < 10
    ) {
      return res.status(400).json({
        success: false,
        message:
          'La justificacion debe tener al menos 10 caracteres.',
      });
    }

    const coordinadorId = req.usuario.id;

    // -------------------------------------------------
    // 1. CONSULTAR ACTIVIDAD Y ASIGNACION
    // -------------------------------------------------

    const actividad = await obtenerActividad(
      actividadId
    );

    if (!actividad) {
      return res.status(404).json({
        success: false,
        message:
          'La actividad no existe.',
      });
    }

    const asignacion = obtenerRelacion(
      actividad.materia_grupo_periodo
    );

    const periodo = obtenerRelacion(
      asignacion?.periodo
    );

    if (
      !asignacion ||
      !periodo
    ) {
      return res.status(409).json({
        success: false,
        message:
          'La actividad no tiene una asignacion o periodo valido.',
      });
    }

    // -------------------------------------------------
    // 2. VERIFICAR AMBITO
    // -------------------------------------------------

    const autorizado =
      await verificarAmbitoCoordinador({
        coordinadorId,
        gradoId: asignacion.grado_id,
        grupoId: asignacion.grupo_id,
      });

    if (!autorizado) {
      return res.status(403).json({
        success: false,
        message:
          'No tiene permiso sobre el grado y grupo de esta actividad.',
      });
    }

    // La RPC volvera a comprobar este estado
    // dentro de su propia transaccion.
    if (periodo.estado_academico !== 'en_curso') {
      return res.status(409).json({
        success: false,
        message:
          'Solo pueden reclasificarse actividades de periodos en curso.',
      });
    }

    if (actividad.es_evaluable === es_evaluable) {
      return res.status(409).json({
        success: false,
        message:
          'La actividad ya tiene esa clasificacion.',
      });
    }

    // -------------------------------------------------
    // 3. RECLASIFICACION TRANSACCIONAL
    // -------------------------------------------------

    // Esta RPC:
    // - Verifica rol y coordinador activo.
    // - Comprueba el ambito autorizado.
    // - Bloquea la actividad.
    // - Comprueba el estado del periodo.
    // - Actualiza es_evaluable.
    // - Inserta el historial de clasificacion.
    //
    // Todo ocurre en una misma transaccion SQL.

    const {
      data: resultadoRpc,
      error: errorRpc,
    } = await supabaseAdmin.rpc(
      'hu08_clasificar_actividad',
      {
        p_actividad_id: actividadId,
        p_coordinador_id: coordinadorId,
        p_es_evaluable: es_evaluable,
        p_justificacion: justificacion.trim(),
      }
    );

    if (errorRpc) {
      console.error(
        '[AULA-AI] RPC de clasificacion rechazada:',
        errorRpc.message
      );

      const mensaje = String(
        errorRpc.message || ''
      ).toLowerCase();

      if (
        mensaje.includes('no tiene permiso') ||
        mensaje.includes('no es un coordinador activo')
      ) {
        return res.status(403).json({
          success: false,
          message:
            'No tiene autorizacion para reclasificar esta actividad.',
        });
      }

      if (
        mensaje.includes('ya tiene esa clasificacion') ||
        mensaje.includes('periodo') ||
        mensaje.includes('justificacion insuficiente')
      ) {
        return res.status(409).json({
          success: false,
          message:
            'La clasificacion no pudo modificarse por una restriccion academica.',
        });
      }

      return res.status(500).json({
        success: false,
        message:
          'No fue posible guardar la nueva clasificacion.',
      });
    }

    const cambio = Array.isArray(resultadoRpc)
      ? resultadoRpc[0]
      : resultadoRpc;

    if (
      !cambio ||
      Number(cambio.actividad_id) !== actividadId ||
      cambio.clasificacion_nueva !== es_evaluable
    ) {
      console.error(
        '[AULA-AI] Respuesta inesperada de clasificacion:',
        resultadoRpc
      );

      // No afirmar que no se guardo.
      // La RPC puede haberse confirmado en Supabase.
      return res.status(200).json({
        success: true,
        clasificacionGuardada: true,
        sincronizacion: 'pendiente',
        message:
          'La solicitud fue procesada, pero no fue posible verificar completamente la respuesta de clasificacion. Consulte nuevamente la actividad.',
      });
    }

    // -------------------------------------------------
    // 4. RECALCULAR ALERTAS DEL GRUPO
    // -------------------------------------------------

    // La clasificacion ya esta guardada en este
    // punto. Los errores posteriores NO deben
    // reportarse como un fallo de guardado.

    let sincronizacion = 'completada';

    let resumenAlertas = {
      procesados: 0,
      exitosos: 0,
      fallidos: 0,
    };

    let mensajeSincronizacion = null;

    try {
      const estudiantesIds =
        await consultarEstudiantesGrupo({
          gradoId: asignacion.grado_id,
          grupoId: asignacion.grupo_id,
        });

      if (estudiantesIds.length > 0) {
        const resultadoAlertas =
          await procesarAlertasDeActividad({
            actividadId,
            estudiantesIds,
          });

        resumenAlertas = {
          procesados:
            resultadoAlertas.procesados || 0,
          exitosos:
            resultadoAlertas.exitosos || 0,
          fallidos:
            resultadoAlertas.fallidos || 0,
        };

        if (resumenAlertas.fallidos > 0) {
          sincronizacion = 'pendiente';

          mensajeSincronizacion =
            'La clasificacion se guardo, pero algunas alertas academicas no pudieron actualizarse.';
        }
      }
    } catch (errorAlertas) {
      console.error(
        '[AULA-AI] Clasificacion guardada, error recalculando alertas:',
        errorAlertas
      );

      sincronizacion = 'pendiente';

      mensajeSincronizacion =
        'La clasificacion se guardo correctamente, pero la sincronizacion de alertas quedo pendiente.';
    }

    // -------------------------------------------------
    // 5. RESPUESTA FINAL
    // -------------------------------------------------

    return res.status(200).json({
      success: true,
      clasificacionGuardada: true,

      message:
        sincronizacion === 'completada'
          ? 'Clasificacion actualizada correctamente.'
          : mensajeSincronizacion,

      actividad: {
        id: actividadId,
        titulo: actividad.titulo,
        clasificacionAnterior:
          cambio.clasificacion_anterior,
        es_evaluable:
          cambio.clasificacion_nueva,
        historialId:
          cambio.historial_id,
      },

      sincronizacion,
      alertas: resumenAlertas,
    });
  } catch (error) {
    console.error(
      '[AULA-AI] Error inesperado actualizando clasificacion:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Ocurrio un error al procesar la clasificacion. Consulte el estado actual antes de reintentar.',
    });
  }
};

// =====================================================
// EXPORTACIONES
// =====================================================

module.exports = {
  consultarClasificacionActividad,
  actualizarClasificacionActividad,
};
