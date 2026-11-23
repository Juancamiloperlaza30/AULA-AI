'use strict';

const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  registrarActividadIncumplida,
  resolverActividadIncumplida,
} = require('./academicAlertService');

const MAXIMO_POR_EJECUCION = 500;
const TIEMPO_CLAIM_MS = 10 * 60 * 1000;

const obtenerRelacion = (valor) =>
  Array.isArray(valor)
    ? valor[0] || null
    : valor || null;

const leerTrabajos = async () => {
  const ahora = new Date().toISOString();
  const fechaBloqueo = new Date(
    Date.now() - TIEMPO_CLAIM_MS
  ).toISOString();
  const [pendientes, bloqueados] = await Promise.all([
    supabaseAdmin
      .from('actividad_alertas_pendientes')
      .select('id,actividad_id,estudiante_id,estado,intentos,bloqueado_at')
      .eq('estado', 'pendiente')
      .lte('proximo_intento_at', ahora)
      .order('id', { ascending: true })
      .range(0, MAXIMO_POR_EJECUCION - 1),
    supabaseAdmin
      .from('actividad_alertas_pendientes')
      .select('id,actividad_id,estudiante_id,estado,intentos,bloqueado_at')
      .eq('estado', 'procesando')
      .lt('bloqueado_at', fechaBloqueo)
      .order('id', { ascending: true })
      .range(0, MAXIMO_POR_EJECUCION - 1),
  ]);

  if (pendientes.error) {
    throw pendientes.error;
  }

  if (bloqueados.error) {
    throw bloqueados.error;
  }

  return [
    ...(pendientes.data || []),
    ...(bloqueados.data || []),
  ].slice(0, MAXIMO_POR_EJECUCION);
};

const reclamarTrabajo = async (trabajo) => {
  const ahora = new Date().toISOString();
  let consulta = supabaseAdmin
    .from('actividad_alertas_pendientes')
    .update({
      estado: 'procesando',
      bloqueado_at: ahora,
      updated_at: ahora,
    })
    .eq('id', trabajo.id)
    .eq('estado', trabajo.estado)
    .select('id,actividad_id,estudiante_id,intentos');

  consulta = trabajo.estado === 'pendiente'
    ? consulta.lte('proximo_intento_at', ahora)
    : consulta.lt(
        'bloqueado_at',
        new Date(Date.now() - TIEMPO_CLAIM_MS).toISOString()
      );

  const { data, error } = await consulta.maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
};

const reagendarTrabajo = async (trabajo) => {
  const intentos = Number(trabajo.intentos || 0) + 1;
  const minutos = Math.min(60, 2 ** Math.min(intentos, 6));
  const ahora = Date.now();
  const { error } = await supabaseAdmin
    .from('actividad_alertas_pendientes')
    .update({
      estado: 'pendiente',
      intentos,
      proximo_intento_at: new Date(
        ahora + minutos * 60 * 1000
      ).toISOString(),
      bloqueado_at: null,
      ultimo_error: 'Error temporal al evaluar la actividad.',
      updated_at: new Date(ahora).toISOString(),
    })
    .eq('id', trabajo.id)
    .eq('estado', 'procesando');

  if (error) {
    throw error;
  }
};

const finalizarTrabajo = async (trabajo) => {
  const { error } = await supabaseAdmin
    .from('actividad_alertas_pendientes')
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

const resolverAlerta = async (trabajo, periodoId, motivo) =>
  resolverActividadIncumplida({
    estudianteId: trabajo.estudiante_id,
    actividadId: trabajo.actividad_id,
    periodoId,
    motivo,
  });

const evaluarActividad = async (trabajo) => {
  const { data: actividad, error } = await supabaseAdmin
    .from('actividades_academicas')
    .select(`
      id,
      titulo,
      estado,
      fecha_publicacion,
      fecha_entrega,
      materia_grupo_periodo_id,
      materia_grupo_periodo:materia_grupo_periodo_id(
        periodo_id,
        grado_id,
        grupo_id,
        materia:materias(nombre)
      )
    `)
    .eq('id', trabajo.actividad_id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!actividad) {
    return resolverAlerta(trabajo, null, 'actividad_no_vigente');
  }

  const asignacion = obtenerRelacion(
    actividad.materia_grupo_periodo
  );
  const materia = obtenerRelacion(asignacion?.materia);
  const periodoId = asignacion?.periodo_id ?? null;

  if (
    actividad.estado !== 'publicada' ||
    !Number.isFinite(Date.parse(actividad.fecha_publicacion)) ||
    Date.parse(actividad.fecha_publicacion) > Date.now() ||
    !Number.isFinite(Date.parse(actividad.fecha_entrega)) ||
    !asignacion?.grado_id ||
    !asignacion?.grupo_id ||
    !materia?.nombre ||
    !periodoId
  ) {
    return resolverAlerta(
      trabajo,
      periodoId,
      'actividad_no_vigente_o_incompleta'
    );
  }

  const { data: estudiante, error: errorEstudiante } =
    await supabaseAdmin
      .from('estudiantes')
      .select('usuario_id')
      .eq('usuario_id', trabajo.estudiante_id)
      .eq('grado_id', asignacion.grado_id)
      .eq('grupo_id', asignacion.grupo_id)
      .maybeSingle();

  if (errorEstudiante) {
    throw errorEstudiante;
  }

  if (!estudiante) {
    return resolverAlerta(
      trabajo,
      periodoId,
      'estudiante_fuera_del_grupo'
    );
  }

  const { data: entrega, error: errorEntrega } =
    await supabaseAdmin
      .from('entregas_actividades')
      .select('id,estado,fecha_entrega')
      .eq('actividad_id', actividad.id)
      .eq('estudiante_id', trabajo.estudiante_id)
      .in('estado', ['entregada', 'entregada_tarde'])
      .limit(1)
      .maybeSingle();

  if (errorEntrega) {
    throw errorEntrega;
  }

  if (entrega) {
    return resolverAlerta(
      trabajo,
      periodoId,
      'entrega_registrada'
    );
  }

  return registrarActividadIncumplida({
    estudianteId: trabajo.estudiante_id,
    actividadId: actividad.id,
    tituloActividad: actividad.titulo,
    materiaNombre: materia.nombre,
    periodoId,
    fechaEntrega: actividad.fecha_entrega,
  });
};

const procesarTrabajo = async (trabajo) => {
  const reclamado = await reclamarTrabajo(trabajo);

  if (!reclamado) {
    return false;
  }

  try {
    await evaluarActividad(reclamado);
    await finalizarTrabajo(reclamado);
    return true;
  } catch (error) {
    await reagendarTrabajo(reclamado);
    console.error(
      '[RNF-10] Se reintentará la evaluación de actividad vencida:',
      {
        actividadId: reclamado.actividad_id,
        estudianteId: reclamado.estudiante_id,
        mensaje: error.message,
      }
    );
    return false;
  }
};

const ejecutarColaAlertasActividades = async () => {
  const trabajos = await leerTrabajos();
  let procesados = 0;
  let fallidos = 0;

  for (const trabajo of trabajos) {
    try {
      if (await procesarTrabajo(trabajo)) {
        procesados++;
      } else {
        fallidos++;
      }
    } catch (error) {
      fallidos++;
      console.error(
        '[RNF-10] No se pudo actualizar la cola de alertas por actividad:',
        {
          trabajoId: trabajo.id,
          mensaje: error.message,
        }
      );
    }
  }

  return { procesados, fallidos };
};

module.exports = {
  ejecutarColaAlertasActividades,
};
