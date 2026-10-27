'use strict';

// ======================================================
// AULA-AI | HU-10
// PRUEBAS DE VALIDACIÓN DEL CIERRE MANUAL
// No realiza cierres exitosos.
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

async function obtenerToken() {
  if (
    !SUPABASE_URL ||
    !SUPABASE_KEY ||
    !TEST_EMAIL ||
    !TEST_PASSWORD
  ) {
    throw new Error(
      'Faltan variables de entorno para la prueba HU-10.'
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
      'No fue posible iniciar sesión con el orientador.'
    );
  }

  return data.session.access_token;
}

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

  return {
    status: respuesta.status,
    datos,
  };
}

async function intentarCierre(token, alertaId, motivo) {
  const respuesta = await fetch(
    `${API_URL}/api/risk-alerts/orientador/${alertaId}/cerrar`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ motivo }),
    }
  );

  const datos = await respuesta.json();

  return {
    status: respuesta.status,
    datos,
  };
}

async function ejecutar() {
  try {
    console.log('======================================');
    console.log('AULA-AI | HU-10');
    console.log('VALIDACIONES DEL CIERRE MANUAL');
    console.log('======================================');

    const token = await obtenerToken();

    // Confirmar que la alerta #3 es accesible.
    const antes = await consultarAlerta(token, 3);

    if (antes.status !== 200) {
      throw new Error(
        'No fue posible consultar la alerta #3.'
      );
    }

    const alertaInicial = antes.datos.alerta;

    if (
      !alertaInicial ||
      alertaInicial.estado !== 'en_seguimiento'
    ) {
      throw new Error(
        'La alerta #3 no está en seguimiento. ' +
        'Se cancela la prueba.'
      );
    }

    console.log('\nPRUEBA 1: motivo vacío');

    const prueba1 = await intentarCierre(
      token,
      3,
      ''
    );

    console.log('HTTP:', prueba1.status);
    console.log('Respuesta:', prueba1.datos.message);

    console.log('\nPRUEBA 2: motivo demasiado corto');

    const prueba2 = await intentarCierre(
      token,
      3,
      'Listo'
    );

    console.log('HTTP:', prueba2.status);
    console.log('Respuesta:', prueba2.datos.message);

    console.log('\nPRUEBA 3: alerta no autorizada');

    // La alerta #2 corresponde a un grupo
    // fuera del ámbito asignado a Gabriel.
    const prueba3 = await intentarCierre(
      token,
      2,
      'Se solicita el cierre de esta alerta académica.'
    );

    console.log('HTTP:', prueba3.status);
    console.log('Respuesta:', prueba3.datos.message);

    // Comprobar que la alerta #3 no cambió.
    const despues = await consultarAlerta(token, 3);

    if (despues.status !== 200) {
      throw new Error(
        'No fue posible verificar el estado final.'
      );
    }

    const alertaFinal = despues.datos.alerta;

    const validacionesCorrectas =
      prueba1.status === 400 &&
      prueba2.status === 400 &&
      prueba3.status === 404 &&
      alertaFinal?.estado === 'en_seguimiento' &&
      alertaFinal?.cierre_manual_at == null;

    console.log('\n======================================');
    console.log(
      'Estado final de alerta #3:',
      alertaFinal?.estado
    );

    if (!validacionesCorrectas) {
      console.error(
        'PRUEBA NO SUPERADA: revisar los resultados.'
      );
      process.exitCode = 1;
      return;
    }

    console.log('PRUEBA EXITOSA');
    console.log('Las validaciones funcionan correctamente.');
    console.log('La alerta #3 permanece en seguimiento.');
    console.log('======================================');
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exitCode = 1;
  }
}

ejecutar();
