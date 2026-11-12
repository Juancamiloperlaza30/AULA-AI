'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const express = require('express');

const rutaRouter = require.resolve(
  '../src/routes/authRoutes'
);

const rutaControlador = require.resolve(
  '../src/controllers/passwordRecoveryController'
);

const rutaServicio = require.resolve(
  '../src/services/passwordRecoveryService'
);

const rutaAuth = require.resolve(
  '../src/middleware/authMiddleware'
);

const rutaAuthController = require.resolve(
  '../src/controllers/authController'
);

let escenario = {};
let llamadasServicio = 0;
let argumentosRecibidos = null;

const servicioSimulado = async (datos) => {
  llamadasServicio++;
  argumentosRecibidos = datos;

  if (escenario.error) {
    throw escenario.error;
  }

  return {
    usuarioId: 'usuario-simulado',
    correo: 'prueba@example.com',
    rol: 'estudiante',
    passwordCambiadoAt: '2026-11-12T00:00:00.000Z',
  };
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

    if (resolved === rutaServicio) {
      return {
        recuperarPasswordSeguro: servicioSimulado,
      };
    }

    if (resolved === rutaAuthController) {
      const controladorNoEjecutado = (req, res) => {
        return res.status(500).json({
          success: false,
          message: 'Controlador simulado no disponible.',
        });
      };

      return {
        login: controladorNoEjecutado,
        logout: controladorNoEjecutado,
        recuperarPassword: controladorNoEjecutado,
        renovarSesion: controladorNoEjecutado,
        actualizarPassword: controladorNoEjecutado,
        cambiarPasswordInicial: controladorNoEjecutado,
        confirmarRecuperacionPassword: controladorNoEjecutado,
      };
    }

    if (resolved === rutaAuth) {
      return {
        verificarToken: (req, res, next) => next(),
      };
    }

    return originalLoad.apply(this, arguments);
  };

  delete require.cache[rutaControlador];
  delete require.cache[rutaRouter];

  router = require(rutaRouter);

} finally {
  Module._load = originalLoad;
  delete require.cache[rutaControlador];
  delete require.cache[rutaRouter];
}

async function solicitar(configuracion = {}) {
  escenario = configuracion;
  llamadasServicio = 0;
  argumentosRecibidos = null;

  const app = express();
  app.use(express.json());

  app.use('/api/auth', router);

  const servidor = app.listen(0, '127.0.0.1');

  try {
    await new Promise((resolve, reject) => {
      if (servidor.listening) return resolve();

      servidor.once('listening', resolve);
      servidor.once('error', reject);
    });

    const puerto = servidor.address().port;

    const respuesta = await fetch(
      `http://127.0.0.1:${puerto}/api/auth/completar-recuperacion-password`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          configuracion.body === undefined
            ? {
                correo: 'prueba@example.com',
                codigo: '123456',
                nuevaContrasena: 'Segura2026',
                confirmarContrasena: 'Segura2026',
              }
            : configuracion.body
        ),
      }
    );

    return {
      status: respuesta.status,
      body: await respuesta.json(),
      llamadasServicio,
      argumentosRecibidos,
    };

  } finally {
    await new Promise(resolve => servidor.close(resolve));
  }
}

function crearError(status, code, message) {
  return Object.assign(new Error(message), {
    status,
    code,
  });
}

test('Recuperacion correcta responde 200', async () => {
  const resultado = await solicitar();

  assert.equal(resultado.status, 200);
  assert.equal(resultado.body.success, true);
  assert.equal(resultado.llamadasServicio, 1);
  assert.equal(
    resultado.argumentosRecibidos.correo,
    'prueba@example.com'
  );
  assert.equal(
    resultado.body.usuario.rol,
    'estudiante'
  );
  assert.equal(
    resultado.body.usuario.passwordCambiadoAt,
    '2026-11-12T00:00:00.000Z'
  );
  assert.equal(
    Object.hasOwn(resultado.body.usuario, 'usuarioId'),
    false
  );
});

test('OTP invalido responde 400', async () => {
  const resultado = await solicitar({
    error: crearError(
      400,
      'INVALID_RECOVERY_CODE',
      'El codigo es invalido.'
    ),
  });

  assert.equal(resultado.status, 400);
  assert.equal(
    resultado.body.code,
    'INVALID_RECOVERY_CODE'
  );
});

test('Password inseguro responde 400', async () => {
  const resultado = await solicitar({
    error: crearError(
      400,
      'INVALID_PASSWORD',
      'La contrasena no cumple los requisitos.'
    ),
  });

  assert.equal(resultado.status, 400);
  assert.equal(
    resultado.body.code,
    'INVALID_PASSWORD'
  );
});

test('Cuenta institucional inactiva responde 403', async () => {
  const resultado = await solicitar({
    error: crearError(
      403,
      'INVALID_INSTITUTIONAL_ACCOUNT',
      'Cuenta institucional no valida.'
    ),
  });

  assert.equal(resultado.status, 403);
  assert.equal(
    resultado.body.code,
    'INVALID_INSTITUTIONAL_ACCOUNT'
  );
});

test('Fallo parcial del perfil responde 500', async () => {
  const resultado = await solicitar({
    error: crearError(
      500,
      'PROFILE_UPDATE_FAILED',
      'La contrasena cambio, pero el perfil no se actualizo.'
    ),
  });

  assert.equal(resultado.status, 500);
  assert.equal(
    resultado.body.code,
    'PROFILE_UPDATE_FAILED'
  );
});

test('Error inesperado responde 500 sin exponer detalles', async () => {
  const resultado = await solicitar({
    error: new Error('SECRETO_INTERNO_SIMULADO'),
  });

  assert.equal(resultado.status, 500);
  assert.equal(
    resultado.body.code,
    'RECOVERY_INTERNAL_ERROR'
  );
  assert.equal(
    resultado.body.message.includes('SECRETO_INTERNO_SIMULADO'),
    false
  );
});

test('Solicitud sin body responde 400', async () => {
  const resultado = await solicitar({
    body: {},
    error: crearError(
      400,
      'INVALID_RECOVERY_DATA',
      'Faltan datos de recuperacion.'
    ),
  });

  assert.equal(resultado.status, 400);
  assert.equal(
    resultado.body.code,
    'INVALID_RECOVERY_DATA'
  );
  assert.equal(resultado.llamadasServicio, 1);
});

test('La ruta no exige autenticacion previa', async () => {
  const resultado = await solicitar();

  assert.equal(resultado.status, 200);
  assert.equal(resultado.llamadasServicio, 1);
});