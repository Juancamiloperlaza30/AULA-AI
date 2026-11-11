const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  registrarAuditoria,
} = require('../services/auditService');

const ROLES_PERMITIDOS = [
  'estudiante',
  'acudiente',
  'docente',
  'orientador',
  'coordinador',
];

const consultarAmbitosCoordinador = async ({
  coordinadorId,
  grupoIds = null,
}) => {
  let consulta = supabaseAdmin
    .from('coordinador_ambito')
    .select('grado_id, grupo_id')
    .eq('coordinador_id', coordinadorId)
    .eq('activo', true);

  if (Array.isArray(grupoIds)) {
    consulta = consulta.in(
      'grupo_id',
      [...new Set(grupoIds)]
    );
  }

  return consulta;
};

const verificarGruposEnAmbitoCoordinador = async ({
  usuario,
  asignaciones,
}) => {
  if (usuario?.rol !== 'coordinador') {
    return {
      autorizado: true,
      error: null,
    };
  }

  const gruposIds = [
    ...new Set(
      asignaciones.map(
        ({ grupoId }) => Number(grupoId)
      )
    ),
  ];

  const {
    data: ambitos,
    error,
  } = await consultarAmbitosCoordinador({
    coordinadorId: usuario.id,
    grupoIds: gruposIds,
  });

  if (error) {
    return {
      autorizado: false,
      error,
    };
  }

  const ambitosAutorizados = new Set(
    (ambitos || []).map(
      ({ grado_id, grupo_id }) =>
        `${grado_id}:${grupo_id}`
    )
  );

  return {
    autorizado: asignaciones.every(
      ({ gradoId, grupoId }) =>
        ambitosAutorizados.has(
          `${Number(gradoId)}:${Number(grupoId)}`
        )
    ),
    error: null,
  };
};

/**
 * Registrar un nuevo usuario.
 *
 * Solo Administrador o Coordinador pueden usar este endpoint.
 * El rol Administrador NO puede crearse desde este formulario.
 */
const registrarUsuario = async (req, res) => {
  try {
    const {
      nombres,
      apellidos,
      tipoDocumento,
      numeroDocumento,
      correo,
      telefono,
      rol,
      gradoId,
      grupoId,
      ambitosOrientador,
      ambitosCoordinador,
      estudiantesVinculados = [],
    } = req.body;

    // =====================================
    // 1. Validar campos obligatorios
    // =====================================

    if (
      !nombres ||
      !apellidos ||
      !tipoDocumento ||
      !numeroDocumento ||
      !correo ||
      !telefono ||
      !rol
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Todos los campos obligatorios deben ser diligenciados.',
      });
    }

    const correoNormalizado =
      correo.trim().toLowerCase();

    // Validación sencilla de correo
    const regexCorreo =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!regexCorreo.test(correoNormalizado)) {
      return res.status(400).json({
        success: false,
        message:
          'El correo electrónico no tiene un formato válido.',
      });
    }

    // =====================================
    // 2. Validar rol permitido
    // =====================================

    if (!ROLES_PERMITIDOS.includes(rol)) {
      return res.status(400).json({
        success: false,
        message:
          'El rol seleccionado no está permitido.',
      });
    }

    // =====================================
    // 3. Validaciones específicas por rol
    // =====================================

    if (rol === 'estudiante') {
      if (!gradoId || !grupoId) {
        return res.status(400).json({
          success: false,
          message:
            'El estudiante debe tener grado y grupo.',
        });
      }

      const permisoGrupo = await verificarGruposEnAmbitoCoordinador({
        usuario: req.usuario,
        asignaciones: [{ gradoId, grupoId }],
      });

      if (permisoGrupo.error) {
        console.error(
          'Error validando el grupo del estudiante para el coordinador:',
          permisoGrupo.error.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible verificar el grupo autorizado para el estudiante.',
        });
      }

      if (!permisoGrupo.autorizado) {
        return res.status(403).json({
          success: false,
          message:
            'El coordinador solo puede registrar estudiantes en los grupos de su propio ámbito.',
        });
      }
    }

    if (rol === 'acudiente') {
      if (
        !Array.isArray(estudiantesVinculados) ||
        estudiantesVinculados.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            'El acudiente debe estar vinculado al menos a un estudiante.',
        });
      }
    }

    let ambitosOrientadorNormalizados = [];

    let ambitosCoordinadorNormalizados = [];

    if (
      rol === 'orientador' ||
      rol === 'coordinador'
    ) {
      const ambitosRecibidos =
        rol === 'orientador'
          ? ambitosOrientador
          : ambitosCoordinador;

      if (
        !Array.isArray(ambitosRecibidos) ||
        ambitosRecibidos.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            rol === 'orientador'
              ? 'El orientador debe tener al menos un grado y grupo asignado.'
              : 'El coordinador debe tener al menos un grado y grupo asignado.',
        });
      }

      const ambitosNormalizados =
        ambitosRecibidos.map((ambito) => {
          const gradoIdTexto =
            String(ambito?.gradoId ?? '');
          const grupoIdTexto =
            String(ambito?.grupoId ?? '');

          if (
            !/^[1-9]\d*$/.test(gradoIdTexto) ||
            !/^[1-9]\d*$/.test(grupoIdTexto)
          ) {
            return null;
          }

          const gradoIdNumero =
            Number(gradoIdTexto);
          const grupoIdNumero =
            Number(grupoIdTexto);

          if (
            !Number.isSafeInteger(gradoIdNumero) ||
            !Number.isSafeInteger(grupoIdNumero)
          ) {
            return null;
          }

          return {
            grado_id: gradoIdNumero,
            grupo_id: grupoIdNumero,
          };
        });

      if (
        ambitosNormalizados.some(
          (ambito) => !ambito
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Uno o más grados o grupos asignados no son válidos.',
        });
      }

      const paresAmbitos = new Set(
        ambitosNormalizados.map(
          ({ grado_id, grupo_id }) =>
            `${grado_id}:${grupo_id}`
        )
      );

      if (
        paresAmbitos.size !==
        ambitosNormalizados.length
      ) {
        return res.status(400).json({
          success: false,
          message:
            'No se permiten asignaciones de grado y grupo duplicadas.',
        });
      }

      const gruposIds = [
        ...new Set(
          ambitosNormalizados.map(
            ({ grupo_id }) => grupo_id
          )
        ),
      ];

      const {
        data: gruposAsignados,
        error: gruposAsignadosError,
      } = await supabaseAdmin
        .from('grupos')
        .select('id, grado_id, activo')
        .in('id', gruposIds);

      if (gruposAsignadosError) {
        console.error(
          `Error validando ámbitos del ${rol}:`,
          gruposAsignadosError.message
        );

        return res.status(500).json({
          success: false,
          message:
            `No fue posible validar los grupos asignados al ${rol}.`,
        });
      }

      const gruposAsignadosPorId = new Map(
        (gruposAsignados || []).map((grupo) => [
          String(grupo.id),
          grupo,
        ])
      );

      const ambitosValidos =
        ambitosNormalizados.every(
          ({ grado_id, grupo_id }) => {
            const grupo = gruposAsignadosPorId.get(
              String(grupo_id)
            );

            return (
              grupo &&
              String(grupo.grado_id) ===
                String(grado_id) &&
              grupo.activo === true
            );
          }
        );

      if (!ambitosValidos) {
        return res.status(400).json({
          success: false,
          message:
            `Uno o más grupos no están activos o no pertenecen al grado indicado para el ${rol}.`,
        });
      }

      if (rol === 'orientador') {
        ambitosOrientadorNormalizados =
          ambitosNormalizados;
      } else {
        ambitosCoordinadorNormalizados =
          ambitosNormalizados;
      }

      const permisoAmbitos = await verificarGruposEnAmbitoCoordinador({
        usuario: req.usuario,
        asignaciones: ambitosNormalizados.map(
          ({ grado_id, grupo_id }) => ({
            gradoId: grado_id,
            grupoId: grupo_id,
          })
        ),
      });

      if (permisoAmbitos.error) {
        console.error(
          'Error validando el ámbito del coordinador autenticado:',
          permisoAmbitos.error.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible validar los grupos que puede asignar el coordinador.',
        });
      }

      if (!permisoAmbitos.autorizado) {
        return res.status(403).json({
          success: false,
          message:
            'El coordinador solo puede asignar grupos incluidos en su propio ámbito.',
        });
      }
    }

    // =====================================
    // 4. Validar duplicados
    // =====================================

    const {
      data: usuarioExistente,
      error: duplicadoError,
    } = await supabaseAdmin
      .from('usuarios')
      .select('id, correo, numero_documento')
      .or(
        `correo.eq.${correoNormalizado},numero_documento.eq.${numeroDocumento}`
      )
      .maybeSingle();

    if (duplicadoError) {
      console.error(
        'Error validando duplicados:',
        duplicadoError
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible validar los datos del usuario.',
      });
    }

    if (usuarioExistente) {
      return res.status(409).json({
        success: false,
        message:
          'Ya existe un usuario con este documento o correo.',
      });
    }

    // =====================================
    // 5. Crear cuenta con contraseña temporal
    // =====================================

    const passwordTemporal =
      numeroDocumento.trim();

    if (passwordTemporal.length < 6) {
      return res.status(400).json({
        success: false,
        message:
          'El número de documento debe tener al menos 6 caracteres para utilizarlo como contraseña temporal.',
      });
    }

    const {
      data: authData,
      error: authError,
    } =
      await supabaseAdmin.auth.admin.createUser({
        email: correoNormalizado,
        password: passwordTemporal,
        email_confirm: true,
        user_metadata: {
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          rol,
          debe_cambiar_password: true,
        },
      });

    if (authError || !authData?.user) {
      console.error(
        'Error creando usuario en Auth:',
        authError?.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible crear la cuenta del usuario.',
      });
    }

    const userId = authData.user.id;

    // =====================================
    // 6. Crear perfil en public.usuarios
    // =====================================

    const {
      error: perfilError,
    } = await supabaseAdmin
      .from('usuarios')
      .insert({
        id: userId,
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        tipo_documento: tipoDocumento,
        numero_documento:
          numeroDocumento.trim(),
        correo: correoNormalizado,
        telefono: telefono.trim(),
        rol,
        activo: true,
        debe_cambiar_password: true,
        password_cambiado_at: null,
      });

    if (perfilError) {
      console.error(
        'Error creando perfil:',
        perfilError.message
      );

      // Limpiamos Auth para evitar usuario huérfano
      await supabaseAdmin.auth.admin.deleteUser(
        userId
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible guardar la información del usuario.',
      });
    }

    // =====================================
    // 7. Datos adicionales de estudiante
    // =====================================

    if (rol === 'estudiante') {
      const {
        data: grupo,
        error: grupoError,
      } = await supabaseAdmin
        .from('grupos')
        .select('id, grado_id, activo')
        .eq('id', grupoId)
        .eq('grado_id', gradoId)
        .maybeSingle();

      if (grupoError || !grupo || !grupo.activo) {
        await limpiarUsuarioCreado(userId);

        return res.status(400).json({
          success: false,
          message:
            'El grupo seleccionado no pertenece al grado indicado.',
        });
      }

      const {
        error: estudianteError,
      } = await supabaseAdmin
        .from('estudiantes')
        .insert({
          usuario_id: userId,
          grado_id: gradoId,
          grupo_id: grupoId,
        });

      if (estudianteError) {
        console.error(
          'Error creando estudiante:',
          estudianteError.message
        );

        await limpiarUsuarioCreado(userId);

        return res.status(500).json({
          success: false,
          message:
            'No fue posible registrar la información académica del estudiante.',
        });
      }
    }

    // =====================================
    // 8. Vinculación del acudiente
    // =====================================

    if (rol === 'acudiente') {
      const {
        data: estudiantes,
        error: estudiantesError,
      } = await supabaseAdmin
        .from('usuarios')
        .select('id, rol')
        .in('id', estudiantesVinculados);

      if (
        estudiantesError ||
        !estudiantes ||
        estudiantes.length !==
          estudiantesVinculados.length ||
        estudiantes.some(
          (estudiante) =>
            estudiante.rol !== 'estudiante'
        )
      ) {
        await limpiarUsuarioCreado(userId);

        return res.status(400).json({
          success: false,
          message:
            'Uno o más estudiantes seleccionados no son válidos.',
        });
      }

      const {
        data: ubicacionesEstudiantes,
        error: ubicacionesError,
      } = await supabaseAdmin
        .from('estudiantes')
        .select('usuario_id, grado_id, grupo_id')
        .in('usuario_id', estudiantesVinculados);

      if (ubicacionesError) {
        console.error(
            'Error consultando grupos de estudiantes vinculados:',
            ubicacionesError.message
        );

        await limpiarUsuarioCreado(userId);

        return res.status(500).json({
            success: false,
            message:
              'No fue posible verificar los grupos de los estudiantes seleccionados.',
        });
      }

      if (
        !ubicacionesEstudiantes ||
        ubicacionesEstudiantes.length !==
            estudiantesVinculados.length
      ) {
        await limpiarUsuarioCreado(userId);

        return res.status(400).json({
            success: false,
            message:
              'Uno o más estudiantes no tienen una asignación académica válida.',
        });
      }

      const permisoVinculacion =
        await verificarGruposEnAmbitoCoordinador({
            usuario: req.usuario,
            asignaciones: ubicacionesEstudiantes.map(
              ({ grado_id, grupo_id }) => ({
                gradoId: grado_id,
                grupoId: grupo_id,
              })
            ),
        });

      if (permisoVinculacion.error) {
        console.error(
            'Error verificando el ámbito de los estudiantes vinculados:',
            permisoVinculacion.error.message
        );

        await limpiarUsuarioCreado(userId);

        return res.status(500).json({
            success: false,
            message:
              'No fue posible verificar los estudiantes que puede vincular el coordinador.',
        });
      }

      if (!permisoVinculacion.autorizado) {
        await limpiarUsuarioCreado(userId);

        return res.status(403).json({
            success: false,
            message:
              'El coordinador solo puede vincular acudientes con estudiantes de su propio ámbito.',
        });
      }

      const relaciones =
        estudiantesVinculados.map(
            (estudianteId) => ({
            acudiente_id: userId,
            estudiante_id: estudianteId,
          })
        );

      const {
        error: relacionError,
      } = await supabaseAdmin
        .from('acudiente_estudiante')
        .insert(relaciones);

      if (relacionError) {
        console.error(
          'Error vinculando acudiente:',
          relacionError.message
        );

        await limpiarUsuarioCreado(userId);

        return res.status(500).json({
          success: false,
          message:
            'No fue posible vincular el acudiente con los estudiantes.',
        });
      }
    }

    // =====================================
    // 9. Asignar ámbitos del orientador
    // =====================================

    if (rol === 'orientador') {
      const ambitosParaInsertar =
        ambitosOrientadorNormalizados.map(
          ({ grado_id, grupo_id }) => ({
            orientador_id: userId,
            grado_id,
            grupo_id,
            activo: true,
          })
        );

      const {
        error: ambitosError,
      } = await supabaseAdmin
        .from('orientador_ambito')
        .insert(ambitosParaInsertar);

      if (ambitosError) {
        console.error(
          'Error asignando ámbitos al orientador:',
          ambitosError.message
        );

        await limpiarUsuarioCreado(userId);

        return res.status(500).json({
          success: false,
          message:
            'No fue posible asignar los grados y grupos al orientador.',
        });
      }
    }

    // =====================================
    // 10. Asignar ámbitos del coordinador
    // =====================================

    if (rol === 'coordinador') {
      const ambitosParaInsertar =
        ambitosCoordinadorNormalizados.map(
          ({ grado_id, grupo_id }) => ({
            coordinador_id: userId,
            grado_id,
            grupo_id,
            activo: true,
          })
        );

      const {
        error: ambitosError,
      } = await supabaseAdmin
        .from('coordinador_ambito')
        .insert(ambitosParaInsertar);

      if (ambitosError) {
        console.error(
          'Error asignando ámbitos al coordinador:',
          ambitosError.message
        );

        await limpiarUsuarioCreado(userId);

        return res.status(500).json({
          success: false,
          message:
            'No fue posible asignar los grados y grupos al coordinador.',
        });
      }
    }

    // =====================================
    // 11. Registrar auditoría
    // =====================================

    await registrarAuditoria({
      usuarioId: req.usuario.id,
      correo: req.usuario.correo,
      evento: 'USUARIO_CREADO',
      descripcion:
        `Se registró un usuario con rol ${rol}.`,
      rol: req.usuario.rol,
      direccionIp: req.ip,
      dispositivo:
        req.headers['user-agent'] || null,
      metadata: {
        usuarioCreadoId: userId,
        rolCreado: rol,
        ...(rol === 'coordinador'
          ? {
              ambitosCoordinador:
                ambitosCoordinadorNormalizados.map(
                  ({ grado_id, grupo_id }) => ({
                    gradoId: grado_id,
                    grupoId: grupo_id,
                  })
                ),
            }
          : {}),
      },
    });

    // =====================================
    // 12. Respuesta
    // =====================================

    return res.status(201).json({
      success: true,
      message:
        'Usuario registrado con éxito.',
      activationMessage:
        'El usuario fue creado con una contraseña temporal y deberá cambiarla en su primer inicio de sesión.',
      usuario: {
        id: userId,
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        correo: correoNormalizado,
        rol,
        debeCambiarPassword: true,
      },
    });
  } catch (error) {
    console.error(
      'Error inesperado registrando usuario:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'No fue posible completar el registro del usuario.',
    });
  }
};

/**
 * Elimina información creada parcialmente
 * si falla una etapa posterior del registro.
 */
const limpiarUsuarioCreado = async (
  userId
) => {
  try {
    await supabaseAdmin
      .from('usuarios')
      .delete()
      .eq('id', userId);

    await supabaseAdmin.auth.admin.deleteUser(
      userId
    );
  } catch (error) {
    console.error(
      'Error limpiando usuario incompleto:',
      error
    );
  }
};

const activarCuenta = async (req, res) => {
  try {
    const {
      accessToken,
      password,
    } = req.body;

    if (!accessToken || !password) {
      return res.status(400).json({
        success: false,
        message:
          'Faltan datos para activar la cuenta.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message:
          'La contraseña debe tener al menos 8 caracteres.',
      });
    }

    // Validamos el token recibido desde la invitación
    const {
      data: userData,
      error: userError,
    } = await supabaseAdmin.auth.getUser(
      accessToken
    );

    if (
      userError ||
      !userData?.user
    ) {
      return res.status(401).json({
        success: false,
        message:
          'El enlace de activación no es válido o ha expirado.',
      });
    }

    const userId = userData.user.id;

    // Verificamos que exista perfil AULA-AI
    const {
      data: usuario,
      error: perfilError,
    } = await supabaseAdmin
      .from('usuarios')
      .select(
        'id, correo, rol, activo'
      )
      .eq('id', userId)
      .maybeSingle();

    if (perfilError || !usuario) {
      return res.status(403).json({
        success: false,
        message:
          'No existe un perfil válido para esta cuenta.',
      });
    }

    // Establecemos la contraseña definitiva
    const {
      error: updateError,
    } =
      await supabaseAdmin.auth.admin
        .updateUserById(
          userId,
          {
            password,
            email_confirm: true,
          }
        );

    if (updateError) {
      console.error(
        'Error activando cuenta:',
        updateError.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible establecer la contraseña.',
      });
    }

    await registrarAuditoria({
      usuarioId: userId,
      correo: usuario.correo,
      evento: 'CUENTA_ACTIVADA',
      descripcion:
        'El usuario completó la activación de su cuenta.',
      rol: usuario.rol,
      direccionIp: req.ip,
      dispositivo:
        req.headers['user-agent'] || null,
    });

    return res.status(200).json({
      success: true,
      message:
        'Cuenta activada correctamente. Ya puede iniciar sesión.',
    });
  } catch (error) {
    console.error(
      'Error inesperado activando cuenta:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'No fue posible completar la activación.',
    });
  }
};

const buscarEstudiantes = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message:
          'Ingrese al menos 2 caracteres para buscar.',
      });
    }

    const termino = q.trim();

    let estudianteIdsPermitidos = null;

    if (req.usuario.rol === 'coordinador') {
      const {
        data: ambitos,
        error: ambitosError,
      } = await consultarAmbitosCoordinador({
        coordinadorId: req.usuario.id,
      });

      if (ambitosError) {
        console.error(
          'Error consultando el ámbito del coordinador para buscar estudiantes:',
          ambitosError.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible consultar los estudiantes de su ámbito.',
        });
      }

      const paresAutorizados = new Set(
        (ambitos || []).map(
          ({ grado_id, grupo_id }) =>
            `${grado_id}:${grupo_id}`
        )
      );

      const gruposIds = [
        ...new Set(
          (ambitos || []).map(
            (ambito) => ambito.grupo_id
          )
        ),
      ];

      if (gruposIds.length === 0) {
        return res.status(200).json({
          success: true,
          estudiantes: [],
        });
      }

      const {
        data: estudiantesEnGrupos,
        error: errorEstudiantes,
      } = await supabaseAdmin
        .from('estudiantes')
        .select('usuario_id, grado_id, grupo_id')
        .in('grupo_id', gruposIds);

      if (errorEstudiantes) {
        console.error(
          'Error consultando estudiantes del ámbito del coordinador:',
          errorEstudiantes.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible consultar los estudiantes de su ámbito.',
        });
      }

      estudianteIdsPermitidos = [
        ...new Set(
          (estudiantesEnGrupos || [])
            .filter((estudiante) =>
              paresAutorizados.has(
                `${estudiante.grado_id}:${estudiante.grupo_id}`
              )
            )
            .map((estudiante) => estudiante.usuario_id)
            .filter(Boolean)
        ),
      ];

      if (estudianteIdsPermitidos.length === 0) {
        return res.status(200).json({
          success: true,
          estudiantes: [],
        });
      }
    }

    let consulta = supabaseAdmin
      .from('usuarios')
      .select(`
        id,
        nombres,
        apellidos,
        numero_documento,
        correo
      `)
      .eq('rol', 'estudiante')
      .eq('activo', true)
      .or(
        `nombres.ilike.%${termino}%,apellidos.ilike.%${termino}%,numero_documento.ilike.%${termino}%`
      )
      .limit(20);

    if (estudianteIdsPermitidos) {
      consulta = consulta.in(
        'id',
        estudianteIdsPermitidos
      );
    }

    const {
      data,
      error,
    } = await consulta;

    if (error) {
      console.error(
        'Error buscando estudiantes:',
        error.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible buscar estudiantes.',
      });
    }

    return res.status(200).json({
      success: true,
      estudiantes: data || [],
    });
  } catch (error) {
    console.error(
      'Error inesperado buscando estudiantes:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Ocurrió un error al buscar estudiantes.',
    });
  }
};

module.exports = {
  registrarUsuario,
  activarCuenta,
  buscarEstudiantes,
};