'use strict';

require('dotenv').config({ quiet: true });

const OpenAI = require('openai');

const verificarConfiguracion = () => {
  const clave = process.env.OPENAI_API_KEY;

  if (!clave) {
    throw new Error(
      'OPENAI_API_KEY no está configurada.'
    );
  }

  const modelo = process.env.OPENAI_MODEL;

  if (!modelo) {
    throw new Error(
      'OPENAI_MODEL no está configurado.'
    );
  }

  return {
    modelo,
    tiempoMaximo: 4000,
  };
};

const ejecutarPrueba = async () => {
  const configuracion = verificarConfiguracion();

  console.log('================================');
  console.log('AULA-AI - PRUEBA OPENAI HU-11');
  console.log('================================');

  console.log(
    'Modelo configurado:',
    configuracion.modelo
  );

  console.log(
    'Tiempo máximo:',
    configuracion.tiempoMaximo,
    'ms'
  );

  console.log(
    'Modo:',
    'VERIFICACIÓN LOCAL'
  );

  const cliente = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: configuracion.tiempoMaximo,
    maxRetries: 0,
  });

  if (!cliente.responses) {
    throw new Error(
      'La Responses API no está disponible.'
    );
  }

  console.log(
    'Responses API:',
    'DISPONIBLE'
  );

  console.log(
    'Solicitud a OpenAI:',
    'NO REALIZADA'
  );

  console.log(
    'Resultado:',
    'CONFIGURACIÓN LOCAL CORRECTA'
  );
};

ejecutarPrueba().catch((error) => {
  console.error(
    'ERROR HU-11:',
    error.message
  );

  process.exitCode = 1;
});
