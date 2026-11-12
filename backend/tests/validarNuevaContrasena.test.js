'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validarNuevaContrasena,
} = require('../src/utils/validarNuevaContrasena');

const casos = [
  ['Acepta una contraseña válida', 'AulaSegura2026', 'AulaSegura2026', true],
  ['Rechaza contraseña vacía', '', '', false],
  ['Rechaza contraseña corta', 'Ab123', 'Ab123', false],
  ['Rechaza contraseña sin mayúscula', 'aulasegura2026', 'aulasegura2026', false],
  ['Rechaza contraseña sin minúscula', 'AULASEGURA2026', 'AULASEGURA2026', false],
  ['Rechaza contraseña sin número', 'AulaSegura', 'AulaSegura', false],
  ['Rechaza confirmación diferente', 'AulaSegura2026', 'OtraClave2026', false],
  ['Rechaza contraseña numérica', 12345678, 12345678, false],
  ['Rechaza confirmación ausente', 'AulaSegura2026', undefined, false],
  ['Rechaza contraseña nula', null, null, false],
];

for (const [nombre, password, confirmacion, esperado] of casos) {
  test(nombre, () => {
    const resultado = validarNuevaContrasena(
      password,
      confirmacion
    );

    assert.equal(resultado.valida, esperado);
    assert.equal(typeof resultado, 'object');

    if (esperado) {
      assert.equal(resultado.mensaje, null);
    } else {
      assert.equal(typeof resultado.mensaje, 'string');
      assert.ok(resultado.mensaje.length > 0);
    }
  });
}