'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const controllerPath = require.resolve(
  '../src/controllers/userController'
);
const supabasePath = require.resolve(
  '../src/config/supabase'
);
const auditPath = require.resolve(
  '../src/services/auditService'
);

test('RNF-02.1: registro con contraseña temporal segura', async () => {
  const originales = new Map(
    [controllerPath, supabasePath, auditPath].map(
      (ruta) => [ruta, require.cache[ruta]]
    )
  );

  const credenciales = [];

  try {
    require.cache[supabasePath] = {
      id: supabasePath,
      filename: supabasePath,
      loaded: true,
      exports: {
        supabaseAdmin: {
          auth: {
            admin: {
              async createUser(datos) {
                credenciales.push(datos);
                return {
                  data: {
                    user: {
                      id: `usuario-prueba-${credenciales.length}`,
                    },
                  },
                  error: null,
                };
              },
            },
          },
          from(tabla) {
            assert.equal(tabla, 'usuarios');
            return {
              select() { return this; },
              eq() { return this; },
              async maybeSingle() {
                return { data: null, error: null };
              },
              async insert() {
                return { error: null };
              },
            };
          },
        },
      },
    };

    require.cache[auditPath] = {
      id: auditPath,
      filename: auditPath,
      loaded: true,
      exports: {
        registrarAuditoria: async () => true,
      },
    };

    delete require.cache[controllerPath];

    const { registrarUsuario } = require(controllerPath);

    for (let i = 0; i < 2; i++) {
      const documento = `1234567${i}`;
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

      await registrarUsuario({
        body: {
          nombres: 'Usuario',
          apellidos: 'Prueba',
          tipoDocumento: 'CC',
          numeroDocumento: documento,
          correo: `rnf02-${i}@example.com`,
          telefono: '3001234567',
          rol: 'docente',
        },
        usuario: {
          id: 'admin-prueba',
          correo: 'admin@example.com',
          rol: 'administrador',
        },
        headers: {},
        ip: '127.0.0.1',
      }, respuesta);

      assert.equal(respuesta.codigo, 201);
      assert.equal(respuesta.cuerpo.success, true);

      const password = credenciales[i].password;

      assert.ok(password.length >= 40);
      assert.notEqual(password, documento);
      assert.match(password, /[A-Z]/);
      assert.match(password, /[a-z]/);
      assert.match(password, /[0-9]/);
      assert.match(password, /[^A-Za-z0-9]/);

      assert.equal(
        JSON.stringify(respuesta.cuerpo).includes(password),
        false
      );
    }

    assert.notEqual(
      credenciales[0].password,
      credenciales[1].password
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
