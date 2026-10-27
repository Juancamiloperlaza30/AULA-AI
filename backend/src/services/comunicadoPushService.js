// ============================================================
// AULA-AI
// HU-12 - NOTIFICACIONES DE COMUNICADOS INSTITUCIONALES
// ============================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  enviarNotificacionesMultiples,
} = require('./pushService');

const TAMANO_CONSULTA = 100;
const TAMANO_LOTE_FCM = 500;

// ============================================================
// ERRORES QUE CONFIRMAN UN TOKEN FCM INVALIDO
// ============================================================

const ERRORES_TOKEN_INVALIDO = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

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
  const resultado = {
    comunicadoId,
    destinatarios: Array.isArray(destinatarios)
      ? destinatarios.length
      : 0,
    dispositivos: 0,
    enviados: 0,
    fallidos: 0,
    tokensDesactivados: 0,
  };

  try {
    if (
      !comunicadoId ||
      !Array.isArray(destinatarios) ||
      destinatarios.length === 0
    ) {
      console.warn(
        '[HU-12 PUSH] Datos insuficientes.'
      );

      return resultado;
    }

    const tokens =
      await consultarTokensDestinatarios(
        destinatarios
      );

    resultado.dispositivos = tokens.length;

    console.log(
      '[HU-12 PUSH] Preparando envio:',
      {
        comunicadoId,
        destinatarios:
          destinatarios.length,
        dispositivos: tokens.length,
      }
    );

    if (tokens.length === 0) {
      console.warn(
        '[HU-12 PUSH] No hay dispositivos activos.'
      );

      return resultado;
    }

    for (
      let inicio = 0;
      inicio < tokens.length;
      inicio += TAMANO_LOTE_FCM
    ) {
      const lote = tokens.slice(
        inicio,
        inicio + TAMANO_LOTE_FCM
      );

      try {
        const respuesta =
          await enviarNotificacionesMultiples({
            tokens: lote,

            titulo:
              'Nuevo comunicado institucional',

            mensaje:
              String(titulo || 'AULA-AI'),

            data: {
              tipo: 'comunicado_publicado',
              comunicadoId:
                String(comunicadoId),
            },
          });

        resultado.enviados +=
          respuesta?.successCount ?? 0;

        resultado.fallidos +=
          respuesta?.failureCount ?? 0;

        const tokensInvalidos = [];

        (respuesta?.responses || [])
          .forEach((respuestaToken, indice) => {
            if (respuestaToken.success) {
              return;
            }

            const codigo = String(
              respuestaToken.error?.code ||
              'desconocido'
            ).toLowerCase();

            console.error(
              '[HU-12 PUSH] Error FCM:',
              {
                indice: inicio + indice,
                codigo,
                mensaje:
                  respuestaToken.error?.message ||
                  'Sin detalle',
              }
            );

            if (
              ERRORES_TOKEN_INVALIDO.has(
                codigo
              ) &&
              lote[indice]
            ) {
              tokensInvalidos.push(
                lote[indice]
              );
            }
          });

        if (tokensInvalidos.length > 0) {
          try {
            const desactivados =
              await desactivarTokensInvalidos(
                tokensInvalidos
              );

            resultado.tokensDesactivados +=
              desactivados;

            console.log(
              '[HU-12 PUSH] Tokens invalidos desactivados:',
              {
                comunicadoId,
                cantidad: desactivados,
              }
            );
          } catch (errorDesactivacion) {
            console.error(
              '[HU-12 PUSH] Error desactivando tokens invalidos:',
              errorDesactivacion.message
            );
          }
        }
      } catch (errorLote) {
        resultado.fallidos += lote.length;

        console.error(
          '[HU-12 PUSH] Error enviando lote:',
          errorLote
        );
      }
    }

    console.log(
      '[HU-12 PUSH] Resultado final:',
      resultado
    );

    return resultado;
  } catch (error) {
    console.error(
      '[HU-12 PUSH] Error general:',
      error
    );

    return {
      ...resultado,
      error: true,
    };
  }
}

module.exports = {
  consultarTokensDestinatarios,
  desactivarTokensInvalidos,
  notificarComunicadoPublicado,
};
