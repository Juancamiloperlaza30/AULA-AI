import 'react-native-url-polyfill/auto';

import AsyncStorage
  from '@react-native-async-storage/async-storage';

import {
  createClient,
} from '@supabase/supabase-js';

const supabaseUrlConfigurada =
  process.env.EXPO_PUBLIC_SUPABASE_URL;

const supabaseUrl =
  supabaseUrlConfigurada?.replace(
    /\/rest\/v1\/?$/,
    ''
  );

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigurado =
  Boolean(
    supabaseUrl &&
    supabaseAnonKey
  );

if (!supabaseConfigurado) {
  console.warn(
    'Supabase móvil no está configurado. Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

export const supabase =
  supabaseConfigurado
    ? createClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          auth: {
            storage:
              AsyncStorage,

            autoRefreshToken:
              true,

            persistSession:
              true,

            detectSessionInUrl:
              false,
          },
        }
      )
    : null;
