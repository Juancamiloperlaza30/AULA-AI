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
    // 5. Crear cuenta y enviar invitación
    // =====================================

    const {
      data: authData,
      error: authError,
    } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      correoNormalizado,
      {
        data: {
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          rol,
        },

        redirectTo: 'aulaai://activate-account',
      }
    );

    if (authError || !authData?.user) {
      console.error(
        'Error enviando invitación:',
        authError?.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible crear la cuenta o enviar la invitación.',
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
        .select('id, grado_id')
        .eq('id', grupoId)
        .eq('grado_id', gradoId)
        .maybeSingle();

      if (grupoError || !grupo) {
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
    // 9. Registrar auditoría
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
      },
    });

    // =====================================
    // 10. Respuesta
    // =====================================

    return res.status(201).json({
      success: true,
      message:
        'Usuario registrado con éxito.',
      activationMessage:
        'Se envió un enlace de activación al correo institucional registrado.',
      usuario: {
        id: userId,
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        correo: correoNormalizado,
        rol,
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

    const {
      data,
      error,
    } = await supabaseAdmin
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