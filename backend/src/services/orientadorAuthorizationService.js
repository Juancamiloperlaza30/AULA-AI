'use strict';

const {
  supabaseAdmin,
} = require('../config/supabase');

/**
 * Verifica si un orientador activo tiene asignado
 * el grado y grupo de un estudiante.
 *
 * IMPORTANTE:
 * El rol y el estado activo del usuario deben
 * validarse previamente mediante:
 *
 * verificarToken
 * permitirRoles('orientador')
 */
const verificarAccesoOrientadorEstudiante = async ({
  orientadorId,
  estudianteId,
}) => {
  if (!orientadorId || !estudianteId) {
    return {
      autorizado: false,
      motivo: 'PARAMETROS_INVALIDOS',
    };
  }

  // Consultar la ubicación académica del estudiante.
  const {
    data: estudiante,
    error: errorEstudiante,
  } = await supabaseAdmin
    .from('estudiantes')
    .select('usuario_id, grado_id, grupo_id')
    .eq('usuario_id', estudianteId)
    .maybeSingle();

  if (errorEstudiante) {
    throw new Error(
      `Error consultando estudiante: ${errorEstudiante.message}`
    );
  }

  if (!estudiante) {
    return {
      autorizado: false,
      motivo: 'ESTUDIANTE_NO_ENCONTRADO',
    };
  }

  // Comprobar una asignación institucional activa.
  const {
    data: ambito,
    error: errorAmbito,
  } = await supabaseAdmin
    .from('orientador_ambito')
    .select('id')
    .eq('orientador_id', orientadorId)
    .eq('grado_id', estudiante.grado_id)
    .eq('grupo_id', estudiante.grupo_id)
    .eq('activo', true)
    .limit(1);

  if (errorAmbito) {
    throw new Error(
      `Error consultando ámbito del orientador: ${errorAmbito.message}`
    );
  }

  if (!ambito || ambito.length === 0) {
    return {
      autorizado: false,
      motivo: 'FUERA_DE_AMBITO',
    };
  }

  return {
    autorizado: true,
    motivo: 'ACCESO_AUTORIZADO',
  };
};

/**
 * Verifica si un orientador puede consultar
 * o gestionar una alerta académica específica.
 */
const verificarAccesoOrientadorAlerta = async ({
  orientadorId,
  alertaId,
}) => {
  if (!orientadorId || !alertaId) {
    return {
      autorizado: false,
      motivo: 'PARAMETROS_INVALIDOS',
    };
  }

  const {
    data: alerta,
    error: errorAlerta,
  } = await supabaseAdmin
    .from('alertas_academicas')
    .select('id, estudiante_id')
    .eq('id', alertaId)
    .maybeSingle();

  if (errorAlerta) {
    throw new Error(
      `Error consultando alerta: ${errorAlerta.message}`
    );
  }

  if (!alerta) {
    return {
      autorizado: false,
      motivo: 'ALERTA_NO_ENCONTRADA',
    };
  }

  const resultado =
    await verificarAccesoOrientadorEstudiante({
      orientadorId,
      estudianteId: alerta.estudiante_id,
    });

  return {
    ...resultado,
    alertaId: alerta.id,
    estudianteId: alerta.estudiante_id,
  };
};

module.exports = {
  verificarAccesoOrientadorEstudiante,
  verificarAccesoOrientadorAlerta,
};
