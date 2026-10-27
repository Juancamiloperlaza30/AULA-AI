'use strict';

// =====================================================
// AULA-AI | HU-11
// PRUEBA DE PRIVACIDAD ENTRE ESTUDIANTES
// =====================================================

const path = require('node:path');

require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
});

const { createClient } = require('@supabase/supabase-js');

const API_URL = 'http://localhost:3000';

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

  console.log('\nHU-11 | PRUEBA DE PRIVACIDAD\n');

  // =====================================================
  // 1. AUTENTICAR ESTUDIANTE
  // =====================================================

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: HU11_TEST_ESTUDIANTE_EMAIL,
      password: HU11_TEST_ESTUDIANTE_PASSWORD,
    });

  if (error || !data.session?.access_token) {
    throw new Error(
      'No fue posible autenticar al estudiante.'
    );
  }

  console.log('Autenticación: correcta.');

  const token = data.session.access_token;
  const estudianteAutenticadoId = data.user.id;

  // =====================================================
  // 2. CONSULTAR PLANES PROPIOS
  // =====================================================

  const respuestaPropia = await fetch(
    `${API_URL}/api/planes-acompanamiento/estudiante/${estudianteAutenticadoId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  console.log(
    '\nConsulta de planes propios:',
    respuestaPropia.status
  );

  // =====================================================
  // 3. INTENTAR CONSULTAR PLANES AJENOS
  // =====================================================

  // UUID distinto al estudiante autenticado.
  // No necesita corresponder a un estudiante real
  // para comprobar el rechazo por identidad.
  const otroEstudianteId =
    '00000000-0000-0000-0000-000000000001';

  if (otroEstudianteId === estudianteAutenticadoId) {
    throw new Error(
      'El identificador de prueba debe ser diferente.'
    );
  }

  const respuestaAjena = await fetch(
    `${API_URL}/api/planes-acompanamiento/estudiante/${otroEstudianteId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  console.log(
    'Consulta de planes ajenos:',
    respuestaAjena.status
  );

  // =====================================================
  // 4. EVALUAR RESULTADOS
  // =====================================================

  if (
    respuestaPropia.status === 200 &&
    respuestaAjena.status === 403
  ) {
    console.log(
      '\nPRUEBA APROBADA: el estudiante consulta sus planes y no puede acceder a los de otro estudiante.'
    );
  } else {
    console.log(
      '\nPRUEBA NO SUPERADA: revisar los permisos de consulta.'
    );

    process.exitCode = 1;
  }
}

iniciar().catch((error) => {
  console.error('\nERROR:', error.message);
  process.exitCode = 1;
});
