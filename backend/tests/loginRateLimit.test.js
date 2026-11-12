'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const {
  limitarLogin,
} = require('../src/middleware/loginRateLimit');

test('RNF-01: limita intentos fallidos de login', async () => {
  const app = express();

  app.set('trust proxy', false);

  app.post('/login', limitarLogin, (req, res) => {
    res.status(401).json({
      success: false,
      message: 'Credenciales incorrectas.',
    });
  });

  const servidor = app.listen(0, '127.0.0.1');

  try {
    await new Promise((resolve) => {
      servidor.once('listening', resolve);
    });

    const puerto = servidor.address().port;
    const url = `http://127.0.0.1:${puerto}/login`;

    for (let intento = 1; intento <= 10; intento++) {
      const respuesta = await fetch(url, {
        method: 'POST',
      });

      assert.equal(respuesta.status, 401);
    }

    const respuestaBloqueada = await fetch(url, {
      method: 'POST',
    });

    assert.equal(respuestaBloqueada.status, 429);

    const cuerpo = await respuestaBloqueada.json();

    assert.equal(
      cuerpo.code,
      'LOGIN_RATE_LIMIT_EXCEEDED'
    );

    assert.equal(cuerpo.success, false);

    assert.equal(
      JSON.stringify(cuerpo).includes('accessToken'),
      false
    );

    assert.equal(
      JSON.stringify(cuerpo).includes('refreshToken'),
      false
    );
  } finally {
    await new Promise((resolve) => {
      servidor.close(resolve);
    });
  }
});
