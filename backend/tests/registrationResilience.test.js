'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const controllerPath = require.resolve('../src/controllers/userController');
const supabasePath = require.resolve('../src/config/supabase');
const auditPath = require.resolve('../src/services/auditService');

test('RNF-02: recuperación de fallo parcial y prevención de duplicados', async () => {
  const rutas = [controllerPath, supabasePath, auditPath];
  const originales = new Map(
    rutas.map((ruta) => [ruta, require.cache[ruta]])
  );

  let fallarInsercion = true;
  let perfil = null;
  let cuentasAuthCreadas = 0;
  let auditoriasExitosas = 0;
  const cuentasAuthEliminadas = [];

  const supabaseAdmin = {
    auth: {
      admin: {
        async createUser() {
          cuentasAuthCreadas++;

          return {
            data: {
              user: {
                id: `usuario-rnf02-${cuentasAuthCreadas}`,
              },
            },
            error: null,
          };
        },

        async deleteUser(id) {
          cuentasAuthEliminadas.push(id);
          return { error: null };
        },
      },
    },

    from(tabla) {
      assert.equal(tabla, 'usuarios');

      return {
        select() {
          return this;
        },

        eq() {
          return this;
        },

        async maybeSingle() {
          return {
            data: perfil ? { id: perfil.id } : null,
            error: null,
          };
        },

        async insert(datos) {
          if (fallarInsercion) {
            return {
              error: {
                code: '23505',
                message: 'Conflicto de unicidad simulado',
              },
            };
          }

          perfil = datos;
          return { error: null };
        },
      };
    },
  };

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
    body: {
      nombres: 'Usuario',
      apellidos: 'De Prueba',
      tipoDocumento: 'CC',
      numeroDocumento: '87654321',
      correo: 'rnf02-prueba@example.com',
      telefono: '3001234567',
      rol: 'docente',
    },

    usuario: {
      id: 'administrador-prueba',
      correo: 'admin@example.com',
      rol: 'administrador',
    },

    headers: {},
    ip: '127.0.0.1',
  };

  try {
    require.cache[supabasePath] = {
      id: supabasePath,
      filename: supabasePath,
      loaded: true,
      exports: { supabaseAdmin },
    };

    require.cache[auditPath] = {
      id: auditPath,
      filename: auditPath,
      loaded: true,
      exports: {
        registrarAuditoria: async () => {
          auditoriasExitosas++;
          return true;
        },
      },
    };

    delete require.cache[controllerPath];

    const { registrarUsuario } = require(controllerPath);

    // 1. Simular un fallo después de crear la cuenta Auth.
    const primera = crearRespuesta();
    await registrarUsuario(solicitud, primera);

    assert.equal(primera.codigo, 409);
    assert.equal(perfil, null);
    assert.deepEqual(
      cuentasAuthEliminadas,
      ['usuario-rnf02-1']
    );
    assert.equal(auditoriasExitosas, 0);

    // 2. Recuperarse del fallo y registrar correctamente.
    fallarInsercion = false;

    const segunda = crearRespuesta();
    await registrarUsuario(solicitud, segunda);

    assert.equal(segunda.codigo, 201);
    assert.equal(segunda.cuerpo.success, true);
    assert.equal(perfil.id, 'usuario-rnf02-2');
    assert.equal(auditoriasExitosas, 1);

    // 3. Evitar que un nuevo reintento genere otro usuario.
    const tercera = crearRespuesta();
    await registrarUsuario(solicitud, tercera);

    assert.equal(tercera.codigo, 409);
    assert.equal(cuentasAuthCreadas, 2);
    assert.equal(auditoriasExitosas, 1);
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
