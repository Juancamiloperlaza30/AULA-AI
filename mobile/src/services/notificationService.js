import {
  Platform,
} from 'react-native';

import Constants
  from 'expo-constants';

const esExpoGo =
  Constants.appOwnership === 'expo';

let moduloNotifications =
  null;

const obtenerNotifications =
  async () => {
    // Expo Go no soporta push remotas
    // con las versiones actuales de Expo.
    if (esExpoGo) {
      console.log(
        'Push remotas desactivadas en Expo Go.'
      );

      return null;
    }

    if (!moduloNotifications) {
      moduloNotifications =
        await import(
          'expo-notifications'
        );

      moduloNotifications
        .setNotificationHandler({
          handleNotification:
            async () => ({
              shouldShowBanner: true,
              shouldShowList: true,
              shouldPlaySound: true,
              shouldSetBadge: false,
            }),
        });
    }

    return moduloNotifications;
  };

export const registrarNotificacionesPush =
  async () => {
    try {
      const Notifications =
        await obtenerNotifications();

      if (!Notifications) {
        return null;
      }

      if (
        Platform.OS === 'android'
      ) {
        await Notifications
          .setNotificationChannelAsync(
            'default',
            {
              name: 'AULA-AI',
              importance:
                Notifications
                  .AndroidImportance
                  .HIGH,
            }
          );
      }

      const permisosActuales =
        await Notifications
          .getPermissionsAsync();

      let estado =
        permisosActuales.status;

      if (
        estado !== 'granted'
      ) {
        const nuevosPermisos =
          await Notifications
            .requestPermissionsAsync();

        estado =
          nuevosPermisos.status;
      }

      if (
        estado !== 'granted'
      ) {
        return null;
      }

      const token =
        await Notifications
          .getDevicePushTokenAsync();

      return token?.data || null;
    } catch (error) {
      console.log(
        'Error obteniendo token push:',
        error?.message || error
      );

      return null;
    }
  };

export const registrarDispositivoEnBackend =
  async (
    apiUrl,
    accessToken
  ) => {
    try {
      if (esExpoGo) {
        console.log(
          'Registro push omitido en Expo Go.'
        );

        return {
          success: true,
          skipped: true,
          message:
            'Push remoto desactivado durante pruebas con Expo Go.',
        };
      }

      const tokenFcm =
        await registrarNotificacionesPush();

      console.log(
        '[AULA-AI PUSH] Token FCM obtenido:',
        tokenFcm ? 'SI' : 'NO'
      );

      if (!tokenFcm) {
        return {
          success: false,
          message:
            'No fue posible obtener el token de notificaciones.',
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
              plataforma:
                Platform.OS,
            }),
          }
        );

      const data =
        await response.json();

      const respuestaSegura = {
        ...data,
        ...(data.dispositivo
          ? {
            dispositivo: {
              ...data.dispositivo,
              token_fcm: data.dispositivo.token_fcm
                ? '[REDACTADO]'
                : data.dispositivo.token_fcm,
            },
          }
          : {}),
      };

      console.log(
        '[AULA-AI PUSH] Respuesta del backend:',
        response.status,
        respuestaSegura
      );

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
        error?.message || error
      );

      return {
        success: false,
        message:
          error?.message ||
          'No fue posible registrar el dispositivo push.',
      };
    }
  };
