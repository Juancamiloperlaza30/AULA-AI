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
        activo
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
    const { correo } = req.body;

    if (!correo || !correo.trim()) {
      return res.status(400).json({
        success: false,
        message:
          'El correo es obligatorio.',
      });
    }

    const correoNormalizado =
      correo.trim().toLowerCase();

    const {
      error,
    } =
      await supabaseAuth.auth
        .resetPasswordForEmail(
          correoNormalizado,
          {
            redirectTo: 'aulaai://reset-password',
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
        'id, nombres, apellidos, correo, rol, activo'
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

module.exports = {
  login,
  logout,
  recuperarPassword,
  renovarSesion,
  actualizarPassword,
};