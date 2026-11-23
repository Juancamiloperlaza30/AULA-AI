'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const rutaSupabase = require.resolve('../src/config/supabase');
const rutaServicio = require.resolve(
  '../src/services/notificacionRegistroService'
);
const originalLoad = Module._load;
let registrosCapturados = [];
let errorSimulado = null;
let servicio;

const supabaseAdmin = {
  from(tabla) {
    assert.equal(tabla, 'notificaciones');
    return {
      upsert(registros, opciones) {
        registrosCapturados.push({ registros, opciones });
        return {
          select: async () => ({ error: errorSimulado }),
        };
      },
    };
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
      return { supabaseAdmin };
    }
    return originalLoad.apply(this, arguments);
  };
  delete require.cache[rutaServicio];
  servicio = require(rutaServicio);
} finally {
  Module._load = originalLoad;
}

test('registra destinatarios únicos con clave idempotente por usuario', async () => {
  registrosCapturados = [];
  errorSimulado = null;

  const resultado = await servicio.registrarNotificaciones({
    destinatarios: ['usuario-a', 'usuario-a', '', null],
    tipo: 'comunicado',
    titulo: 'Nuevo comunicado',
    mensaje: 'Consulta AULA-AI.',
    recursoTipo: 'comunicado',
    recursoId: 25,
    eventoClave: 'comunicado:25',
  });

  assert.deepEqual(resultado, {
    destinatarios: 1,
    registradas: 1,
  });
  assert.equal(registrosCapturados.length, 1);
  assert.equal(
    registrosCapturados[0].registros[0].evento_clave,
    'comunicado:25:usuario-a'
  );
  assert.equal(
    registrosCapturados[0].opciones.ignoreDuplicates,
    true
  );
});

test('no oculta fallos de persistencia', async () => {
  registrosCapturados = [];
  errorSimulado = new Error('fallo de base simulado');

  await assert.rejects(
    servicio.registrarNotificaciones({
      destinatarios: ['usuario-a'],
      tipo: 'comunicado',
      titulo: 'Nuevo comunicado',
      mensaje: 'Consulta AULA-AI.',
      recursoTipo: 'comunicado',
      recursoId: 25,
      eventoClave: 'comunicado:25',
    }),
    /fallo de base simulado/
  );
  errorSimulado = null;
});
