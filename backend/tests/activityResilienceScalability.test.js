'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const rutaControlador = path.resolve(
  __dirname,
  '../src/controllers/activityController.js'
);

const DOCENTE =
  '00000000-0000-0000-0000-000000000001';

const SOLICITUD = {
  materiaGrupoPeriodoId: 5,
  tipo: 'tarea',
  titulo: 'Actividad prueba de resiliencia',
  descripcion: 'Registro simulado, sin Supabase real',
  fechaPublicacion: '2030-05-10T09:00:00.000Z',
  fechaEntrega: '2030-05-11T09:00:00.000Z',
  clientRequestId:
    '00000000-0000-0000-0000-000000000002',
};

async function ejecutar(accion, opciones = {}) {
  const estadisticas = {
    inserciones: 0,
    auditorias: 0,
    notificaciones: 0,
    paginas: [],
  };

  const total = opciones.total || 0;

  const supabaseAdmin = {
    rpc(nombre, parametros) {
      assert.equal(
        nombre,
        'rnf04_guardar_actividad_auditada'
      );
      assert.equal(parametros.p_operacion, 'registrar');
      estadisticas.inserciones += 1;

      if (!opciones.falloInsercion) {
        estadisticas.auditorias += 1;
      }

      const fallo =
        opciones.falloInsercion ||
        opciones.falloAuditoria;

      return Promise.resolve({
        data: fallo ? null : { id: 99 },
        error: fallo ? {
          code: 'XX000',
          message: 'ERROR INTERNO SIMULADO',
        } : null,
      });
    },
    from(tabla) {
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
        insert() {
          estadisticas.inserciones += 1;
          return this;
        },
        async maybeSingle() {
          if (tabla === 'materia_docente') {
            return opciones.falloAsignacion
              ? {
                  data: null,
                  error: {
                    message: 'ERROR INTERNO SIMULADO',
                  },
                }
              : {
                  data: { id: 1 },
                  error: null,
                };
          }

          if (tabla === 'materia_grupo_periodo') {
            return {
              data: {
                id: 5,
                estado: 'activa',
                periodo: { activo: true },
              },
              error: null,
            };
          }

          if (tabla === 'actividades_academicas') {
            return {
              data: null,
              error: null,
            };
          }

          throw new Error(
            `Tabla inesperada: ${tabla}`
          );
        },
        async single() {
          if (opciones.falloInsercion) {
            return {
              data: null,
              error: {
                code: 'XX000',
                message: 'ERROR INTERNO SIMULADO',
              },
            };
          }

          return {
            data: { id: 99 },
            error: null,
          };
        },
        async range(inicio, fin) {
          assert.equal(
            tabla,
            'actividades_academicas'
          );

          estadisticas.paginas.push([
            inicio,
            fin,
          ]);

          if (
            opciones.falloPagina &&
            inicio >= 500
          ) {
            return {
              data: null,
              error: {
                message: 'ERROR INTERNO SIMULADO',
              },
            };
          }

          const registros = [];

          for (
            let id = inicio;
            id <= fin && id < total;
            id += 1
          ) {
            registros.push({
              id,
              titulo: `Actividad ${id}`,
            });
          }

          return {
            data: registros,
            error: null,
          };
        },
      };

      return consulta;
    },
  };

  const cargarOriginal = Module._load;
  let controlador;

  try {
    Module._load = function(solicitud, padre) {
      if (padre?.filename === rutaControlador) {
        if (solicitud === '../config/supabase') {
          return { supabaseAdmin };
        }

        if (
          solicitud === '../services/auditService'
        ) {
          return {
            registrarAuditoria: async () => {
              estadisticas.auditorias += 1;
              return opciones.falloAuditoria !== true;
            },
          };
        }

        if (
          solicitud ===
          '../services/activityPublicationService'
        ) {
          return {
            notificarActividadPublicada: async () => {
              estadisticas.notificaciones += 1;
              return { success: true };
            },
          };
        }
      }

      return cargarOriginal.apply(
        this,
        arguments
      );
    };

    delete require.cache[rutaControlador];

    controlador = require(
      rutaControlador
    );
  } finally {
    Module._load = cargarOriginal;
    delete require.cache[rutaControlador];
  }

  const respuesta = {
    statusCode: 200,
    body: null,
    status(codigo) {
      this.statusCode = codigo;
      return this;
    },
    json(cuerpo) {
      this.body = cuerpo;
      return this;
    },
  };

  const req = {
    usuario: {
      id: DOCENTE,
      correo: 'docente@example.com',
      rol: 'docente',
    },
    body: SOLICITUD,
    headers: {},
    ip: '127.0.0.1',
  };

  const inicio = performance.now();

  await controlador[accion](
    req,
    respuesta
  );

  await new Promise((resolver) =>
    setImmediate(resolver)
  );

  return {
    respuesta,
    estadisticas,
    milisegundos:
      performance.now() - inicio,
  };
}

test(
  'RNF-04.10: fallo de asignacion no crea actividades',
  async () => {
    const {
      respuesta,
      estadisticas,
    } = await ejecutar(
      'registrarActividad',
      { falloAsignacion: true }
    );

    assert.equal(
      respuesta.statusCode,
      500
    );
    assert.equal(
      respuesta.body.success,
      false
    );
    assert.doesNotMatch(
      JSON.stringify(respuesta.body),
      /ERROR INTERNO SIMULADO/
    );
    assert.equal(
      estadisticas.inserciones,
      0
    );
    assert.equal(
      estadisticas.auditorias,
      0
    );
    assert.equal(
      estadisticas.notificaciones,
      0
    );
  }
);

test(
  'RNF-04.10: fallo de insercion no confirma registro',
  async () => {
    const {
      respuesta,
      estadisticas,
    } = await ejecutar(
      'registrarActividad',
      { falloInsercion: true }
    );

    assert.equal(
      respuesta.statusCode,
      500
    );
    assert.equal(
      respuesta.body.success,
      false
    );
    assert.doesNotMatch(
      JSON.stringify(respuesta.body),
      /ERROR INTERNO SIMULADO/
    );
    assert.equal(
      estadisticas.inserciones,
      1
    );
    assert.equal(
      estadisticas.auditorias,
      0
    );
    assert.equal(
      estadisticas.notificaciones,
      0
    );
  }
);

test(
  'RNF-04.12: recupera 1205 actividades simuladas sin omisiones',
  async () => {
    const {
      respuesta,
      estadisticas,
      milisegundos,
    } = await ejecutar(
      'listarActividadesDocente',
      { total: 1205 }
    );

    assert.equal(
      respuesta.statusCode,
      200
    );
    assert.equal(
      respuesta.body.actividades.length,
      1205
    );
    assert.deepEqual(
      estadisticas.paginas,
      [
        [0, 499],
        [500, 999],
        [1000, 1499],
      ]
    );

    console.log(
      `Procesamiento simulado: ${
        milisegundos.toFixed(2)
      } ms`
    );
  }
);

test(
  'RNF-04.10: error de paginacion no devuelve datos incompletos',
  async () => {
    const {
      respuesta,
      estadisticas,
    } = await ejecutar(
      'listarActividadesDocente',
      {
        total: 1205,
        falloPagina: true,
      }
    );

    assert.equal(
      respuesta.statusCode,
      500
    );
    assert.equal(
      respuesta.body.success,
      false
    );
    assert.doesNotMatch(
      JSON.stringify(respuesta.body),
      /ERROR INTERNO SIMULADO/
    );
    assert.equal(
      estadisticas.paginas.length,
      2
    );
  }
);

test(
  'RNF-04.9: fallo de auditoria impide confirmar registro',
  async () => {
    const {
      respuesta,
      estadisticas,
    } = await ejecutar(
      'registrarActividad',
      { falloAuditoria: true }
    );

    assert.equal(
      estadisticas.inserciones,
      1
    );
    assert.equal(
      estadisticas.auditorias,
      1
    );

    // La transaccion debe rechazar una auditoria fallida.
    assert.equal(respuesta.statusCode, 500);
    assert.equal(respuesta.body.success, false);
    assert.equal(estadisticas.notificaciones, 0);

    console.log(
      'Auditoria fallida: registro rechazado'
    );
  }
);
