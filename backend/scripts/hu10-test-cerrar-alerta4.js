'use strict';

// ======================================================
// AULA-AI | HU-10
// PRUEBA DE CIERRE MANUAL DE ALERTA TÉCNICA #4
// ======================================================

const path = require('path');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
});

const API_URL = (
  process.env.HU10_TEST_API_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

const SUPABASE_URL = process.env.SUPABASE_URL;

const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY;

const TEST_EMAIL = process.env.HU10_TEST_EMAIL;
const TEST_PASSWORD = process.env.HU10_TEST_PASSWORD;

const ALERTA_PRUEBA_ID = 4;
const ALERTA_REAL_ID = 3;

const ESTUDIANTE_ID =
  '85fb51da-83cb-4eed-b818-95aa7426d2f6';

const MOTIVO =
  'Cierre de prueba técnica HU-10. Se verificó el flujo ' +
  'de seguimiento y cierre manual. Este registro no ' +
  'representa un riesgo académico real.';

async function consultarAlerta(token, alertaId) {
  const respuesta = await fetch(
    `${API_URL}/api/risk-alerts/orientador/${alertaId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const datos = await respuesta.json();

  if (respuesta.status !== 200) {
    throw new Error(
      `No fue posible consultar la alerta ${alertaId}. ` +
      `HTTP ${respuesta.status}`
    );
  }

  return datos.alerta;
}

async function ejecutar() {
  try {
    console.log('====================================');
    console.log('AULA-AI | HU-10');
    console.log('CIERRE MANUAL DE ALERTA #4');
    console.log('====================================');

    if (
      !SUPABASE_URL ||
      !SUPABASE_KEY ||
      !TEST_EMAIL ||
      !TEST_PASSWORD
    ) {
      throw new Error(
        'Faltan variables de entorno para la prueba.'
      );
    }

    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

    if (error || !data.session?.access_token) {
      throw new Error(
        'No fue posible autenticar al orientador.'
      );
    }

    const token = data.session.access_token;
    const orientadorId = data.user.id;

    console.log('Autenticación correcta.');

    // 1. Verificar la alerta real #3.
    const alertaRealAntes = await consultarAlerta(
      token,
      ALERTA_REAL_ID
    );

    if (alertaRealAntes.estado !== 'en_seguimiento') {
      throw new Error(
        'La alerta real #3 no está en seguimiento.'
      );
    }

    // 2. Verificar la alerta técnica #4.
    const alertaPrueba = await consultarAlerta(
      token,
      ALERTA_PRUEBA_ID
    );

    if (
      alertaPrueba.id !== ALERTA_PRUEBA_ID ||
      alertaPrueba.estudiante_id !== ESTUDIANTE_ID ||
      alertaPrueba.titulo !==
        '[PRUEBA HU-10] Validación de cierre manual' ||
      alertaPrueba.estado !== 'en_seguimiento'
    ) {
      throw new Error(
        'La alerta #4 no cumple las condiciones de prueba.'
      );
    }

    console.log('Alerta técnica #4 verificada.');
    console.log('Estado inicial:', alertaPrueba.estado);

    // 3. Solicitar cierre manual.
    const respuesta = await fetch(
      `${API_URL}/api/risk-alerts/orientador/${ALERTA_PRUEBA_ID}/cerrar`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          motivo: MOTIVO,
        }),
      }
    );

    const resultado = await respuesta.json();

    console.log('HTTP cierre:', respuesta.status);
    console.log(
      'Respuesta:',
      JSON.stringify(resultado, null, 2)
    );

    if (
      respuesta.status !== 200 ||
      resultado.alerta?.id !== ALERTA_PRUEBA_ID ||
      resultado.alerta?.estado !== 'resuelta' ||
      resultado.alerta?.cierre_manual_por !== orientadorId ||
      resultado.alerta?.motivo_cierre !== MOTIVO ||
      !resultado.alerta?.cierre_manual_at
    ) {
      throw new Error(
        'El cierre manual no devolvió los datos esperados.'
      );
    }

    // 4. Comprobar que la alerta real sigue intacta.
    const alertaRealDespues = await consultarAlerta(
      token,
      ALERTA_REAL_ID
    );

    if (
      alertaRealDespues.estado !==
        alertaRealAntes.estado
    ) {
      throw new Error(
        'La alerta real #3 cambió de estado.'
      );
    }

    console.log('====================================');
    console.log('PRUEBA EXITOSA');
    console.log('Alerta #4 cerrada correctamente.');
    console.log('Alerta #3 permanece en seguimiento.');
    console.log('====================================');
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exitCode = 1;
  }
}

ejecutar();
