'use strict';

const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  evaluarRegistroAsistencia,
} = require('./academicAlertService');

const TAMANO_PAGINA = 100;
const MAXIMO_POR_EJECUCION = 500;
const TIEMPO_CLAIM_MS = 10 * 60 * 1000;

const obtenerRelacion = (valor) =>
  Array.isArray(valor)
    ? valor[0] || null
    : valor || null;

const leerTrabajos = async () => {
  const trabajos = [];
  let inicio = 0;
  const ahora = new Date().toISOString();
  const fechaBloqueo = new Date(
    Date.now() - TIEMPO_CLAIM_MS
  ).toISOString();

  while (trabajos.length < MAXIMO_POR_EJECUCION) {
    const crearConsulta = () =>
      supabaseAdmin
        .from('asistencia_alertas_pendientes')
        .select(`
          id,
          asistencia_id,
          estado,
          intentos,
          bloqueado_at
        `)
        .order('id', { ascending: true })
        .range(
          inicio,
          inicio + TAMANO_PAGINA - 1
        );

    const [pendientes, bloqueados] =
      await Promise.all([
        crearConsulta()
          .eq('estado', 'pendiente')
          .lte('proximo_intento_at', ahora),
        crearConsulta()
          .eq('estado', 'procesando')
          .lt('bloqueado_at', fechaBloqueo)
      ]);

    if (pendientes.error) {
      throw pendientes.error;
    }

    if (bloqueados.error) {
      throw bloqueados.error;
    }

    const pagina = [
      ...(pendientes.data || []),
      ...(bloqueados.data || []),
    ];
    trabajos.push(...pagina);

    if (
      (pendientes.data || []).length < TAMANO_PAGINA &&
      (bloqueados.data || []).length < TAMANO_PAGINA
    ) {
      break;
    }

    inicio += TAMANO_PAGINA;
  }

  return trabajos.slice(0, MAXIMO_POR_EJECUCION);
};

const reclamarTrabajo = async (trabajo) => {
  const ahora = new Date().toISOString();
  const fechaBloqueo = new Date(
    Date.now() - TIEMPO_CLAIM_MS
  ).toISOString();
  let consulta = supabaseAdmin
    .from('asistencia_alertas_pendientes')
    .update({
      estado: 'procesando',
      bloqueado_at: ahora,
      updated_at: ahora,
    })
    .eq('id', trabajo.id)
    .eq('estado', trabajo.estado)
    .select('id,asistencia_id,intentos');

  consulta = trabajo.estado === 'pendiente'
    ? consulta.lte('proximo_intento_at', ahora)
    : consulta.lt('bloqueado_at', fechaBloqueo);

  const { data, error } = await consulta.maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
};

const reagendarTrabajo = async (trabajo, mensaje) => {
  const intentos = Number(trabajo.intentos || 0) + 1;
  const demoraMinutos = Math.min(
    60,
    2 ** Math.min(intentos, 6)
  );
  const proximoIntento = new Date(
    Date.now() + demoraMinutos * 60 * 1000
  ).toISOString();

  const { error } = await supabaseAdmin
    .from('asistencia_alertas_pendientes')
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
    .from('asistencia_alertas_pendientes')
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

const evaluarTrabajo = async (trabajo) => {
  const { data, error } = await supabaseAdmin
    .from('asistencias')
    .select(`
      id,
      estudiante_id,
      estado,
      fecha,
      materia_grupo_periodo:materia_grupo_periodo_id(
        periodo_id,
        materia:materias(nombre)
      )
    `)
    .eq('id', trabajo.asistencia_id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      'No se encontró la asistencia pendiente de evaluación.'
    );
  }

  const asignacion = obtenerRelacion(
    data.materia_grupo_periodo
  );
  const materia = obtenerRelacion(asignacion?.materia);

  if (!materia?.nombre) {
    throw new Error(
      'La asistencia no tiene una materia válida para evaluar.'
    );
  }

  await evaluarRegistroAsistencia({
    estudianteId: data.estudiante_id,
    asistenciaId: data.id,
    materiaNombre: materia.nombre,
    estado: data.estado,
    fecha: data.fecha,
    periodoId: asignacion.periodo_id,
  });
};

const procesarTrabajo = async (trabajo) => {
  const reclamado = await reclamarTrabajo(trabajo);

  if (!reclamado) {
    return false;
  }

  try {
    await evaluarTrabajo(reclamado);
    await finalizarTrabajo(reclamado);
    return true;
  } catch (error) {
    await reagendarTrabajo(
      reclamado,
      'No fue posible evaluar la alerta de asistencia.'
    );

    console.error(
      '[AULA-AI][RNF-06] Se reintentará la alerta de asistencia:',
      {
        asistenciaId: reclamado.asistencia_id,
        mensaje: error.message,
      }
    );

    return false;
  }
};

const ejecutarColaAlertasAsistencia = async () => {
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
        '[AULA-AI][RNF-06] No se pudo actualizar la cola de alertas:',
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

module.exports = {
  ejecutarColaAlertasAsistencia,
};
