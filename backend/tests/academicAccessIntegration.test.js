'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const {
  requirePasswordChangeCompleted,
} = require('../src/middleware/requirePasswordChangeCompleted');

const roles = [
  'administrador',
  'coordinador',
  'orientador',
  'docente',
  'estudiante',
  'acudiente',
];

async function ejecutarSolicitud(usuario) {
  const app = express();

  const verificarTokenSimulado = (req, res, next) => {
    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado.',
      });
    }

    req.usuario = usuario;
    next();
  };

  app.get(
    '/api/academic/prueba',
    verificarTokenSimulado,
    requirePasswordChangeCompleted,
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

    const direccion = servidor.address();

    const respuesta = await fetch(
      `http://127.0.0.1:${direccion.port}/api/academic/prueba`
    );

    return {
      status: respuesta.status,
      body: await respuesta.json(),
    };
  } finally {
    await new Promise((resolve) => servidor.close(resolve));
  }
}

test('Rechaza solicitudes sin autenticacion', async () => {
  const resultado = await ejecutarSolicitud(null);

  assert.equal(resultado.status, 401);
});

for (const rol of roles) {
  test(`Bloquea cambio pendiente: ${rol}`, async () => {
    const resultado = await ejecutarSolicitud({
      id: 'usuario-simulado',
      rol,
      debe_cambiar_password: true,
    });

    assert.equal(resultado.status, 403);

    assert.equal(
      resultado.body.code,
      'PASSWORD_CHANGE_REQUIRED'
    );
  });

  test(`Permite cambio completado: ${rol}`, async () => {
    const resultado = await ejecutarSolicitud({
      id: 'usuario-simulado',
      rol,
      debe_cambiar_password: false,
    });

    assert.equal(resultado.status, 200);
    assert.equal(resultado.body.rol, rol);
  });
}

test('Bloquea indicador ausente', async () => {
  const resultado = await ejecutarSolicitud({
    id: 'usuario-simulado',
    rol: 'docente',
  });

  assert.equal(resultado.status, 403);

  assert.equal(
    resultado.body.code,
    'PASSWORD_CHANGE_REQUIRED'
  );
});

test('Bloquea indicador null', async () => {
  const resultado = await ejecutarSolicitud({
    id: 'usuario-simulado',
    rol: 'estudiante',
    debe_cambiar_password: null,
  });

  assert.equal(resultado.status, 403);
});