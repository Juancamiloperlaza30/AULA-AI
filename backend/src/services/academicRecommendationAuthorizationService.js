'use strict';

const {
  verificarAccesoOrientadorEstudiante,
} = require('./orientadorAuthorizationService');

const {
  supabaseAdmin,
} = require('../config/supabase');

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verifica si un usuario autenticado puede consultar
 * las recomendaciones académicas de un estudiante.
 *
 * IMPORTANTE:
 * El objeto usuario debe provenir de req.usuario,
 * establecido previamente por verificarToken.
 */
const verificarAccesoRecomendacionesEstudiante = async ({
  usuario,
  estudianteId,
}) => {
  if (
    !usuario ||
    typeof usuario.id !== 'string' ||
    !UUID_REGEX.test(usuario.id) ||
    typeof usuario.rol !== 'string' ||
    typeof estudianteId !== 'string' ||
    !UUID_REGEX.test(estudianteId)
  ) {
    return {
      autorizado: false,
      motivo: 'PARAMETROS_INVALIDOS',
    };
  }

  // El estudiante solamente consulta su información.
  if (usuario.rol === 'estudiante') {
    return {
      autorizado: usuario.id === estudianteId,
      motivo:
        usuario.id === estudianteId
          ? 'ACCESO_AUTORIZADO'
          : 'ESTUDIANTE_DIFERENTE',
    };
  }

  // El orientador debe tener asignado el grado y grupo.
  if (usuario.rol === 'orientador') {
    return verificarAccesoOrientadorEstudiante({
      orientadorId: usuario.id,
      estudianteId,
    });
  }

  // El acudiente solo consulta estudiantes con
  // una vinculacion activa y verificada.
  if (usuario.rol === 'acudiente') {
    const { data: vinculacion, error } =
      await supabaseAdmin
        .from('acudiente_estudiante')
        .select('id')
        .eq('acudiente_id', usuario.id)
        .eq('estudiante_id', estudianteId)
        .eq('activo', true)
        .eq('verificado', true)
        .maybeSingle();

    if (error) {
      throw new Error(
        'No fue posible verificar la vinculacion del acudiente.'
      );
    }

    return {
      autorizado: Boolean(vinculacion),
      motivo: vinculacion
        ? 'ACCESO_AUTORIZADO'
        : 'VINCULACION_NO_AUTORIZADA',
    };
  }

  // El coordinador puede realizar consultas
  // para supervisión académica institucional.
  if (usuario.rol === 'coordinador') {
    const { data: estudiante, error } =
      await supabaseAdmin
        .from('estudiantes')
        .select('usuario_id')
        .eq('usuario_id', estudianteId)
        .maybeSingle();

    if (error) {
      throw new Error(
        'No fue posible verificar el estudiante.'
      );
    }

    return {
      autorizado: Boolean(estudiante),
      motivo: estudiante
        ? 'ACCESO_AUTORIZADO'
        : 'ESTUDIANTE_NO_ENCONTRADO',
    };
  }

  // Los demás roles no tienen acceso general.
  return {
    autorizado: false,
    motivo: 'ROL_NO_AUTORIZADO',
  };
};

module.exports = {
  verificarAccesoRecomendacionesEstudiante,
};
