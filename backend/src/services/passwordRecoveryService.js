'use strict';

const { createClient } = require('@supabase/supabase-js');

const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  validarNuevaContrasena,
} = require('../utils/validarNuevaContrasena');

const {
  registrarAuditoria,
} = require('../services/auditService');
const crearError = (status, message, code) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

const recuperarPasswordSeguro = async ({
  correo,
  codigo,
  nuevaContrasena,
  confirmarContrasena,
}) => {
  const validacion = validarNuevaContrasena(
    nuevaContrasena,
    confirmarContrasena
  );

  if (!validacion.valida) {
    throw crearError(
      400,
      validacion.mensaje,
      'INVALID_PASSWORD'
    );
  }

  if (
    typeof correo !== 'string' ||
    !correo.trim() ||
    typeof codigo !== 'string' ||
    !codigo.trim()
  ) {
    throw crearError(
      400,
      'El correo y el codigo de recuperacion son obligatorios.',
      'INVALID_RECOVERY_DATA'
    );
  }

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw crearError(
      503,
      'El servicio de recuperacion no esta disponible.',
      'RECOVERY_UNAVAILABLE'
    );
  }

  const cliente = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const correoNormalizado = correo.trim().toLowerCase();

  const {
    data: verificacion,
    error: errorOtp,
  } = await cliente.auth.verifyOtp({
    email: correoNormalizado,
    token: codigo.trim(),
    type: 'recovery',
  });

  if (
    errorOtp ||
    !verificacion?.user?.id ||
    !verificacion?.session
  ) {
    throw crearError(
      400,
      'El codigo de recuperacion es invalido o ha expirado.',
      'INVALID_RECOVERY_CODE'
    );
  }

  const usuarioId = verificacion.user.id;

  const {
    data: usuario,
    error: errorUsuario,
  } = await supabaseAdmin
    .from('usuarios')
    .select(
      'id, correo, rol, activo, numero_documento'
    )
    .eq('id', usuarioId)
    .maybeSingle();

  if (
    errorUsuario ||
    !usuario ||
    usuario.activo !== true
  ) {
    throw crearError(
      403,
      'No fue posible validar la cuenta institucional.',
      'INVALID_INSTITUTIONAL_ACCOUNT'
    );
  }

  if (
    nuevaContrasena ===
    String(usuario.numero_documento || '').trim()
  ) {
    throw crearError(
      400,
      'La nueva contrasena no puede ser el numero de documento.',
      'DOCUMENT_PASSWORD_NOT_ALLOWED'
    );
  }

  const {
    data: passwordActualizado,
    error: errorPassword,
  } = await cliente.auth.updateUser({
    password: nuevaContrasena,
  });

  if (
    errorPassword ||
    passwordActualizado?.user?.id !== usuarioId
  ) {
    throw crearError(
      502,
      'No fue posible confirmar la actualizacion de la contrasena.',
      'PASSWORD_UPDATE_FAILED'
    );
  }

  const fechaCambio = new Date().toISOString();

  const {
    data: perfilActualizado,
    error: errorPerfil,
  } = await supabaseAdmin
    .from('usuarios')
    .update({
      debe_cambiar_password: false,
      password_cambiado_at: fechaCambio,
    })
    .eq('id', usuarioId)
    .select('id')
    .maybeSingle();

  if (errorPerfil || perfilActualizado?.id !== usuarioId) {
    try {
      const auditoriaRegistrada = await registrarAuditoria({
        usuarioId,
        correo: usuario.correo,
        rol: usuario.rol,
        evento: 'PASSWORD_RECOVERY_PARTIAL_FAILURE',
        descripcion:
          'La contrasena fue actualizada en Auth, pero fallo la actualizacion del perfil institucional.',
        metadata: {
          componente: 'passwordRecoveryService',
          etapa: 'actualizacion_perfil',
        },
      });

      if (auditoriaRegistrada !== true) {
        console.error(
          'No fue posible registrar el fallo parcial de recuperacion.',
          {
            usuarioId,
            codigo: 'RECOVERY_AUDIT_FAILED',
          }
        );
      }
    } catch (errorAuditoria) {
      console.error(
        'No fue posible registrar el fallo parcial de recuperacion.',
        {
          usuarioId,
          codigo: 'RECOVERY_AUDIT_FAILED',
        }
      );
    }

    throw crearError(
      500,
      'La contrasena cambio, pero no fue posible finalizar la actualizacion institucional.',
      'PROFILE_UPDATE_FAILED'
    );
  }

  return {
    usuarioId,
    correo: usuario.correo,
    rol: usuario.rol,
    passwordCambiadoAt: fechaCambio,
  };
};

module.exports = {
  recuperarPasswordSeguro,
};