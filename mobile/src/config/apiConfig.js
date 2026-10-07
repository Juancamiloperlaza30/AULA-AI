const apiUrlConfigurada =
  process.env.EXPO_PUBLIC_API_URL ||
  'http://192.168.1.22:3000';

export const API_URL =
  apiUrlConfigurada.replace(/\/+$/, '');
