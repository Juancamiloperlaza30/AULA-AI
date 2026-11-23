'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const rutaSupabase = require.resolve(
  '../src/config/supabase'
);
const rutaAlertas = require.resolve(
  '../src/services/academicAlertService'
);
const originalLoad = Module._load;

const estudianteId =
  '123e4567-e89b-42d3-a456-426614174000';

let fixture;
let alertasEvaluadas;
let alertasResueltas;

class ConsultaSimulada {
  constructor(tabla) {
    this.tabla = tabla;
    this.accion = 'select';
    this.filtros = {};
    this.actualizacion = null;
  }

  select() { return this; }
  order() { return this; }
  range() { return this; }
  limit() { return this; }

  eq(campo, valor) {
    this.filtros[campo] = valor;
    return this;
  }

  in(campo, valor) {
    this.filtros[campo] = valor;
    return this;
  }

  lte(campo, valor) {
    this.filtros[campo] = valor;
    return this;
  }

  lt(campo, valor) {
    this.filtros[campo] = valor;
    return this;
  }

  update(valor) {
    this.accion = 'update';
    this.actualizacion = valor;
    return this;
  }

  maybeSingle() {
    return Promise.resolve(this.ejecutar());
  }

  ejecutar() {
    if (this.tabla === 'actividad_alertas_pendientes') {
      if (this.accion === 'select') {
        const trabajos =
          this.filtros.estado === 'pendiente'
            ? [fixture.trabajo]
            : [];
        return { data: trabajos, error: null };
      }

      if (this.actualizacion.estado === 'procesando') {
        return {
          data: {
            ...fixture.trabajo,
            estado: 'procesando',
          },
          error: null,
        };
      }

      return { data: null, error: null };
    }

    if (this.tabla === 'actividades_academicas') {
      return { data: fixture.actividad, error: null };
    }

    if (this.tabla === 'estudiantes') {
      return { data: fixture.estudiante, error: null };
    }

    if (this.tabla === 'entregas_actividades') {
      return { data: fixture.entrega, error: null };
    }

    throw new Error(`Consulta inesperada: ${this.tabla}`);
  }

  then(resolve, reject) {
    return Promise.resolve(this.ejecutar()).then(
      resolve,
      reject
    );
  }
}

const supabaseAdmin = {
  from(tabla) {
    return new ConsultaSimulada(tabla);
  },
};

let servicio;

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

    if (resolved === rutaAlertas) {
      return {
        registrarActividadIncumplida: async (datos) => {
          alertasEvaluadas.push(datos);
          return { accion: 'creada' };
        },
        resolverActividadIncumplida: async (datos) => {
          alertasResueltas.push(datos);
          return { accion: 'resuelta' };
        },
      };
    }

    return originalLoad.apply(this, arguments);
  };

  delete require.cache[
    require.resolve('../src/services/activityRiskAlertQueueService')
  ];
  servicio = require(
    '../src/services/activityRiskAlertQueueService'
  );
} finally {
  Module._load = originalLoad;
}

function prepararFixture(entrega = null) {
  const fechaEntrega = new Date(
    Date.now() - 60 * 60 * 1000
  ).toISOString();

  fixture = {
    trabajo: {
      id: 8,
      actividad_id: 17,
      estudiante_id: estudianteId,
      estado: 'pendiente',
      intentos: 0,
    },
    actividad: {
      id: 17,
      titulo: 'Taller de ciencias',
      estado: 'publicada',
      fecha_publicacion: new Date(
        Date.now() - 2 * 60 * 60 * 1000
      ).toISOString(),
      fecha_entrega: fechaEntrega,
      materia_grupo_periodo_id: 4,
      materia_grupo_periodo: {
        periodo_id: 2,
        grado_id: 3,
        grupo_id: 1,
        materia: { nombre: 'Ciencias' },
      },
    },
    estudiante: { usuario_id: estudianteId },
    entrega,
  };
  alertasEvaluadas = [];
  alertasResueltas = [];
}

test('Genera alerta únicamente para actividad publicada, vencida y sin entrega', async () => {
  prepararFixture();

  const resultado =
    await servicio.ejecutarColaAlertasActividades();

  assert.deepEqual(resultado, {
    procesados: 1,
    fallidos: 0,
  });
  assert.equal(alertasEvaluadas.length, 1);
  assert.equal(alertasEvaluadas[0].actividadId, 17);
  assert.equal(alertasEvaluadas[0].estudianteId, estudianteId);
  assert.equal(alertasResueltas.length, 0);
});

test('Resuelve la alerta existente cuando se registra una entrega válida', async () => {
  prepararFixture({
    id: 35,
    estado: 'entregada_tarde',
    fecha_entrega: new Date().toISOString(),
  });

  const resultado =
    await servicio.ejecutarColaAlertasActividades();

  assert.deepEqual(resultado, {
    procesados: 1,
    fallidos: 0,
  });
  assert.equal(alertasEvaluadas.length, 0);
  assert.equal(alertasResueltas.length, 1);
  assert.equal(
    alertasResueltas[0].motivo,
    'entrega_registrada'
  );
});
