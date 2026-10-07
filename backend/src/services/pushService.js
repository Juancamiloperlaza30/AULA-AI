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

    return await firebaseMessaging
      .sendEachForMulticast(
        payload
      );
  };

module.exports = {
  enviarNotificacionPush,
  enviarNotificacionesMultiples,
};
