'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const express = require('express');

const rutaRouter = require.resolve(
  '../src/routes/guardianRoutes'
);

const rutaAuth = require.resolve(
  '../src/middleware/authMiddleware'
);

const rutaAccess = require.resolve(
  '../src/middleware/requireAcademicAccess'
);

const rutaUpload = require.resolve(
  '../src/middleware/excuseUploadMiddleware'
);

const {
  requirePasswordChangeCompleted,
} = require(
  '../src/middleware/requirePasswordChangeCompleted'
);

const nombresControladores = [
  'guardianController',
  'guardianGradesController',
  'guardianActivitiesController',
  'guardianAttendanceController',
  'guardianExcusesController',
  'guardianExcuseSubmissionController',
  'guardianExcuseTrackingController',
  'guardianExcuseSupportController',
  'guardianAlertsController',
];

const rutasControladores = new Set(
  nombresControladores.map(nombre =>
    require.resolve(`../src/controllers/${nombre}`)
  )
);

const funciones = [
  'listarMisEstudiantes',
  'listarCalificacionesAcudiente',
  'listarActividadesAcudiente',
  'consultarAsistenciaAcudiente',
  'listarInasistenciasParaExcusas',
  'crearExcusaAcudiente',
  'listarExcusasAcudiente',
  'descargarSoporteExcusa',
  'listarAlertasAcudiente',
  'listarHistorialAlertasAcudiente',
];

let usuarioSimulado = null;
let autenticaciones = 0;
let ejecucionesControlador = 0;

function verificarTokenSimulado(req, res, next) {
  autenticaciones++;

  if (!usuarioSimulado) {
    return res.status(401).json({
      success: false,
      message: 'Sesion no valida.',
    });
  }

  req.usuario = usuarioSimulado;
  return next();
}

function permitirRolesSimulado(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario?.rol)) {
      return res.status(403).json({
        success: false,
        code: 'ROLE_FORBIDDEN',
      });
    }

    return next();
  };
}

function controladorSimulado(req, res) {
  ejecucionesControlador++;

  return res.status(200).json({
    success: true,
    controlador: 'SIMULADO',
    rol: req.usuario.rol,
  });
}

const controladoresSimulados = Object.fromEntries(
  funciones.map(nombre => [
    nombre,
    controladorSimulado,
  ])
);

const originalLoad = Module._load;
let router;

try {
  Module._load = function(request, parent, isMain) {
    const resolved = Module._resolveFilename(
      request,
      parent,
      isMain
    );

    if (resolved === rutaAuth) {
      return {
        verificarToken: verificarTokenSimulado,
        permitirRoles: permitirRolesSimulado,
      };
    }

    if (resolved === rutaAccess) {
      return {
        requireAcademicAccess: [
          verificarTokenSimulado,
          requirePasswordChangeCompleted,
        ],
      };
    }

    if (resolved === rutaUpload) {
      return {
        recibirSoporteExcusa: (req, res, next) => next(),
      };
    }

    if (rutasControladores.has(resolved)) {
      return controladoresSimulados;
    }

    return originalLoad.apply(this, arguments);
  };

  delete require.cache[rutaRouter];
  router = require(rutaRouter);

} finally {
  Module._load = originalLoad;
  delete require.cache[rutaRouter];
}

async function solicitar(usuario) {
  usuarioSimulado = usuario;
  autenticaciones = 0;
  ejecucionesControlador = 0;

  const app = express();

  app.use('/api/guardian', router);

  const servidor = app.listen(0, '127.0.0.1');

  try {
    await new Promise((resolve, reject) => {
      if (servidor.listening) return resolve();

      servidor.once('listening', resolve);
      servidor.once('error', reject);
    });

    const puerto = servidor.address().port;

    const respuesta = await fetch(
      `http://127.0.0.1:${puerto}/api/guardian/mis-estudiantes`
    );

    return {
      status: respuesta.status,
      body: await respuesta.json(),
      autenticaciones,
      ejecucionesControlador,
    };

  } finally {
    await new Promise(resolve => servidor.close(resolve));
  }
}

test('Sin autenticacion responde 401', async () => {
  const resultado = await solicitar(null);

  assert.equal(resultado.status, 401);
  assert.equal(resultado.autenticaciones, 1);
  assert.equal(resultado.ejecucionesControlador, 0);
});

test('Acudiente con password pendiente responde 403', async () => {
  const resultado = await solicitar({
    id: 'simulado',
    rol: 'acudiente',
    debe_cambiar_password: true,
  });

  assert.equal(resultado.status, 403);
  assert.equal(
    resultado.body.code,
    'PASSWORD_CHANGE_REQUIRED'
  );
  assert.equal(resultado.ejecucionesControlador, 0);
});

test('Acudiente autorizado responde 200', async () => {
  const resultado = await solicitar({
    id: 'simulado',
    rol: 'acudiente',
    debe_cambiar_password: false,
  });

  assert.equal(resultado.status, 200);
  assert.equal(resultado.autenticaciones, 1);
  assert.equal(resultado.ejecucionesControlador, 1);
  assert.equal(resultado.body.controlador, 'SIMULADO');
});

test('Docente no autorizado responde 403', async () => {
  const resultado = await solicitar({
    id: 'simulado',
    rol: 'docente',
    debe_cambiar_password: false,
  });

  assert.equal(resultado.status, 403);
  assert.equal(resultado.body.code, 'ROLE_FORBIDDEN');
  assert.equal(resultado.ejecucionesControlador, 0);
});

test('Estudiante no autorizado responde 403', async () => {
  const resultado = await solicitar({
    id: 'simulado',
    rol: 'estudiante',
    debe_cambiar_password: false,
  });

  assert.equal(resultado.status, 403);
  assert.equal(resultado.body.code, 'ROLE_FORBIDDEN');
  assert.equal(resultado.ejecucionesControlador, 0);
});

test('Indicador de password ausente responde 403', async () => {
  const resultado = await solicitar({
    id: 'simulado',
    rol: 'acudiente',
  });

  assert.equal(resultado.status, 403);
  assert.equal(
    resultado.body.code,
    'PASSWORD_CHANGE_REQUIRED'
  );
  assert.equal(resultado.ejecucionesControlador, 0);
});