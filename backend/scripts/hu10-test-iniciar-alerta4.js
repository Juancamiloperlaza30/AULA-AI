'use strict';

// AULA-AI | HU-10
// Iniciar seguimiento de la alerta técnica #4.

const path = require('path');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
});

const API_URL = (
  process.env.HU10_TEST_API_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY;

async function ejecutar() {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
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
        email: process.env.HU10_TEST_EMAIL,
        password: process.env.HU10_TEST_PASSWORD,
      });

    if (error || !data.session?.access_token) {
      throw new Error(
        'No fue posible autenticar al orientador.'
      );
    }

    const token = data.session.access_token;

    console.log('Autenticación correcta.');

    // Verificar que sea exactamente la alerta técnica.
    const consulta = await fetch(
      `${API_URL}/api/risk-alerts/orientador/4`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const datosConsulta = await consulta.json();

    console.log('====================================');
    console.log('DIAGNÓSTICO DE ALERTA #4');
    console.log('====================================');

    console.log('Código HTTP:', consulta.status);

    console.log(
      'Respuesta completa:',
      JSON.stringify(datosConsulta, null, 2)
    );

    console.log('====================================');

    if (
      consulta.status !== 200 ||
      datosConsulta.alerta?.id !== 4 ||
      datosConsulta.alerta?.estudiante_id !==
        '85fb51da-83cb-4eed-b818-95aa7426d2f6' ||
      datosConsulta.alerta?.titulo !==
        '[PRUEBA HU-10] Validación de cierre manual' ||
      datosConsulta.alerta?.estado !== 'activa'
    ) {
      throw new Error(
        'La alerta #4 no cumple las condiciones de prueba.'
      );
    }

    console.log('Alerta técnica #4 verificada.');

    // Iniciar seguimiento.
    const respuesta = await fetch(
      `${API_URL}/api/risk-alerts/orientador/4/iniciar-seguimiento`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const resultado = await respuesta.json();

    console.log('HTTP:', respuesta.status);
    console.log(
      'Estado:',
      resultado.alerta?.estado
    );
    console.log('Respuesta:', resultado.message);

    if (
      respuesta.status !== 200 ||
      resultado.alerta?.estado !== 'en_seguimiento'
    ) {
      throw new Error(
        'No se pudo iniciar el seguimiento.'
      );
    }

    console.log(
      'PRUEBA EXITOSA: alerta #4 en seguimiento.'
    );
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exitCode = 1;
  }
}

ejecutar();
