'use strict';

const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  enviarNotificacionesMultiples,
} = require('./pushService');

const TIEMPO_MAXIMO_PROCESANDO_MS =
  15 * 60 * 1000;
const TAMANO_LOTE = 500;

const actualizarEstadoEnvio = async ({
  actividadId,
  estudianteIds,
  tipoRecordatorio,
  estadoEnvio,
  procesandoDesde = null,
  enviadoAt = null,
}) => {
  if (estudianteIds.length === 0) {
    return;
  }

  for (
    let inicio = 0;
    inicio < estudianteIds.length;
    inicio += TAMANO_LOTE
  ) {
    const lote = estudianteIds.slice(
      inicio,
      inicio + TAMANO_LOTE
    );
    const { error } = await supabaseAdmin
      .from('recordatorios_actividades')
      .update({
        estado_envio: estadoEnvio,
        procesando_desde: procesandoDesde,
        enviado_at: enviadoAt,
      })
      .eq('actividad_id', actividadId)
      .eq('tipo_recordatorio', tipoRecordatorio)
      .in('estudiante_id', lote);

    if (error) {
      throw error;
    }
  }
};

const encolarNotificacionesActividad = async ({
  actividadId,
  estudianteIds,
  tipoRecordatorio,
  titulo,
  mensaje,
  data,
}) => {
  const estudiantesUnicos = [
    ...new Set(estudianteIds.filter(Boolean)),
  ];

  if (estudiantesUnicos.length === 0) {
    return {
      success: true,
      enviados: 0,
    };
  }

  const registros = estudiantesUnicos.map(
    (estudianteId) => ({
      actividad_id: actividadId,
      estudiante_id: estudianteId,
      tipo_recordatorio: tipoRecordatorio,
      estado_envio: 'pendiente',
    })
  );

  for (
    let inicio = 0;
    inicio < registros.length;
    inicio += TAMANO_LOTE
  ) {
    const lote = registros.slice(
      inicio,
      inicio + TAMANO_LOTE
    );
    const { error: errorEncolando } =
      await supabaseAdmin
        .from('recordatorios_actividades')
        .upsert(lote, {
          onConflict:
            'actividad_id,estudiante_id,tipo_recordatorio',
          ignoreDuplicates: true,
        });

    if (errorEncolando) {
      throw errorEncolando;
    }
  }

  const fechaLimiteProcesando = new Date(
    Date.now() - TIEMPO_MAXIMO_PROCESANDO_MS
  ).toISOString();

  const { error: errorRecuperacion } =
    await supabaseAdmin
      .from('recordatorios_actividades')
      .update({
        estado_envio: 'pendiente',
        procesando_desde: null,
      })
      .eq('actividad_id', actividadId)
      .eq('tipo_recordatorio', tipoRecordatorio)
      .eq('estado_envio', 'procesando')
      .lt('procesando_desde', fechaLimiteProcesando);

  if (errorRecuperacion) {
    throw errorRecuperacion;
  }

  const fechaProcesando =
    new Date().toISOString();
  const enviosReservados = [];

  for (
    let inicio = 0;
    inicio < estudiantesUnicos.length;
    inicio += TAMANO_LOTE
  ) {
    const lote = estudiantesUnicos.slice(
      inicio,
      inicio + TAMANO_LOTE
    );
    const {
      data,
      error: errorReserva,
    } = await supabaseAdmin
      .from('recordatorios_actividades')
      .update({
        estado_envio: 'procesando',
        procesando_desde: fechaProcesando,
      })
      .eq('actividad_id', actividadId)
      .eq('tipo_recordatorio', tipoRecordatorio)
      .eq('estado_envio', 'pendiente')
      .in('estudiante_id', lote)
      .select('estudiante_id');

    if (errorReserva) {
      if (enviosReservados.length > 0) {
        await actualizarEstadoEnvio({
          actividadId,
          estudianteIds: enviosReservados.map(
            (envio) => envio.estudiante_id
          ),
          tipoRecordatorio,
          estadoEnvio: 'pendiente',
        });
      }

      throw errorReserva;
    }

    enviosReservados.push(...(data || []));
  }

  const estudiantesReservados = [
    ...new Set(
      (enviosReservados || []).map(
        (envio) => envio.estudiante_id
      )
    ),
  ];

  if (estudiantesReservados.length === 0) {
    return {
      success: true,
      enviados: 0,
    };
  }

  let resultado;
  let usuariosPorToken;
  let tokens = [];

  try {
    const dispositivos = [];

    for (
      let inicio = 0;
      inicio < estudiantesReservados.length;
      inicio += TAMANO_LOTE
    ) {
      const lote = estudiantesReservados.slice(
        inicio,
        inicio + TAMANO_LOTE
      );
      const {
        data,
        error: errorDispositivos,
      } = await supabaseAdmin
        .from('dispositivos_push')
        .select('usuario_id, token_fcm')
        .in('usuario_id', lote)
        .eq('activo', true);

      if (errorDispositivos) {
        throw errorDispositivos;
      }

      dispositivos.push(...(data || []));
    }

    usuariosPorToken = new Map();

    for (const dispositivo of dispositivos || []) {
      if (!dispositivo.token_fcm) {
        continue;
      }

      const usuarios =
        usuariosPorToken.get(
          dispositivo.token_fcm
        ) || new Set();

      usuarios.add(dispositivo.usuario_id);
      usuariosPorToken.set(
        dispositivo.token_fcm,
        usuarios
      );
    }

    tokens = [...usuariosPorToken.keys()];

    if (tokens.length === 0) {
      await actualizarEstadoEnvio({
        actividadId,
        estudianteIds: estudiantesReservados,
        tipoRecordatorio,
        estadoEnvio: 'pendiente',
      });

      return {
        success: true,
        enviados: 0,
      };
    }

    resultado = await enviarNotificacionesMultiples({
        tokens,
        titulo,
        mensaje,
        data,
      });
  } catch (error) {
    await actualizarEstadoEnvio({
      actividadId,
      estudianteIds: estudiantesReservados,
      tipoRecordatorio,
      estadoEnvio: 'pendiente',
    });

    throw error;
  }

  const estudiantesNotificados = new Set();

  (resultado.responses || []).forEach(
    (respuesta, indice) => {
      if (respuesta.success) {
        for (
          const usuarioId of
          usuariosPorToken.get(tokens[indice]) || []
        ) {
          estudiantesNotificados.add(usuarioId);
        }
      }
    }
  );

  const estudiantesEnviados =
    estudiantesReservados.filter(
      (estudianteId) =>
        estudiantesNotificados.has(estudianteId)
    );
  const estudiantesPendientes =
    estudiantesReservados.filter(
      (estudianteId) =>
        !estudiantesNotificados.has(estudianteId)
    );

  await actualizarEstadoEnvio({
    actividadId,
    estudianteIds: estudiantesEnviados,
    tipoRecordatorio,
    estadoEnvio: 'enviado',
    enviadoAt: new Date().toISOString(),
  });

  await actualizarEstadoEnvio({
    actividadId,
    estudianteIds: estudiantesPendientes,
    tipoRecordatorio,
    estadoEnvio: 'pendiente',
  });

  return {
    success: estudiantesPendientes.length === 0,
    enviados: estudiantesEnviados.length,
    pendientes: estudiantesPendientes.length,
  };
};

module.exports = {
  encolarNotificacionesActividad,
};
