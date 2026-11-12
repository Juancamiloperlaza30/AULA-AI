'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Module = require('node:module');

test('Las rutas de recuperacion aplican limites HTTP', async () => {
  const modulosSimulados = new Map();

  const rutaRouter = require.resolve('../src/routes/authRoutes');
  const rutaLimiter = require.resolve(
    '../src/middleware/passwordRecoveryRateLimit'
  );

  const routerAnterior = require.cache[rutaRouter];
  const limiterAnterior = require.cache[rutaLimiter];

  let servidor;
  let llamadasSolicitud = 0;
  let llamadasCompletar = 0;

  function simularModulo(ruta, exportsSimulados) {
    const archivo = require.resolve(ruta);

    modulosSimulados.set(archivo, require.cache[archivo]);

    const modulo = new Module(archivo);
    modulo.filename = archivo;
    modulo.loaded = true;
    modulo.exports = exportsSimulados;

    require.cache[archivo] = modulo;
  }

  try {
    simularModulo('../src/controllers/authController', {
      login: (req, res) => res.sendStatus(200),
      logout: (req, res) => res.sendStatus(200),
      recuperarPassword: (req, res) => {
        llamadasSolicitud++;
        res.status(200).json({ success: true });
      },
      renovarSesion: (req, res) => res.sendStatus(200),
      actualizarPassword: (req, res) => res.sendStatus(200),
      cambiarPasswordInicial: (req, res) => res.sendStatus(200),
      confirmarRecuperacionPassword: (req, res) =>
        res.sendStatus(200),
    });

    simularModulo(
      '../src/controllers/passwordRecoveryController',
      {
        completarRecuperacionPassword: (req, res) => {
          llamadasCompletar++;
          res.status(200).json({ success: true });
        },
      }
    );

    simularModulo('../src/middleware/authMiddleware', {
      verificarToken: (req, res, next) => next(),
    });

    delete require.cache[rutaRouter];
    delete require.cache[rutaLimiter];

    const router = require(rutaRouter);
    const app = express();

    app.set('trust proxy', false);
    app.use(express.json());
    app.use('/api/auth', router);

    servidor = app.listen(0, '127.0.0.1');

    await new Promise((resolve, reject) => {
      if (servidor.listening) return resolve();
      servidor.once('listening', resolve);
      servidor.once('error', reject);
    });

    const base =
      `http://127.0.0.1:${servidor.address().port}`;

    async function verificarLimite(ruta, limite) {
      for (let intento = 1; intento <= limite + 1; intento++) {
        const respuesta = await fetch(base + ruta, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            correo: 'prueba@example.com',
          }),
        });

        if (intento <= limite) {
          assert.equal(respuesta.status, 200);
        } else {
          assert.equal(respuesta.status, 429);

          const datos = await respuesta.json();

          assert.equal(
            datos.code,
            'RATE_LIMIT_EXCEEDED'
          );
        }
      }
    }

    await verificarLimite(
      '/api/auth/recuperar-password',
      5
    );

    await verificarLimite(
      '/api/auth/completar-recuperacion-password',
      10
    );

    assert.equal(llamadasSolicitud, 5);
    assert.equal(llamadasCompletar, 10);

  } finally {
    if (servidor) {
      await new Promise(resolve => servidor.close(resolve));
    }

    if (routerAnterior) {
      require.cache[rutaRouter] = routerAnterior;
    } else {
      delete require.cache[rutaRouter];
    }

    if (limiterAnterior) {
      require.cache[rutaLimiter] = limiterAnterior;
    } else {
      delete require.cache[rutaLimiter];
    }

    for (const [archivo, anterior] of modulosSimulados) {
      if (anterior) {
        require.cache[archivo] = anterior;
      } else {
        delete require.cache[archivo];
      }
    }
  }
});
