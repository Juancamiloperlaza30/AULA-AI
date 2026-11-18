'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const rutaControlador = path.resolve(
  __dirname,
  '../src/controllers/activityController.js'
);

const DOCENTE_ID =
  '00000000-0000-0000-0000-000000000001';
const CLIENT_REQUEST_ID =
  '00000000-0000-0000-0000-000000000002';

const BODY_VALIDO = {
  materiaGrupoPeriodoId: '5',
  tipo: 'tarea',
  titulo: '  Actividad de prueba  ',
  descripcion: '  Descripción de prueba  ',
  fechaPublicacion: '2030-05-10T09:00:00.000Z',
  fechaEntrega: '2030-05-11T09:00:00.000Z',
  clientRequestId: CLIENT_REQUEST_ID,
};

async function ejecutarRegistro(body, actividadExistente) {
  const llamadasBaseDatos = [];
  const inserciones = [];
  let llamadaAuditoria = false;
  let llamadaNotificacion = false;
  const supabaseAdmin = {
    from(tabla) {
      const consulta = {
        select() {
          return this;
        },
        insert(datos) {
          inserciones.push({ tabla, datos });
          return this;
        },
        single() {
          return Promise.resolve({
            data: { id: 99 },
            error: null,
          });
        },
        eq(campo, valor) {
          llamadasBaseDatos.push({
            tabla,
            campo,
            valor,
          });
          return this;
        },
        maybeSingle() {
          if (tabla === 'materia_docente') {
            return Promise.resolve({
              data: { id: 8 },
              error: null,
            });
          }

          if (tabla === 'materia_grupo_periodo') {
            return Promise.resolve({
              data: {
                id: 5,
                estado: 'activa',
                grado_id: 7,
                grupo_id: 3,
                materia: { nombre: 'Matemáticas' },
                periodo: { activo: true },
              },
              error: null,
            });
          }

          if (tabla === 'actividades_academicas') {
            return Promise.resolve({
              data: actividadExistente || null,
              error: null,
            });
          }

          throw new Error(
            `Consulta inesperada a ${tabla}`
          );
        },
      };

      return consulta;
    },
  };
  const cargarOriginal = Module._load;

  const cargarMock = function(request, parent) {
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
      return {
        registrarAuditoria: async () => {
          llamadaAuditoria = true;
          return true;
        },
      };
    }

    if (
      parent?.filename === rutaControlador &&
      request === '../services/activityPublicationService'
    ) {
      return {
        notificarActividadPublicada: async () => {
          llamadaNotificacion = true;
          return { success: true };
        },
      };
    }

    return cargarOriginal.apply(this, arguments);
  };

  let controlador;

  try {
    Module._load = cargarMock;
    delete require.cache[rutaControlador];
    controlador = require(rutaControlador);
  } finally {
    Module._load = cargarOriginal;
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

  await controlador.registrarActividad(
    {
      body,
      usuario: {
        id: DOCENTE_ID,
        correo: 'docente@example.com',
        rol: 'docente',
      },
      headers: {},
      ip: '127.0.0.1',
    },
    respuesta
  );

  await new Promise((resolve) => setImmediate(resolve));

  return {
    respuesta,
    llamadasBaseDatos,
    inserciones,
    llamadaAuditoria,
    llamadaNotificacion,
  };
}

test('RNF-04.2: rechaza datos y fechas con formato inválido', async () => {
  const solicitudesInvalidas = [
    undefined,
    { ...BODY_VALIDO, materiaGrupoPeriodoId: 0 },
    { ...BODY_VALIDO, titulo: 12 },
    {
      ...BODY_VALIDO,
      fechaPublicacion: '2030-02-30T09:00:00.000Z',
    },
    {
      ...BODY_VALIDO,
      fechaPublicacion: '2030-05-10T09:00:00',
    },
    {
      ...BODY_VALIDO,
      fechaEntrega: '2030-05-10T09:00:00.000Z',
    },
    {
      ...BODY_VALIDO,
      clientRequestId: 'solicitud-invalida',
    },
  ];

  for (const body of solicitudesInvalidas) {
    const resultado = await ejecutarRegistro(body);
    assert.equal(resultado.respuesta.statusCode, 400);
    assert.equal(resultado.respuesta.body.success, false);
    assert.equal(resultado.llamadasBaseDatos.length, 0);
    assert.equal(resultado.llamadaAuditoria, false);
    assert.equal(resultado.llamadaNotificacion, false);
  }
});

test('RNF-04.10: un reintento idéntico devuelve la actividad existente', async () => {
  const actividadExistente = {
    id: 23,
    docente_id: DOCENTE_ID,
    materia_grupo_periodo_id: 5,
    tipo: 'tarea',
    titulo: 'Actividad de prueba',
    descripcion: 'Descripción de prueba',
    fecha_publicacion: '2030-05-10T09:00:00.000Z',
    fecha_entrega: '2030-05-11T09:00:00.000Z',
  };
  const resultado = await ejecutarRegistro(
    BODY_VALIDO,
    actividadExistente
  );

  assert.equal(resultado.respuesta.statusCode, 200);
  assert.equal(resultado.respuesta.body.success, true);
  assert.equal(resultado.respuesta.body.actividadId, 23);
  assert.equal(resultado.llamadaAuditoria, false);
  assert.equal(resultado.llamadaNotificacion, false);
});

test('RNF-04.1: conserva el registro y la auditoría de una actividad válida', async () => {
  const resultado = await ejecutarRegistro(
    BODY_VALIDO
  );
  const insercion = resultado.inserciones[0];

  assert.equal(resultado.respuesta.statusCode, 201);
  assert.equal(resultado.respuesta.body.success, true);
  assert.equal(resultado.respuesta.body.actividadId, 99);
  assert.equal(
    insercion.datos.materia_grupo_periodo_id,
    5
  );
  assert.equal(insercion.datos.titulo, 'Actividad de prueba');
  assert.equal(
    insercion.datos.descripcion,
    'Descripción de prueba'
  );
  assert.equal(
    insercion.datos.client_request_id,
    CLIENT_REQUEST_ID
  );
  assert.equal(resultado.llamadaAuditoria, true);
  assert.equal(resultado.llamadaNotificacion, false);
});

test('RNF-04.10: rechaza reutilizar un identificador con otro contenido', async () => {
  const resultado = await ejecutarRegistro(
    BODY_VALIDO,
    {
      id: 23,
      docente_id: DOCENTE_ID,
      materia_grupo_periodo_id: 5,
      tipo: 'examen',
      titulo: 'Otra actividad',
      descripcion: 'Otro contenido',
      fecha_publicacion: '2030-05-10T09:00:00.000Z',
      fecha_entrega: '2030-05-11T09:00:00.000Z',
    }
  );

  assert.equal(resultado.respuesta.statusCode, 409);
  assert.equal(resultado.respuesta.body.success, false);
  assert.equal(resultado.llamadaAuditoria, false);
  assert.equal(resultado.llamadaNotificacion, false);
});
