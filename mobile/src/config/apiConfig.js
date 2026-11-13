
import Constants from 'expo-constants';

// En desarrollo permitimos la API local.
// En producción exigimos una URL HTTPS configurada.
const esDesarrollo = __DEV__;

const hostUri = Constants.expoConfig?.hostUri;

let hostDesarrollo = null;

if (esDesarrollo && hostUri) {
  try {
    hostDesarrollo = new URL(
      `http://${hostUri}`
    ).hostname;
  } catch {
    hostDesarrollo = null;
  }
}

const apiUrlConfigurada =
  process.env.EXPO_PUBLIC_API_URL?.trim();

const apiUrlLocal = hostDesarrollo
  ? `http://${hostDesarrollo}:3000`
  : 'http://localhost:3000';

function obtenerApiUrl() {
  const url = (
    apiUrlConfigurada ||
    (esDesarrollo ? apiUrlLocal : '')
  ).replace(/\/+$/, '');

  if (!url) {
    throw new Error(
      'RNF-01.4: Debe configurar EXPO_PUBLIC_API_URL ' +
      'con una direccion HTTPS para produccion.'
    );
  }

  let direccion;

  try {
    direccion = new URL(url);
  } catch {
    throw new Error(
      'RNF-01.4: La URL del backend no es valida.'
    );
  }

  if (!['http:', 'https:'].includes(direccion.protocol)) {
    throw new Error(
      'RNF-01.4: Protocolo de API no permitido.'
    );
  }

  if (direccion.username || direccion.password) {
    throw new Error(
      'RNF-01.4: La URL no debe contener credenciales.'
    );
  }

  if (!esDesarrollo) {
    if (direccion.protocol !== 'https:') {
      throw new Error(
        'RNF-01.4: HTTPS es obligatorio en produccion.'
      );
    }

    const hostname = direccion.hostname.toLowerCase();

    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.endsWith('.localhost')
    ) {
      throw new Error(
        'RNF-01.4: No se permite localhost en produccion.'
      );
    }
  }

  return url;
}

export const API_URL = obtenerApiUrl();
