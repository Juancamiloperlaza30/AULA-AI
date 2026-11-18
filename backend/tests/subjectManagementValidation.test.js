'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const controllerPath = require.resolve(
  '../src/controllers/subjectController'
);
const supabasePath = require.resolve(
  '../src/config/supabase'
);
const auditPath = require.resolve(
  '../src/services/auditService'
);

function crearRespuesta() {
  return {
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
}

function crearSolicitud(body) {
  return {
    body,
    params: { id: '1' },
    usuario: {
      id: '00000000-0000-0000-0000-000000000001',
      correo: 'admin@example.com',
      rol: 'administrador',
    },
    headers: {},
    ip: '127.0.0.1',
  };
}

test('RNF-03: validar datos de registro y actualización de materias', async () => {
  const rutas = [
    controllerPath,
    supabasePath,
    auditPath,
  ];
  const originales = new Map(
    rutas.map((ruta) => [ruta, require.cache[ruta]])
  );
  let llamadasBaseDatos = 0;

  try {
    require.cache[supabasePath] = {
      id: supabasePath,
      filename: supabasePath,
      loaded: true,
      exports: {
        supabaseAdmin: {
          from() {
            llamadasBaseDatos += 1;
            throw new Error(
              'No debe consultar la base de datos con una solicitud inválida.'
            );
          },
        },
      },
    };
    require.cache[auditPath] = {
      id: auditPath,
      filename: auditPath,
      loaded: true,
      exports: {
        registrarAuditoria: async () => true,
      },
    };

    delete require.cache[controllerPath];
    const {
      registrarMateria,
      actualizarMateria,
      listarMateriasEstudiante,
    } = require(controllerPath);
    const docenteId =
      '00000000-0000-0000-0000-000000000002';
    const registroValido = {
      nombre: 'Matemáticas',
      gradoId: 1,
      gruposIds: [1],
      docentesIds: [docenteId],
      periodoId: 1,
      estado: 'activa',
    };

    const registrosInvalidos = [
      undefined,
      { ...registroValido, nombre: 12 },
      { ...registroValido, gradoId: 0 },
      { ...registroValido, gruposIds: [1, 1] },
      { ...registroValido, gruposIds: ['1x'] },
      { ...registroValido, docentesIds: [docenteId, docenteId] },
      { ...registroValido, docentesIds: ['docente-no-uuid'] },
      { ...registroValido, periodoId: 1.5 },
      { ...registroValido, estado: 'borrada' },
    ];

    for (const body of registrosInvalidos) {
      const respuesta = crearRespuesta();

      await registrarMateria(
        crearSolicitud(body),
        respuesta
      );

      assert.equal(respuesta.codigo, 400);
      assert.equal(respuesta.cuerpo.success, false);
    }

    const actualizacionesInvalidas = [
      { id: '0', body: registroValido },
      { id: '1.5', body: registroValido },
      {
        id: '1',
        body: {
          ...registroValido,
          grupoId: 1,
          docentesIds: [],
        },
      },
    ];

    for (const caso of actualizacionesInvalidas) {
      const respuesta = crearRespuesta();
      const solicitud = crearSolicitud(caso.body);
      solicitud.params.id = caso.id;

      await actualizarMateria(
        solicitud,
        respuesta
      );

      assert.equal(respuesta.codigo, 400);
      assert.equal(respuesta.cuerpo.success, false);
    }

    const solicitudEstudiante =
      crearSolicitud(undefined);
    solicitudEstudiante.query = {
      periodoId: 'periodo-invalido',
    };
    const respuestaEstudiante = crearRespuesta();

    await listarMateriasEstudiante(
      solicitudEstudiante,
      respuestaEstudiante
    );

    assert.equal(respuestaEstudiante.codigo, 400);
    assert.equal(respuestaEstudiante.cuerpo.success, false);
    assert.equal(llamadasBaseDatos, 0);
  } finally {
    for (const [ruta, original] of originales) {
      if (original) {
        require.cache[ruta] = original;
      } else {
        delete require.cache[ruta];
      }
    }
  }
});

test('RNF-03: los fallos al validar grupos responden sin filtrar detalles internos', async () => {
  const rutas = [
    controllerPath,
    supabasePath,
    auditPath,
  ];
  const originales = new Map(
    rutas.map((ruta) => [ruta, require.cache[ruta]])
  );

  try {
    require.cache[supabasePath] = {
      id: supabasePath,
      filename: supabasePath,
      loaded: true,
      exports: {
        supabaseAdmin: {
          from() {
            return {
              select() {
                return this;
              },
              in() {
                return this;
              },
              then(resolve) {
                return Promise.resolve({
                  data: null,
                  error: {
                    message: 'detalle interno de la base de datos',
                  },
                }).then(resolve);
              },
            };
          },
        },
      },
    };
    require.cache[auditPath] = {
      id: auditPath,
      filename: auditPath,
      loaded: true,
      exports: {
        registrarAuditoria: async () => true,
      },
    };

    delete require.cache[controllerPath];
    const { registrarMateria } = require(controllerPath);
    const respuesta = crearRespuesta();

    await registrarMateria(
      crearSolicitud({
        nombre: 'Matemáticas',
        gradoId: 1,
        gruposIds: [1],
        docentesIds: [
          '00000000-0000-0000-0000-000000000002',
        ],
        periodoId: 1,
        estado: 'activa',
      }),
      respuesta
    );

    assert.equal(respuesta.codigo, 500);
    assert.equal(respuesta.cuerpo.success, false);
    assert.equal(
      JSON.stringify(respuesta.cuerpo).includes(
        'detalle interno de la base de datos'
      ),
      false
    );
  } finally {
    for (const [ruta, original] of originales) {
      if (original) {
        require.cache[ruta] = original;
      } else {
        delete require.cache[ruta];
      }
    }
  }
});

test('RNF-03: conservar el registro y actualización válidos con IDs normalizados', async () => {
  const rutas = [
    controllerPath,
    supabasePath,
    auditPath,
  ];
  const originales = new Map(
    rutas.map((ruta) => [ruta, require.cache[ruta]])
  );
  const docenteId =
    '00000000-0000-0000-0000-000000000002';
  const llamadasRpc = [];
  const auditorias = [];

  try {
    require.cache[supabasePath] = {
      id: supabasePath,
      filename: supabasePath,
      loaded: true,
      exports: {
        supabaseAdmin: {
          from(tabla) {
            const datos = {
              grupos: [
                { id: 1, grado_id: 1, activo: true },
              ],
              usuarios: [
                {
                  id: docenteId,
                  rol: 'docente',
                  activo: true,
                },
              ],
            };
            const consulta = {
              select() {
                return this;
              },
              in() {
                return this;
              },
              eq() {
                return this;
              },
              maybeSingle() {
                return Promise.resolve({
                  data: { id: 1, activo: true },
                  error: null,
                });
              },
              then(resolve) {
                return Promise.resolve({
                  data: datos[tabla] || [],
                  error: null,
                }).then(resolve);
              },
            };

            return consulta;
          },
          async rpc(nombre, parametros) {
            llamadasRpc.push({ nombre, parametros });
            return { data: 17, error: null };
          },
        },
      },
    };
    require.cache[auditPath] = {
      id: auditPath,
      filename: auditPath,
      loaded: true,
      exports: {
        registrarAuditoria: async (datos) => {
          auditorias.push(datos);
          return true;
        },
      },
    };

    delete require.cache[controllerPath];
    const {
      registrarMateria,
      actualizarMateria,
    } = require(controllerPath);
    const body = {
      nombre: ' Matemáticas ',
      gradoId: '1',
      gruposIds: ['1'],
      docentesIds: [docenteId],
      periodoId: '1',
      estado: 'activa',
    };
    const respuestaRegistro = crearRespuesta();

    await registrarMateria(
      crearSolicitud(body),
      respuestaRegistro
    );

    assert.equal(respuestaRegistro.codigo, 201);
    assert.equal(respuestaRegistro.cuerpo.success, true);
    assert.equal(
      llamadasRpc[0].nombre,
      'registrar_materia_transaccional'
    );
    assert.equal(
      llamadasRpc[0].parametros.p_grado_id,
      1
    );
    assert.equal(
      llamadasRpc[0].parametros.p_nombre,
      'Matemáticas'
    );

    const solicitudActualizacion = crearSolicitud({
      ...body,
      grupoId: '1',
    });
    const respuestaActualizacion = crearRespuesta();

    await actualizarMateria(
      solicitudActualizacion,
      respuestaActualizacion
    );

    assert.equal(respuestaActualizacion.codigo, 200);
    assert.equal(respuestaActualizacion.cuerpo.success, true);
    assert.equal(
      llamadasRpc[1].nombre,
      'actualizar_asignacion_materia'
    );
    assert.equal(
      llamadasRpc[1].parametros.p_periodo_id,
      1
    );
    assert.deepEqual(
      auditorias.map((evento) => evento.evento),
      ['MATERIA_REGISTRADA', 'MATERIA_MODIFICADA']
    );
  } finally {
    for (const [ruta, original] of originales) {
      if (original) {
        require.cache[ruta] = original;
      } else {
        delete require.cache[ruta];
      }
    }
  }
});
