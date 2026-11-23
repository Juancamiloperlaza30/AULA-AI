'use strict';

const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  procesarAlertasDeActividad,
} = require('./gradeAlertIntegrationService');

const TAMANO_PAGINA = 100;
const MAXIMO_POR_EJECUCION = 500;
const TIEMPO_CLAIM_MS = 10 * 60 * 1000;

const leerTrabajos = async ({
  estado,
  actividadId,
  estudiantesIds,
  ahora,
}) => {
  const trabajos = [];

  for (
    let inicio = 0;
    inicio < (estudiantesIds?.length || 1);
    inicio += TAMANO_PAGINA
  ) {
    const loteEstudiantes = estudiantesIds
      ? estudiantesIds.slice(
          inicio,
          inicio + TAMANO_PAGINA
        )
      : null;

    let consulta = supabaseAdmin
      .from('calificacion_alertas_pendientes')
      .select(`
        id,
        actividad_id,
        estudiante_id,
        estado,
        intentos,
        bloqueado_at
      `)
      .eq('estado', estado)
      .order('id', { ascending: true })
      .range(0, TAMANO_PAGINA - 1);

    if (actividadId) {
      consulta = consulta.eq(
        'actividad_id',
        actividadId
      );
    }

    if (loteEstudiantes) {
      consulta = consulta.in(
        'estudiante_id',
        loteEstudiantes
      );
    }

    if (estado === 'pendiente') {
      consulta = consulta.lte(
        'proximo_intento_at',
        ahora
      );
    } else {
      consulta = consulta.lt(
        'bloqueado_at',
        new Date(
          Date.now() - TIEMPO_CLAIM_MS
        ).toISOString()
      );
    }

    const {
      data,
      error,
    } = await consulta;

    if (error) {
      throw error;
    }

    trabajos.push(...(data || []));

    if (!estudiantesIds || loteEstudiantes.length < TAMANO_PAGINA) {
      break;
    }
  }

  return trabajos;
};

const reclamarTrabajo = async (trabajo) => {
  const ahora = new Date().toISOString();
  let consulta = supabaseAdmin
    .from('calificacion_alertas_pendientes')
    .update({
      estado: 'procesando',
      bloqueado_at: ahora,
      updated_at: ahora,
    })
    .eq('id', trabajo.id)
    .eq('estado', trabajo.estado)
    .select(`
      id,
      actividad_id,
      estudiante_id,
      intentos
    `);

  if (trabajo.estado === 'pendiente') {
    consulta = consulta.lte(
      'proximo_intento_at',
      ahora
    );
  } else {
    consulta = consulta.lt(
      'bloqueado_at',
      new Date(
        Date.now() - TIEMPO_CLAIM_MS
      ).toISOString()
    );
  }

  const {
    data,
    error,
  } = await consulta.maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
};

const reagendarTrabajo = async (
  trabajo,
  mensaje
) => {
  const intentos = Number(trabajo.intentos || 0) + 1;
  const demoraMinutos = Math.min(
    60,
    2 ** Math.min(intentos, 6)
  );
  const proximoIntento = new Date(
    Date.now() + demoraMinutos * 60 * 1000
  ).toISOString();

  const { error } = await supabaseAdmin
    .from('calificacion_alertas_pendientes')
    .update({
      estado: 'pendiente',
      intentos,
      proximo_intento_at: proximoIntento,
      bloqueado_at: null,
      ultimo_error: mensaje,
      updated_at: new Date().toISOString(),
    })
    .eq('id', trabajo.id)
    .eq('estado', 'procesando');

  if (error) {
    throw error;
  }
};

const finalizarTrabajo = async (trabajo) => {
  const { error } = await supabaseAdmin
    .from('calificacion_alertas_pendientes')
    .update({
      estado: 'procesada',
      bloqueado_at: null,
      ultimo_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', trabajo.id)
    .eq('estado', 'procesando');

  if (error) {
    throw error;
  }
};

const procesarTrabajo = async (trabajo) => {
  const reclamado = await reclamarTrabajo(trabajo);

  if (!reclamado) {
    return false;
  }

  try {
    const resultado = await procesarAlertasDeActividad({
      actividadId: reclamado.actividad_id,
      estudiantesIds: [reclamado.estudiante_id],
    });
    const evaluacion =
      resultado.resultados?.find(
        (item) =>
          item.estudianteId ===
          reclamado.estudiante_id
      );

    if (!evaluacion?.success) {
      await reagendarTrabajo(
        reclamado,
        'No fue posible evaluar la alerta académica.'
      );
      return false;
    }

    await finalizarTrabajo(reclamado);
    return true;
  } catch (error) {
    await reagendarTrabajo(
      reclamado,
      'Error temporal al evaluar la alerta académica.'
    );

    console.error(
      '[AULA-AI][HU-08] Se reintentará la alerta académica:',
      {
        actividadId: reclamado.actividad_id,
        estudianteId: reclamado.estudiante_id,
        mensaje: error.message,
      }
    );

    return false;
  }
};

const procesarTrabajos = async (trabajos) => {
  let procesados = 0;
  let fallidos = 0;

  for (
    const trabajo of trabajos.slice(
      0,
      MAXIMO_POR_EJECUCION
    )
  ) {
    try {
      if (await procesarTrabajo(trabajo)) {
        procesados++;
      } else {
        fallidos++;
      }
    } catch (error) {
      fallidos++;
      console.error(
        '[AULA-AI][HU-08] No se pudo actualizar el estado de una alerta:',
        {
          trabajoId: trabajo.id,
          mensaje: error.message,
        }
      );
    }
  }

  return {
    procesados,
    fallidos,
  };
};

const procesarAlertasEncoladas = async ({
  actividadId,
  estudiantesIds,
}) => {
  if (
    !Number.isSafeInteger(Number(actividadId)) ||
    Number(actividadId) <= 0 ||
    !Array.isArray(estudiantesIds) ||
    estudiantesIds.length === 0
  ) {
    return {
      procesados: 0,
      fallidos: 0,
    };
  }

  const estudiantesUnicos = [
    ...new Set(estudiantesIds.filter(Boolean)),
  ];
  const trabajos = await leerTrabajos({
    estado: 'pendiente',
    actividadId: Number(actividadId),
    estudiantesIds: estudiantesUnicos,
    ahora: new Date().toISOString(),
  });

  return procesarTrabajos(trabajos);
};

const ejecutarColaAlertasCalificaciones =
  async () => {
    const ahora = new Date().toISOString();
    const pendientes = await leerTrabajos({
      estado: 'pendiente',
      ahora,
    });
    const bloqueados = await leerTrabajos({
      estado: 'procesando',
      ahora,
    });

    return procesarTrabajos([
      ...pendientes,
      ...bloqueados,
    ]);
  };

module.exports = {
  procesarAlertasEncoladas,
  ejecutarColaAlertasCalificaciones,
};
