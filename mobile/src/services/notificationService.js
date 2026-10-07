import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const registrarNotificacionesPush =
  async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(
        'default',
        {
          name: 'AULA-AI',
          importance:
            Notifications.AndroidImportance.HIGH,
        }
      );
    }

    const permisosActuales =
      await Notifications.getPermissionsAsync();

    let estado =
      permisosActuales.status;

    if (
      estado !==
      'granted'
    ) {
      const nuevosPermisos =
        await Notifications.requestPermissionsAsync();

      estado =
        nuevosPermisos.status;
    }

    if (
      estado !==
      'granted'
    ) {
      return null;
    }

    const token =
      await Notifications.getDevicePushTokenAsync();

    return token.data;
  };

export const registrarDispositivoEnBackend =
  async (
    apiUrl,
    accessToken
  ) => {
    try {
      const tokenFcm =
        await registrarNotificacionesPush();

      if (!tokenFcm) {
        return {
          success: false,
          message:
            'No se obtuvo permiso para notificaciones.',
        };
      }

      const response =
        await fetch(
          `${apiUrl}/api/push/registrar-token`,
          {
            method: 'POST',

            headers: {
              Authorization:
                `Bearer ${accessToken}`,

              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              tokenFcm,
              plataforma: 'android',
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
          'No fue posible registrar el dispositivo.'
        );
      }

      return {
        success: true,
        tokenFcm,
        data,
      };
    } catch (error) {
      console.log(
        'Error registrando dispositivo push:',
        error.message
      );

      return {
        success: false,
        message:
          error.message,
      };
    }
  };
