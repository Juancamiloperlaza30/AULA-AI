'use strict';

const {
  recuperarPasswordSeguro,
} = require('../services/passwordRecoveryService');

const completarRecuperacionPassword = async (req, res) => {
  try {
    const {
      correo,
      codigo,
      nuevaContrasena,
      confirmarContrasena,
    } = req.body || {};

    const resultado = await recuperarPasswordSeguro({
      correo,
      codigo,
      nuevaContrasena,
      confirmarContrasena,
    });

    return res.status(200).json({
      success: true,
      message: 'La contraseña fue restablecida correctamente.',
      usuario: {
        rol: resultado.rol,
        passwordCambiadoAt: resultado.passwordCambiadoAt,
      },
    });

  } catch (error) {
    const codigosPermitidos = new Set([
      'INVALID_PASSWORD',
      'INVALID_RECOVERY_DATA',
      'RECOVERY_UNAVAILABLE',
      'INVALID_RECOVERY_CODE',
      'INVALID_INSTITUTIONAL_ACCOUNT',
      'DOCUMENT_PASSWORD_NOT_ALLOWED',
      'PASSWORD_UPDATE_FAILED',
      'PROFILE_UPDATE_FAILED',
    ]);

    const codigo = codigosPermitidos.has(error?.code)
      ? error.code
      : 'RECOVERY_INTERNAL_ERROR';

    const status = Number.isInteger(error?.status) &&
      error.status >= 400 &&
      error.status <= 599 &&
      codigosPermitidos.has(error?.code)
        ? error.status
        : 500;

    if (codigo === 'RECOVERY_INTERNAL_ERROR') {
      console.error(
        'Error interno completando recuperacion:',
        error?.message
      );
    }

    return res.status(status).json({
      success: false,
      code: codigo,
      message: codigo === 'RECOVERY_INTERNAL_ERROR'
        ? 'No fue posible completar la recuperación.'
        : error.message,
    });
  }
};

module.exports = {
  completarRecuperacionPassword,
};