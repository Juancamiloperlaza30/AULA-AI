'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const controllerPath = require.resolve(
  '../src/controllers/attendanceController'
);
const supabasePath = require.resolve(
  '../src/config/supabase'
);

test('RNF-06.2 y 06.3: rechaza estados inválidos y estudiantes duplicados antes de escribir', async () => {
  const originalController = require.cache[controllerPath];
  const originalSupabase = require.cache[supabasePath];
  let consultas = 0;

  try {
    require.cache[supabasePath] = {
      id: supabasePath,
      filename: supabasePath,
      loaded: true,
      exports: {
        supabaseAdmin: {
          from() {
            consultas++;
            throw new Error(
              'No debe consultar la base con un lote inválido.'
            );
          },
        },
      },
    };

    delete require.cache[controllerPath];

    const {
      registrarAsistencias,
    } = require(controllerPath);
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

    const solicitudBase = {
      params: { sesionId: '4' },
      usuario: {
        id: '00000000-0000-4000-8000-000000000001',
      },
    };

    const respuestaDuplicados = crearRespuesta();
    await registrarAsistencias(
      {
        ...solicitudBase,
        body: {
          registros: [
            {
              estudianteId:
                '00000000-0000-4000-8000-000000000002',
              estado: 'presente',
            },
            {
              estudianteId:
                '00000000-0000-4000-8000-000000000002'.toUpperCase(),
              estado: 'ausente',
            },
          ],
        },
      },
      respuestaDuplicados
    );

    assert.equal(respuestaDuplicados.codigo, 400);
    assert.match(
      respuestaDuplicados.cuerpo.message,
      /sin estudiantes repetidos/
    );

    const respuestaEstado = crearRespuesta();
    await registrarAsistencias(
      {
        ...solicitudBase,
        body: {
          registros: [
            {
              estudianteId:
                '00000000-0000-4000-8000-000000000003',
              estado: 'justificado',
            },
          ],
        },
      },
      respuestaEstado
    );

    assert.equal(respuestaEstado.codigo, 400);
    assert.equal(consultas, 0);
  } finally {
    if (originalController) {
      require.cache[controllerPath] =
        originalController;
    } else {
      delete require.cache[controllerPath];
    }

    if (originalSupabase) {
      require.cache[supabasePath] = originalSupabase;
    } else {
      delete require.cache[supabasePath];
    }
  }
});
