const {
  supabaseAdmin,
} = require('../config/supabase');

/**
 * Registra un evento de auditoría.
 *
 * IMPORTANTE:
 * Nunca debemos guardar:
 * - contraseñas
 * - access tokens
 * - refresh tokens
 * - claves privadas
 */
const registrarAuditoria = async ({
  usuarioId = null,
  correo = null,
  evento,
  descripcion = null,
  rol = null,
  direccionIp = null,
  dispositivo = null,
  metadata = {},
}) => {
  try {
    const {
      error,
    } = await supabaseAdmin
      .from('auditoria')
      .insert({
        usuario_id: usuarioId,
        correo,
        evento,
        descripcion,
        rol,
        direccion_ip: direccionIp,
        dispositivo,
        metadata,
      });

    if (error) {
      console.error(
        'Error registrando auditoría:',
        error.message
      );

      return false;
    }

    return true;
  } catch (error) {
    console.error(
      'Error inesperado en auditoría:',
      error
    );

    return false;
  }
};

module.exports = {
  registrarAuditoria,
};