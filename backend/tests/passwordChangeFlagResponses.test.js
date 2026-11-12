'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rutaController = path.join(
  __dirname,
  '../src/controllers/authController.js'
);

const rutaRoutes = path.join(
  __dirname,
  '../src/routes/authRoutes.js'
);

const controller = fs.readFileSync(
  rutaController,
  'utf8'
);

const routes = fs.readFileSync(
  rutaRoutes,
  'utf8'
);

const expresionSegura =
  /(?:req\.)?usuario\.debe_cambiar_password\s*!==\s*false/g;

const expresionInsegura =
  /(?:req\.)?usuario\.debe_cambiar_password\s*===\s*true/g;

test('Login y refresh utilizan la regla segura', () => {
  const coincidencias = controller.match(
    expresionSegura
  ) || [];

  assert.equal(coincidencias.length, 2);
});

test('La ruta /me utiliza la regla segura', () => {
  const coincidencias = routes.match(
    expresionSegura
  ) || [];

  assert.equal(coincidencias.length, 1);
});

test('El controlador no utiliza la comparación insegura', () => {
  assert.equal(
    expresionInsegura.test(controller),
    false
  );
});

test('Las rutas de autenticación no utilizan la comparación insegura', () => {
  assert.equal(
    expresionInsegura.test(routes),
    false
  );
});

test('La regla segura bloquea valores inesperados', () => {
  const requiereCambio = (valor) =>
    valor !== false;

  assert.equal(requiereCambio(false), false);
  assert.equal(requiereCambio(true), true);
  assert.equal(requiereCambio(null), true);
  assert.equal(requiereCambio(undefined), true);
  assert.equal(requiereCambio('false'), true);
  assert.equal(requiereCambio(0), true);
});