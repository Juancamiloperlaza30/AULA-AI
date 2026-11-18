'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');

const auditPath = require.resolve(
  '../src/services/auditService'
);

const middlewarePath = require.resolve(
  '../src/middleware/registrationAuditMiddleware'
);

test('RNF-02.8: audita registros rechazados y fallidos sin datos sensibles', async () => {
  const originalAudit = require.cache[auditPath];
  const originalMiddleware = require.cache[middlewarePath];

  const eventos = [];

  try {
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

    const {
      auditarRegistroFallido,
    } = require(middlewarePath);

    const casos = [
      { status: 201, evento: null },
      { status: 400, evento: 'REGISTRO_USUARIO_RECHAZADO' },
      { status: 401, evento: 'REGISTRO_USUARIO_RECHAZADO' },
      { status: 403, evento: 'REGISTRO_USUARIO_RECHAZADO' },
      { status: 409, evento: 'REGISTRO_USUARIO_RECHAZADO' },
      { status: 500, evento: 'REGISTRO_USUARIO_FALLIDO' },
    ];

    for (const caso of casos) {
      const anterior = eventos.length;
      const respuesta = new EventEmitter();

      respuesta.statusCode = caso.status;

      const solicitud = {
        usuario: {
          id: 'admin-prueba',
          rol: 'administrador',
        },
        body: {
          nombres: 'Ana',
          numeroDocumento: '12345678',
          correo: 'privado@example.com',
          contrasena: 'SECRETO_PRUEBA',
          accessToken: 'TOKEN_PRIVADO_PRUEBA',
        },
      };

      let ejecucionesNext = 0;

      auditarRegistroFallido(
        solicitud,
        respuesta,
        () => {
          ejecucionesNext++;
        }
      );

      assert.equal(ejecucionesNext, 1);

      respuesta.emit('finish');

      await new Promise((resolve) => setImmediate(resolve));

      if (caso.evento === null) {
        assert.equal(eventos.length, anterior);
        continue;
      }

      assert.equal(eventos.length, anterior + 1);

      const registrado = eventos.at(-1);

      assert.equal(registrado.evento, caso.evento);
      assert.equal(registrado.usuarioId, 'admin-prueba');
      assert.equal(
        registrado.metadata.codigoHttp,
        caso.status
      );

      const contenidoAuditoria = JSON.stringify(registrado);

      for (const datoSensible of [
        '12345678',
        'privado@example.com',
        'SECRETO_PRUEBA',
        'TOKEN_PRIVADO_PRUEBA',
      ]) {
        assert.equal(
          contenidoAuditoria.includes(datoSensible),
          false,
          'La auditoría no debe incluir datos sensibles.'
        );
      }
    }
  } finally {
    if (originalAudit) {
      require.cache[auditPath] = originalAudit;
    } else {
      delete require.cache[auditPath];
    }

    if (originalMiddleware) {
      require.cache[middlewarePath] = originalMiddleware;
    } else {
      delete require.cache[middlewarePath];
    }
  }
});

test('RNF-02.5 y 02.8: ruta de registro conserva roles y auditoría', () => {
  const archivo = path.join(
    __dirname,
    '../src/routes/userRoutes.js'
  );

  const contenido = fs.readFileSync(archivo, 'utf8');

  const coincidencia = contenido.match(
    /router\.post\(\s*['"]\/['"]\s*,([\s\S]*?)registrarUsuario\s*\)/
  );

  assert.ok(
    coincidencia,
    'Debe existir POST /api/users con registrarUsuario.'
  );

  const ruta = coincidencia[1];

  assert.ok(ruta.includes('auditarRegistroFallido'));
  assert.ok(ruta.includes('verificarToken'));
  assert.ok(ruta.includes('permitirRoles'));
  assert.ok(ruta.includes("'administrador'"));
  assert.ok(ruta.includes("'coordinador'"));

  assert.ok(
    ruta.indexOf('auditarRegistroFallido') <
      ruta.indexOf('verificarToken')
  );

  assert.ok(
    ruta.indexOf('verificarToken') <
      ruta.indexOf('permitirRoles')
  );

  assert.ok(
    ruta.indexOf('permitirRoles') <
      ruta.indexOf('registrarUsuario')
      || !ruta.includes('registrarUsuario')
  );
});
