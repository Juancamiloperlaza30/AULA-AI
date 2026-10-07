import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'aula_ai_session';

/**
 * Guarda la sesión del usuario de forma segura.
 */
export const guardarSesion = async (sesion) => {
  try {
    await SecureStore.setItemAsync(
      SESSION_KEY,
      JSON.stringify(sesion)
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
    const sessionString =
      await SecureStore.getItemAsync(SESSION_KEY);

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
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return true;
  } catch (error) {
    console.log('Error eliminando sesión:', error);
    return false;
  }
};