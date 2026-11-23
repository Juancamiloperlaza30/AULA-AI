'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const servicePath = path.resolve(
  __dirname,
  '../src/services/gradeAlertQueueService.js'
);

const ESTUDIANTE_ID =
  '00000000-0000-4000-8000-000000000002';

const ejecutarEscenario = async (alertaExitosa) => {
  const actualizaciones = [];
  const trabajo = {
    id: 5,
    actividad_id: 8,
    estudiante_id: ESTUDIANTE_ID,
    estado: 'pendiente',
    intentos: 0,
    bloqueado_at: null,
  };
  const cargarOriginal = Module._load;

  const cargarMock = function(request, parent) {
    if (
      parent?.filename === servicePath &&
      request === '../config/supabase'
    ) {
      return {
        supabaseAdmin: {
          from(tabla) {
            let valoresActualizacion = null;
            const filtros = [];

            const consulta = {
              select() {
                return this;
              },
              update(valores) {
                valoresActualizacion = valores;
                return this;
              },
              eq(campo, valor) {
                filtros.push({ campo, valor });
                return this;
              },
              in(campo, valores) {
                filtros.push({ campo, valores });
                return this;
              },
              lte(campo, valor) {
                filtros.push({ campo, valor });
                return this;
              },
              lt(campo, valor) {
                filtros.push({ campo, valor });
                return this;
              },
              order() {
                return this;
              },
              range() {
                return this;
              },
              maybeSingle() {
                if (
                  tabla === 'calificacion_alertas_pendientes' &&
                  valoresActualizacion?.estado === 'procesando'
                ) {
                  actualizaciones.push({
                    valores: valoresActualizacion,
                    filtros,
                  });

                  return Promise.resolve({
                    data: {
                      ...trabajo,
                      ...valoresActualizacion,
                      estado: 'procesando',
                    },
                    error: null,
                  });
                }

                return Promise.resolve({
                  data: null,
                  error: null,
                });
              },
              then(resolve, reject) {
                if (valoresActualizacion) {
                  actualizaciones.push({
                    valores: valoresActualizacion,
                    filtros,
                  });
                  return Promise.resolve({
                    error: null,
                  }).then(resolve, reject);
                }

                return Promise.resolve({
                  data:
                    tabla === 'calificacion_alertas_pendientes'
                      ? [trabajo]
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

    if (
      parent?.filename === servicePath &&
      request === './gradeAlertIntegrationService'
    ) {
      return {
        procesarAlertasDeActividad: async () => ({
          resultados: [{
            success: alertaExitosa,
            estudianteId: ESTUDIANTE_ID,
          }],
        }),
      };
    }

    return cargarOriginal.apply(this, arguments);
  };

  const serviceOriginal = require.cache[servicePath];

  try {
    Module._load = cargarMock;
    delete require.cache[servicePath];
    const servicio = require(servicePath);
    const resultado =
      await servicio.procesarAlertasEncoladas({
        actividadId: 8,
        estudiantesIds: [ESTUDIANTE_ID],
      });

    return {
      resultado,
      actualizaciones,
    };
  } finally {
    Module._load = cargarOriginal;

    if (serviceOriginal) {
      require.cache[servicePath] = serviceOriginal;
    } else {
      delete require.cache[servicePath];
    }
  }
};

test('RNF-05.11: completa el trabajo de alerta procesado correctamente', async () => {
  const { resultado, actualizaciones } =
    await ejecutarEscenario(true);

  assert.deepEqual(resultado, {
    procesados: 1,
    fallidos: 0,
  });
  assert.deepEqual(
    actualizaciones.map((item) => item.valores.estado),
    ['procesando', 'procesada']
  );
});

test('RNF-05.11: reintenta una alerta fallida sin ocultar el error', async () => {
  const { resultado, actualizaciones } =
    await ejecutarEscenario(false);

  assert.deepEqual(resultado, {
    procesados: 0,
    fallidos: 1,
  });
  assert.equal(actualizaciones.length, 2);
  assert.equal(
    actualizaciones[1].valores.estado,
    'pendiente'
  );
  assert.equal(
    actualizaciones[1].valores.intentos,
    1
  );
});
