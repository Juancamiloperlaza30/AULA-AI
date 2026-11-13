'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const middlewarePath = require.resolve(
  '../src/middleware/authMiddleware'
);

const auditPath = require.resolve(
  '../src/services/auditService'
);

const supabasePath = require.resolve(
  '../src/config/supabase'
);

test('RNF-01: audita accesos denegados sin alterar permisos', async () => {
  const eventos = [];

  const modulosOriginales = new Map();

  for (const ruta of [supabasePath, auditPath, middlewarePath]) {
    modulosOriginales.set(ruta, require.cache[ruta]);
  }

  try {
    require.cache[supabasePath] = {
      id: supabasePath,
      filename: supabasePath,
      loaded: true,
      exports: {
        supabaseAuth: {},
        supabaseAdmin: {},
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

    delete require.cache[middlewarePath];

    const { permitirRoles } = require(middlewarePath);

    const crearRespuesta = () => ({
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
    });

    const solicitud = {
      usuario: {
        id: 'usuario-prueba-001',
        correo: 'prueba@example.com',
        rol: 'estudiante',
      },
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'RNF-01-Test',
      },
      method: 'GET',
      path: '/ruta-protegida',
    };

    const respuestaDenegada = crearRespuesta();
    let accesoConcedido = false;

    permitirRoles('administrador')(
      solicitud,
      respuestaDenegada,
      () => {
        accesoConcedido = true;
      }
    );

    assert.equal(respuestaDenegada.codigo, 403);
    assert.equal(accesoConcedido, false);

    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(eventos.length, 1);
    assert.equal(eventos[0].evento, 'ACCESO_DENEGADO');
    assert.equal(eventos[0].rol, 'estudiante');
    assert.equal(eventos[0].usuarioId, 'usuario-prueba-001');
    assert.equal(eventos[0].metadata.metodo, 'GET');
    assert.equal(eventos[0].metadata.ruta, '/ruta-protegida');

    const datos = JSON.stringify(eventos[0]);

    assert.equal(datos.includes('accessToken'), false);
    assert.equal(datos.includes('refreshToken'), false);
    assert.equal(datos.includes('contrasena'), false);

    const respuestaAutorizada = crearRespuesta();
    let autorizado = false;

    permitirRoles('estudiante')(
      solicitud,
      respuestaAutorizada,
      () => {
        autorizado = true;
      }
    );

    assert.equal(autorizado, true);

    const respuestaSinUsuario = crearRespuesta();

    permitirRoles('administrador')(
      { headers: {} },
      respuestaSinUsuario,
      () => {}
    );

    assert.equal(respuestaSinUsuario.codigo, 401);

    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(eventos.length, 1);
  } finally {
    for (const [ruta, original] of modulosOriginales) {
      if (original) {
        require.cache[ruta] = original;
      } else {
        delete require.cache[ruta];
      }
    }
  }
});
