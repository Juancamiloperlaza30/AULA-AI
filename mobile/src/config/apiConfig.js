import Constants from 'expo-constants';

const hostUri = Constants.expoConfig?.hostUri;
const hostDesarrollo = hostUri
  ? new URL(`http://${hostUri}`).hostname
  : null;

const apiUrlConfigurada =
  process.env.EXPO_PUBLIC_API_URL?.trim();

const apiUrlPorDefecto = hostDesarrollo
  ? `http://${hostDesarrollo}:3000`
  : 'http://localhost:3000';

export const API_URL =
  (apiUrlConfigurada || apiUrlPorDefecto)
    .replace(/\/+$/, '');
