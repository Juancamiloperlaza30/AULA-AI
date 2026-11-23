'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const controllerPath = path.resolve(
  __dirname,
  '../src/controllers/subjectController.js'
);
const supabasePath = require.resolve(
  '../src/config/supabase'
);

test('RNF-07.1 y 07.5: recupera todas las materias del estudiante autenticado', async () => {
  const originalController = require.cache[controllerPath];
  const originalSupabase = require.cache[supabasePath];
  const originalLoad = Module._load;
  const rangos = [];
  const estudiantesConsultados = [];
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
        order() {
          return this;
        },
        range(desde, hasta) {
          inicio = desde;
          fin = hasta;
          rangos.push([desde, hasta]);
          return this;
        },
        maybeSingle() {
          estudiantesConsultados.push(
            filtros.usuario_id
          );

          return Promise.resolve({
            data: {
              usuario_id: estudianteId,
              grado_id: 2,
              grupo_id: 3,
              grado: { nombre: 'Décimo' },
              grupo: { nombre: 'A' },
            },
            error: null,
          });
        },
        then(resolve, reject) {
          const filas = Array.from(
            { length: 501 },
            (_, indice) => ({
              id: indice + 1,
              periodo_id: 4,
              estado: 'activa',
              materia: {
                id: indice + 1,
                nombre: `Materia ${indice + 1}`,
              },
              grado: { nombre: 'Décimo' },
              grupo: { nombre: 'A' },
              periodo: { id: 4, nombre: '2026' },
              docentes: [],
              filtros,
              tabla,
            })
          );

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

    if (
      parent?.filename === controllerPath &&
      request === '../services/auditService'
    ) {
      return {
        registrarAuditoria: async () => {},
      };
    }

    return originalLoad.apply(this, arguments);
  };

  const respuesta = {
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
  };

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
      listarMateriasEstudiante,
    } = require(controllerPath);

    await listarMateriasEstudiante(
      {
        usuario: { id: estudianteId },
        query: {
          estudianteId:
            '00000000-0000-4000-8000-000000000099',
        },
      },
      respuesta
    );

    assert.equal(respuesta.codigo, 200);
    assert.equal(
      respuesta.cuerpo.materias.length,
      501
    );
    assert.equal(
      respuesta.cuerpo.resumenAcademico.totalMaterias,
      501
    );
    assert.deepEqual(rangos, [
      [0, 499],
      [500, 999],
    ]);
    assert.deepEqual(estudiantesConsultados, [
      estudianteId,
    ]);
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
