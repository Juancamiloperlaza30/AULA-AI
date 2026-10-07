const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (
  !supabaseUrl ||
  !supabaseAnonKey ||
  !supabaseServiceRoleKey
) {
  throw new Error(
    'Faltan variables de configuración de Supabase en el archivo .env'
  );
}

/**
 * Cliente utilizado para autenticación.
 * Usa la clave pública ANON.
 *
 * persistSession se desactiva porque estamos en un servidor Node.js,
 * no en el dispositivo del usuario.
 */
const supabaseAuth = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * Cliente exclusivo del BACKEND.
 *
 * La clave SERVICE ROLE nunca debe exponerse
 * en React Native ni almacenarse en GitHub.
 */
const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

module.exports = {
  supabaseAuth,
  supabaseAdmin,
};