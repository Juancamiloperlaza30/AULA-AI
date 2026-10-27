'use strict';

// ======================================================
// AULA-AI | HU-10
// PRUEBA DE REGISTRO DE SEGUIMIENTO
// ======================================================

const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
});

const {
  createClient,
} = require('@supabase/supabase-js');

async function ejecutarPrueba() {
  const email = process.env.HU10_TEST_EMAIL;
  const password = process.env.HU10_TEST_PASSWORD;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;

  const apiUrl = (
    process.env.HU10_TEST_API_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');

  if (
    !email ||
    !password ||
    !supabaseUrl ||
    !supabaseAnonKey
  ) {
    console.error(
      'Faltan variables de entorno para ejecutar la prueba.'
    );
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  // 1. Autenticación del orientador.

  const {
    data,
    error,
  } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session?.access_token) {
    console.error(
      'No fue posible autenticar al orientador:',
      error?.message || 'Sin sesión.'
    );
    process.exitCode = 1;
    return;
  }

  console.log('Autenticación: correcta.');

  // 2. Registrar una observación sobre la alerta #3.

  const respuesta = await fetch(
    `${apiUrl}/api/risk-alerts/orientador/3/seguimientos`,
    {
      method: 'POST',
      headers: {
        Authorization:
          `Bearer ${data.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tipo_intervencion: 'observacion',
        observacion:
          'Seguimiento de prueba HU-10: se identifica ' +
          'riesgo académico en Matemáticas. ' +
          'Se recomienda revisar el desempeño del estudiante.',
        proxima_revision: null,
      }),
    }
  );

  const texto = await respuesta.text();

  let resultado;

  try {
    resultado = JSON.parse(texto);
  } catch {
    resultado = { respuesta: texto };
  }

  console.log('Código HTTP:', respuesta.status);
  console.log(
    'Respuesta del servidor:',
    JSON.stringify(resultado, null, 2)
  );

  if (
    respuesta.status === 201 &&
    resultado.success === true &&
    resultado.seguimiento?.alerta_id === 3
  ) {
    console.log(
      'PRUEBA EXITOSA: seguimiento registrado.'
    );
  } else {
    console.log(
      'PRUEBA NO SUPERADA: revisar la respuesta.'
    );
    process.exitCode = 1;
  }
}

ejecutarPrueba().catch((error) => {
  console.error(
    'Error ejecutando la prueba:',
    error.message
  );

  process.exitCode = 1;
});
