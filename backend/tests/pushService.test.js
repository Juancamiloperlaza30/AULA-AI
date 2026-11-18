'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const rutaServicio = path.resolve(
  __dirname,
  '../src/services/pushService.js'
);

test('RNF-04.8: limita lotes FCM a 500 y conserva resultados parciales', async () => {
  const llamadas = [];
  const cargarOriginal = Module._load;
  const errorOriginal = console.error;
  const servicioOriginal = require.cache[rutaServicio];

  const cargarMock = function(request, parent) {
    if (
      parent?.filename === rutaServicio &&
      request === '../config/firebase'
    ) {
      return {
        firebaseMessaging: {
          async sendEachForMulticast({ tokens }) {
            llamadas.push(tokens);

            if (llamadas.length === 2) {
              throw new Error('FCM no disponible');
            }

            return {
              responses: tokens.map(() => ({
                success: true,
              })),
            };
          },
        },
      };
    }

    return cargarOriginal.apply(this, arguments);
  };

  try {
    Module._load = cargarMock;
    delete require.cache[rutaServicio];
    const servicio = require(rutaServicio);
    console.error = () => {};

    const tokens = Array.from(
      { length: 501 },
      (_, indice) => `token-${indice}`
    );
    const resultado =
      await servicio.enviarNotificacionesMultiples({
        tokens,
        titulo: 'Nueva actividad',
        mensaje: 'Se publicó una actividad.',
      });

    assert.deepEqual(
      llamadas.map((lote) => lote.length),
      [500, 1]
    );
    assert.equal(resultado.responses.length, 501);
    assert.equal(resultado.successCount, 500);
    assert.equal(resultado.failureCount, 1);
    assert.equal(
      resultado.responses[500].success,
      false
    );
  } finally {
    Module._load = cargarOriginal;
    console.error = errorOriginal;

    if (servicioOriginal) {
      require.cache[rutaServicio] = servicioOriginal;
    } else {
      delete require.cache[rutaServicio];
    }
  }
});
