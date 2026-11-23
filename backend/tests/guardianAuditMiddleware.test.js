'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const middlewarePath = path.resolve(
  __dirname,
  '../src/middleware/guardianAuditMiddleware.js'
);

test('RNF-08.12: audita consultas del acudiente con estudiante, ruta y estado', async () => {
  const originalMiddleware =
    require.cache[middlewarePath];
  const originalLoad = Module._load;
  const estudianteId =
    '00000000-0000-4000-8000-000000000001';
  let auditoria;
  let finalizarRespuesta;
  let nextEjecutado = false;

  const cargarMock = function(request, parent) {
    if (
      parent?.filename === middlewarePath &&
      request === '../services/auditService'
    ) {
      return {
        registrarAuditoria: async (datos) => {
          auditoria = datos;
          return true;
        },
      };
    }

    return originalLoad.apply(this, arguments);
  };

  try {
    Module._load = cargarMock;
    delete require.cache[middlewarePath];

    const {
      auditarConsultaAcudiente,
    } = require(middlewarePath);
    const req = {
      method: 'GET',
      path: `/estudiantes/${estudianteId}/asistencia`,
      route: {
        path: '/estudiantes/:estudianteId/asistencia',
      },
      params: { estudianteId },
      usuario: {
        id: '00000000-0000-4000-8000-000000000002',
        correo: 'acudiente@example.test',
        rol: 'acudiente',
      },
      headers: {
        'user-agent': 'AULA-AI test',
      },
      ip: '127.0.0.1',
    };
    const res = {
      statusCode: 403,
      once(evento, callback) {
        assert.equal(evento, 'finish');
        finalizarRespuesta = callback;
      },
    };

    auditarConsultaAcudiente(
      req,
      res,
      () => {
        nextEjecutado = true;
      }
    );

    assert.equal(nextEjecutado, true);
    res.statusCode = 403;
    finalizarRespuesta();
    await new Promise((resolve) =>
      setImmediate(resolve)
    );

    assert.equal(
      auditoria.evento,
      'CONSULTA_ACADEMICA_ACUDIENTE'
    );
    assert.equal(
      auditoria.usuarioId,
      req.usuario.id
    );
    assert.equal(
      auditoria.metadata.estudianteId,
      estudianteId
    );
    assert.equal(
      auditoria.metadata.estadoHttp,
      403
    );
    assert.equal(
      auditoria.metadata.ruta,
      '/estudiantes/:estudianteId/asistencia'
    );
  } finally {
    Module._load = originalLoad;

    if (originalMiddleware) {
      require.cache[middlewarePath] =
        originalMiddleware;
    } else {
      delete require.cache[middlewarePath];
    }
  }
});

test('RNF-09.9: audita el envío sin registrar el motivo ni el contenido del archivo', async () => {
  const originalMiddleware =
    require.cache[middlewarePath];
  const originalLoad = Module._load;
  const estudianteId =
    '00000000-0000-4000-8000-000000000001';
  let auditoria;
  let finalizarRespuesta;

  const cargarMock = function(request, parent) {
    if (
      parent?.filename === middlewarePath &&
      request === '../services/auditService'
    ) {
      return {
        registrarAuditoria: async (datos) => {
          auditoria = datos;
          return true;
        },
      };
    }

    return originalLoad.apply(this, arguments);
  };

  try {
    Module._load = cargarMock;
    delete require.cache[middlewarePath];

    const {
      auditarEnvioExcusa,
    } = require(middlewarePath);
    const req = {
      method: 'POST',
      path: `/estudiantes/${estudianteId}/excusas`,
      route: {
        path: '/estudiantes/:estudianteId/excusas',
      },
      params: { estudianteId },
      body: {
        asistenciaId: '23',
        motivo: 'Información privada que no debe auditarse.',
      },
      usuario: {
        id: '00000000-0000-4000-8000-000000000002',
        correo: 'acudiente@example.test',
        rol: 'acudiente',
      },
      headers: {
        'user-agent': 'AULA-AI test',
      },
      ip: '127.0.0.1',
    };
    const res = {
      statusCode: 201,
      locals: { excusaId: 45 },
      once(evento, callback) {
        assert.equal(evento, 'finish');
        finalizarRespuesta = callback;
      },
    };

    auditarEnvioExcusa(req, res, () => {});
    finalizarRespuesta();
    await new Promise((resolve) =>
      setImmediate(resolve)
    );

    assert.equal(
      auditoria.evento,
      'ENVIO_EXCUSA_ACADEMICA'
    );
    assert.equal(
      auditoria.usuarioId,
      req.usuario.id
    );
    assert.equal(
      auditoria.metadata.estudianteId,
      estudianteId
    );
    assert.equal(
      auditoria.metadata.asistenciaId,
      '23'
    );
    assert.equal(
      auditoria.metadata.excusaId,
      45
    );
    assert.equal(
      auditoria.metadata.estadoHttp,
      201
    );
    assert.equal(
      Object.hasOwn(auditoria.metadata, 'motivo'),
      false
    );
  } finally {
    Module._load = originalLoad;

    if (originalMiddleware) {
      require.cache[middlewarePath] =
        originalMiddleware;
    } else {
      delete require.cache[middlewarePath];
    }
  }
});
