'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const rutaServicio = path.resolve(
  __dirname,
  '../src/services/activityNotificationService.js'
);

async function ejecutarEscenario(escenario) {
  const llamadasUpsert = [];
  const actualizaciones = [];
  const llamadasPush = [];

  const supabaseAdmin = {
    from(tabla) {
      let actualizacion;
      const filtros = [];

      const consulta = {
        upsert(registros, opciones) {
          llamadasUpsert.push({
            tabla,
            registros,
            opciones,
          });
          return Promise.resolve({ error: null });
        },
        update(valores) {
          actualizacion = valores;
          return this;
        },
        select() {
          return this;
        },
        eq(campo, valor) {
          filtros.push({ campo, valor });
          return this;
        },
        in(campo, valores) {
          filtros.push({ campo, valores });
          return this;
        },
        lt(campo, valor) {
          filtros.push({ campo, valor });
          return this;
        },
        then(resolve, reject) {
          if (tabla === 'recordatorios_actividades') {
            actualizaciones.push({
              valores: actualizacion,
              filtros,
            });
          }

          const esReserva =
            actualizacion?.estado_envio === 'procesando';
          const data = esReserva
            ? escenario.reservados || []
            : tabla === 'dispositivos_push'
            ? escenario.dispositivos || []
            : null;

          return Promise.resolve({
            data,
            error: null,
          }).then(resolve, reject);
        },
      };

      return consulta;
    },
  };

  const cargarOriginal = Module._load;

  const cargarMock = function(request, parent) {
    if (
      parent?.filename === rutaServicio &&
      request === '../config/supabase'
    ) {
      return { supabaseAdmin };
    }

    if (
      parent?.filename === rutaServicio &&
      request === './pushService'
    ) {
      return {
        enviarNotificacionesMultiples:
          async (parametros) => {
            llamadasPush.push(parametros);
            return {
              responses:
                escenario.respuestas || [],
            };
          },
      };
    }

    return cargarOriginal.apply(this, arguments);
  };

  let servicio;

  try {
    Module._load = cargarMock;
    delete require.cache[rutaServicio];
    servicio = require(rutaServicio);
  } finally {
    Module._load = cargarOriginal;
    delete require.cache[rutaServicio];
  }

  const resultado =
    await servicio.encolarNotificacionesActividad({
      actividadId: 23,
      estudianteIds: ['estudiante-1', 'estudiante-1', 'estudiante-2'],
      tipoRecordatorio: 'publicacion',
      titulo: 'Nueva tarea',
      mensaje: 'Lectura - Matemáticas',
      data: {
        tipo: 'actividad_publicada',
        actividadId: 23,
      },
    });

  return {
    resultado,
    llamadasUpsert,
    actualizaciones,
    llamadasPush,
  };
}

test('RNF-04.8: reserva destinatarios una vez y conserva fallos para reintento', async () => {
  const {
    resultado,
    llamadasUpsert,
    actualizaciones,
    llamadasPush,
  } = await ejecutarEscenario({
    reservados: [
      { estudiante_id: 'estudiante-1' },
      { estudiante_id: 'estudiante-2' },
    ],
    dispositivos: [
      {
        usuario_id: 'estudiante-1',
        token_fcm: 'token-1',
      },
      {
        usuario_id: 'estudiante-2',
        token_fcm: 'token-2',
      },
    ],
    respuestas: [
      { success: true },
      { success: false },
    ],
  });

  assert.equal(llamadasUpsert.length, 1);
  assert.equal(
    llamadasUpsert[0].opciones.onConflict,
    'actividad_id,estudiante_id,tipo_recordatorio'
  );
  assert.equal(
    llamadasUpsert[0].opciones.ignoreDuplicates,
    true
  );
  assert.equal(llamadasUpsert[0].registros.length, 2);
  assert.equal(llamadasPush.length, 1);
  assert.equal(llamadasPush[0].tokens.length, 2);
  assert.deepEqual(resultado, {
    success: false,
    enviados: 1,
    pendientes: 1,
  });

  assert.ok(
    actualizaciones.some(
      (actualizacion) =>
        actualizacion.valores.estado_envio === 'enviado' &&
        actualizacion.filtros.some(
          (filtro) =>
            filtro.campo === 'estudiante_id' &&
            filtro.valores[0] === 'estudiante-1'
        )
    )
  );
  assert.ok(
    actualizaciones.some(
      (actualizacion) =>
        actualizacion.valores.estado_envio === 'pendiente' &&
        actualizacion.filtros.some(
          (filtro) =>
            filtro.campo === 'estudiante_id' &&
            filtro.valores[0] === 'estudiante-2'
        )
    )
  );
});

test('RNF-04.8: no reenvía destinatarios ya reservados por otro proceso', async () => {
  const {
    resultado,
    llamadasPush,
  } = await ejecutarEscenario({
    reservados: [],
  });

  assert.deepEqual(resultado, {
    success: true,
    enviados: 0,
  });
  assert.equal(llamadasPush.length, 0);
});
