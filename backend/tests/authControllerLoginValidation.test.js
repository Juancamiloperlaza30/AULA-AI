'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const rutaSupabase = require.resolve('../src/config/supabase');
const rutaAuditoria = require.resolve('../src/services/auditService');
const rutaControlador = require.resolve(
  '../src/controllers/authController'
);
const originalLoad = Module._load;

let intentosAuth = 0;
let login;
const supabaseAuth = {
  auth: {
    async signInWithPassword() {
      intentosAuth += 1;
      return {
        data: { user: null, session: null },
        error: new Error('Invalid login credentials'),
      };
    },
  },
};

try {
  Module._load = function(request, parent, isMain) {
    const resolved = Module._resolveFilename(
      request,
      parent,
      isMain
    );
    if (resolved === rutaSupabase) {
      return { supabaseAuth, supabaseAdmin: {} };
    }
    if (resolved === rutaAuditoria) {
      return { registrarAuditoria: async () => true };
    }
    return originalLoad.apply(this, arguments);
  };
  delete require.cache[rutaControlador];
  login = require(rutaControlador).login;
} finally {
  Module._load = originalLoad;
}

function crearRespuesta() {
  return {
    statusCode: 200,
    body: null,
    status(codigo) {
      this.statusCode = codigo;
      return this;
    },
    json(contenido) {
      this.body = contenido;
      return this;
    },
  };
}

test('rechaza formato de correo inválido antes de consultar Auth', async () => {
  intentosAuth = 0;
  const res = crearRespuesta();

  await login(
    {
      body: { correo: 'correo-invalido', contrasena: 'clave' },
      headers: {},
    },
    res
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /correo electrónico es inválido/i);
  assert.equal(intentosAuth, 0);
});

test('mantiene un mensaje genérico para credenciales incorrectas', async () => {
  intentosAuth = 0;
  const res = crearRespuesta();

  await login(
    {
      body: { correo: 'persona@colegio.edu', contrasena: 'clave' },
      headers: {},
      ip: '127.0.0.1',
    },
    res
  );

  assert.equal(res.statusCode, 401);
  assert.equal(
    res.body.message,
    'Correo o contraseña incorrectos.'
  );
  assert.equal(intentosAuth, 1);
});
