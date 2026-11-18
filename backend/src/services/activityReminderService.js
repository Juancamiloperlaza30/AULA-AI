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

const ejecutarRecordatoriosActividades =
  async () => {
    try {
      const ahora =
        new Date();

      const limite =
        new Date(
          ahora.getTime() +
          24 * 60 * 60 * 1000
        );

      const actividades = await consultarTodos(
        () => supabaseAdmin
          .from('actividades_academicas')
          .select(`
          id,
          tipo,
          titulo,
          fecha_entrega,
          estado,
          materia_grupo_periodo_id,
          materia_grupo_periodo (
            grado_id,
            grupo_id,
            materia:materias (
              nombre
            )
          )
          `)
          .eq('estado', 'publicada')
          .lte('fecha_publicacion', ahora.toISOString())
          .gte('fecha_entrega', ahora.toISOString())
          .lte('fecha_entrega', limite.toISOString())
          .order('fecha_entrega', { ascending: true })
          .order('id', { ascending: true })
      );

      if (
        !actividades ||
        actividades.length === 0
      ) {
        return {
          success: true,
          procesadas: 0,
        };
      }

      let procesadas = 0;

      for (
        const actividad of actividades
      ) {
        const asignacion =
          actividad.materia_grupo_periodo;

        if (!asignacion) {
          continue;
        }

        const estudiantesGrupo = await consultarTodos(
          () => supabaseAdmin
            .from('estudiantes')
            .select('usuario_id')
            .eq('grado_id', asignacion.grado_id)
            .eq('grupo_id', asignacion.grupo_id)
            .order('usuario_id', { ascending: true })
        );

        if (!estudiantesGrupo?.length) {
          continue;
        }

        const usuariosIds =
          estudiantesGrupo.map(
            (estudiante) =>
              estudiante.usuario_id
          );

        const entregas = await consultarTodos(
          () => supabaseAdmin
            .from('entregas_actividades')
            .select('estudiante_id')
            .eq('actividad_id', actividad.id)
            .neq('estado', 'anulada')
            .order('estudiante_id', { ascending: true })
        );

        const estudiantesConEntrega =
          new Set(
            (entregas || []).map(
              (entrega) =>
                entrega.estudiante_id
            )
          );

        const pendientes =
          usuariosIds.filter(
            (usuarioId) =>
              !estudiantesConEntrega.has(
                usuarioId
              )
          );

        if (
          pendientes.length === 0
        ) {
          continue;
        }

        const resultadoEnvio =
          await encolarNotificacionesActividad({
            actividadId: actividad.id,
            estudianteIds: pendientes,
            tipoRecordatorio: '24h',
            titulo:
              'Actividad próxima a vencer',
            mensaje:
              `${actividad.titulo} vence dentro de las próximas 24 horas.`,
            data: {
              tipo: 'recordatorio_actividad',
              actividadId: actividad.id,
              tipoActividad: actividad.tipo,
            },
          });

        if (resultadoEnvio.enviados > 0) {
          procesadas += 1;
        }
      }

      return {
        success: true,
        procesadas,
      };
    } catch (error) {
      console.error(
        'Error en recordatorios de actividades:',
        error
      );

      return {
        success: false,
        procesadas: 0,
        error:
          error.message,
      };
    }
  };

module.exports = {
  ejecutarRecordatoriosActividades,
};
