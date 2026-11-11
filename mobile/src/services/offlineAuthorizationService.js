import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// =====================================================
// AULA-AI | HU-14
// AUTORIZACION TEMPORAL PARA CONSULTAS OFFLINE
// =====================================================

const CLAVE_AUTORIZACION = 'aula_ai_offline_auth_v1';

const VIGENCIA_MS = 24 * 60 * 60 * 1000;

const esUsuarioValido = (usuario) => {
  return (
    usuario &&
    typeof usuario.id === 'string' &&
    usuario.id.trim().length > 0 &&
    usuario.debeCambiarPassword !== true
  );
};

// No habilitamos esta autorizacion en web porque
// requiere almacenamiento seguro nativo.
const almacenamientoDisponible = () => {
  return Platform.OS === 'android' || Platform.OS === 'ios';
};

export const guardarAutorizacionOffline = async (
  usuario
) => {
  if (
    !almacenamientoDisponible() ||
    !esUsuarioValido(usuario)
  ) {
    return false;
  }

  try {
    const autorizacion = {
      usuarioId: usuario.id.trim(),
      rol: usuario.rol,
      validadoEn: Date.now(),
    };

    await SecureStore.setItemAsync(
      CLAVE_AUTORIZACION,
      JSON.stringify(autorizacion)
    );

    return true;
  } catch (error) {
    console.warn(
      '[HU-14] No fue posible guardar autorizacion offline:',
      error?.message || error
    );

    return false;
  }
};

export const verificarAutorizacionOffline = async (
  usuario
) => {
  if (
    !almacenamientoDisponible() ||
    !esUsuarioValido(usuario)
  ) {
    return false;
  }

  try {
    const contenido = await SecureStore.getItemAsync(
      CLAVE_AUTORIZACION
    );

    if (!contenido) {
      return false;
    }

    const autorizacion = JSON.parse(contenido);

    const validadoEn = Number(
      autorizacion?.validadoEn
    );

    if (
      autorizacion?.usuarioId !== usuario.id.trim() ||
      autorizacion?.rol !== usuario.rol ||
      !Number.isFinite(validadoEn) ||
      validadoEn <= 0
    ) {
      return false;
    }

    const antiguedad = Date.now() - validadoEn;

    return (
      antiguedad >= 0 &&
      antiguedad <= VIGENCIA_MS
    );
  } catch (error) {
    console.warn(
      '[HU-14] No fue posible verificar autorizacion offline:',
      error?.message || error
    );

    return false;
  }
};

export const eliminarAutorizacionOffline = async () => {
  if (!almacenamientoDisponible()) {
    return true;
  }

  try {
    await SecureStore.deleteItemAsync(
      CLAVE_AUTORIZACION
    );

    return true;
  } catch (error) {
    console.warn(
      '[HU-14] No fue posible eliminar autorizacion offline:',
      error?.message || error
    );

    return false;
  }
};
