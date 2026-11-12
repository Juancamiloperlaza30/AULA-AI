
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  requirePasswordChangeCompleted,
} = require('../src/middleware/requirePasswordChangeCompleted');

function ejecutarMiddleware(usuario) {
  const resultado = {
    status: null,
    body: null,
    nextCalled: false,
  };

  const req = { usuario };

  const res = {
    status(codigo) {
      resultado.status = codigo;
      return this;
    },

    json(datos) {
      resultado.body = datos;
      return this;
    },
  };

  const next = () => {
    resultado.nextCalled = true;
  };

  requirePasswordChangeCompleted(req, res, next);

  return resultado;
}

test('Rechaza solicitudes sin usuario autenticado', () => {
  const resultado = ejecutarMiddleware(undefined);

  assert.equal(resultado.status, 401);
  assert.equal(resultado.nextCalled, false);
  assert.equal(resultado.body.success, false);
});

test('Bloquea usuarios con cambio obligatorio pendiente', () => {
  const resultado = ejecutarMiddleware({
    id: 'usuario-prueba',
    rol: 'estudiante',
    debe_cambiar_password: true,
  });

  assert.equal(resultado.status, 403);
  assert.equal(resultado.nextCalled, false);
  assert.equal(
    resultado.body.code,
    'PASSWORD_CHANGE_REQUIRED'
  );
});

test('Permite usuarios con contraseña actualizada', () => {
  const resultado = ejecutarMiddleware({
    id: 'usuario-prueba',
    rol: 'estudiante',
    debe_cambiar_password: false,
  });

  assert.equal(resultado.status, null);
  assert.equal(resultado.nextCalled, true);
});

const roles = [
  'administrador',
  'coordinador',
  'orientador',
  'docente',
  'estudiante',
  'acudiente',
];

for (const rol of roles) {
  test(`Permite al rol ${rol} sin cambio pendiente`, () => {
    const resultado = ejecutarMiddleware({
      id: `prueba-${rol}`,
      rol,
      debe_cambiar_password: false,
    });

    assert.equal(resultado.nextCalled, true);
    assert.equal(resultado.status, null);
  });

  test(`Bloquea al rol ${rol} con cambio pendiente`, () => {
    const resultado = ejecutarMiddleware({
      id: `prueba-${rol}`,
      rol,
      debe_cambiar_password: true,
    });

    assert.equal(resultado.nextCalled, false);
    assert.equal(resultado.status, 403);
    assert.equal(
      resultado.body.code,
      'PASSWORD_CHANGE_REQUIRED'
    );
  });
}

test('Bloquea cuando falta el indicador de contraseña', () => {
  const resultado = ejecutarMiddleware({
    id: 'usuario-sin-indicador',
    rol: 'estudiante',
  });

  assert.equal(resultado.status, 403);
  assert.equal(resultado.nextCalled, false);
  assert.equal(
    resultado.body.code,
    'PASSWORD_CHANGE_REQUIRED'
  );
});

test('Bloquea cuando el indicador es null', () => {
  const resultado = ejecutarMiddleware({
    id: 'usuario-indicador-null',
    rol: 'docente',
    debe_cambiar_password: null,
  });

  assert.equal(resultado.status, 403);
  assert.equal(resultado.nextCalled, false);
});

test('Bloquea cuando el indicador tiene un valor inesperado', () => {
  const resultado = ejecutarMiddleware({
    id: 'usuario-indicador-invalido',
    rol: 'administrador',
    debe_cambiar_password: 'false',
  });

  assert.equal(resultado.status, 403);
  assert.equal(resultado.nextCalled, false);
});
