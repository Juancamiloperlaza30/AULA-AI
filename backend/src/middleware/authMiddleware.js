const {
  supabaseAuth,
  supabaseAdmin,
} = require('../config/supabase');

const {
  registrarAuditoria,
} = require('../services/auditService');

/**
 * Verifica que la petición tenga una sesión válida.
 *
 * El cliente debe enviar:
 * Authorization: Bearer TOKEN
 */
const verificarToken = async (req, res, next) => {
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

    // Supabase verifica que el JWT sea válido
    const {
      data,
      error,
    } = await supabaseAuth.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({
        success: false,
        message: 'La sesión no es válida o ha expirado.',
      });
    }

    // Consultamos el perfil oficial de AULA-AI
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
        message: 'El usuario no tiene un perfil válido.',
      });
    }

    // Una cuenta desactivada tampoco puede usar
    // una sesión que hubiese obtenido anteriormente.
    if (!usuario.activo) {
      return res.status(403).json({
        success: false,
        message: 'La cuenta se encuentra desactivada.',
      });
    }

    // Guardamos el usuario dentro de la petición
    req.usuario = usuario;

    next();
  } catch (error) {
    console.error(
      'Error verificando token:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Ocurrió un error al validar la sesión.',
    });
  }
};

/**
 * Permite definir qué roles pueden utilizar
 * un endpoint determinado.
 *
 * Ejemplo:
 * permitirRoles('administrador', 'coordinador')
 */
const permitirRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado.',
      });
    }

    if (
      !rolesPermitidos.includes(req.usuario.rol)
    ) {
      Promise.resolve()
        .then(() => registrarAuditoria({
          usuarioId: req.usuario.id,
          correo: req.usuario.correo,
          rol: req.usuario.rol,
          evento: 'ACCESO_DENEGADO',
          descripcion: 'Intento de acceso sin permisos.',
          direccionIp: req.ip,
          dispositivo: req.headers['user-agent'] || null,
          metadata: {
            metodo: req.method,
            ruta: req.route?.path || req.path,
          },
        }))
        .catch((error) => {
          console.error(
            'Error registrando acceso denegado:',
            error.message
          );
        });

      return res.status(403).json({
        success: false,
        message:
          'No tiene permisos para acceder a esta funcionalidad.',
      });
    }

    next();
  };
};

module.exports = {
  verificarToken,
  permitirRoles,
};