'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const archivo = path.resolve(
  __dirname,
  '../src/services/academicAlertService.js'
);

const codigo = fs.readFileSync(archivo, 'utf8');

const inicio = codigo.indexOf(
  'async function actualizarAlerta(actual, nuevo)'
);

const fin = codigo.indexOf(
  'async function guardarAlerta(',
  inicio
);

assert.ok(
  inicio >= 0 && fin > inicio,
  'No se encontró la función actualizarAlerta.'
);

const funcion = codigo.slice(inicio, fin);

const condicionProteccion =
  /anterior\.estado\s*===\s*ESTADOS\.RESUELTA\s*&&\s*anterior\.cierre_manual_at\s*\)\s*\{\s*return\s*\{\s*accion:\s*['"]cierre_manual_conservado['"]/;

assert.match(
  funcion,
  condicionProteccion,
  'No se encontró la protección integral del cierre manual.'
);

console.log('====================================');
console.log('HU-10 | REVISIÓN DE LÓGICA');
console.log('====================================');
console.log('Función actualizarAlerta: encontrada.');
console.log('Protección integral: encontrada.');
console.log('No se realizaron cambios en Supabase.');
console.log('====================================');
console.log('REVISIÓN ESTÁTICA EXITOSA');
console.log('====================================');
