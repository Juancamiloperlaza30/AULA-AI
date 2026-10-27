'use strict';

// ======================================================
// AULA-AI | HU-11
// PRUEBA INDEPENDIENTE DE CONEXIÓN OPENAI
// No consulta ni modifica Supabase.
// No utiliza información de estudiantes.
// ======================================================

require('dotenv').config({
  quiet: true,
});

const OpenAI = require('openai');

async function ejecutarPrueba() {
  const apiKey = process.env.OPENAI_API_KEY;
  const modelo =
    process.env.OPENAI_MODEL || 'gpt-4.1-mini';

  console.log('\n===================================');
  console.log(' AULA-AI | DIAGNÓSTICO OPENAI');
  console.log('===================================');

  console.log('Modelo:', modelo);
  console.log('API configurada:', Boolean(apiKey));
  console.log(
    'IA habilitada:',
    process.env.OPENAI_ENABLED === 'true'
  );

  if (!apiKey || !apiKey.trim()) {
    console.error(
      'ERROR: No existe OPENAI_API_KEY.'
    );
    process.exitCode = 1;
    return;
  }

  const cliente = new OpenAI({
    apiKey: apiKey.trim(),
    timeout: 20000,
    maxRetries: 0,
  });

  const inicio = Date.now();

  console.log('\nProbando conexión directa...');

  try {
    const respuesta = await cliente.responses.create({
      model: modelo,

      instructions:
        'Responde únicamente con JSON válido. ' +
        'No incluyas explicaciones adicionales.',

      input:
        'Devuelve un JSON válido con la clave ' +
        '"estado" y el valor "conexion_correcta".',

      max_output_tokens: 100,

      text: {
        format: {
          type: 'json_object',
        },
      },
    });

    const duracion = Date.now() - inicio;

    console.log('\nRESULTADO DE LA API');

    console.log(
      'Tiempo de respuesta:',
      duracion,
      'ms'
    );

    console.log(
      'Estado:',
      respuesta.status
    );

    console.log(
      'Texto recibido:',
      respuesta.output_text || 'VACÍO'
    );

    let contenido = null;

    try {
      contenido = JSON.parse(
        respuesta.output_text || ''
      );
    } catch (_error) {
      console.error(
        'ERROR: La API no devolvió JSON válido.'
      );
      process.exitCode = 1;
      return;
    }

    if (
      respuesta.status === 'completed' &&
      contenido.estado === 'conexion_correcta'
    ) {
      console.log(
        '\nÉXITO: OPENAI RESPONDE CORRECTAMENTE.'
      );
    } else {
      console.log(
        '\nATENCIÓN: La API respondió, ' +
        'pero la validación no fue satisfactoria.'
      );
      process.exitCode = 1;
    }

  } catch (error) {
    const duracion = Date.now() - inicio;

    const mensaje = String(error?.message || '');

    let causa = 'ERROR_DESCONOCIDO';

    if (error?.status === 401) {
      causa = 'API_KEY_INVALIDA';
    } else if (error?.status === 403) {
      causa = 'ACCESO_DENEGADO';
    } else if (error?.status === 429) {
      causa = 'LIMITE_O_CUOTA';
    } else if (error?.status === 400) {
      causa = 'PARAMETROS_INCORRECTOS';
    } else if (
      error?.name === 'APIConnectionTimeoutError' ||
      /timed out|timeout/i.test(mensaje)
    ) {
      causa = 'TIEMPO_DE_ESPERA';
    } else if (
      error?.name === 'APIConnectionError'
    ) {
      causa = 'ERROR_DE_CONEXION';
    }

    console.error('\nERROR DE CONEXIÓN');

    console.error('Causa:', causa);
    console.error('Tipo:', error?.name || 'Desconocido');
    console.error('HTTP:', error?.status ?? 'Sin respuesta');
    console.error('Duración:', duracion, 'ms');

    if (
      error?.status === 400 ||
      error?.status === 404
    ) {
      console.error(
        'Revisa compatibilidad y acceso al modelo.'
      );
    }

    process.exitCode = 1;
  }
}

ejecutarPrueba().catch(() => {
  console.error('Error inesperado en el diagnóstico.');
  process.exitCode = 1;
});
