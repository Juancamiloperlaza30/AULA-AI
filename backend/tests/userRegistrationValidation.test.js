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

test('RNF-02: valida datos de registro en el backend', async () => {
  const rutas = [
    controllerPath,
    supabasePath,
    auditPath,
  ];

  const originales = new Map(
    rutas.map((ruta) => [ruta, require.cache[ruta]])
  );
  let consultasSupabase = 0;
  const duplicados = {
    correo: null,
    numero_documento: null,
  };

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

  try {
    require.cache[supabasePath] = {
      id: supabasePath,
      filename: supabasePath,
      loaded: true,
      exports: {
        supabaseAdmin: {
          from(tabla) {
            assert.equal(tabla, 'usuarios');

            return {
              campo: null,

              select() {
                return this;
              },

              eq(campo) {
                this.campo = campo;
                return this;
              },

              async maybeSingle() {
                consultasSupabase += 1;
                return {
                  data: duplicados[this.campo],
                  error: null,
                };
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

    const {
      registrarUsuario,
    } = require(controllerPath);

    const base = {
      nombres: 'Ana',
      apellidos: 'Pérez',
      tipoDocumento: 'CC',
      numeroDocumento: '12345678',
      correo: 'ana@example.com',
      telefono: '3001234567',
      rol: 'docente',
    };

    const casos = [
      {
        nombre: 'rechaza un cuerpo ausente',
        body: undefined,
      },
      {
        nombre: 'rechaza campos que no sean texto',
        body: {
          ...base,
          nombres: 123,
        },
      },
      {
        nombre: 'rechaza correo con formato inválido',
        body: {
          ...base,
          correo: 'correo-invalido',
        },
      },
      {
        nombre: 'rechaza teléfono vacío',
        body: {
          ...base,
          telefono: '   ',
        },
      },
      {
        nombre: 'rechaza documento menor al mínimo actual',
        body: {
          ...base,
          numeroDocumento: '12345',
        },
      },
      {
        nombre: 'rechaza el registro del rol administrador',
        body: {
          ...base,
          rol: 'administrador',
        },
      },
      {
        nombre: 'rechaza IDs académicos inválidos para estudiante',
        body: {
          ...base,
          rol: 'estudiante',
          gradoId: '1;select',
          grupoId: 2,
        },
      },
    ];

    for (const caso of casos) {
      const respuesta = crearRespuesta();

      await registrarUsuario(
        {
          body: caso.body,
          usuario: {
            id: 'administrador-prueba',
            correo: 'admin@example.com',
            rol: 'administrador',
          },
          headers: {},
          ip: '127.0.0.1',
        },
        respuesta
      );

      assert.equal(
        respuesta.codigo,
        400,
        `${caso.nombre}: debe responder 400`
      );
      assert.equal(
        respuesta.cuerpo.success,
        false,
        `${caso.nombre}: debe indicar que falló`
      );
    }

    assert.equal(
      consultasSupabase,
      0,
      'Los datos inválidos deben rechazarse antes de consultar Supabase.'
    );

    duplicados.correo = {
      id: 'usuario-correo-duplicado',
    };

    const respuestaCorreoDuplicado =
      crearRespuesta();

    await registrarUsuario(
      {
        body: base,
        usuario: {
          id: 'administrador-prueba',
          correo: 'admin@example.com',
          rol: 'administrador',
        },
        headers: {},
        ip: '127.0.0.1',
      },
      respuestaCorreoDuplicado
    );

    assert.equal(
      respuestaCorreoDuplicado.codigo,
      409
    );

    duplicados.correo = null;
    duplicados.numero_documento = {
      id: 'usuario-documento-duplicado',
    };

    const respuestaDocumentoDuplicado =
      crearRespuesta();

    await registrarUsuario(
      {
        body: base,
        usuario: {
          id: 'administrador-prueba',
          correo: 'admin@example.com',
          rol: 'administrador',
        },
        headers: {},
        ip: '127.0.0.1',
      },
      respuestaDocumentoDuplicado
    );

    assert.equal(
      respuestaDocumentoDuplicado.codigo,
      409
    );
    assert.equal(consultasSupabase, 4);
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
