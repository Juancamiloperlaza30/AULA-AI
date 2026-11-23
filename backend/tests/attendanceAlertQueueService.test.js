'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const servicePath = path.resolve(
  __dirname,
  '../src/services/attendanceAlertQueueService.js'
);

const ejecutarEscenario = async (alertaExitosa) => {
  const actualizaciones = [];
  const evaluaciones = [];
  const trabajo = {
    id: 7,
    asistencia_id: 14,
    estado: 'pendiente',
    intentos: 0,
    bloqueado_at: null,
  };
  const originalLoad = Module._load;

  const cargarMock = function(request, parent) {
    if (
      parent?.filename === servicePath &&
      request === '../config/supabase'
    ) {
      return {
        supabaseAdmin: {
          from(tabla) {
            let valoresActualizacion = null;
            const filtros = {};

            const consulta = {
              select() {
                return this;
              },
              update(valores) {
                valoresActualizacion = valores;
                return this;
              },
              eq(campo, valor) {
                filtros[campo] = valor;
                return this;
              },
              lte(campo, valor) {
                filtros[campo] = valor;
                return this;
              },
              lt(campo, valor) {
                filtros[campo] = valor;
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
                  tabla === 'asistencia_alertas_pendientes' &&
                  valoresActualizacion?.estado === 'procesando'
                ) {
                  actualizaciones.push(
                    valoresActualizacion
                  );
                  return Promise.resolve({
                    data: {
                      ...trabajo,
                      ...valoresActualizacion,
                      estado: 'procesando',
                    },
                    error: null,
                  });
                }

                if (tabla === 'asistencias') {
                  return Promise.resolve({
                    data: {
                      id: 14,
                      estudiante_id:
                        '00000000-0000-4000-8000-000000000002',
                      estado: 'ausente',
                      fecha: '2026-03-10',
                      materia_grupo_periodo: {
                        periodo_id: 3,
                        materia: {
                          nombre: 'Ciencias',
                        },
                      },
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
                  actualizaciones.push(
                    valoresActualizacion
                  );
                  return Promise.resolve({
                    error: null,
                  }).then(resolve, reject);
                }

                return Promise.resolve({
                  data:
                    tabla === 'asistencia_alertas_pendientes' &&
                    filtros.estado === 'pendiente'
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
      request === './academicAlertService'
    ) {
      return {
        evaluarRegistroAsistencia: async (datos) => {
          evaluaciones.push(datos);
          if (!alertaExitosa) {
            throw new Error('Fallo temporal simulado.');
          }
          return { accion: 'alerta_actualizada' };
        },
      };
    }

    return originalLoad.apply(this, arguments);
  };

  const originalService = require.cache[servicePath];

  try {
    Module._load = cargarMock;
    delete require.cache[servicePath];
    const servicio = require(servicePath);
    const resultado =
      await servicio.ejecutarColaAlertasAsistencia();

    return {
      resultado,
      actualizaciones,
      evaluaciones,
    };
  } finally {
    Module._load = originalLoad;

    if (originalService) {
      require.cache[servicePath] = originalService;
    } else {
      delete require.cache[servicePath];
    }
  }
};

test('RNF-06.11: procesa alertas con los datos académicos vigentes', async () => {
  const {
    resultado,
    actualizaciones,
    evaluaciones,
  } = await ejecutarEscenario(true);

  assert.deepEqual(resultado, {
    procesados: 1,
    fallidos: 0,
  });
  assert.deepEqual(
    actualizaciones.map((item) => item.estado),
    ['procesando', 'procesada']
  );
  assert.deepEqual(evaluaciones[0], {
    estudianteId:
      '00000000-0000-4000-8000-000000000002',
    asistenciaId: 14,
    materiaNombre: 'Ciencias',
    estado: 'ausente',
    fecha: '2026-03-10',
    periodoId: 3,
  });
});

test('RNF-06.11: reintenta los errores de evaluación', async () => {
  const { resultado, actualizaciones } =
    await ejecutarEscenario(false);

  assert.deepEqual(resultado, {
    procesados: 0,
    fallidos: 1,
  });
  assert.equal(actualizaciones.length, 2);
  assert.equal(actualizaciones[1].estado, 'pendiente');
  assert.equal(actualizaciones[1].intentos, 1);
});
