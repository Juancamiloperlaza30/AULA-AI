'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const controllerPath = path.resolve(
  __dirname,
  '../src/controllers/studentAttendanceController.js'
);
const supabasePath = require.resolve(
  '../src/config/supabase'
);

test('RNF-07.1 y 07.5: entrega todo el historial paginado del estudiante autenticado', async () => {
  const originalController = require.cache[controllerPath];
  const originalSupabase = require.cache[supabasePath];
  const originalLoad = Module._load;
  const filtrosAsistencia = [];
  const rangosAsistencia = [];
  const estudianteId =
    '00000000-0000-4000-8000-000000000001';

  const crearSupabase = () => ({
    from(tabla) {
      const filtros = {};
      let inicio = 0;
      let fin = 0;

      const consulta = {
        select() {
          return this;
        },
        eq(campo, valor) {
          filtros[campo] = valor;
          return this;
        },
        in(campo, valores) {
          filtros[campo] = valores;
          return this;
        },
        order() {
          return this;
        },
        range(desde, hasta) {
          inicio = desde;
          fin = hasta;
          if (tabla === 'asistencias') {
            rangosAsistencia.push([desde, hasta]);
            filtrosAsistencia.push({ ...filtros });
          }
          return this;
        },
        maybeSingle() {
          return Promise.resolve({
            data: {
              usuario_id: estudianteId,
              grado_id: 2,
              grupo_id: 3,
            },
            error: null,
          });
        },
        then(resolve, reject) {
          let filas = [];

          if (tabla === 'materia_grupo_periodo') {
            filas = [{
              id: 8,
              periodo_id: 4,
              materia: { id: 5, nombre: 'Ciencias' },
            }];
          } else if (tabla === 'asistencias') {
            filas = Array.from(
              { length: 501 },
              (_, indice) => ({
                id: indice + 1,
                estado:
                  indice === 500
                    ? 'ausente'
                    : 'presente',
                observacion: null,
                sesion_clase_id: indice + 1,
                materia_grupo_periodo_id: 8,
              })
            );
          } else if (tabla === 'sesiones_clase') {
            filas = Array.from(
              { length: 501 },
              (_, indice) => ({
                id: indice + 1,
                materia_grupo_periodo_id: 8,
                fecha: '2026-03-10',
                numero_sesion: indice + 1,
              })
            );

            if (Array.isArray(filtros.id)) {
              const ids = new Set(
                filtros.id.map(Number)
              );

              filas = filas.filter((sesion) =>
                ids.has(sesion.id)
              );
            }
          }

          return Promise.resolve({
            data: filas.slice(inicio, fin + 1),
            error: null,
          }).then(resolve, reject);
        },
      };

      return consulta;
    },
  });

  const cargarMock = function(request, parent) {
    if (
      parent?.filename === controllerPath &&
      request === '../config/supabase'
    ) {
      return {
        supabaseAdmin: crearSupabase(),
      };
    }

    return originalLoad.apply(this, arguments);
  };

  const crearRespuesta = () => ({
    codigo: 200,
    cuerpo: null,
    status(codigo) {
      this.codigo = codigo;
      return this;
    },
    json(cuerpo) {
      this.cuerpo = cuerpo;
      return this;
    },
  });

  try {
    Module._load = cargarMock;
    require.cache[supabasePath] = {
      id: supabasePath,
      filename: supabasePath,
      loaded: true,
      exports: {
        supabaseAdmin: crearSupabase(),
      },
    };
    delete require.cache[controllerPath];

    const {
      consultarMiHistorial,
    } = require(controllerPath);
    const respuesta = crearRespuesta();

    await consultarMiHistorial(
      {
        usuario: { id: estudianteId },
        params: {
          estudianteId:
            '00000000-0000-4000-8000-000000000099',
        },
        query: {},
      },
      respuesta
    );

    assert.equal(respuesta.codigo, 200);
    assert.equal(
      respuesta.cuerpo.asistencias.length,
      501
    );
    assert.equal(
      respuesta.cuerpo.resumen.totalRegistros,
      501
    );
    assert.equal(
      respuesta.cuerpo.resumen.ausentes,
      1
    );
    assert.deepEqual(rangosAsistencia, [
      [0, 499],
      [500, 999],
    ]);
    assert.ok(
      filtrosAsistencia.every(
        (filtros) =>
          filtros.estudiante_id === estudianteId
      ),
      'La consulta debe usar la identidad autenticada, nunca el ID de la ruta.'
    );
  } finally {
    Module._load = originalLoad;

    if (originalController) {
      require.cache[controllerPath] =
        originalController;
    } else {
      delete require.cache[controllerPath];
    }

    if (originalSupabase) {
      require.cache[supabasePath] =
        originalSupabase;
    } else {
      delete require.cache[supabasePath];
    }
  }
});
