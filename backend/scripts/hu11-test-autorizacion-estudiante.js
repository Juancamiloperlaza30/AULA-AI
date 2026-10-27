'use strict';

// =====================================================
// AULA-AI | HU-11
// PRUEBA DE AUTORIZACIÓN DEL ROL ESTUDIANTE
// =====================================================

const path = require('node:path');

require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
});

const { createClient } = require('@supabase/supabase-js');

// =====================================================
// CONFIGURACIÓN
// =====================================================

const API_URL = 'http://localhost:3000';

const ESTUDIANTE_ID_FICTICIO =
  '00000000-0000-0000-0000-000000000001';

const PLAN_ID_FICTICIO = 999999999;

// =====================================================
// PRUEBA
// =====================================================

async function iniciar() {
  const {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    HU11_TEST_ESTUDIANTE_EMAIL,
    HU11_TEST_ESTUDIANTE_PASSWORD,
  } = process.env;

  if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY ||
    !HU11_TEST_ESTUDIANTE_EMAIL ||
    !HU11_TEST_ESTUDIANTE_PASSWORD
  ) {
    throw new Error(
      'Faltan variables de configuración para HU-11.'
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

  // =====================================================
  // 1. AUTENTICAR ESTUDIANTE
  // =====================================================

  console.log(
    '\nHU-11 | PRUEBA DE SEGURIDAD POR ROL\n'
  );

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: HU11_TEST_ESTUDIANTE_EMAIL,
      password: HU11_TEST_ESTUDIANTE_PASSWORD,
    });

  if (error || !data.session?.access_token) {
    throw new Error(
      'No fue posible autenticar la cuenta de estudiante.'
    );
  }

  console.log('Autenticación: correcta.');

  const token = data.session.access_token;

  // =====================================================
  // 2. INTENTAR MODIFICAR UN PLAN
  // =====================================================

  const url =
    `${API_URL}/api/planes-acompanamiento/estudiante/` +
    `${ESTUDIANTE_ID_FICTICIO}/${PLAN_ID_FICTICIO}`;

  console.log(
    '\nIntentando modificar un plan desde el rol Estudiante...'
  );

  const respuesta = await fetch(url, {
    method: 'PATCH',

    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },

    body: JSON.stringify({
      objetivo:
        'PRUEBA DE SEGURIDAD HU-11',
    }),
  });

  let resultado;

  try {
    resultado = await respuesta.json();
  } catch {
    resultado = {
      message: 'El servidor no devolvió JSON.',
    };
  }

  // =====================================================
  // 3. MOSTRAR RESULTADOS
  // =====================================================

  console.log('\nCódigo HTTP:', respuesta.status);

  console.log('Respuesta del servidor:');

  console.log(
    JSON.stringify(resultado, null, 2)
  );

  // =====================================================
  // 4. VALIDAR SEGURIDAD
  // =====================================================

  if (respuesta.status === 403) {
    console.log(
      '\nPRUEBA APROBADA: el estudiante no puede modificar planes.'
    );
  } else {
    console.log(
      '\nPRUEBA NO SUPERADA: revisar autorización.'
    );

    process.exitCode = 1;
  }
}

// =====================================================
// EJECUCIÓN
// =====================================================

iniciar().catch((error) => {
  console.error(
    '\nERROR:',
    error.message
  );

  process.exitCode = 1;
});
