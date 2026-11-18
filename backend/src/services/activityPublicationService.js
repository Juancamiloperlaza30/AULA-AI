'use strict';

const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  encolarNotificacionesActividad,
} = require('./activityNotificationService');

const TAMANO_PAGINA = 500;

const consultarTodos = async (crearConsulta) => {
  const registros = [];
  let desde = 0;

  while (true) {
    const {
      data,
      error,
    } = await crearConsulta().range(
      desde,
      desde + TAMANO_PAGINA - 1
    );

    if (error) {
      throw error;
    }

    const pagina = data || [];
    registros.push(...pagina);

    if (pagina.length < TAMANO_PAGINA) {
      return registros;
    }

    desde += TAMANO_PAGINA;
  }
};

const obtenerRelacion = (valor) => {
  if (Array.isArray(valor)) {
    return valor[0] || null;
  }

  return valor || null;
};

const notificarActividadPublicada =
  async (actividadId) => {
    const ahora = new Date();
    const {
      data: actividad,
      error: errorActividad,
    } = await supabaseAdmin
      .from('actividades_academicas')
      .select(`
        id,
        tipo,
        titulo,
        fecha_publicacion,
        estado,
        materia_grupo_periodo:materia_grupo_periodo_id (
          grado_id,
          grupo_id,
          estado,
          materia:materias (
            nombre
          )
        )
      `)
      .eq('id', actividadId)
      .maybeSingle();

    if (errorActividad) {
      throw errorActividad;
    }

    const fechaPublicacion =
      Date.parse(actividad?.fecha_publicacion);

    if (
      !actividad ||
      actividad.estado !== 'publicada' ||
      !Number.isFinite(fechaPublicacion) ||
      fechaPublicacion > ahora.getTime()
    ) {
      return {
        success: true,
        enviados: 0,
      };
    }

    const asignacion = obtenerRelacion(
      actividad.materia_grupo_periodo
    );

    if (!asignacion || asignacion.estado !== 'activa') {
      return {
        success: true,
        enviados: 0,
      };
    }

    const estudiantes = await consultarTodos(
      () => supabaseAdmin
        .from('estudiantes')
        .select('usuario_id')
        .eq('grado_id', asignacion.grado_id)
        .eq('grupo_id', asignacion.grupo_id)
        .order('usuario_id', {
          ascending: true,
        })
    );

    const estudianteIds = [
      ...new Set(
        (estudiantes || [])
          .map((estudiante) => estudiante.usuario_id)
          .filter(Boolean)
      ),
    ];

    return encolarNotificacionesActividad({
      actividadId: actividad.id,
      estudianteIds,
      tipoRecordatorio: 'publicacion',
      titulo:
        actividad.tipo === 'examen'
          ? 'Nuevo examen'
          : actividad.tipo === 'tarea'
          ? 'Nueva tarea'
          : 'Nueva actividad',
      mensaje:
        `${actividad.titulo} - ${asignacion.materia?.nombre || 'AULA-AI'}`,
      data: {
        tipo: 'actividad_publicada',
        actividadId: actividad.id,
        tipoActividad: actividad.tipo,
      },
    });
  };

const ejecutarNotificacionesPublicacionesProgramadas =
  async () => {
    const ahora = new Date().toISOString();
    let desde = 0;
    let procesadas = 0;
    let fallidas = 0;

    while (true) {
      const {
        data: actividades,
        error,
      } = await supabaseAdmin
        .from('actividades_academicas')
        .select('id')
        .eq('estado', 'publicada')
        .lte('fecha_publicacion', ahora)
        .order('fecha_publicacion', {
          ascending: true,
        })
        .order('id', {
          ascending: true,
        })
        .range(desde, desde + TAMANO_PAGINA - 1);

      if (error) {
        throw error;
      }

      const pagina = actividades || [];

      for (const actividad of pagina) {
        try {
          await notificarActividadPublicada(
            actividad.id
          );
          procesadas += 1;
        } catch (errorNotificacion) {
          fallidas += 1;
          console.error(
            'Error procesando notificación de publicación:',
            {
              actividadId: actividad.id,
              mensaje: errorNotificacion.message,
            }
          );
        }
      }

      if (pagina.length < TAMANO_PAGINA) {
        break;
      }

      desde += TAMANO_PAGINA;
    }

    return {
      success: fallidas === 0,
      procesadas,
      fallidas,
    };
  };

module.exports = {
  notificarActividadPublicada,
  ejecutarNotificacionesPublicacionesProgramadas,
};
