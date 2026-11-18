'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const controllerPath = require.resolve(
  '../src/controllers/authController'
);
const supabasePath = require.resolve(
  '../src/config/supabase'
);
const auditPath = require.resolve(
  '../src/services/auditService'
);

test('RNF-01.6: verificar revocacion de sesiones', async () => {
  const rutas = [
    controllerPath,
    supabasePath,
    auditPath,
  ];

  const originales = new Map(
    rutas.map((ruta) => [ruta, require.cache[ruta]])
  );

  const eventos = [];
  const llamadasSignOut = [];

  let simularSignOut = async () => ({
    error: null,
  });

  function crearRespuesta() {
    return {
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
  }

  function crearSolicitud() {
    return {
      headers: {
        authorization: 'Bearer token-ficticio-prueba',
        'user-agent': 'RNF-01.6-Test',
      },
      usuario: {
        id: 'usuario-prueba-001',
        correo: 'prueba@example.com',
        rol: 'estudiante',
      },
      ip: '127.0.0.1',
    };
  }

  try {
    require.cache[supabasePath] = {
      id: supabasePath,
      filename: supabasePath,
      loaded: true,
      exports: {
        supabaseAuth: {},
        supabaseAdmin: {
          auth: {
            admin: {
              signOut: async (...args) => {
                llamadasSignOut.push(args);
                return simularSignOut(...args);
              },
            },
          },
        },
      },
    };

    require.cache[auditPath] = {
      id: auditPath,
      filename: auditPath,
      loaded: true,
      exports: {
        registrarAuditoria: async (datos) => {
          eventos.push(datos);
          return true;
        },
      },
    };

    delete require.cache[controllerPath];

    const { logout } = require(controllerPath);

    // ESCENARIO 1:
    // Supabase revoca correctamente la sesion.
    const respuestaExitosa = crearRespuesta();

    await logout(
      crearSolicitud(),
      respuestaExitosa
    );

    assert.equal(respuestaExitosa.codigo, 200);
    assert.equal(respuestaExitosa.cuerpo.success, true);
    assert.equal(llamadasSignOut.length, 1);
    assert.equal(llamadasSignOut[0][1], 'local');
    assert.equal(eventos.length, 1);
    assert.equal(eventos[0].evento, 'LOGOUT');

    // ESCENARIO 2:
    // Supabase devuelve un error de revocacion.
    eventos.length = 0;

    simularSignOut = async () => ({
      error: {
        message: 'Fallo simulado de Supabase',
      },
    });

    const respuestaFallida = crearRespuesta();

    await logout(
      crearSolicitud(),
      respuestaFallida
    );

    assert.ok(
      respuestaFallida.codigo >= 500 &&
      respuestaFallida.codigo < 600,
      'El backend debe informar un error del servidor si falla la revocacion.'
    );

    assert.equal(
      respuestaFallida.cuerpo.success,
      false
    );

    assert.equal(
      eventos.some((evento) => evento.evento === 'LOGOUT'),
      false,
      'No debe registrarse LOGOUT exitoso cuando falla la revocacion.'
    );
  } finally {
    for (const [ruta, original] of originales) {
      if (original) {
        require.cache[ruta] = original;
      } else {
        delete require.cache[ruta];
      }
    }
  }
});
