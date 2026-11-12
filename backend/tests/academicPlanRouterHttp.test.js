'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const express = require('express');

const rutaRouter = require.resolve(
  '../src/routes/academicPlanRoutes'
);

const rutaAuth = require.resolve(
  '../src/middleware/authMiddleware'
);

const rutaController = require.resolve(
  '../src/controllers/academicPlanController'
);

const rutaAcademicAccess = require.resolve(
  '../src/middleware/requireAcademicAccess'
);

const {
  requirePasswordChangeCompleted,
} = require(
  '../src/middleware/requirePasswordChangeCompleted'
);

let usuarioSimulado = null;
let llamadasAutenticacion = 0;
let llamadasControlador = 0;

function verificarTokenSimulado(req, res, next) {
  llamadasAutenticacion++;

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
  llamadasControlador++;

  return res.status(200).json({
    success: true,
    controlador: 'SIMULADO',
    rol: req.usuario.rol,
  });
}

const controladoresSimulados = {
  listarPlanesEstudiante: controladorSimulado,
  obtenerPlanEstudiante: controladorSimulado,
  registrarPlanAcompanamiento: controladorSimulado,
  modificarPlanAcompanamiento: controladorSimulado,
};

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

    if (resolved === rutaController) {
      return controladoresSimulados;
    }

    if (resolved === rutaAcademicAccess) {
      return {
        requireAcademicAccess: [
          verificarTokenSimulado,
          requirePasswordChangeCompleted,
        ],
      };
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
  llamadasAutenticacion = 0;
  llamadasControlador = 0;

  const app = express();

  app.use('/api/planes-acompanamiento', router);

  const servidor = app.listen(0, '127.0.0.1');

  try {
    await new Promise((resolve, reject) => {
      if (servidor.listening) return resolve();

      servidor.once('listening', resolve);
      servidor.once('error', reject);
    });

    const puerto = servidor.address().port;

    const respuesta = await fetch(
      `http://127.0.0.1:${puerto}/api/planes-acompanamiento/estudiante/123`
    );

    return {
      status: respuesta.status,
      body: await respuesta.json(),
      autenticaciones: llamadasAutenticacion,
      controladores: llamadasControlador,
    };

  } finally {
    await new Promise(resolve => servidor.close(resolve));
  }
}

test('Sin autenticacion responde 401', async () => {
  const resultado = await solicitar(null);

  assert.equal(resultado.status, 401);
  assert.equal(resultado.autenticaciones, 1);
  assert.equal(resultado.controladores, 0);
});

test('Con cambio de password pendiente responde 403', async () => {
  const resultado = await solicitar({
    id: 'simulado',
    rol: 'orientador',
    debe_cambiar_password: true,
  });

  assert.equal(resultado.status, 403);
  assert.equal(
    resultado.body.code,
    'PASSWORD_CHANGE_REQUIRED'
  );
  assert.equal(resultado.controladores, 0);
});

test('Orientador autorizado responde 200', async () => {
  const resultado = await solicitar({
    id: 'simulado',
    rol: 'orientador',
    debe_cambiar_password: false,
  });

  assert.equal(resultado.status, 200);
  assert.equal(resultado.controladores, 1);
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
  assert.equal(resultado.controladores, 0);
});

test('Indicador de password ausente responde 403', async () => {
  const resultado = await solicitar({
    id: 'simulado',
    rol: 'orientador',
  });

  assert.equal(resultado.status, 403);
  assert.equal(
    resultado.body.code,
    'PASSWORD_CHANGE_REQUIRED'
  );
  assert.equal(resultado.controladores, 0);
});