'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const controllerPath = path.resolve(
  __dirname,
  '../src/controllers/attendanceController.js'
);

test('HU-14: la asistencia prioriza la asignación del período vigente', async () => {
  const originalLoad = Module._load;
  const originalController =
    require.cache[controllerPath];
  const hoy = '2026-06-15';
  let aseguramientos = 0;

  const asignaciones = [
    {
      id: 11,
      estado: 'activa',
      materia: { id: 4, nombre: 'Ciencias' },
      grado: { id: 8, nombre: 'Octavo' },
      grupo: { id: 3, nombre: 'A', activo: true },
      periodo: {
        id: 1,
        nombre: 'Período 1',
        activo: true,
        fecha_inicio: '2026-01-20',
        fecha_fin: '2026-03-27',
      },
    },
    {
      id: 22,
      estado: 'activa',
      materia: { id: 4, nombre: 'Ciencias' },
      grado: { id: 8, nombre: 'Octavo' },
      grupo: { id: 3, nombre: 'A', activo: true },
      periodo: {
        id: 2,
        nombre: 'Período 2',
        activo: true,
        fecha_inicio: '2026-06-01',
        fecha_fin: '2026-11-30',
      },
    },
  ];

  const supabaseAdmin = {
    from(tabla) {
      assert.equal(tabla, 'materia_docente');

      const consulta = {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        then(resolve, reject) {
          return Promise.resolve({
            data: asignaciones.map(
              (asignacion) => ({ asignacion })
            ),
            error: null,
          }).then(resolve, reject);
        },
      };

      return consulta;
    },
  };

  const respuesta = {
    codigo: 200,
    cuerpo: null,
    status(codigo) {
      this.codigo = codigo;
      return this;
    },
    json(cuerpo) {
      this.cuerpo = cuerpo;
      return this;
    },
  };

  try {
    Module._load = function(request, parent) {
      if (parent?.filename === controllerPath) {
        if (request === '../config/supabase') {
          return { supabaseAdmin };
        }

        if (
          request ===
          '../services/academicPeriodService'
        ) {
          return {
            asegurarAsignacionesPeriodoActual:
              async () => {
                aseguramientos += 1;
              },
            obtenerFechaAcademicaActual:
              () => hoy,
          };
        }
      }

      return originalLoad.apply(
        this,
        arguments
      );
    };

    delete require.cache[controllerPath];
    const {
      listarAsignaciones,
    } = require(controllerPath);

    await listarAsignaciones(
      { usuario: { id: 'docente-1' } },
      respuesta
    );

    assert.equal(respuesta.codigo, 200);
    assert.equal(aseguramientos, 1);
    assert.deepEqual(
      respuesta.cuerpo.asignaciones.map(
        (item) => item.id
      ),
      [22, 11]
    );
    assert.equal(
      respuesta.cuerpo.asignaciones[0]
        .periodo.esActual,
      true
    );
    assert.equal(
      respuesta.cuerpo.asignaciones[1]
        .periodo.fecha_fin,
      '2026-03-27'
    );
  } finally {
    Module._load = originalLoad;

    if (originalController) {
      require.cache[controllerPath] =
        originalController;
    } else {
      delete require.cache[controllerPath];
    }
  }
});
