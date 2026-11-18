const enviarNotificacionPush =
  async ({
    tokenFcm,
    titulo,
    mensaje,
    data = {},
  }) => {
    const payload = {
      token: tokenFcm,

      notification: {
        title: titulo,
        body: mensaje,
      },

      data: Object.fromEntries(
        Object.entries(data).map(
          ([key, value]) => [
            key,
            String(value),
          ]
        )
      ),

      android: {
        priority: 'high',

        notification: {
          channelId: 'default',
        },
      },
    };

    const {
      firebaseMessaging,
    } = require('../config/firebase');

    const respuesta =
      await firebaseMessaging.send(
        payload
      );

    return respuesta;
  };

const enviarNotificacionesMultiples =
  async ({
    tokens = [],
    titulo,
    mensaje,
    data = {},
  }) => {
    const tokensValidos =
      [
        ...new Set(
          tokens.filter(Boolean)
        ),
      ];

    if (
      tokensValidos.length === 0
    ) {
      return {
        successCount: 0,
        failureCount: 0,
      };
    }

    const payload = {
      tokens: tokensValidos,

      notification: {
        title: titulo,
        body: mensaje,
      },

      data: Object.fromEntries(
        Object.entries(data).map(
          ([key, value]) => [
            key,
            String(value),
          ]
        )
      ),

      android: {
        priority: 'high',

        notification: {
          channelId: 'default',
        },
      },
    };

    const {
      firebaseMessaging,
    } = require('../config/firebase');

    const respuestas = [];
    const TAMANO_MAXIMO_FCM = 500;

    for (
      let inicio = 0;
      inicio < tokensValidos.length;
      inicio += TAMANO_MAXIMO_FCM
    ) {
      const lote = tokensValidos.slice(
        inicio,
        inicio + TAMANO_MAXIMO_FCM
      );
      try {
        const respuesta =
          await firebaseMessaging.sendEachForMulticast({
            ...payload,
            tokens: lote,
          });

        respuestas.push(
          ...(respuesta.responses || [])
        );
      } catch (error) {
        console.error(
          'Error enviando lote de notificaciones push:',
          error.message
        );
        respuestas.push(
          ...lote.map(() => ({
            success: false,
          }))
        );
      }
    }

    const successCount = respuestas.filter(
      (respuesta) => respuesta.success
    ).length;

    return {
      responses: respuestas,
      successCount,
      failureCount:
        respuestas.length - successCount,
    };
  };

module.exports = {
  enviarNotificacionPush,
  enviarNotificacionesMultiples,
};
