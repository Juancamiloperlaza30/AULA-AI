'use strict';

require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function probarHistorial() {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_PUBLISHABLE_KEY,
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

    if (error || !data.session) {
      throw new Error(
        error?.message || 'No se pudo iniciar sesión.'
      );
    }

    console.log('Autenticación de Gabriel: correcta.');

    const baseUrl = (
      process.env.HU10_TEST_API_URL ||
      'http://localhost:3000'
    ).replace(/\/+$/, '');

    const respuesta = await fetch(
      `${baseUrl}/api/risk-alerts/orientador/3/seguimientos`,
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
    console.log(
      'Respuesta:',
      JSON.stringify(resultado, null, 2)
    );

    const seguimientoEncontrado =
      Array.isArray(resultado.seguimientos) &&
      resultado.seguimientos.some(
        (s) =>
          s.id === 1 &&
          s.alerta_id === 3 &&
          s.tipo_intervencion === 'observacion'
      );

    if (respuesta.status === 200 && seguimientoEncontrado) {
      console.log(
        'PRUEBA EXITOSA: historial consultado correctamente.'
      );
    } else {
      console.log(
        'PRUEBA NO SUPERADA: revisar la respuesta.'
      );
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exitCode = 1;
  }
}

probarHistorial();
