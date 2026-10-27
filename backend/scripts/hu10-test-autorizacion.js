'use strict';

// =====================================================
// AULA-AI | HU-10 | PRUEBA DE AUTORIZACIÓN POR ROL
// =====================================================

const path = require('node:path');

require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
});

const { createClient } = require('@supabase/supabase-js');

async function iniciar() {
  const {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    HU10_TEST_EMAIL,
    HU10_TEST_PASSWORD,
  } = process.env;

  if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY ||
    !HU10_TEST_EMAIL ||
    !HU10_TEST_PASSWORD
  ) {
    throw new Error(
      'Faltan variables de configuración para la prueba HU-10.'
    );
  }

  const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: HU10_TEST_EMAIL,
      password: HU10_TEST_PASSWORD,
    });

  if (error || !data.session?.access_token) {
    throw new Error(
      'No fue posible autenticar la cuenta de prueba.'
    );
  }

  console.log('Autenticación de prueba: correcta.');

  const respuesta = await fetch(
    'http://localhost:3000/api/risk-alerts/orientador/3/seguimientos',
    {
      method: 'GET',
      headers: {
        Authorization:
          `Bearer ${data.session.access_token}`,
      },
    }
  );

  const resultado = await respuesta.json();

  console.log('Código HTTP:', respuesta.status);
  console.log('Respuesta del servidor:');
  console.log(JSON.stringify(resultado, null, 2));

  if (respuesta.status === 403) {
    console.log(
      'PRUEBA APROBADA: el orientador no puede consultar alertas de grupos no asignados.'
    );
  } else {
    console.log(
      'PRUEBA PENDIENTE: revisar el código HTTP y la respuesta.'
    );
    process.exitCode = 1;
  }
}

iniciar().catch((error) => {
  console.error('ERROR:', error.message);
  process.exitCode = 1;
});
