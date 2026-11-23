'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const rutaSupabase = require.resolve(
  '../src/config/supabase'
);
const rutaPush = require.resolve(
  '../src/services/pushService'
);
const originalLoad = Module._load;

let academicAlertService;

try {
  Module._load = function(request, parent, isMain) {
    const resolved = Module._resolveFilename(
      request,
      parent,
      isMain
    );

    if (resolved === rutaSupabase) {
      return { supabaseAdmin: {} };
    }

    if (resolved === rutaPush) {
      return {
        enviarNotificacionesMultiples: async () => ({
          successCount: 0,
          failureCount: 0,
        }),
      };
    }

    return originalLoad.apply(this, arguments);
  };

  delete require.cache[
    require.resolve('../src/services/academicAlertService')
  ];
  academicAlertService = require(
    '../src/services/academicAlertService'
  );
} finally {
  Module._load = originalLoad;
}

test('La clasificación aplica umbrales deterministas y no evalúa materias sin notas', () => {
  assert.equal(
    academicAlertService.clasificarRendimiento({
      promedio: 2.99,
      cantidadNotas: 1,
    }).estado,
    'riesgo'
  );
  assert.equal(
    academicAlertService.clasificarRendimiento({
      promedio: 3,
      cantidadNotas: 1,
    }).estado,
    'atencion'
  );
  assert.equal(
    academicAlertService.clasificarRendimiento({
      promedio: 3.5,
      cantidadNotas: 1,
    }).estado,
    'favorable'
  );
  assert.equal(
    academicAlertService.clasificarRendimiento({
      promedio: null,
      cantidadNotas: 0,
    }).estado,
    'sin_datos'
  );
});

test('No se genera alerta por una actividad cuyo plazo todavía está vigente', async () => {
  const resultado =
    await academicAlertService.registrarActividadIncumplida({
      estudianteId: '123e4567-e89b-42d3-a456-426614174000',
      actividadId: 7,
      tituloActividad: 'Trabajo de ciencias',
      materiaNombre: 'Ciencias',
      periodoId: 2,
      fechaEntrega: new Date(
        Date.now() + 60 * 60 * 1000
      ).toISOString(),
    });

  assert.equal(resultado.accion, 'plazo_vigente');
  assert.equal(resultado.alerta, null);
});
