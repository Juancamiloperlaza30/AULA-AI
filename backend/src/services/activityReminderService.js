const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  enviarNotificacionesMultiples,
} = require('./pushService');

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

      const {
        data: actividades,
        error: errorActividades,
      } = await supabaseAdmin
        .from(
          'actividades_academicas'
        )
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
        .eq(
          'estado',
          'publicada'
        )
        .gte(
          'fecha_entrega',
          ahora.toISOString()
        )
        .lte(
          'fecha_entrega',
          limite.toISOString()
        );

      if (errorActividades) {
        throw errorActividades;
      }

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

        const {
          data: estudiantesGrupo,
          error: errorEstudiantes,
        } = await supabaseAdmin
          .from('estudiantes')
          .select('usuario_id')
          .eq(
            'grado_id',
            asignacion.grado_id
          )
          .eq(
            'grupo_id',
            asignacion.grupo_id
          );

        if (
          errorEstudiantes ||
          !estudiantesGrupo?.length
        ) {
          continue;
        }

        const usuariosIds =
          estudiantesGrupo.map(
            (estudiante) =>
              estudiante.usuario_id
          );

        const {
          data: entregas,
          error: errorEntregas,
        } = await supabaseAdmin
          .from(
            'entregas_actividades'
          )
          .select(
            'estudiante_id'
          )
          .eq(
            'actividad_id',
            actividad.id
          )
          .neq(
            'estado',
            'anulada'
          );

        if (errorEntregas) {
          continue;
        }

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

        const {
          data: recordatoriosPrevios,
          error: errorRecordatorios,
        } = await supabaseAdmin
          .from('recordatorios_actividades')
          .select('estudiante_id')
          .eq(
            'actividad_id',
            actividad.id
          )
          .eq(
            'tipo_recordatorio',
            '24h'
          )
          .in(
            'estudiante_id',
            pendientes
          );

        if (errorRecordatorios) {
          console.error(
            'Error consultando recordatorios previos:',
            errorRecordatorios.message
          );

          continue;
        }

        const estudiantesYaNotificados =
          new Set(
            (recordatoriosPrevios || []).map(
              (recordatorio) =>
                recordatorio.estudiante_id
            )
          );

        const pendientesSinRecordatorio =
          pendientes.filter(
            (usuarioId) =>
              !estudiantesYaNotificados.has(
                usuarioId
              )
          );

        if (
          pendientesSinRecordatorio.length === 0
        ) {
          continue;
        }

        const {
          data: dispositivos,
          error: errorDispositivos,
        } = await supabaseAdmin
          .from(
            'dispositivos_push'
          )
          .select(`
            usuario_id,
            token_fcm
          `)
          .in(
            'usuario_id',
            pendientesSinRecordatorio
          )
          .eq(
            'activo',
            true
          );

        if (
          errorDispositivos ||
          !dispositivos?.length
        ) {
          continue;
        }

        const usuariosPorToken =
          new Map();

        for (const dispositivo of dispositivos) {
          if (!dispositivo.token_fcm) {
            continue;
          }

          const usuarios =
            usuariosPorToken.get(
              dispositivo.token_fcm
            ) || new Set();

          usuarios.add(
            dispositivo.usuario_id
          );

          usuariosPorToken.set(
            dispositivo.token_fcm,
            usuarios
          );
        }

        const tokens =
          Array.from(
            usuariosPorToken.keys()
          );

        if (tokens.length === 0) {
          continue;
        }

        const resultadoEnvio =
          await enviarNotificacionesMultiples({
            tokens,

            titulo:
              'Actividad próxima a vencer',

            mensaje:
              `${actividad.titulo} vence dentro de las próximas 24 horas.`,

            data: {
              tipo:
                'recordatorio_actividad',

              actividadId:
                actividad.id,

              tipoActividad:
                actividad.tipo,
            },
          });

        const estudiantesNotificados =
          new Set();

        resultadoEnvio.responses?.forEach(
          (respuesta, index) => {
            if (respuesta.success) {
              for (
                const usuarioId of
                usuariosPorToken.get(
                  tokens[index]
                ) || []
              ) {
                estudiantesNotificados.add(
                  usuarioId
                );
              }
            }
          }
        );

        if (
          estudiantesNotificados.size > 0
        ) {
          const registros =
            Array.from(
              estudiantesNotificados
            ).map(
              (estudianteId) => ({
                actividad_id:
                  actividad.id,

                estudiante_id:
                  estudianteId,

                tipo_recordatorio:
                  '24h',
              })
            );

          const {
            error: errorRegistro,
          } = await supabaseAdmin
            .from(
              'recordatorios_actividades'
            )
            .insert(
              registros
            );

          if (errorRegistro) {
            console.error(
              'Error registrando recordatorios:',
              errorRegistro.message
            );
          }
        }

        procesadas++;
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
