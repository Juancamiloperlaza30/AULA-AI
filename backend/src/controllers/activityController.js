const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  registrarAuditoria,
} = require('../services/auditService');

const {
  enviarNotificacionesMultiples,
} = require('../services/pushService');

const listarAsignacionesDocente =
  async (req, res) => {
    try {
      const docenteId =
        req.usuario.id;

      const {
        data,
        error,
      } = await supabaseAdmin
        .from('materia_docente')
        .select(`
          id,
          materia_grupo_periodo_id,
          materia_grupo_periodo (
            id,
            estado,
            materia_id,
            grado_id,
            grupo_id,
            periodo_id,
            materia:materias (
              id,
              nombre,
              estado
            ),
            grado:grados (
              id,
              nombre
            ),
            grupo:grupos (
              id,
              nombre
            ),
            periodo:periodos_academicos (
              id,
              nombre,
              fecha_inicio,
              fecha_fin,
              activo
            )
          )
        `)
        .eq(
          'docente_id',
          docenteId
        );

      if (error) {
        console.error(
          'Error consultando asignaciones del docente:',
          error.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible consultar las materias asignadas.',
        });
      }

      const asignaciones =
        (data || [])
          .map(
            (item) =>
              item.materia_grupo_periodo
          )
          .filter(
            (item) =>
              item &&
              item.estado === 'activa' &&
              item.materia?.estado ===
                'activa'
          );

      return res.status(200).json({
        success: true,
        asignaciones,
      });
    } catch (error) {
      console.error(
        'Error inesperado consultando asignaciones:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Ocurrió un error al consultar las materias asignadas.',
      });
    }
  };

const registrarActividad =
  async (req, res) => {
    try {
      const docenteId =
        req.usuario.id;

      const {
        materiaGrupoPeriodoId,
        tipo,
        titulo,
        descripcion,
        fechaPublicacion,
        fechaEntrega,
        clientRequestId,
      } = req.body;

      // Validaciones básicas
      if (
        !materiaGrupoPeriodoId ||
        !tipo ||
        !titulo?.trim() ||
        !descripcion?.trim() ||
        !fechaPublicacion ||
        !fechaEntrega
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Complete todos los campos obligatorios.',
        });
      }

      if (
        ![
          'tarea',
          'actividad',
          'examen',
        ].includes(tipo)
      ) {
        return res.status(400).json({
          success: false,
          message:
            'El tipo de actividad no es válido.',
        });
      }

      const fechaPublicacionDate =
        new Date(fechaPublicacion);

      const fechaEntregaDate =
        new Date(fechaEntrega);

      if (
        Number.isNaN(
          fechaPublicacionDate.getTime()
        ) ||
        Number.isNaN(
          fechaEntregaDate.getTime()
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Las fechas ingresadas no son válidas.',
        });
      }

      if (
        fechaEntregaDate <
        fechaPublicacionDate
      ) {
        return res.status(400).json({
          success: false,
          message:
            'La fecha de entrega no puede ser anterior a la fecha de publicación.',
        });
      }

      // Verificar que el Docente realmente
      // esté asignado a esa materia/grupo.
      const {
        data: relacion,
        error: errorRelacion,
      } = await supabaseAdmin
        .from('materia_docente')
        .select(`
          id,
          materia_grupo_periodo_id
        `)
        .eq(
          'docente_id',
          docenteId
        )
        .eq(
          'materia_grupo_periodo_id',
          materiaGrupoPeriodoId
        )
        .maybeSingle();

      if (errorRelacion) {
        console.error(
          'Error validando asignación:',
          errorRelacion.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible validar la asignación académica.',
        });
      }

      if (!relacion) {
        return res.status(403).json({
          success: false,
          message:
            'No está autorizado para registrar actividades en esta materia y grupo.',
        });
      }

      // Evitar duplicados por reintento.
      if (clientRequestId) {
        const {
          data: actividadExistente,
          error: errorExistente,
        } = await supabaseAdmin
          .from(
            'actividades_academicas'
          )
          .select('id')
          .eq(
            'client_request_id',
            clientRequestId
          )
          .maybeSingle();

        if (errorExistente) {
          console.error(
            'Error verificando solicitud:',
            errorExistente.message
          );

          return res.status(500).json({
            success: false,
            message:
              'No fue posible verificar la solicitud.',
          });
        }

        if (actividadExistente) {
          return res.status(200).json({
            success: true,
            message:
              'Actividad registrada con éxito.',
            actividadId:
              actividadExistente.id,
          });
        }
      }

      const {
        data: actividad,
        error: errorActividad,
      } = await supabaseAdmin
        .from(
          'actividades_academicas'
        )
        .insert({
          materia_grupo_periodo_id:
            materiaGrupoPeriodoId,

          docente_id:
            docenteId,

          tipo,

          titulo:
            titulo.trim(),

          descripcion:
            descripcion.trim(),

          fecha_publicacion:
            fechaPublicacion,

          fecha_entrega:
            fechaEntrega,

          estado: 'publicada',

          client_request_id:
            clientRequestId || null,
        })
        .select('id')
        .single();

      if (errorActividad) {
        console.error(
          'Error registrando actividad:',
          errorActividad.message
        );

        if (
          errorActividad.code ===
          '23505'
        ) {
          return res.status(409).json({
            success: false,
            message:
              'La actividad ya fue registrada.',
          });
        }

        return res.status(500).json({
          success: false,
          message:
            'No fue posible registrar la actividad.',
        });
      }

      await registrarAuditoria({
        usuarioId: req.usuario.id,
        correo: req.usuario.correo,
        evento:
          'ACTIVIDAD_REGISTRADA',
        descripcion:
          `Se registró la actividad ${actividad.id}.`,
        rol: req.usuario.rol,
        direccionIp: req.ip,
        dispositivo:
          req.headers['user-agent'] || null,
        metadata: {
          accion:
            'ACTIVIDAD_REGISTRADA',
          entidad:
            'actividades_academicas',
          entidadId:
            actividad.id,
          detalle: {
            tipo,
            titulo:
              titulo.trim(),
            descripcion:
              descripcion.trim(),
            materiaGrupoPeriodoId,
            fechaPublicacion,
            fechaEntrega,
            estado:
              'publicada',
          },
        },
      });

      try {
        console.log(
          'FCM ACTIVIDAD - Inicio',
          {
            actividadId: actividad.id,
            materiaGrupoPeriodoId,
          }
        );

        const {
          data: asignacionActividad,
          error: errorAsignacion,
        } = await supabaseAdmin
          .from('materia_grupo_periodo')
          .select(`
            grado_id,
            grupo_id,
            materia:materias (
              nombre
            )
          `)
          .eq(
            'id',
            materiaGrupoPeriodoId
          )
          .single();

        console.log(
          'FCM ACTIVIDAD - Asignación:',
          asignacionActividad
        );

        if (
          !errorAsignacion &&
          asignacionActividad
        ) {
          const {
            data: estudiantesGrupo,
            error: errorEstudiantes,
          } = await supabaseAdmin
            .from('estudiantes')
            .select('usuario_id')
            .eq(
              'grado_id',
              asignacionActividad.grado_id
            )
            .eq(
              'grupo_id',
              asignacionActividad.grupo_id
            );

          console.log(
            'FCM ACTIVIDAD - Estudiantes encontrados:',
            estudiantesGrupo?.length || 0
          );

          if (
            !errorEstudiantes &&
            estudiantesGrupo?.length
          ) {
            const usuariosIds =
              estudiantesGrupo.map(
                (estudiante) =>
                  estudiante.usuario_id
              );

            const {
              data: dispositivos,
              error: errorDispositivos,
            } = await supabaseAdmin
              .from('dispositivos_push')
              .select('token_fcm')
              .in(
                'usuario_id',
                usuariosIds
              )
              .eq(
                'activo',
                true
              );

            console.log(
              'FCM ACTIVIDAD - Dispositivos encontrados:',
              dispositivos?.length || 0
            );

            if (
              !errorDispositivos &&
              dispositivos?.length
            ) {
              const tokens =
                dispositivos.map(
                  (dispositivo) =>
                    dispositivo.token_fcm
                );

              await enviarNotificacionesMultiples({
                tokens,

                titulo:
                  tipo === 'examen'
                    ? 'Nuevo examen'
                    : tipo === 'tarea'
                    ? 'Nueva tarea'
                    : 'Nueva actividad',

                mensaje:
                  `${titulo} - ${asignacionActividad.materia?.nombre || 'AULA-AI'}`,

                data: {
                  tipo:
                    'actividad_publicada',

                  actividadId:
                    actividad.id,

                  tipoActividad:
                    tipo,
                },
              });

              console.log(
                'FCM ACTIVIDAD - Notificación enviada correctamente'
              );
            }
          }
        }
      } catch (errorNotificacion) {
        console.error(
          'Error enviando notificación de actividad:',
          errorNotificacion
        );
      }

      return res.status(201).json({
        success: true,
        message:
          'Actividad registrada con éxito.',
        actividadId:
          actividad.id,
      });
    } catch (error) {
      console.error(
        'Error inesperado registrando actividad:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Ocurrió un error al registrar la actividad.',
      });
    }
  };

const listarActividadesDocente =
  async (req, res) => {
    try {
      const docenteId =
        req.usuario.id;

      const {
        data,
        error,
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
          created_at,
          materia_grupo_periodo:materia_grupo_periodo_id (
            id,
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
            ),
            periodo:periodos_academicos (
              id,
              nombre
            )
          )
        `)
        .eq(
          'docente_id',
          docenteId
        )
        .order(
          'fecha_publicacion',
          {
            ascending: false,
          }
        );

      if (error) {
        console.error(
          'Error consultando actividades del docente:',
          error.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible consultar las actividades.',
        });
      }

      return res.status(200).json({
        success: true,
        actividades:
          data || [],
      });
    } catch (error) {
      console.error(
        'Error inesperado consultando actividades:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Ocurrió un error al consultar las actividades.',
      });
    }
  };

const listarActividadesEstudiante =
  async (req, res) => {
    try {
      const estudianteId =
        req.usuario.id;

      // 1. Obtener grado y grupo del estudiante
      const {
        data: estudiante,
        error: errorEstudiante,
      } = await supabaseAdmin
        .from('estudiantes')
        .select(`
          grado_id,
          grupo_id
        `)
        .eq(
          'usuario_id',
          estudianteId
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
            'No fue posible consultar la información académica del estudiante.',
        });
      }

      if (!estudiante) {
        return res.status(404).json({
          success: false,
          message:
            'No se encontró la información académica del estudiante.',
        });
      }

      // 2. Buscar las asignaciones de su grado y grupo
      const {
        data: asignaciones,
        error: errorAsignaciones,
      } = await supabaseAdmin
        .from(
          'materia_grupo_periodo'
        )
        .select('id')
        .eq(
          'grado_id',
          estudiante.grado_id
        )
        .eq(
          'grupo_id',
          estudiante.grupo_id
        )
        .eq(
          'estado',
          'activa'
        );

      if (errorAsignaciones) {
        console.error(
          'Error consultando asignaciones:',
          errorAsignaciones.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible consultar las materias del estudiante.',
        });
      }

      const asignacionesIds =
        (asignaciones || []).map(
          (item) => item.id
        );

      if (
        asignacionesIds.length === 0
      ) {
        return res.status(200).json({
          success: true,
          actividades: [],
        });
      }

      // 3. Consultar solo actividades autorizadas
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
          materia_grupo_periodo:materia_grupo_periodo_id (
            id,
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
            ),
            periodo:periodos_academicos (
              id,
              nombre
            )
          )
        `)
        .in(
          'materia_grupo_periodo_id',
          asignacionesIds
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
          'Error consultando actividades del estudiante:',
          errorActividades.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible consultar las actividades.',
        });
      }

      const actividadesIds =
        (actividades || []).map(
          (actividad) => actividad.id
        );

      let entregas = [];

      if (actividadesIds.length > 0) {
        const {
          data: entregasData,
          error: errorEntregas,
        } = await supabaseAdmin
          .from('entregas_actividades')
          .select(`
            id,
            actividad_id,
            comentario,
            estado,
            fecha_entrega,
            created_at,
            updated_at
          `)
          .eq(
            'estudiante_id',
            estudianteId
          )
          .in(
            'actividad_id',
            actividadesIds
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          );

        if (errorEntregas) {
          console.error(
            'Error consultando entregas del estudiante:',
            errorEntregas.message
          );

          return res.status(500).json({
            success: false,
            message:
              'No fue posible consultar las entregas del estudiante.',
          });
        }

        entregas =
          entregasData || [];
      }

      let calificaciones = [];

      if (actividadesIds.length > 0) {
        const {
          data: calificacionesData,
          error: errorCalificaciones,
        } = await supabaseAdmin
          .from('calificaciones')
          .select(`
            id,
            actividad_id,
            valor,
            retroalimentacion,
            estado,
            created_at,
            updated_at
          `)
          .eq(
            'estudiante_id',
            estudianteId
          )
          .in(
            'actividad_id',
            actividadesIds
          )
          .eq(
            'estado',
            'registrada'
          );

        if (errorCalificaciones) {
          console.error(
            'Error consultando calificaciones del estudiante:',
            errorCalificaciones.message
          );

          return res.status(500).json({
            success: false,
            message:
              'No fue posible consultar las calificaciones del estudiante.',
          });
        }

        calificaciones =
          calificacionesData || [];
      }

      const actividadesConEntrega =
        (actividades || []).map(
          (actividad) => {
            const entrega =
              entregas.find(
                (item) =>
                  item.actividad_id ===
                    actividad.id &&
                  item.estado !==
                    'anulada'
              ) || null;

            const calificacion =
              calificaciones.find(
                (item) =>
                  item.actividad_id ===
                  actividad.id
              ) || null;

            return {
              ...actividad,

              entrega: entrega
                ? {
                    id: entrega.id,

                    comentario:
                      entrega.comentario,

                    estado:
                      entrega.estado,

                    fecha_entrega:
                      entrega.fecha_entrega,

                    anulada:
                      entrega.estado ===
                      'anulada',

                    entregada_tarde:
                      entrega.estado ===
                      'entregada_tarde',
                  }
                : null,

              calificacion: calificacion
                ? {
                    id:
                      calificacion.id,

                    valor:
                      calificacion.valor,

                    retroalimentacion:
                      calificacion.retroalimentacion,

                    created_at:
                      calificacion.created_at,

                    updated_at:
                      calificacion.updated_at,
                  }
                : null,
            };
          }
        );

      return res.status(200).json({
        success: true,
        actividades:
          actividadesConEntrega,
      });
    } catch (error) {
      console.error(
        'Error inesperado consultando actividades del estudiante:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Ocurrió un error al consultar las actividades.',
      });
    }
  };

const listarActividadesAdministrativas =
  async (req, res) => {
    try {
      const usuarioId =
        req.usuario.id;

      const rol =
        req.usuario.rol;

      let idsAsignacionesPermitidas =
        null;

      // ==================================================
      // COORDINADOR:
      // SOLO PUEDE VER SU ÁMBITO ASIGNADO
      // ==================================================

      if (rol === 'coordinador') {
        const {
          data: ambitos,
          error: errorAmbitos,
        } = await supabaseAdmin
          .from('coordinador_ambito')
          .select(`
            grado_id,
            grupo_id
          `)
          .eq(
            'coordinador_id',
            usuarioId
          )
          .eq(
            'activo',
            true
          );

        if (errorAmbitos) {
          console.error(
            'Error consultando ámbito del coordinador:',
            errorAmbitos.message
          );

          return res.status(500).json({
            success: false,
            message:
              'No fue posible consultar el ámbito del coordinador.',
          });
        }

        if (
          !ambitos ||
          ambitos.length === 0
        ) {
          return res.status(200).json({
            success: true,
            actividades: [],
          });
        }

        const {
          data: asignaciones,
          error: errorAsignaciones,
        } = await supabaseAdmin
          .from(
            'materia_grupo_periodo'
          )
          .select(`
            id,
            grado_id,
            grupo_id
          `);

        if (errorAsignaciones) {
          console.error(
            'Error consultando asignaciones académicas:',
            errorAsignaciones.message
          );

          return res.status(500).json({
            success: false,
            message:
              'No fue posible consultar las asignaciones académicas.',
          });
        }

        const ambitosPermitidos =
          new Set(
            ambitos.map(
              (ambito) =>
                `${ambito.grado_id}-${ambito.grupo_id}`
            )
          );

        idsAsignacionesPermitidas =
          (asignaciones || [])
            .filter(
              (asignacion) =>
                ambitosPermitidos.has(
                  `${asignacion.grado_id}-${asignacion.grupo_id}`
                )
            )
            .map(
              (asignacion) =>
                asignacion.id
            );

        if (
          idsAsignacionesPermitidas.length ===
          0
        ) {
          return res.status(200).json({
            success: true,
            actividades: [],
          });
        }
      }

      // ==================================================
      // CONSULTA DE ACTIVIDADES
      // ADMINISTRADOR = TODAS
      // COORDINADOR = SOLO LAS DE SU ÁMBITO
      // ==================================================

      let consulta =
        supabaseAdmin
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
            docente_id,
            created_at,
            updated_at,

            docente:usuarios!actividades_academicas_docente_id_fkey (
              id,
              nombres,
              apellidos,
              correo
            ),

            materia_grupo_periodo:materia_grupo_periodo_id (
              id,

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
              ),

              periodo:periodos_academicos (
                id,
                nombre
              )
            )
          `);

      if (
        rol === 'coordinador'
      ) {
        consulta =
          consulta.in(
            'materia_grupo_periodo_id',
            idsAsignacionesPermitidas
          );
      }

      const {
        data,
        error,
      } =
        await consulta.order(
          'fecha_entrega',
          {
            ascending: true,
          }
        );

      if (error) {
        console.error(
          'Error consultando actividades administrativas:',
          error.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible consultar las actividades académicas.',
        });
      }

      return res.status(200).json({
        success: true,
        actividades:
          data || [],
      });
    } catch (error) {
      console.error(
        'Error inesperado consultando actividades administrativas:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Ocurrió un error al consultar las actividades académicas.',
      });
    }
  };

const actualizarActividadAdministrativa =
  async (req, res) => {
    try {
      const actividadId =
        Number(req.params.id);

      const {
        tipo,
        titulo,
        descripcion,
        fechaPublicacion,
        fechaEntrega,
        estado,
      } = req.body;

      if (!actividadId) {
        return res.status(400).json({
          success: false,
          message:
            'La actividad no es válida.',
        });
      }

      if (
        !tipo ||
        !titulo?.trim() ||
        !descripcion?.trim() ||
        !fechaPublicacion ||
        !fechaEntrega ||
        !estado
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Complete todos los campos obligatorios.',
        });
      }

      if (
        ![
          'tarea',
          'actividad',
          'examen',
        ].includes(tipo)
      ) {
        return res.status(400).json({
          success: false,
          message:
            'El tipo de actividad no es válido.',
        });
      }

      if (
        ![
          'publicada',
          'cancelada',
        ].includes(estado)
      ) {
        return res.status(400).json({
          success: false,
          message:
            'El estado de la actividad no es válido.',
        });
      }

      const fechaPublicacionDate =
        new Date(fechaPublicacion);

      const fechaEntregaDate =
        new Date(fechaEntrega);

      if (
        Number.isNaN(
          fechaPublicacionDate.getTime()
        ) ||
        Number.isNaN(
          fechaEntregaDate.getTime()
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Las fechas ingresadas no son válidas.',
        });
      }

      if (
        fechaEntregaDate <
        fechaPublicacionDate
      ) {
        return res.status(400).json({
          success: false,
          message:
            'La fecha de entrega no puede ser anterior a la fecha de publicación.',
        });
      }

      const {
        data: actividadActual,
        error: errorConsulta,
      } = await supabaseAdmin
        .from('actividades_academicas')
        .select(`
          *,
          materia_grupo_periodo:materia_grupo_periodo_id (
            id,
            grado_id,
            grupo_id
          )
        `)
        .eq('id', actividadId)
        .maybeSingle();

      if (errorConsulta) {
        return res.status(500).json({
          success: false,
          message:
            'No fue posible consultar la actividad.',
        });
      }

      if (!actividadActual) {
        return res.status(404).json({
          success: false,
          message:
            'La actividad no existe.',
        });
      }

      if (
        req.usuario.rol ===
        'coordinador'
      ) {
        const asignacion =
            actividadActual
              .materia_grupo_periodo;

        if (!asignacion) {
            return res.status(403).json({
              success: false,
              message:
                'No tiene permisos para modificar esta actividad.',
            });
        }

        const {
            data: ambitoPermitido,
            error: errorAmbito,
        } = await supabaseAdmin
            .from('coordinador_ambito')
            .select('id')
            .eq(
              'coordinador_id',
              req.usuario.id
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
              'Error validando ámbito del coordinador:',
              errorAmbito.message
            );

            return res.status(500).json({
              success: false,
              message:
                'No fue posible validar los permisos del coordinador.',
            });
        }

        if (!ambitoPermitido) {
            return res.status(403).json({
              success: false,
              message:
                'No tiene permisos para modificar actividades fuera de su ámbito.',
            });
        }
      }

      const {
        error: errorActualizacion,
      } = await supabaseAdmin
        .from('actividades_academicas')
        .update({
          tipo,
          titulo: titulo.trim(),
          descripcion:
            descripcion.trim(),
          fecha_publicacion:
            fechaPublicacion,
          fecha_entrega:
            fechaEntrega,
          estado,
          updated_at:
            new Date().toISOString(),
        })
        .eq('id', actividadId);

      if (errorActualizacion) {
        console.error(
          'Error actualizando actividad:',
          errorActualizacion.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible actualizar la actividad.',
        });
      }

      await registrarAuditoria({
        usuarioId: req.usuario.id,
        correo: req.usuario.correo,
        evento:
          'ACTIVIDAD_MODIFICADA',
        descripcion:
          `Se modificó la actividad ${actividadId}.`,
        rol: req.usuario.rol,
        direccionIp: req.ip,
        dispositivo:
          req.headers['user-agent'] || null,
        metadata: {
          accion:
            'ACTIVIDAD_MODIFICADA',
          entidad:
            'actividades_academicas',
          entidadId:
            actividadId,
          detalle: {
            antes: {
              tipo:
                actividadActual.tipo,
              titulo:
                actividadActual.titulo,
              descripcion:
                actividadActual.descripcion,
              fechaPublicacion:
                actividadActual.fecha_publicacion,
              fechaEntrega:
                actividadActual.fecha_entrega,
              estado:
                actividadActual.estado,
            },
            despues: {
              tipo,
              titulo:
                titulo.trim(),
              descripcion:
                descripcion.trim(),
              fechaPublicacion,
              fechaEntrega,
              estado,
            },
          },
        },
      });

      return res.status(200).json({
        success: true,
        message:
          'Actividad actualizada con éxito.',
      });
    } catch (error) {
      console.error(
        'Error inesperado actualizando actividad:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Ocurrió un error al actualizar la actividad.',
      });
    }
  };

const subirRecursoActividad =
  async (req, res) => {
    try {
      const docenteId =
        req.usuario.id;

      const actividadId =
        Number(req.params.id);

      if (!actividadId) {
        return res.status(400).json({
          success: false,
          message:
            'La actividad no es válida.',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message:
            'Debe seleccionar un archivo.',
        });
      }

      // Verificar que la actividad pertenezca
      // al docente autenticado.
      const {
        data: actividad,
        error: errorActividad,
      } = await supabaseAdmin
        .from('actividades_academicas')
        .select(`
          id,
          docente_id
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
        actividad.docente_id !==
        docenteId
      ) {
        return res.status(403).json({
          success: false,
          message:
            'No está autorizado para adjuntar archivos a esta actividad.',
        });
      }

      const nombreSeguro =
        req.file.originalname
          .replace(
            /[^a-zA-Z0-9._-]/g,
            '_'
          );

      const storagePath =
        `actividades/${actividadId}/${Date.now()}-${nombreSeguro}`;

      const {
        error: errorStorage,
      } = await supabaseAdmin
        .storage
        .from(
          'aulaai-actividades'
        )
        .upload(
          storagePath,
          req.file.buffer,
          {
            contentType:
              req.file.mimetype,

            upsert: false,
          }
        );

      if (errorStorage) {
        console.error(
          'Error subiendo archivo:',
          errorStorage.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible subir el archivo.',
        });
      }

      let tipoRecurso =
        'archivo';

      if (
        req.file.mimetype ===
        'application/pdf'
      ) {
        tipoRecurso = 'pdf';
      } else if (
        req.file.mimetype.startsWith(
          'image/'
        )
      ) {
        tipoRecurso = 'imagen';
      } else if (
        req.file.mimetype.startsWith(
          'video/'
        )
      ) {
        tipoRecurso = 'video';
      } else if (
        req.file.mimetype.includes(
          'word'
        ) ||
        req.file.mimetype.includes(
          'excel'
        ) ||
        req.file.mimetype.includes(
          'powerpoint'
        ) ||
        req.file.mimetype.includes(
          'officedocument'
        )
      ) {
        tipoRecurso =
          'documento';
      }

      const {
        data: recurso,
        error: errorRecurso,
      } = await supabaseAdmin
        .from(
          'actividad_recursos'
        )
        .insert({
          actividad_id:
            actividadId,

          nombre_original:
            req.file.originalname,

          tipo_recurso:
            tipoRecurso,

          mime_type:
            req.file.mimetype,

          tamano_bytes:
            req.file.size,

          storage_path:
            storagePath,

          url_externa:
            null,
        })
        .select()
        .single();

      if (errorRecurso) {
        // Si falla BD,
        // eliminamos el archivo subido.
        await supabaseAdmin
          .storage
          .from(
            'aulaai-actividades'
          )
          .remove([
            storagePath,
          ]);

        console.error(
          'Error registrando recurso:',
          errorRecurso.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible registrar el archivo.',
        });
      }

      return res.status(201).json({
        success: true,
        message:
          'Archivo adjuntado con éxito.',
        recurso,
      });
    } catch (error) {
      console.error(
        'Error inesperado subiendo recurso:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Ocurrió un error al subir el archivo.',
      });
    }
  };

const agregarEnlaceActividad =
  async (req, res) => {
    try {
      const docenteId =
        req.usuario.id;

      const actividadId =
        Number(req.params.id);

      const {
        url,
        nombre,
      } = req.body;

      if (!actividadId) {
        return res.status(400).json({
          success: false,
          message:
            'La actividad no es válida.',
        });
      }

      if (!url?.trim()) {
        return res.status(400).json({
          success: false,
          message:
            'Debe ingresar un enlace.',
        });
      }

      let urlValidada;

      try {
        urlValidada =
          new URL(url.trim());
      } catch (error) {
        return res.status(400).json({
          success: false,
          message:
            'El enlace ingresado no es válido.',
        });
      }

      if (
        ![
          'http:',
          'https:',
        ].includes(
          urlValidada.protocol
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            'El enlace debe utilizar http o https.',
        });
      }

      // Verificar que la actividad
      // pertenezca al docente.
      const {
        data: actividad,
        error: errorActividad,
      } = await supabaseAdmin
        .from(
          'actividades_academicas'
        )
        .select(`
          id,
          docente_id
        `)
        .eq(
          'id',
          actividadId
        )
        .maybeSingle();

      if (errorActividad) {
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
        actividad.docente_id !==
        docenteId
      ) {
        return res.status(403).json({
          success: false,
          message:
            'No está autorizado para agregar recursos a esta actividad.',
        });
      }

      const {
        data: recurso,
        error: errorRecurso,
      } = await supabaseAdmin
        .from(
          'actividad_recursos'
        )
        .insert({
          actividad_id:
            actividadId,

          nombre_original:
            nombre?.trim() ||
            urlValidada.hostname,

          tipo_recurso:
            'enlace',

          mime_type:
            null,

          tamano_bytes:
            null,

          storage_path:
            null,

          url_externa:
            urlValidada.toString(),
        })
        .select()
        .single();

      if (errorRecurso) {
        console.error(
          'Error registrando enlace:',
          errorRecurso.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible registrar el enlace.',
        });
      }

      return res.status(201).json({
        success: true,
        message:
          'Enlace agregado con éxito.',
        recurso,
      });
    } catch (error) {
      console.error(
        'Error inesperado agregando enlace:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Ocurrió un error al registrar el enlace.',
      });
    }
  };

const listarRecursosActividad =
  async (req, res) => {
    try {
      const usuarioId =
        req.usuario.id;

      const rol =
        req.usuario.rol;

      const actividadId =
        Number(req.params.id);

      if (!actividadId) {
        return res.status(400).json({
          success: false,
          message:
            'La actividad no es válida.',
        });
      }

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

      const asignacionRelacionada =
        actividad.materia_grupo_periodo;

      const asignacion =
        Array.isArray(asignacionRelacionada)
          ? asignacionRelacionada[0]
          : asignacionRelacionada;

      let autorizado = false;

      if (
        rol === 'administrador'
      ) {
        autorizado = true;
      }

      // Por ahora conserva el acceso administrativo
      // existente. El alcance institucional se
      // restringirá cuando modelemos sus permisos.
      if (
        rol === 'coordinador'
      ) {
        const {
          data: ambitoCoordinador,
          error: errorAmbitoCoordinador,
        } = await supabaseAdmin
          .from('coordinador_ambito')
          .select('id')
          .eq(
            'coordinador_id',
            usuarioId
          )
          .eq(
            'grado_id',
            asignacion?.grado_id
          )
          .eq(
            'grupo_id',
            asignacion?.grupo_id
          )
          .eq(
            'activo',
            true
          )
          .maybeSingle();

        if (errorAmbitoCoordinador) {
          console.error(
            'Error validando ámbito del coordinador:',
            errorAmbitoCoordinador.message
          );

          return res.status(500).json({
            success: false,
            message:
              'No fue posible validar los permisos del coordinador.',
          });
        }

        if (ambitoCoordinador) {
          autorizado = true;
        }
      }

      if (
        rol === 'docente' &&
        actividad.docente_id === usuarioId
      ) {
        autorizado = true;
      }

      // Estudiante perteneciente al grado y grupo
      if (
        rol === 'estudiante'
      ) {
        const {
          data: estudiante,
          error: errorEstudiante,
        } = await supabaseAdmin
          .from('estudiantes')
          .select(`
            grado_id,
            grupo_id
          `)
          .eq(
            'usuario_id',
            usuarioId
          )
          .maybeSingle();

        if (errorEstudiante) {
          return res.status(500).json({
            success: false,
            message:
              'No fue posible validar al estudiante.',
          });
        }

        if (
          estudiante &&
          estudiante.grado_id ===
            asignacion?.grado_id &&
          estudiante.grupo_id ===
            asignacion?.grupo_id
        ) {
          autorizado = true;
        }
      }

      if (!autorizado) {
        return res.status(403).json({
          success: false,
          message:
            'No está autorizado para consultar los recursos de esta actividad.',
        });
      }

      // 3. Consultar recursos
      const {
        data: recursos,
        error: errorRecursos,
      } = await supabaseAdmin
        .from(
          'actividad_recursos'
        )
        .select(`
          id,
          nombre_original,
          tipo_recurso,
          mime_type,
          tamano_bytes,
          storage_path,
          url_externa,
          created_at
        `)
        .eq(
          'actividad_id',
          actividadId
        )
        .order(
          'created_at',
          {
            ascending: true,
          }
        );

      if (errorRecursos) {
        console.error(
          'Error consultando recursos:',
          errorRecursos.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible consultar los recursos.',
        });
      }

      // 4. Generar enlaces temporales
      const recursosRespuesta = [];

      for (
        const recurso of recursos || []
      ) {
        // Link externo
        if (
          recurso.tipo_recurso ===
          'enlace'
        ) {
          recursosRespuesta.push({
            ...recurso,
            url:
              recurso.url_externa,
            storage_path:
              undefined,
          });

          continue;
        }

        if (!recurso.storage_path) {
          continue;
        }

        // Archivo privado
        const {
          data: signedData,
          error: errorSigned,
        } = await supabaseAdmin.storage
          .from(
            'aulaai-actividades'
          )
          .createSignedUrl(
            recurso.storage_path,
            15 * 60
          );

        if (errorSigned) {
          console.error(
            'Error creando URL firmada:',
            errorSigned.message
          );

          continue;
        }

        recursosRespuesta.push({
          ...recurso,
          url:
            signedData.signedUrl,
          storage_path:
            undefined,
        });
      }

      return res.status(200).json({
        success: true,
        recursos:
          recursosRespuesta,
      });
    } catch (error) {
      console.error(
        'Error inesperado consultando recursos:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Ocurrió un error al consultar los recursos.',
      });
    }
  };

const registrarEntregaEstudiante =
  async (req, res) => {
    try {
      const estudianteId =
        req.usuario.id;

      const actividadId =
        Number(req.params.id);

      const {
        comentario: comentarioRecibido,
        clientRequestId,
      } = req.body || {};

      const comentario =
        comentarioRecibido?.trim() ||
        null;

      if (
        !actividadId ||
        Number.isNaN(actividadId)
      ) {
        return res.status(400).json({
          success: false,
          message:
            'La actividad seleccionada no es válida.',
        });
      }

      // ========================================
      // 1. Obtener información académica
      //    del estudiante autenticado
      // ========================================

      const {
        data: estudiante,
        error: errorEstudiante,
      } = await supabaseAdmin
        .from('estudiantes')
        .select(`
          grado_id,
          grupo_id
        `)
        .eq(
          'usuario_id',
          estudianteId
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
            'No fue posible validar la información académica del estudiante.',
        });
      }

      if (!estudiante) {
        return res.status(404).json({
          success: false,
          message:
            'No se encontró la información académica del estudiante.',
        });
      }

      // ========================================
      // 2. Consultar actividad
      // ========================================

      const {
        data: actividad,
        error: errorActividad,
      } = await supabaseAdmin
        .from(
          'actividades_academicas'
        )
        .select(`
          id,
          titulo,
          fecha_entrega,
          estado,
          materia_grupo_periodo_id,
          materia_grupo_periodo:materia_grupo_periodo_id (
            id,
            grado_id,
            grupo_id,
            estado
          )
        `)
        .eq(
          'id',
          actividadId
        )
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

      if (
        actividad.estado !==
        'publicada'
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Esta actividad no está disponible para entrega.',
        });
      }

      // ========================================
      // 3. Validar grado y grupo
      // ========================================

      const asignacion =
        actividad.materia_grupo_periodo;

      if (
        !asignacion ||
        asignacion.estado !==
          'activa'
      ) {
        return res.status(400).json({
          success: false,
          message:
            'La asignación académica de esta actividad no está activa.',
        });
      }

      if (
        Number(asignacion.grado_id) !==
          Number(
            estudiante.grado_id
          ) ||
        Number(asignacion.grupo_id) !==
          Number(
            estudiante.grupo_id
          )
      ) {
        return res.status(403).json({
          success: false,
          message:
            'No estás autorizado para entregar esta actividad.',
        });
      }

      // ========================================
      // 4. Comprobar si ya existe
      //    una entrega activa
      // ========================================

      if (clientRequestId) {
        const {
          data: entregaProcesada,
          error: errorProcesada,
        } = await supabaseAdmin
          .from(
            'entregas_actividades'
          )
          .select(`
            id,
            actividad_id,
            estudiante_id,
            comentario,
            estado,
            fecha_entrega,
            created_at,
            updated_at
          `)
          .eq(
            'client_request_id',
            clientRequestId
          )
          .eq(
            'estudiante_id',
            estudianteId
          )
          .maybeSingle();

        if (errorProcesada) {
          console.error(
            'Error verificando clientRequestId:',
            errorProcesada.message
          );

          return res.status(500).json({
            success: false,
            message:
              'No fue posible verificar la solicitud de entrega.',
          });
        }

        if (entregaProcesada) {
          return res.status(200).json({
            success: true,
            message:
              entregaProcesada.estado ===
              'entregada_tarde'
                ? 'Entrega registrada con retraso.'
                : 'Entrega registrada con éxito.',

            entregaId:
              entregaProcesada.id,

            entrega:
              entregaProcesada,
          });
        }
      }

      const {
        data: entregaExistente,
        error: errorExistente,
      } = await supabaseAdmin
        .from(
          'entregas_actividades'
        )
        .select(`
          id,
          estado,
          fecha_entrega
        `)
        .eq(
          'actividad_id',
          actividadId
        )
        .eq(
          'estudiante_id',
          estudianteId
        )
        .neq(
          'estado',
          'anulada'
        )
        .maybeSingle();

      if (errorExistente) {
        console.error(
          'Error verificando entrega existente:',
          errorExistente.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible verificar si ya existe una entrega.',
        });
      }

      if (entregaExistente) {
        return res.status(409).json({
          success: false,
          message:
            'Ya tienes una entrega activa para esta actividad. Si deseas volver a enviarla, primero debes deshacer la entrega actual.',
          entregaId:
            entregaExistente.id,
        });
      }

      // ========================================
      // 5. Determinar entrega normal/tarde
      // ========================================

      const ahora =
        new Date();

      const fechaLimite =
        new Date(
          actividad.fecha_entrega
        );

      const estadoEntrega =
        ahora.getTime() >
        fechaLimite.getTime()
          ? 'entregada_tarde'
          : 'entregada';

      // ========================================
      // 6. Registrar entrega
      // ========================================

      const {
        data: entrega,
        error: errorEntrega,
      } = await supabaseAdmin
        .from(
          'entregas_actividades'
        )
        .insert({
          actividad_id:
            actividadId,

          estudiante_id:
            estudianteId,

          comentario,

          estado:
            estadoEntrega,

          fecha_entrega:
            ahora.toISOString(),

          client_request_id:
            clientRequestId || null,
        })
        .select(`
          id,
          actividad_id,
          estudiante_id,
          comentario,
          estado,
          fecha_entrega,
          created_at,
          updated_at
        `)
        .single();

      if (errorEntrega) {
        console.error(
          'Error registrando entrega:',
          errorEntrega.message,
          errorEntrega.code
        );

        if (
          errorEntrega.code ===
          '23505'
        ) {
          return res.status(409).json({
            success: false,
            message:
              'Ya existe una entrega activa para esta actividad.',
          });
        }

        return res.status(500).json({
          success: false,
          message:
            'No fue posible registrar la entrega.',
        });
      }

      return res.status(201).json({
        success: true,
        message:
          estadoEntrega ===
          'entregada_tarde'
            ? 'Entrega registrada con retraso.'
            : 'Entrega registrada con éxito.',
        entregaId:
          entrega.id,
        entrega,
      });
    } catch (error) {
      console.error(
        'Error inesperado registrando entrega:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Ocurrió un error al registrar la entrega.',
      });
    }
  };

const consultarMiEntrega =
  async (req, res) => {
    try {
      const estudianteId =
        req.usuario.id;

      const entregaId =
        Number(req.params.entregaId);

      if (!entregaId) {
        return res.status(400).json({
          success: false,
          message:
            'La entrega no es válida.',
        });
      }

      const {
        data: entrega,
        error: errorEntrega,
      } = await supabaseAdmin
        .from('entregas_actividades')
        .select(`
          id,
          actividad_id,
          estudiante_id,
          comentario,
          estado,
          fecha_entrega,
          created_at,
          updated_at
        `)
        .eq('id', entregaId)
        .maybeSingle();

      if (errorEntrega) {
        console.error(
          'Error consultando entrega:',
          errorEntrega.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible consultar la entrega.',
        });
      }

      if (!entrega) {
        return res.status(404).json({
          success: false,
          message:
            'La entrega no existe.',
        });
      }

      if (
        entrega.estudiante_id !==
        estudianteId
      ) {
        return res.status(403).json({
          success: false,
          message:
            'No está autorizado para consultar esta entrega.',
        });
      }

      const {
        data: recursos,
        error: errorRecursos,
      } = await supabaseAdmin
        .from('entrega_recursos')
        .select(`
          id,
          nombre_original,
          tipo_recurso,
          mime_type,
          tamano_bytes,
          storage_path,
          url_externa,
          created_at
        `)
        .eq(
          'entrega_id',
          entregaId
        )
        .order(
          'created_at',
          {
            ascending: true,
          }
        );

      if (errorRecursos) {
        console.error(
          'Error consultando recursos de entrega:',
          errorRecursos.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible consultar los archivos de la entrega.',
        });
      }

      const recursosRespuesta = [];

      for (
        const recurso of recursos || []
      ) {
        if (
          recurso.tipo_recurso ===
          'enlace'
        ) {
          recursosRespuesta.push({
            ...recurso,
            url:
              recurso.url_externa,
            storage_path:
              undefined,
          });

          continue;
        }

        if (!recurso.storage_path) {
          console.error(
            'El recurso de entrega no tiene una ruta de almacenamiento:',
            recurso.id
          );

          return res.status(500).json({
            success: false,
            message:
              'No fue posible preparar los archivos de la entrega.',
          });
        }

        const {
          data: signedData,
          error: errorSigned,
        } =
          await supabaseAdmin.storage
            .from(
              'aulaai-actividades'
            )
            .createSignedUrl(
              recurso.storage_path,
              15 * 60
            );

        if (errorSigned) {
          console.error(
            'Error creando URL temporal:',
            errorSigned.message
          );

          return res.status(500).json({
            success: false,
            message:
              'No fue posible preparar los archivos de la entrega.',
          });
        }

        recursosRespuesta.push({
          ...recurso,
          url:
            signedData.signedUrl,
          storage_path:
            undefined,
        });
      }

      return res.status(200).json({
        success: true,

        entrega: {
          id:
            entrega.id,

          actividadId:
            entrega.actividad_id,

          comentario:
            entrega.comentario,

          estado:
            entrega.estado,

          fechaEntrega:
            entrega.fecha_entrega,

          recursos:
            recursosRespuesta,
        },
      });
    } catch (error) {
      console.error(
        'Error inesperado consultando entrega:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Ocurrió un error al consultar la entrega.',
      });
    }
  };

const deshacerEntregaEstudiante =
  async (req, res) => {
    try {
      const estudianteId =
        req.usuario.id;

      const entregaId =
        Number(req.params.entregaId);

      if (!entregaId) {
        return res.status(400).json({
          success: false,
          message:
            'La entrega no es válida.',
        });
      }

      const {
        data: entrega,
        error: errorConsulta,
      } = await supabaseAdmin
        .from('entregas_actividades')
        .select(`
          id,
          estudiante_id,
          estado
        `)
        .eq('id', entregaId)
        .maybeSingle();

      if (errorConsulta) {
        return res.status(500).json({
          success: false,
          message:
            'No fue posible consultar la entrega.',
        });
      }

      if (!entrega) {
        return res.status(404).json({
          success: false,
          message:
            'La entrega no existe.',
        });
      }

      if (
        entrega.estudiante_id !==
        estudianteId
      ) {
        return res.status(403).json({
          success: false,
          message:
            'No está autorizado para modificar esta entrega.',
        });
      }

      if (
        entrega.estado ===
        'anulada'
      ) {
        return res.status(400).json({
          success: false,
          message:
            'La entrega ya fue anulada.',
        });
      }

      const {
        error: errorActualizacion,
      } = await supabaseAdmin
        .from('entregas_actividades')
        .update({
          estado: 'anulada',
          updated_at:
            new Date().toISOString(),
        })
        .eq('id', entregaId);

      if (errorActualizacion) {
        console.error(
          'Error anulando entrega:',
          errorActualizacion.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible deshacer la entrega.',
        });
      }

      return res.status(200).json({
        success: true,
        message:
          'Entrega anulada correctamente.',
      });
    } catch (error) {
      console.error(
        'Error inesperado anulando entrega:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Ocurrió un error al deshacer la entrega.',
      });
    }
  };

const subirRecursoEntrega =
  async (req, res) => {
    try {
      const estudianteId =
        req.usuario.id;

      const entregaId =
        Number(req.params.entregaId);

      if (!entregaId) {
        return res.status(400).json({
          success: false,
          message:
            'La entrega no es válida.',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message:
            'Debe seleccionar un archivo.',
        });
      }

      // Verificar que la entrega pertenezca
      // al estudiante autenticado
      const {
        data: entrega,
        error: errorEntrega,
      } = await supabaseAdmin
        .from('entregas_actividades')
        .select(`
          id,
          actividad_id,
          estudiante_id
        `)
        .eq(
          'id',
          entregaId
        )
        .maybeSingle();

      if (errorEntrega) {
        return res.status(500).json({
          success: false,
          message:
            'No fue posible validar la entrega.',
        });
      }

      if (!entrega) {
        return res.status(404).json({
          success: false,
          message:
            'La entrega no existe.',
        });
      }

      if (
        entrega.estudiante_id !==
        estudianteId
      ) {
        return res.status(403).json({
          success: false,
          message:
            'No está autorizado para adjuntar archivos a esta entrega.',
        });
      }

      const nombreSeguro =
        req.file.originalname.replace(
          /[^a-zA-Z0-9._-]/g,
          '_'
        );

      const storagePath =
        `entregas/${entregaId}/${Date.now()}-${nombreSeguro}`;

      const {
        error: errorStorage,
      } = await supabaseAdmin
        .storage
        .from(
          'aulaai-actividades'
        )
        .upload(
          storagePath,
          req.file.buffer,
          {
            contentType:
              req.file.mimetype,
            upsert: false,
          }
        );

      if (errorStorage) {
        console.error(
          'Error subiendo archivo de entrega:',
          errorStorage.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible subir el archivo de la entrega.',
        });
      }

      let tipoRecurso =
        'archivo';

      if (
        req.file.mimetype ===
        'application/pdf'
      ) {
        tipoRecurso = 'pdf';
      } else if (
        req.file.mimetype.startsWith(
          'image/'
        )
      ) {
        tipoRecurso = 'imagen';
      } else if (
        req.file.mimetype.startsWith(
          'video/'
        )
      ) {
        tipoRecurso = 'video';
      } else if (
        req.file.mimetype.includes(
          'word'
        ) ||
        req.file.mimetype.includes(
          'excel'
        ) ||
        req.file.mimetype.includes(
          'powerpoint'
        ) ||
        req.file.mimetype.includes(
          'officedocument'
        )
      ) {
        tipoRecurso =
          'documento';
      }

      const {
        data: recurso,
        error: errorRecurso,
      } = await supabaseAdmin
        .from(
          'entrega_recursos'
        )
        .insert({
          entrega_id:
            entregaId,

          nombre_original:
            req.file.originalname,

          tipo_recurso:
            tipoRecurso,

          mime_type:
            req.file.mimetype,

          tamano_bytes:
            req.file.size,

          storage_path:
            storagePath,

          url_externa:
            null,
        })
        .select()
        .single();

      if (errorRecurso) {
        await supabaseAdmin
          .storage
          .from(
            'aulaai-actividades'
          )
          .remove([
            storagePath,
          ]);

        console.error(
          'Error registrando archivo de entrega:',
          errorRecurso.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible registrar el archivo de la entrega.',
        });
      }

      return res.status(201).json({
        success: true,
        message:
          'Archivo de entrega adjuntado con éxito.',
        recurso,
      });
    } catch (error) {
      console.error(
        'Error inesperado subiendo archivo de entrega:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Ocurrió un error al subir el archivo de la entrega.',
      });
    }
  };

const agregarEnlaceEntrega =
  async (req, res) => {
    try {
      const estudianteId =
        req.usuario.id;

      const entregaId =
        Number(req.params.entregaId);

      const {
        url,
        nombre,
      } = req.body;

      if (!entregaId) {
        return res.status(400).json({
          success: false,
          message:
            'La entrega no es válida.',
        });
      }

      if (!url?.trim()) {
        return res.status(400).json({
          success: false,
          message:
            'Debe ingresar un enlace.',
        });
      }

      let urlValidada;

      try {
        urlValidada =
          new URL(url.trim());
      } catch (error) {
        return res.status(400).json({
          success: false,
          message:
            'El enlace ingresado no es válido.',
        });
      }

      if (
        ![
          'http:',
          'https:',
        ].includes(
          urlValidada.protocol
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            'El enlace debe utilizar http o https.',
        });
      }

      // Verificar que la entrega
      // pertenezca al estudiante autenticado
      const {
        data: entrega,
        error: errorEntrega,
      } = await supabaseAdmin
        .from(
          'entregas_actividades'
        )
        .select(`
          id,
          estudiante_id
        `)
        .eq(
          'id',
          entregaId
        )
        .maybeSingle();

      if (errorEntrega) {
        return res.status(500).json({
          success: false,
          message:
            'No fue posible validar la entrega.',
        });
      }

      if (!entrega) {
        return res.status(404).json({
          success: false,
          message:
            'La entrega no existe.',
        });
      }

      if (
        entrega.estudiante_id !==
        estudianteId
      ) {
        return res.status(403).json({
          success: false,
          message:
            'No está autorizado para agregar recursos a esta entrega.',
        });
      }

      const {
        data: recurso,
        error: errorRecurso,
      } = await supabaseAdmin
        .from(
          'entrega_recursos'
        )
        .insert({
          entrega_id:
            entregaId,

          nombre_original:
            nombre?.trim() ||
            urlValidada.hostname,

          tipo_recurso:
            'enlace',

          mime_type:
            null,

          tamano_bytes:
            null,

          storage_path:
            null,

          url_externa:
            urlValidada.toString(),
        })
        .select()
        .single();

      if (errorRecurso) {
        console.error(
          'Error registrando enlace de entrega:',
          errorRecurso.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible registrar el enlace de la entrega.',
        });
      }

      return res.status(201).json({
        success: true,
        message:
          'Enlace de entrega agregado con éxito.',
        recurso,
      });
    } catch (error) {
      console.error(
        'Error inesperado agregando enlace de entrega:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Ocurrió un error al registrar el enlace de la entrega.',
      });
    }
  };

const listarEntregasActividadDocente =
  async (req, res) => {
    try {
      const docenteId =
        req.usuario.id;

      const actividadId =
        Number(req.params.id);

      if (!actividadId) {
        return res.status(400).json({
          success: false,
          message:
            'La actividad no es válida.',
        });
      }

      const {
        data: actividad,
        error: errorActividad,
      } = await supabaseAdmin
        .from(
          'actividades_academicas'
        )
        .select(`
          id,
          titulo,
          fecha_entrega,
          docente_id
        `)
        .eq(
          'id',
          actividadId
        )
        .maybeSingle();

      if (errorActividad) {
        console.error(
          'Error consultando actividad para listar entregas:',
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

      if (
        actividad.docente_id !==
        docenteId
      ) {
        return res.status(403).json({
          success: false,
          message:
            'No está autorizado para consultar las entregas de esta actividad.',
        });
      }

      const {
        data: entregas,
        error: errorEntregas,
      } = await supabaseAdmin
        .from(
          'entregas_actividades'
        )
        .select(`
          id,
          estudiante_id,
          comentario,
          estado,
          fecha_entrega,
          created_at,
          estudiante:usuarios!entregas_actividades_estudiante_id_fkey (
            id,
            nombres,
            apellidos,
            correo
          )
        `)
        .eq(
          'actividad_id',
          actividadId
        )
        .neq(
          'estado',
          'anulada'
        )
        .order(
          'fecha_entrega',
          {
            ascending: true,
          }
        );

      if (errorEntregas) {
        console.error(
          'Error consultando entregas:',
          errorEntregas.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible consultar las entregas.',
        });
      }

      const resultado = [];

      for (
        const entrega of entregas || []
      ) {
        const {
          data: recursos,
          error: errorRecursos,
        } = await supabaseAdmin
          .from(
            'entrega_recursos'
          )
          .select(`
            id,
            nombre_original,
            tipo_recurso,
            mime_type,
            tamano_bytes,
            storage_path,
            url_externa
          `)
          .eq(
            'entrega_id',
            entrega.id
          );

        if (errorRecursos) {
          console.error(
            'Error consultando recursos de entrega:',
            errorRecursos.message
          );

          return res.status(500).json({
            success: false,
            message:
              'No fue posible consultar los archivos de las entregas.',
          });
        }

        const recursosRespuesta = [];

        for (
          const recurso of recursos || []
        ) {
          if (
            recurso.tipo_recurso ===
            'enlace'
          ) {
            recursosRespuesta.push({
              ...recurso,
              url:
                recurso.url_externa,
              storage_path:
                undefined,
            });

            continue;
          }

          if (!recurso.storage_path) {
            console.error(
              'El recurso de entrega no tiene una ruta de almacenamiento:',
              recurso.id
            );

            return res.status(500).json({
              success: false,
              message:
                'No fue posible preparar los archivos de las entregas.',
            });
          }

          const {
            data: signedData,
            error: errorSigned,
          } =
            await supabaseAdmin.storage
              .from(
                'aulaai-actividades'
              )
              .createSignedUrl(
                recurso.storage_path,
                15 * 60
              );

          if (errorSigned) {
            console.error(
              'Error creando URL temporal para recurso de entrega:',
              errorSigned.message
            );

            return res.status(500).json({
              success: false,
              message:
                'No fue posible preparar los archivos de las entregas.',
            });
          }

          recursosRespuesta.push({
            ...recurso,
            url:
              signedData.signedUrl,
            storage_path:
              undefined,
          });
        }

        resultado.push({
          ...entrega,

          entregada_tarde:
            entrega.estado ===
            'entregada_tarde',

          recursos:
            recursosRespuesta,
        });
      }

      return res.status(200).json({
        success: true,

        actividad: {
          id:
            actividad.id,

          titulo:
            actividad.titulo,

          fechaLimite:
            actividad.fecha_entrega,
        },

        entregas:
          resultado,
      });
    } catch (error) {
      console.error(
        'Error inesperado consultando entregas:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Ocurrió un error al consultar las entregas.',
      });
    }
  };

module.exports = {
  listarAsignacionesDocente,
  registrarActividad,
  listarActividadesDocente,
  listarActividadesEstudiante,
  listarActividadesAdministrativas,
  actualizarActividadAdministrativa,
  subirRecursoActividad,
  agregarEnlaceActividad,
  listarRecursosActividad,
  registrarEntregaEstudiante,
  consultarMiEntrega,
  deshacerEntregaEstudiante,
  subirRecursoEntrega,
  agregarEnlaceEntrega,
  listarEntregasActividadDocente,
};
