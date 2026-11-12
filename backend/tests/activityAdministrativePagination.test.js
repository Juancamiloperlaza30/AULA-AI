'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const rutaControlador = path.resolve(
  __dirname,
  '../src/controllers/activityController.js'
);

async function ejecutarEscenario(escenario) {
  const llamadas = [];
  const registros = escenario.actividades || [];

  const supabaseAdmin = {
    from(tabla) {
      const filtros = [];

      const consulta = {
        select() {
          return this;
        },
        eq(campo, valor) {
          filtros.push({ campo, valor });
          return this;
        },
        or() {
          return this;
        },
        in(campo, valores) {
          filtros.push({ campo, valores });
          return this;
        },
        order() {
          return this;
        },
        async range(inicio, fin) {
          llamadas.push({ tabla, inicio, fin });

          if (tabla === 'coordinador_ambito') {
            return {
              data: (escenario.ambitos || []).slice(inicio, fin + 1),
              error: null,
            };
          }

          if (tabla === 'materia_grupo_periodo') {
            return {
              data: escenario.asignaciones || [],
              error: null,
            };
          }

          let datos = registros;

          const filtroAsignaciones = filtros.find(
            (filtro) =>
              filtro.campo === 'materia_grupo_periodo_id'
          );

          if (filtroAsignaciones) {
            datos = datos.filter((actividad) =>
              filtroAsignaciones.valores.includes(
                actividad.materia_grupo_periodo_id
              )
            );
          }

          return {
            data: datos.slice(inicio, fin + 1),
            error: null,
          };
        },
        then(resolve, reject) {
          if (tabla === 'coordinador_ambito') {
            return Promise.resolve({
              data: escenario.ambitos || [],
              error: null,
            }).then(resolve, reject);
          }

          return Promise.reject(
            new Error('Consulta simulada inesperada')
          ).then(resolve, reject);
        },
      };

      return consulta;
    },
  };

  const cargaOriginal = Module._load;

  const cargarMock = function(request, parent, isMain) {
    if (
      parent?.filename === rutaControlador &&
      request === '../config/supabase'
    ) {
      return { supabaseAdmin };
    }

    if (
      parent?.filename === rutaControlador &&
      request === '../services/auditService'
    ) {
      return { registrarAuditoria: async () => true };
    }

    if (
      parent?.filename === rutaControlador &&
      request === '../services/pushService'
    ) {
      return { enviarNotificacionesMultiples: async () => {} };
    }

    return cargaOriginal.apply(this, arguments);
  };

  let controlador;

  try {
    Module._load = cargarMock;
    delete require.cache[rutaControlador];

    controlador = require(rutaControlador);
  } finally {
    Module._load = cargaOriginal;
    delete require.cache[rutaControlador];
  }

  const respuesta = {
    statusCode: 200,
    status(codigo) {
      this.statusCode = codigo;
      return this;
    },
    json(cuerpo) {
      this.body = cuerpo;
      return this;
    },
  };

  try {
    await controlador.listarActividadesAdministrativas(
      {
        usuario: {
          id: 'usuario-simulado',
          rol: escenario.rol,
        },
      },
      respuesta
    );
  } finally {
    delete require.cache[rutaControlador];
  }

  return { respuesta, llamadas };
}

test('Administrador recupera 1200 actividades en tres lotes', async () => {
  const actividades = Array.from(
    { length: 1200 },
    (_, indice) => ({
      id: indice + 1,
      titulo: `Actividad ${indice + 1}`,
      materia_grupo_periodo_id: 3,
    })
  );

  const { respuesta, llamadas } = await ejecutarEscenario({
    rol: 'administrador',
    actividades,
  });

  assert.equal(respuesta.statusCode, 200);
  assert.equal(respuesta.body.success, true);
  assert.equal(respuesta.body.actividades.length, 1200);

  assert.equal(
    new Set(respuesta.body.actividades.map((a) => a.id)).size,
    1200
  );

  assert.deepEqual(
    llamadas.filter((llamada) =>
      llamada.tabla === 'actividades_academicas'
    ).map(({ inicio, fin }) => [inicio, fin]),
    [
      [0, 499],
      [500, 999],
      [1000, 1499],
    ]
  );
});

test('Coordinador recibe solo actividades autorizadas', async () => {
  const actividades = [
    { id: 1, materia_grupo_periodo_id: 3 },
    { id: 2, materia_grupo_periodo_id: 3 },
    { id: 3, materia_grupo_periodo_id: 2 },
  ];

  const { respuesta } = await ejecutarEscenario({
    rol: 'coordinador',
    ambitos: [{ grado_id: 6, grupo_id: 6 }],
    asignaciones: [{ id: 3 }],
    actividades,
  });

  assert.equal(respuesta.statusCode, 200);
  assert.equal(respuesta.body.actividades.length, 2);

  assert.deepEqual(
    respuesta.body.actividades.map((a) => a.id),
    [1, 2]
  );
});

test('Coordinador sin ambitos recibe lista vacia', async () => {
  const { respuesta } = await ejecutarEscenario({
    rol: 'coordinador',
    ambitos: [],
    actividades: [
      { id: 1, materia_grupo_periodo_id: 3 },
    ],
  });

  assert.equal(respuesta.statusCode, 200);
  assert.equal(respuesta.body.success, true);
  assert.deepEqual(respuesta.body.actividades, []);
});
test('Coordinador recupera mas de 1000 ambitos paginados', async () => {
  const ambitos = Array.from(
    { length: 1200 },
    (_, indice) => ({
      id: indice + 1,
      grado_id: indice + 1,
      grupo_id: 1,
    })
  );

  const { respuesta, llamadas } = await ejecutarEscenario({
    rol: 'coordinador',
    ambitos,
    asignaciones: [{ id: 3 }],
    actividades: [
      { id: 1, materia_grupo_periodo_id: 3 },
    ],
  });

  assert.equal(respuesta.statusCode, 200);
  assert.equal(respuesta.body.success, true);

  assert.deepEqual(
    llamadas
      .filter((llamada) =>
        llamada.tabla === 'coordinador_ambito'
      )
      .map(({ inicio, fin }) => [inicio, fin]),
    [
      [0, 499],
      [500, 999],
      [1000, 1499],
    ]
  );
});
