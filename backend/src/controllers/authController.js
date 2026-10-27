const {
  supabaseAuth,
  supabaseAdmin,
} = require('../config/supabase');

const {
  registrarAuditoria,
} = require('../services/auditService');

/**
 * Inicio de sesión de AULA-AI.
 *
 * Proceso:
 * 1. Valida correo y contraseña.
 * 2. Autentica contra Supabase Auth.
 * 3. Obtiene el perfil interno desde public.usuarios.
 * 4. Comprueba que la cuenta esté activa.
 * 5. Devuelve usuario, rol y sesión.
 */
const login = async (req, res) => {
  try {
    const { correo, contrasena } = req.body;

    // -----------------------------
    // 1. Validaciones iniciales
    // -----------------------------

    if (!correo || !correo.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El correo es obligatorio.',
      });
    }

    if (!contrasena || !contrasena.trim()) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña es obligatoria.',
      });
    }

    const correoNormalizado =
      correo.trim().toLowerCase();

    // -----------------------------
    // 2. Supabase Authentication
    // -----------------------------

    const {
      data: authData,
      error: authError,
    } = await supabaseAuth.auth.signInWithPassword({
      email: correoNormalizado,
      password: contrasena,
    });

    if (
      authError ||
      !authData?.user ||
      !authData?.session
    ) {
      await registrarAuditoria({
        correo: correoNormalizado,
        evento: 'LOGIN_FALLIDO',
        descripcion:
          'Intento de inicio de sesión con credenciales incorrectas.',
        direccionIp: req.ip,
        dispositivo:
          req.headers['user-agent'] || null,
      });

      console.error(
        'Error Supabase Auth:',
        authError?.message
      );

      return res.status(401).json({
        success: false,
        message: 'Correo o contraseña incorrectos.',
      });
    }

    console.log(
      'Usuario autenticado:',
      authData.user.id
    );

    // -----------------------------
    // 3. Perfil AULA-AI
    // -----------------------------

    const {
      data: usuario,
      error: usuarioError,
    } = await supabaseAdmin
      .from('usuarios')
      .select(`
        id,
        nombres,
        apellidos,
        correo,
        rol,
        activo,
        debe_cambiar_password,
        password_cambiado_at
      `)
      .eq('id', authData.user.id)
      .maybeSingle();

    if (usuarioError) {
      console.error(
        'Error consultando public.usuarios:',
        usuarioError
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible consultar el perfil del usuario.',
      });
    }

    if (!usuario) {
      console.error(
        `No existe perfil para UUID: ${authData.user.id}`
      );

      return res.status(403).json({
        success: false,
        message:
          'El usuario no tiene un perfil válido en AULA-AI.',
      });
    }

    // -----------------------------
    // 4. Estado de cuenta
    // -----------------------------

    if (!usuario.activo) {
      await registrarAuditoria({
        usuarioId: usuario.id,
        correo: usuario.correo,
        evento: 'LOGIN_CUENTA_DESACTIVADA',
        descripcion:
          'Se intentó iniciar sesión con una cuenta desactivada.',
        rol: usuario.rol,
        direccionIp: req.ip,
        dispositivo:
          req.headers['user-agent'] || null,
      });

      return res.status(403).json({
        success: false,
        message:
          'La cuenta se encuentra desactivada.',
      });
    }

    // -----------------------------
    // 5. Login correcto
    // -----------------------------

    await registrarAuditoria({
      usuarioId: usuario.id,
      correo: usuario.correo,
      evento: 'LOGIN_EXITOSO',
      descripcion:
        'El usuario inició sesión correctamente.',
      rol: usuario.rol,
      direccionIp: req.ip,
      dispositivo:
        req.headers['user-agent'] || null,
    });

    return res.status(200).json({
      success: true,
      message: 'Inicio de sesión exitoso.',

      usuario: {
        id: usuario.id,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        correo: usuario.correo,
        rol: usuario.rol,
        debeCambiarPassword:
          usuario.debe_cambiar_password === true,
        passwordCambiadoAt:
          usuario.password_cambiado_at || null,
      },

      session: {
        accessToken:
          authData.session.access_token,
        refreshToken:
          authData.session.refresh_token,
        expiresAt:
          authData.session.expires_at,
      },
    });
  } catch (error) {
    console.error(
      'Error inesperado durante login:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Ocurrió un error interno al iniciar sesión.',
    });
  }
};

const logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'No se proporcionó un token de acceso.',
      });
    }

    const partes = authHeader.split(' ');

    if (
      partes.length !== 2 ||
      partes[0] !== 'Bearer' ||
      !partes[1]
    ) {
      return res.status(401).json({
        success: false,
        message: 'Formato de token inválido.',
      });
    }

    const token = partes[1];

    const { error } =
      await supabaseAdmin.auth.admin.signOut(
        token,
        'local'
      );

    if (error) {
      console.error(
        'Error revocando sesión:',
        error.message
      );
    }

    await registrarAuditoria({
      usuarioId: req.usuario?.id || null,
      correo: req.usuario?.correo || null,
      evento: 'LOGOUT',
      descripcion:
        'El usuario cerró su sesión.',
      rol: req.usuario?.rol || null,
      direccionIp: req.ip,
      dispositivo:
        req.headers['user-agent'] || null,
    });

    return res.status(200).json({
      success: true,
      message: 'Sesión cerrada correctamente.',
    });
  } catch (error) {
    console.error(
      'Error inesperado cerrando sesión:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Ocurrió un error al cerrar la sesión.',
    });
  }
};

const recuperarPassword = async (
  req,
  res
) => {
  try {
    const {
      correo,
      redirectTo,
    } = req.body;

    if (!correo || !correo.trim()) {
      return res.status(400).json({
        success: false,
        message:
          'El correo es obligatorio.',
      });
    }

    const correoNormalizado =
      correo.trim().toLowerCase();

    let urlRedireccion =
      'aulaai://reset-password';

    if (
      typeof redirectTo === 'string' &&
      (
        redirectTo.startsWith(
          'exp://'
        ) ||
        redirectTo ===
          'aulaai://reset-password'
      )
    ) {
      urlRedireccion =
        redirectTo;
    }

    console.log(
      'URL RECUPERACION UTILIZADA:',
      urlRedireccion
    );

    const {
      error,
    } =
      await supabaseAuth.auth
        .resetPasswordForEmail(
          correoNormalizado,
          {
            redirectTo:
              urlRedireccion,
          }
        );

    /*
     * Por seguridad respondemos igual
     * exista o no exista la cuenta.
     */
    if (error) {
      console.error(
        'Error enviando recuperación:',
        error.message
      );

      return res.status(502).json({
        success: false,
        message:
          'No fue posible enviar el correo de recuperación. Intente nuevamente más tarde.',
      });
    }

    return res.status(200).json({
      success: true,
      message:
        'Si el correo está registrado, recibirá instrucciones para restablecer su contraseña.',
    });
  } catch (error) {
    console.error(
      'Error en recuperación:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'No fue posible procesar la solicitud.',
    });
  }
};

/**
 * Renueva una sesión utilizando el refresh token.
 */
const renovarSesion = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionó el token de renovación.',
      });
    }

    const {
      data,
      error,
    } = await supabaseAuth.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (
      error ||
      !data?.session ||
      !data?.user
    ) {
      return res.status(401).json({
        success: false,
        message:
          'La sesión no puede renovarse. Inicie sesión nuevamente.',
      });
    }

    /**
     * También comprobamos que el usuario
     * siga existiendo y continúe activo.
     */
    const {
      data: usuario,
      error: usuarioError,
    } = await supabaseAdmin
      .from('usuarios')
      .select(
        'id, nombres, apellidos, correo, rol, activo, debe_cambiar_password, password_cambiado_at'
      )
      .eq('id', data.user.id)
      .maybeSingle();

    if (usuarioError || !usuario) {
      return res.status(403).json({
        success: false,
        message:
          'El usuario no tiene un perfil válido en AULA-AI.',
      });
    }

    if (!usuario.activo) {
      return res.status(403).json({
        success: false,
        message:
          'La cuenta se encuentra desactivada.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Sesión renovada correctamente.',

      usuario: {
        id: usuario.id,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        correo: usuario.correo,
        rol: usuario.rol,
        activo: usuario.activo,
        debeCambiarPassword:
          usuario.debe_cambiar_password === true,
        passwordCambiadoAt:
          usuario.password_cambiado_at || null,
      },

      session: {
        accessToken:
          data.session.access_token,

        refreshToken:
          data.session.refresh_token,

        expiresAt:
          data.session.expires_at,
      },
    });
  } catch (error) {
    console.error(
      'Error renovando sesión:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Ocurrió un error al renovar la sesión.',
    });
  }
};

const actualizarPassword = async (
  req,
  res
) => {
  try {
    const {
      accessToken,
      nuevaPassword,
    } = req.body;

    if (!accessToken || !nuevaPassword) {
      return res.status(400).json({
        success: false,
        message:
          'Faltan datos para actualizar la contraseña.',
      });
    }

    if (nuevaPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message:
          'La contraseña debe tener al menos 8 caracteres.',
      });
    }

    const {
      data: userData,
      error: userError,
    } =
      await supabaseAuth.auth.getUser(
        accessToken
      );

    if (
      userError ||
      !userData?.user
    ) {
      return res.status(401).json({
        success: false,
        message:
          'El enlace de recuperación no es válido o ha expirado.',
      });
    }

    const {
      error,
    } = await supabaseAdmin.auth.admin
      .updateUserById(
        userData.user.id,
        {
          password: nuevaPassword,
        }
      );

    if (error) {
      console.error(
        'Error actualizando contraseña:',
        error.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible actualizar la contraseña.',
      });
    }

    await registrarAuditoria({
      usuarioId: userData.user.id,
      correo: userData.user.email,
      evento:
        'PASSWORD_RESTABLECIDA',
      descripcion:
        'El usuario restableció su contraseña.',
      direccionIp: req.ip,
      dispositivo:
        req.headers['user-agent'] || null,
    });

    return res.status(200).json({
      success: true,
      message:
        'Contraseña actualizada correctamente.',
    });
  } catch (error) {
    console.error(
      'Error restableciendo contraseña:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Ocurrió un error al actualizar la contraseña.',
    });
  }
};

const cambiarPasswordInicial =
  async (req, res) => {
    try {
      const usuarioId =
        req.usuario.id;

      const {
        nuevaContrasena,
        confirmarContrasena,
      } = req.body;

      // =====================================
      // 1. Validar campos
      // =====================================

      if (
        !nuevaContrasena ||
        !nuevaContrasena.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            'La nueva contraseña es obligatoria.',
        });
      }

      if (
        !confirmarContrasena ||
        !confirmarContrasena.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Debe confirmar la nueva contraseña.',
        });
      }

      if (
        nuevaContrasena !==
        confirmarContrasena
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Las contraseñas no coinciden.',
        });
      }

      // =====================================
      // 2. Validar seguridad
      // =====================================

      if (
        nuevaContrasena.length < 8
      ) {
        return res.status(400).json({
          success: false,
          message:
            'La contraseña debe tener mínimo 8 caracteres.',
        });
      }

      const tieneMayuscula =
        /[A-Z]/.test(
          nuevaContrasena
        );

      const tieneMinuscula =
        /[a-z]/.test(
          nuevaContrasena
        );

      const tieneNumero =
        /[0-9]/.test(
          nuevaContrasena
        );

      if (
        !tieneMayuscula ||
        !tieneMinuscula ||
        !tieneNumero
      ) {
        return res.status(400).json({
          success: false,
          message:
            'La contraseña debe incluir al menos una letra mayúscula, una minúscula y un número.',
        });
      }

      // =====================================
      // 3. Consultar usuario
      // =====================================

      const {
        data: usuario,
        error: usuarioError,
      } = await supabaseAdmin
        .from('usuarios')
        .select(`
          id,
          correo,
          rol,
          numero_documento,
          debe_cambiar_password
        `)
        .eq(
          'id',
          usuarioId
        )
        .maybeSingle();

      if (
        usuarioError ||
        !usuario
      ) {
        console.error(
          'Error consultando usuario:',
          usuarioError?.message
        );

        return res.status(404).json({
          success: false,
          message:
            'No fue posible encontrar el usuario.',
        });
      }

      // =====================================
      // 4. Verificar cambio obligatorio
      // =====================================

      if (
        usuario.debe_cambiar_password !==
        true
      ) {
        return res.status(409).json({
          success: false,
          message:
            'El usuario no tiene un cambio obligatorio de contraseña pendiente.',
        });
      }

      // =====================================
      // 5. No permitir usar el documento
      // =====================================

      if (
        nuevaContrasena ===
        usuario.numero_documento
      ) {
        return res.status(400).json({
          success: false,
          message:
            'La nueva contraseña no puede ser igual al número de documento.',
        });
      }

      // =====================================
      // 6. Actualizar contraseña en Auth
      // =====================================

      const {
        error: authError,
      } =
        await supabaseAdmin
          .auth
          .admin
          .updateUserById(
            usuarioId,
            {
              password:
                nuevaContrasena,
            }
          );

      if (authError) {
        console.error(
          'Error actualizando contraseña en Auth:',
          authError.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible actualizar la contraseña.',
        });
      }

      // =====================================
      // 7. Actualizar estado del perfil
      // =====================================

      const fechaCambio =
        new Date().toISOString();

      const {
        error: perfilError,
      } = await supabaseAdmin
        .from('usuarios')
        .update({
          debe_cambiar_password:
            false,
          password_cambiado_at:
            fechaCambio,
        })
        .eq(
          'id',
          usuarioId
        );

      if (perfilError) {
        console.error(
          'Error actualizando estado de contraseña:',
          perfilError.message
        );

        return res.status(500).json({
          success: false,
          message:
            'La contraseña fue actualizada, pero no fue posible finalizar el proceso. Intente iniciar sesión nuevamente.',
        });
      }

      // =====================================
      // 8. Auditoría
      // =====================================

      await registrarAuditoria({
        usuarioId:
          usuario.id,
        correo:
          usuario.correo,
        evento:
          'PASSWORD_INICIAL_CAMBIADA',
        descripcion:
          'El usuario cambió correctamente su contraseña temporal.',
        rol:
          usuario.rol,
        direccionIp:
          req.ip,
        dispositivo:
          req.headers[
            'user-agent'
          ] || null,
      });

      // =====================================
      // 9. Respuesta
      // =====================================

      return res
        .status(200)
        .json({
          success: true,
          message:
            'Contraseña actualizada correctamente.',
          usuario: {
            debeCambiarPassword:
              false,
            passwordCambiadoAt:
              fechaCambio,
          },
        });
    } catch (error) {
      console.error(
        'Error inesperado cambiando contraseña inicial:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Ocurrió un error al cambiar la contraseña.',
      });
    }
  };

const confirmarRecuperacionPassword =
  async (req, res) => {
    try {
      const usuarioId =
        req.usuario.id;

      const {
        data: usuario,
        error: usuarioError,
      } = await supabaseAdmin
        .from('usuarios')
        .select(`
          id,
          correo,
          rol
        `)
        .eq(
          'id',
          usuarioId
        )
        .maybeSingle();

      if (
        usuarioError ||
        !usuario
      ) {
        console.error(
          'Error consultando usuario:',
          usuarioError?.message
        );

        return res.status(404).json({
          success: false,
          message:
            'No fue posible encontrar el usuario.',
        });
      }

      const fechaCambio =
        new Date().toISOString();

      const {
        error: updateError,
      } = await supabaseAdmin
        .from('usuarios')
        .update({
          debe_cambiar_password:
            false,
          password_cambiado_at:
            fechaCambio,
        })
        .eq(
          'id',
          usuarioId
        );

      if (updateError) {
        console.error(
          'Error actualizando recuperación:',
          updateError.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible finalizar la recuperación de contraseña.',
        });
      }

      await registrarAuditoria({
        usuarioId:
          usuario.id,
        correo:
          usuario.correo,
        evento:
          'PASSWORD_RECUPERADA',
        descripcion:
          'El usuario restableció su contraseña mediante recuperación por correo.',
        rol:
          usuario.rol,
        direccionIp:
          req.ip,
        dispositivo:
          req.headers[
            'user-agent'
          ] || null,
      });

      return res.status(200).json({
        success: true,
        message:
          'Recuperación de contraseña finalizada correctamente.',
        passwordCambiadoAt:
          fechaCambio,
      });
    } catch (error) {
      console.error(
        'Error confirmando recuperación:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Ocurrió un error al finalizar la recuperación.',
      });
    }
  };

module.exports = {
  login,
  logout,
  recuperarPassword,
  renovarSesion,
  actualizarPassword,
  cambiarPasswordInicial,
  confirmarRecuperacionPassword,
};