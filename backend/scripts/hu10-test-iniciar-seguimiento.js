'use strict';

// ======================================================
// AULA-AI | HU-10
// PRUEBA DE INICIO FORMAL DE SEGUIMIENTO
// ======================================================

const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
});

const { createClient } = require('@supabase/supabase-js');

const ALERTA_ID = 3;

async function ejecutarPrueba() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY;

    const email = process.env.HU10_TEST_EMAIL;
    const password = process.env.HU10_TEST_PASSWORD;

    const apiUrl = (
      process.env.HU10_TEST_API_URL ||
      'http://localhost:3000'
    ).replace(/\/+$/, '');

    if (!supabaseUrl || !supabaseKey || !email || !password) {
      throw new Error(
        'Faltan variables de entorno para ejecutar la prueba.'
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 1. Autenticar al orientador Gabriel.
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error || !data.session?.access_token) {
      throw new Error(
        error?.message || 'No fue posible iniciar sesión.'
      );
    }

    const token = data.session.access_token;

    console.log('Autenticación del orientador: correcta.');

    const urlAlerta =
      `${apiUrl}/api/risk-alerts/orientador/${ALERTA_ID}`;

    // 2. Consultar el estado anterior.
    const antesRespuesta = await fetch(urlAlerta, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const antes = await antesRespuesta.json();

    console.log(
      'Estado anterior:',
      antes.alerta?.estado || 'No disponible'
    );

    if (
      antesRespuesta.status !== 200 ||
      !antes.alerta
    ) {
      throw new Error(
        'No fue posible consultar la alerta antes de actualizarla.'
      );
    }

    // Evitar repetir una operación que ya se completó.
    if (antes.alerta.estado === 'en_seguimiento') {
      console.log(
        'La alerta ya está en seguimiento. No se realizará otro cambio.'
      );
      return;
    }

    if (antes.alerta.estado !== 'activa') {
      throw new Error(
        'La alerta no está activa. Se cancela la prueba.'
      );
    }

    // 3. Iniciar formalmente el seguimiento.
    const respuesta = await fetch(
      `${urlAlerta}/iniciar-seguimiento`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const resultado = await respuesta.json();

    console.log('Código HTTP:', respuesta.status);
    console.log(
      'Respuesta del servidor:',
      JSON.stringify(resultado, null, 2)
    );

    if (
      respuesta.status !== 200 ||
      resultado.alerta?.estado !== 'en_seguimiento'
    ) {
      throw new Error(
        'No se pudo iniciar el seguimiento académico.'
      );
    }

    // 4. Verificar el estado posterior.
    const despuesRespuesta = await fetch(urlAlerta, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const despues = await despuesRespuesta.json();

    console.log(
      'Estado posterior:',
      despues.alerta?.estado || 'No disponible'
    );

    if (
      despuesRespuesta.status === 200 &&
      despues.alerta?.estado === 'en_seguimiento'
    ) {
      console.log(
        'PRUEBA EXITOSA: seguimiento iniciado correctamente.'
      );
    } else {
      throw new Error(
        'El estado posterior no coincide con el esperado.'
      );
    }
  } catch (error) {
    console.error('PRUEBA NO SUPERADA:', error.message);
    process.exitCode = 1;
  }
}

ejecutarPrueba();
