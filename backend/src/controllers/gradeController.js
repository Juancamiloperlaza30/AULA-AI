const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  registrarAuditoria,
} = require('../services/auditService');

const listarActividadesCalificablesDocente =
  async (req, res) => {
    try {
      const docenteId =
        req.usuario.id;

      // 1. Consultar asignaciones activas del Docente
      const {
        data: asignacionesDocente,
        error: errorAsignaciones,
      } = await supabaseAdmin
        .from('materia_docente')
        .select(`
          materia_grupo_periodo_id
        `)
        .eq(
          'docente_id',
          docenteId
        );

      if (errorAsignaciones) {
        console.error(
          'Error consultando asignaciones del Docente:',
          errorAsignaciones.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible consultar las asignaciones del Docente.',
        });
      }

      const idsAsignaciones =
        (asignacionesDocente || [])
          .map(
            (item) =>
              item.materia_grupo_periodo_id
          )
          .filter(Boolean);

      if (!idsAsignaciones.length) {
        return res.status(200).json({
          success: true,
          actividades: [],
        });
      }

      // 2. Consultar solamente actividades
      // pertenecientes a esas asignaciones
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
          descripcion,
          fecha_publicacion,
          fecha_entrega,
          estado,
          materia_grupo_periodo_id,
          materia_grupo_periodo:materia_grupo_periodo_id (
            id,
            grado_id,
            grupo_id,
            materia:materias (
              id,
              nombre
            ),
            grado:grados (
              id,
              nombre
            ),
            grupo:grupos (
              id,
              nombre
            )
          )
        `)
        .eq(
          'docente_id',
          docenteId
        )
        .in(
          'materia_grupo_periodo_id',
          idsAsignaciones
        )
        .eq(
          'estado',
          'publicada'
        )
        .order(
          'fecha_entrega',
          {
            ascending: true,
          }
        );

      if (errorActividades) {
        console.error(
          'Error consultando actividades calificables:',
          errorActividades.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible consultar las actividades calificables.',
        });
      }

      return res.status(200).json({
        success: true,
        actividades:
          actividades || [],
      });
    } catch (error) {
      console.error(
        'Error inesperado consultando actividades calificables:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Ocurrió un error al consultar las actividades calificables.',
      });
    }
  };

const listarEstudiantesActividadDocente =
  async (req, res) => {
    try {
      const docenteId =
        req.usuario.id;

      const actividadId =
        Number(req.params.actividadId);

      if (!actividadId) {
        return res.status(400).json({
          success: false,
          message:
            'La actividad no es válida.',
        });
      }

      // 1. Consultar la actividad
      const {
        data: actividad,
        error: errorActividad,
      } = await supabaseAdmin
        .from('actividades_academicas')
        .select(`
          id,
          docente_id,
          materia_grupo_periodo_id,
          materia_grupo_periodo:materia_grupo_periodo_id (
            grado_id,
            grupo_id
          )
        `)
        .eq('id', actividadId)
        .maybeSingle();

      if (errorActividad) {
        console.error(
          'Error consultando actividad:',
          errorActividad.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible consultar la actividad.',
        });
      }

      if (!actividad) {
        return res.status(404).json({
          success: false,
          message:
            'La actividad no existe.',
        });
      }

      // 2. Verificar que la actividad pertenezca al Docente
      if (
        actividad.docente_id !== docenteId
      ) {
        return res.status(403).json({
          success: false,
          message:
            'No está autorizado para calificar esta actividad.',
        });
      }

      const relacion =
        Array.isArray(
          actividad.materia_grupo_periodo
        )
          ? actividad.materia_grupo_periodo[0]
          : actividad.materia_grupo_periodo;

      if (!relacion) {
        return res.status(400).json({
          success: false,
          message:
            'La actividad no tiene una asignación válida.',
        });
      }

      // 3. Consultar estudiantes del grado y grupo
      const {
        data: estudiantes,
        error: errorEstudiantes,
      } = await supabaseAdmin
        .from('estudiantes')
        .select(`
          usuario_id,
          usuario:usuarios (
            id,
            nombres,
            apellidos,
            correo
          )
        `)
        .eq(
          'grado_id',
          relacion.grado_id
        )
        .eq(
          'grupo_id',
          relacion.grupo_id
        );

      if (errorEstudiantes) {
        console.error(
          'Error consultando estudiantes:',
          errorEstudiantes.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible consultar los estudiantes.',
        });
      }

      return res.status(200).json({
        success: true,
        actividadId,
        estudiantes:
          estudiantes || [],
      });
    } catch (error) {
      console.error(
        'Error inesperado consultando estudiantes:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Ocurrió un error al consultar los estudiantes.',
      });
    }
  };

const registrarCalificacionesMasivas =
  async (req, res) => {
    try {
      const docenteId =
        req.usuario.id;

      const {
        actividadId,
        calificaciones,
      } = req.body;

      if (
        !actividadId ||
        !Array.isArray(calificaciones) ||
        calificaciones.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Debe enviar la actividad y al menos una calificación.',
        });
      }

      // 1. Validar actividad y propiedad del Docente
      const {
        data: actividad,
        error: errorActividad,
      } = await supabaseAdmin
        .from('actividades_academicas')
        .select(`
          id,
          docente_id,
          materia_grupo_periodo:materia_grupo_periodo_id (
            grado_id,
            grupo_id
          )
        `)
        .eq('id', actividadId)
        .maybeSingle();

      if (errorActividad) {
        console.error(
          'Error consultando actividad:',
          errorActividad.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible validar la actividad.',
        });
      }

      if (!actividad) {
        return res.status(404).json({
          success: false,
          message:
            'La actividad no existe.',
        });
      }

      if (
        actividad.docente_id !== docenteId
      ) {
        return res.status(403).json({
          success: false,
          message:
            'No está autorizado para calificar esta actividad.',
        });
      }

      const relacion =
        Array.isArray(
          actividad.materia_grupo_periodo
        )
          ? actividad.materia_grupo_periodo[0]
          : actividad.materia_grupo_periodo;

      if (!relacion) {
        return res.status(400).json({
          success: false,
          message:
            'La actividad no tiene una asignación válida.',
        });
      }

      // 2. Validar cada calificación
      for (
        const item of calificaciones
      ) {
        const valor =
          Number(item.valor);

        if (
          !item.estudianteId ||
          Number.isNaN(valor) ||
          valor < 0 ||
          valor > 5
        ) {
          return res.status(400).json({
            success: false,
            message:
              'Existe una calificación inválida. La nota debe estar entre 0.00 y 5.00.',
          });
        }

        const {
          data: estudiante,
          error: errorEstudiante,
        } = await supabaseAdmin
          .from('estudiantes')
          .select(`
            usuario_id,
            grado_id,
            grupo_id
          `)
          .eq(
            'usuario_id',
            item.estudianteId
          )
          .maybeSingle();

        if (
          errorEstudiante ||
          !estudiante
        ) {
          return res.status(400).json({
            success: false,
            message:
              'Uno de los estudiantes no es válido.',
          });
        }

        if (
          estudiante.grado_id !==
            relacion.grado_id ||
          estudiante.grupo_id !==
            relacion.grupo_id
        ) {
          return res.status(403).json({
            success: false,
            message:
              'Uno de los estudiantes no pertenece al grupo de la actividad.',
          });
        }
      }

      // 3. Registro transaccional en PostgreSQL
      const {
        data: calificacionesRegistradas,
        error: errorRegistro,
      } = await supabaseAdmin.rpc(
        'registrar_calificaciones_masivas',
        {
          p_actividad_id:
            actividadId,
          p_docente_id:
            docenteId,
          p_calificaciones:
            calificaciones,
        }
      );

      if (errorRegistro) {
        console.error(
          'Error registrando calificaciones:',
          errorRegistro.message
        );

        if (
          errorRegistro.code ===
          '23505'
        ) {
          return res.status(409).json({
            success: false,
            message:
              'Ya existe una calificación registrada para uno de los estudiantes.',
          });
        }

        return res.status(500).json({
          success: false,
          message:
            'No fue posible registrar las calificaciones.',
        });
      }

      return res.status(201).json({
        success: true,
        message:
          'Calificaciones registradas correctamente.',
        calificaciones:
          calificacionesRegistradas || [],
      });
    } catch (error) {
      console.error(
        'Error inesperado registrando calificaciones:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Ocurrió un error al registrar las calificaciones.',
      });
    }
  };

const listarCalificacionesEstudiante =
  async (req, res) => {
    try {
      const usuarioId =
        req.usuario.id;

      const {
        data: estudiante,
        error: errorEstudiante,
      } = await supabaseAdmin
        .from('estudiantes')
        .select(`
          usuario_id,
          grado_id,
          grupo_id
        `)
        .eq(
          'usuario_id',
          usuarioId
        )
        .maybeSingle();

      if (errorEstudiante) {
        console.error(
          'Error consultando estudiante:',
          errorEstudiante.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible validar al estudiante.',
        });
      }

      if (!estudiante) {
        return res.status(404).json({
          success: false,
          message:
            'No se encontró información académica del estudiante.',
        });
      }

      const {
        data: calificaciones,
        error: errorCalificaciones,
      } = await supabaseAdmin
        .from('calificaciones')
        .select(`
          id,
          valor,
          retroalimentacion,
          estado,
          created_at,
          updated_at,
          actividad:actividades_academicas (
            id,
            tipo,
            titulo,
            descripcion,
            fecha_publicacion,
            fecha_entrega,
            materia_grupo_periodo:materia_grupo_periodo_id (
              materia:materias (
                id,
                nombre
              ),
              grado:grados (
                id,
                nombre
              ),
              grupo:grupos (
                id,
                nombre
              )
            )
          )
        `)
        .eq(
          'estudiante_id',
          usuarioId
        )
        .eq(
          'estado',
          'registrada'
        )
        .order(
          'created_at',
          {
            ascending: false,
          }
        );

      if (errorCalificaciones) {
        console.error(
          'Error consultando calificaciones:',
          errorCalificaciones.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible consultar las calificaciones.',
        });
      }

      return res.status(200).json({
        success: true,
        calificaciones:
          calificaciones || [],
      });
    } catch (error) {
      console.error(
        'Error inesperado consultando calificaciones del estudiante:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Ocurrió un error al consultar las calificaciones.',
      });
    }
  };

const actualizarCalificacionAdministrativa =
  async (req, res) => {
    try {
      const usuarioId =
        req.usuario.id;

      const rol =
        req.usuario.rol;

      const calificacionId =
        Number(req.params.calificacionId);

      const {
        valor,
        retroalimentacion,
        motivo,
      } = req.body;

      if (!calificacionId) {
        return res.status(400).json({
          success: false,
          message:
            'La calificación no es válida.',
        });
      }

      const valorNumerico =
        Number(valor);

      if (
        Number.isNaN(valorNumerico) ||
        valorNumerico < 0 ||
        valorNumerico > 5
      ) {
        return res.status(400).json({
          success: false,
          message:
            'La nota debe estar entre 0.00 y 5.00.',
        });
      }

      const {
        data: calificacionActual,
        error: errorCalificacion,
      } = await supabaseAdmin
        .from('calificaciones')
        .select(`
          id,
          actividad_id,
          estudiante_id,
          valor,
          retroalimentacion,
          estado,
          actividad:actividades_academicas (
            materia_grupo_periodo:materia_grupo_periodo_id (
              grado_id,
              grupo_id
            )
          )
        `)
        .eq(
          'id',
          calificacionId
        )
        .maybeSingle();

      if (errorCalificacion) {
        console.error(
          'Error consultando calificación:',
          errorCalificacion.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible consultar la calificación.',
        });
      }

      if (!calificacionActual) {
        return res.status(404).json({
          success: false,
          message:
            'La calificación no existe.',
        });
      }

      if (
        rol !== 'administrador' &&
        rol !== 'coordinador'
      ) {
        return res.status(403).json({
          success: false,
          message:
            'No está autorizado para modificar calificaciones.',
        });
      }

      if (
        rol === 'coordinador'
      ) {
        const actividadRelacionada =
          Array.isArray(
            calificacionActual.actividad
          )
            ? calificacionActual.actividad[0]
            : calificacionActual.actividad;

        const asignacion =
          Array.isArray(
            actividadRelacionada
              ?.materia_grupo_periodo
          )
            ? actividadRelacionada
                .materia_grupo_periodo[0]
            : actividadRelacionada
                ?.materia_grupo_periodo;

        if (!asignacion) {
          return res.status(400).json({
            success: false,
            message:
              'La calificación no tiene una asignación válida.',
          });
        }

        const {
          data: ambito,
          error: errorAmbito,
        } = await supabaseAdmin
          .from('coordinador_ambito')
          .select('id')
          .eq(
            'coordinador_id',
            usuarioId
          )
          .eq(
            'grado_id',
            asignacion.grado_id
          )
          .eq(
            'grupo_id',
            asignacion.grupo_id
          )
          .eq(
            'activo',
            true
          )
          .maybeSingle();

        if (errorAmbito) {
          console.error(
            'Error validando ámbito del Coordinador:',
            errorAmbito.message
          );

          return res.status(500).json({
            success: false,
            message:
              'No fue posible validar los permisos del Coordinador.',
          });
        }

        if (!ambito) {
          return res.status(403).json({
            success: false,
            message:
              'No está autorizado para modificar esta calificación.',
          });
        }
      }

      const {
        error: errorActualizacion,
      } = await supabaseAdmin
        .from('calificaciones')
        .update({
          valor:
            valorNumerico,

          retroalimentacion:
            retroalimentacion?.trim() ||
            null,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          calificacionId
        );

      if (errorActualizacion) {
        console.error(
          'Error actualizando calificación:',
          errorActualizacion.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible actualizar la calificación.',
        });
      }

      const {
        error: errorHistorial,
      } = await supabaseAdmin
        .from(
          'calificaciones_historial'
        )
        .insert({
          calificacion_id:
            calificacionId,

          usuario_id:
            usuarioId,

          valor_anterior:
            calificacionActual.valor,

          valor_nuevo:
            valorNumerico,

          retroalimentacion_anterior:
            calificacionActual
              .retroalimentacion,

          retroalimentacion_nueva:
            retroalimentacion?.trim() ||
            null,

          motivo:
            motivo?.trim() ||
            null,

          rol_usuario:
            rol,
        });

      if (errorHistorial) {
        console.error(
          'Error registrando historial de calificación:',
          errorHistorial.message
        );
      }

      await registrarAuditoria({
        usuarioId,
        correo:
          req.usuario.correo,

        evento:
          'CALIFICACION_MODIFICADA',

        descripcion:
          `Se modificó la calificación ${calificacionId}.`,

        rol,

        direccionIp:
          req.ip,

        dispositivo:
          req.headers['user-agent'] ||
          null,

        metadata: {
          accion:
            'CALIFICACION_MODIFICADA',

          entidad:
            'calificaciones',

          entidadId:
            calificacionId,

          detalle: {
            valorAnterior:
              calificacionActual.valor,

            valorNuevo:
              valorNumerico,

            retroalimentacionAnterior:
              calificacionActual
                .retroalimentacion,

            retroalimentacionNueva:
              retroalimentacion?.trim() ||
              null,

            motivo:
              motivo?.trim() ||
              null,
          },
        },
      });

      return res.status(200).json({
        success: true,
        message:
          'Calificación actualizada correctamente.',
      });
    } catch (error) {
      console.error(
        'Error inesperado actualizando calificación:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Ocurrió un error al actualizar la calificación.',
      });
    }
  };

module.exports = {
  listarActividadesCalificablesDocente,
  listarEstudiantesActividadDocente,
  registrarCalificacionesMasivas,
  listarCalificacionesEstudiante,
  actualizarCalificacionAdministrativa,
};
