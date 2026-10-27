'use strict';

// ================================================
// AULA-AI | HU-11
// Prueba independiente de conexión con Gemini
// ================================================

require('dotenv').config();

const { GoogleGenAI } = require('@google/genai');

async function probarGemini() {
  console.log('\n===================================');
  console.log(' AULA-AI | DIAGNÓSTICO GEMINI');
  console.log('===================================');

  const apiKey = process.env.GEMINI_API_KEY;
  const modelo =
    process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

  if (!apiKey || !apiKey.trim()) {
    console.error('ERROR: GEMINI_API_KEY no está configurada.');
    process.exitCode = 1;
    return;
  }

  console.log('Modelo:', modelo);
  console.log('API configurada: Sí');
  console.log(
    'Gemini habilitado:',
    process.env.GEMINI_ENABLED === 'true'
  );

  const cliente = new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      timeout: 20000,
    },
  });

  const inicio = Date.now();

  try {
    console.log('\nEnviando solicitud de prueba...');

    const respuesta = await cliente.models.generateContent({
      model: modelo,
      contents:
        'Responde únicamente con la palabra: CONEXION_EXITOSA',
      config: {
        maxOutputTokens: 100,
        temperature: 0,
      },
    });

    const duracion = Date.now() - inicio;
    const texto = (respuesta.text || '').trim();

    console.log('\nRESULTADO');
    console.log('Tiempo:', duracion, 'ms');
    console.log('Respuesta:', texto || '(vacía)');

    if (texto === 'CONEXION_EXITOSA') {
      console.log('\n✅ GEMINI FUNCIONA CORRECTAMENTE');
    } else {
      console.log(
        '\n⚠️ Gemini respondió, pero no devolvió el texto esperado.'
      );
      process.exitCode = 1;
    }
  } catch (error) {
    const duracion = Date.now() - inicio;

    console.error('\n❌ ERROR AL CONECTAR CON GEMINI');
    console.error('Tiempo:', duracion, 'ms');
    console.error('Estado HTTP:', error.status || 'No disponible');
    console.error('Mensaje:', error.message || 'Error desconocido');

    process.exitCode = 1;
  }
}

probarGemini().catch((error) => {
  console.error('Error inesperado:', error.message);
  process.exitCode = 1;
});
