'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const servicePath = path.resolve(
  __dirname,
  '../src/services/academicAttendanceIndicatorsService.js'
);

test('RNF-06.11: los indicadores incluyen todas las páginas de asistencia', async () => {
  const rangos = [];
  const originalLoad = Module._load;
  const originalService = require.cache[servicePath];

  const cargarMock = function(request, parent) {
    if (
      parent?.filename === servicePath &&
      request === '../config/supabase'
    ) {
      return {
        supabaseAdmin: {
          from(tabla) {
            let desde = 0;
            const consulta = {
              select() {
                return this;
              },
              eq() {
                return this;
              },
              order() {
                return this;
              },
              range(inicio, fin) {
                desde = inicio;
                rangos.push([inicio, fin]);
                return this;
              },
              maybeSingle() {
                return Promise.resolve({
                  data: { usuario_id: 'estudiante-prueba' },
                  error: null,
                });
              },
              then(resolve, reject) {
                const todos = Array.from(
                  { length: 501 },
                  (_, indice) => ({
                    id: indice + 1,
                    fecha: `2026-03-${String(
                      Math.min(28, indice + 1)
                    ).padStart(2, '0')}`,
                    estado:
                      indice === 500
                        ? 'ausente'
                        : 'presente',
                  })
                );

                return Promise.resolve({
                  data:
                    tabla === 'asistencias'
                      ? todos.slice(desde, desde + 500)
                      : [],
                  error: null,
                }).then(resolve, reject);
              },
            };

            return consulta;
          },
        },
      };
    }

    return originalLoad.apply(this, arguments);
  };

  try {
    Module._load = cargarMock;
    delete require.cache[servicePath];

    const {
      obtenerIndicadoresAsistencia,
    } = require(servicePath);
    const resultado =
      await obtenerIndicadoresAsistencia({
        estudianteId: 'estudiante-prueba',
      });

    assert.deepEqual(rangos, [
      [0, 499],
      [500, 999],
    ]);
    assert.equal(
      resultado.indicadores.totalRegistros,
      501
    );
    assert.equal(
      resultado.indicadores.totalAusencias,
      1
    );
    assert.equal(
      resultado.indicadores.totalPresentes,
      500
    );
  } finally {
    Module._load = originalLoad;

    if (originalService) {
      require.cache[servicePath] = originalService;
    } else {
      delete require.cache[servicePath];
    }
  }
});
