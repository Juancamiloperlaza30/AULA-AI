'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const controllerPath = path.resolve(
  __dirname,
  '../src/controllers/gradeController.js'
);

const DOCENTE_ID =
  '00000000-0000-4000-8000-000000000001';
const ESTUDIANTE_ID =
  '00000000-0000-4000-8000-000000000002';

const crearControlador = async () => {
  const llamadasRpc = [];
  const llamadasInsert = [];
  const supabaseAdmin = {
    from(tabla) {
      const consulta = {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle() {
          if (tabla === 'actividades_academicas') {
            return Promise.resolve({
              data: {
                id: 8,
                docente_id: DOCENTE_ID,
                materia_grupo_periodo: {
                  grado_id: 4,
                  grupo_id: 2,
                },
              },
              error: null,
            });
          }

          if (tabla === 'estudiantes') {
            return Promise.resolve({
              data: {
                usuario_id: ESTUDIANTE_ID,
                grado_id: 4,
                grupo_id: 2,
              },
              error: null,
            });
          }

          if (tabla === 'calificaciones') {
            return Promise.resolve({
              data: {
                id: 12,
                actividad_id: 8,
                estudiante_id: ESTUDIANTE_ID,
                valor: 3,
                retroalimentacion: 'Anterior',
                estado: 'registrada',
                actividad: {
                  materia_grupo_periodo: {
                    grado_id: 4,
                    grupo_id: 2,
                  },
                },
              },
              error: null,
            });
          }

          throw new Error(`Consulta inesperada: ${tabla}`);
        },
        insert(datos) {
          llamadasInsert.push({ tabla, datos });
          return Promise.resolve({ error: null });
        },
      };

      return consulta;
    },
    async rpc(nombre, parametros) {
      llamadasRpc.push({ nombre, parametros });

      if (nombre === 'guardar_calificaciones_masivas_rnf05') {
        return {
          data: parametros.p_calificaciones.map(
            (item, indice) => ({
              id: indice + 1,
              estudiante_id: item.estudianteId,
              valor: item.valor,
              retroalimentacion: item.retroalimentacion,
              estado: 'registrada',
              esNueva: true,
            })
          ),
          error: null,
        };
      }

      return {
        data: true,
        error: null,
      };
    },
  };

  const cargarOriginal = Module._load;
  const cargarMock = function(request, parent) {
    if (
      parent?.filename === controllerPath &&
      request === '../config/supabase'
    ) {
      return { supabaseAdmin };
    }

    if (
      parent?.filename === controllerPath &&
      request === '../services/auditService'
    ) {
      return {
        registrarAuditoria: async () => true,
      };
    }

    return cargarOriginal.apply(this, arguments);
  };

  try {
    Module._load = cargarMock;
    delete require.cache[controllerPath];
    return {
      controlador: require(controllerPath),
      llamadasRpc,
      llamadasInsert,
      restaurar() {
        Module._load = cargarOriginal;
        delete require.cache[controllerPath];
      },
    };
  } catch (error) {
    Module._load = cargarOriginal;
    delete require.cache[controllerPath];
    throw error;
  }
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

const crearSolicitud = (calificaciones) => ({
  body: {
    actividadId: 8,
    calificaciones,
  },
  usuario: {
    id: DOCENTE_ID,
    correo: 'docente@example.com',
    rol: 'docente',
  },
  headers: {},
  ip: '127.0.0.1',
});

test('RNF-05.2 y 05.6: conserva cero como nota válida y guarda el lote en una transacción', async () => {
  const contexto = await crearControlador();

  try {
    const respuesta = crearRespuesta();
    await contexto.controlador.registrarCalificacionesMasivas(
      crearSolicitud([
        {
          estudianteId: ESTUDIANTE_ID,
          valor: 0,
          retroalimentacion: '  Seguimiento  ',
        },
      ]),
      respuesta
    );

    assert.equal(respuesta.codigo, 201);
    assert.equal(respuesta.cuerpo.success, true);
    assert.equal(contexto.llamadasRpc.length, 1);
    assert.equal(
      contexto.llamadasRpc[0].nombre,
      'guardar_calificaciones_masivas_rnf05'
    );
    assert.deepEqual(
      contexto.llamadasRpc[0].parametros.p_calificaciones,
      [{
        estudianteId: ESTUDIANTE_ID,
        valor: 0,
        retroalimentacion: 'Seguimiento',
      }]
    );
    assert.equal(contexto.llamadasInsert.length, 0);
  } finally {
    contexto.restaurar();
  }
});

test('RNF-05.2: rechaza notas fuera de escala o con tipo inválido antes de guardar', async () => {
  for (const valor of [-0.01, 5.01, '', null, true]) {
    const contexto = await crearControlador();

    try {
      const respuesta = crearRespuesta();
      await contexto.controlador.registrarCalificacionesMasivas(
        crearSolicitud([{
          estudianteId: ESTUDIANTE_ID,
          valor,
        }]),
        respuesta
      );

      assert.equal(respuesta.codigo, 400);
      assert.equal(contexto.llamadasRpc.length, 0);
    } finally {
      contexto.restaurar();
    }
  }
});

test('RNF-05.1: rechaza estudiantes duplicados en el mismo lote', async () => {
  const contexto = await crearControlador();

  try {
    const respuesta = crearRespuesta();
    await contexto.controlador.registrarCalificacionesMasivas(
      crearSolicitud([
        { estudianteId: ESTUDIANTE_ID, valor: 4 },
        { estudianteId: ESTUDIANTE_ID, valor: 5 },
      ]),
      respuesta
    );

    assert.equal(respuesta.codigo, 400);
    assert.equal(contexto.llamadasRpc.length, 0);
  } finally {
    contexto.restaurar();
  }
});

test('RNF-05.7: las correcciones administrativas usan la operación atómica de historial', async () => {
  const contexto = await crearControlador();

  try {
    const respuesta = crearRespuesta();
    await contexto.controlador.actualizarCalificacionAdministrativa(
      {
        params: { calificacionId: '12' },
        body: {
          valor: 5,
          retroalimentacion: '  Corregida  ',
          motivo: 'Revisión académica',
        },
        usuario: {
          id: '00000000-0000-4000-8000-000000000003',
          correo: 'admin@example.com',
          rol: 'administrador',
        },
        headers: {},
        ip: '127.0.0.1',
      },
      respuesta
    );

    assert.equal(respuesta.codigo, 200);
    assert.equal(contexto.llamadasRpc.length, 1);
    assert.equal(
      contexto.llamadasRpc[0].nombre,
      'actualizar_calificacion_auditada_rnf05'
    );
    assert.equal(contexto.llamadasInsert.length, 0);
  } finally {
    contexto.restaurar();
  }
});
