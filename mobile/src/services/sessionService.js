import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'aula_ai_session';

/**
 * Guarda la sesión del usuario.
 *
 * Android/iOS: utiliza SecureStore.
 * Web: utiliza sessionStorage.
 *
 * En web, la sesión se conserva durante la sesión
 * de la pestaña, pero no es almacenamiento cifrado.
 */
export const guardarSesion = async (sesion) => {
  try {
    const sessionString = JSON.stringify(sesion);

    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') {
        return false;
      }

      window.sessionStorage.setItem(
        SESSION_KEY,
        sessionString
      );

      return true;
    }

    await SecureStore.setItemAsync(
      SESSION_KEY,
      sessionString
    );

    return true;
  } catch (error) {
    console.log('Error guardando sesión:', error);
    return false;
  }
};

/**
 * Recupera la sesión guardada.
 */
export const obtenerSesion = async () => {
  try {
    let sessionString = null;

    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') {
        return null;
      }

      sessionString = window.sessionStorage.getItem(
        SESSION_KEY
      );
    } else {
      sessionString = await SecureStore.getItemAsync(
        SESSION_KEY
      );
    }

    if (!sessionString) {
      return null;
    }

    return JSON.parse(sessionString);
  } catch (error) {
    console.log('Error recuperando sesión:', error);
    return null;
  }
};

/**
 * Elimina la sesión almacenada.
 */
export const eliminarSesion = async () => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') {
        return false;
      }

      window.sessionStorage.removeItem(SESSION_KEY);
      return true;
    }

    await SecureStore.deleteItemAsync(SESSION_KEY);
    return true;
  } catch (error) {
    console.log('Error eliminando sesión:', error);
    return false;
  }
};
