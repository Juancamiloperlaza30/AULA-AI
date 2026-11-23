// ============================================================
// AULA-AI
// HU-12 - NOTIFICACIONES DE COMUNICADOS INSTITUCIONALES
// ============================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  registrarNotificaciones,
} = require('./notificacionRegistroService');

const TAMANO_CONSULTA = 100;

// ============================================================
// CONSULTAR TOKENS DE DESTINATARIOS
// ============================================================

async function consultarTokensDestinatarios(
  destinatarios
) {
  const usuariosIds = [
    ...new Set(
      destinatarios.filter(Boolean)
    ),
  ];

  if (usuariosIds.length === 0) {
    return [];
  }

  const tokens = [];

  for (
    let inicio = 0;
    inicio < usuariosIds.length;
    inicio += TAMANO_CONSULTA
  ) {
    const lote = usuariosIds.slice(
      inicio,
      inicio + TAMANO_CONSULTA
    );

    let desde = 0;

    while (true) {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from('dispositivos_push')
        .select('id, token_fcm')
        .in('usuario_id', lote)
        .eq('activo', true)
        .order('id', {
          ascending: true,
        })
        .range(
          desde,
          desde + 499
        );

      if (error) {
        throw error;
      }

      const pagina = data || [];

      for (const dispositivo of pagina) {
        if (dispositivo.token_fcm) {
          tokens.push(
            dispositivo.token_fcm
          );
        }
      }

      if (pagina.length < 500) {
        break;
      }

      desde += 500;
    }
  }

  return [
    ...new Set(tokens),
  ];
}

// ============================================================
// DESACTIVAR TOKENS INVALIDOS
// ============================================================

async function desactivarTokensInvalidos(
  tokensInvalidos
) {
  const tokens = [
    ...new Set(
      (tokensInvalidos || []).filter(Boolean)
    ),
  ];

  if (tokens.length === 0) {
    return 0;
  }

  let totalDesactivados = 0;

  for (
    let inicio = 0;
    inicio < tokens.length;
    inicio += TAMANO_CONSULTA
  ) {
    const lote = tokens.slice(
      inicio,
      inicio + TAMANO_CONSULTA
    );

    const {
      data,
      error,
    } = await supabaseAdmin
      .from('dispositivos_push')
      .update({
        activo: false,
        updated_at: new Date().toISOString(),
      })
      .in('token_fcm', lote)
      .eq('activo', true)
      .select('id');

    if (error) {
      throw error;
    }

    totalDesactivados +=
      (data || []).length;
  }

  return totalDesactivados;
}

// ============================================================
// ENVIAR NOTIFICACIONES DE COMUNICADO
// ============================================================

async function notificarComunicadoPublicado({
  comunicadoId,
  titulo,
  destinatarios = [],
}) {
  if (
    !comunicadoId ||
    !Array.isArray(destinatarios) ||
    destinatarios.length === 0
  ) {
    return {
      comunicadoId,
      destinatarios: Array.isArray(destinatarios)
        ? destinatarios.length
        : 0,
      notificacionesPreparadas: 0,
    };
  }

  const resultado = await registrarNotificaciones({
    destinatarios,
    tipo: 'comunicado',
    titulo: 'Nuevo comunicado institucional',
    mensaje: String(titulo || 'AULA-AI'),
    recursoTipo: 'comunicado',
    recursoId: comunicadoId,
    eventoClave: `comunicado:${comunicadoId}`,
  });

  return {
    comunicadoId,
    destinatarios: resultado.destinatarios,
    notificacionesPreparadas: resultado.registradas,
    encoladas: resultado.registradas,
  };
}

module.exports = {
  consultarTokensDestinatarios,
  desactivarTokensInvalidos,
  notificarComunicadoPublicado,
};
