'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const express = require('express');

const rutaMiddleware = require.resolve(
  '../src/middleware/requireAcademicAccess'
);

const rutaAuth = require.resolve(
  '../src/middleware/authMiddleware'
);

const originalLoad = Module._load;

let usuarioSimulado = null;
let llamadasAutenticacion = 0;

const verificarTokenSimulado = (req, res, next) => {
  llamadasAutenticacion++;

  if (!usuarioSimulado) {
    return res.status(401).json({
      success: false,
      message: 'Sesion no valida.',
    });
  }

  req.usuario = usuarioSimulado;
  return next();
};

const permitirRolesSimulado = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.usuario?.rol)) {
      return res.status(403).json({
        success: false,
        code: 'ROLE_FORBIDDEN',
      });
    }

    return next();
  };
};

let requireAcademicAccess;

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

    return originalLoad.apply(this, arguments);
  };

  delete require.cache[rutaMiddleware];

  ({
    requireAcademicAccess,
  } = require(rutaMiddleware));

} finally {
  Module._load = originalLoad;
}

assert.ok(Array.isArray(requireAcademicAccess));
assert.equal(requireAcademicAccess.length, 2);

async function solicitar(usuario, rolesPermitidos = ['docente']) {
  usuarioSimulado = usuario;
  llamadasAutenticacion = 0;

  const app = express();

  app.get(
    '/api/prueba',
    requireAcademicAccess,
    permitirRolesSimulado(...rolesPermitidos),
    (req, res) => {
      res.status(200).json({
        success: true,
        rol: req.usuario.rol,
      });
    }
  );

  const servidor = app.listen(0, '127.0.0.1');

  try {
    await new Promise((resolve, reject) => {
      if (servidor.listening) return resolve();

      servidor.once('listening', resolve);
      servidor.once('error', reject);
    });

    const puerto = servidor.address().port;

    const respuesta = await fetch(
      `http://127.0.0.1:${puerto}/api/prueba`
    );

    return {
      status: respuesta.status,
      body: await respuesta.json(),
      autenticaciones: llamadasAutenticacion,
    };
  } finally {
    await new Promise(resolve => servidor.close(resolve));
  }
}

test('Sin sesion responde 401', async () => {
  const resultado = await solicitar(null);

  assert.equal(resultado.status, 401);
  assert.equal(resultado.autenticaciones, 1);
});

test('Con cambio pendiente responde 403', async () => {
  const resultado = await solicitar({
    id: 'simulado',
    rol: 'docente',
    debe_cambiar_password: true,
  });

  assert.equal(resultado.status, 403);

  assert.equal(
    resultado.body.code,
    'PASSWORD_CHANGE_REQUIRED'
  );

  assert.equal(resultado.autenticaciones, 1);
});

test('Con cambio completado y rol autorizado responde 200', async () => {
  const resultado = await solicitar({
    id: 'simulado',
    rol: 'docente',
    debe_cambiar_password: false,
  });

  assert.equal(resultado.status, 200);
  assert.equal(resultado.autenticaciones, 1);
});

test('Con cambio completado pero rol incorrecto responde 403', async () => {
  const resultado = await solicitar({
    id: 'simulado',
    rol: 'estudiante',
    debe_cambiar_password: false,
  });

  assert.equal(resultado.status, 403);
  assert.equal(resultado.body.code, 'ROLE_FORBIDDEN');
  assert.equal(resultado.autenticaciones, 1);
});

test('Indicador ausente responde 403', async () => {
  const resultado = await solicitar({
    id: 'simulado',
    rol: 'docente',
  });

  assert.equal(resultado.status, 403);

  assert.equal(
    resultado.body.code,
    'PASSWORD_CHANGE_REQUIRED'
  );
});