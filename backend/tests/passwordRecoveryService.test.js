'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const rutaServicio = path.resolve(
  __dirname,
  '../src/services/passwordRecoveryService.js'
);

const cargaOriginal = Module._load;

const ejecutarConMocks = async (escenario, ejecutar) => {
  const llamadas = {
    verificarOtp: 0,
    cambiarPassword: 0,
    actualizarPerfil: 0,
    registrarAuditoria: 0,
  };

  const usuarioId = 'usuario-prueba-001';

  const clienteAuth = {
    auth: {
      verifyOtp: async () => {
        llamadas.verificarOtp++;

        return escenario.otp || {
          data: {
            user: { id: usuarioId },
            session: { access_token: 'token-simulado' },
          },
          error: null,
        };
      },

      updateUser: async () => {
        llamadas.cambiarPassword++;

        return escenario.password || {
          data: {
            user: { id: usuarioId },
          },
          error: null,
        };
      },
    },
  };

  const perfil = escenario.perfil || {
    id: usuarioId,
    correo: 'prueba@example.com',
    rol: 'estudiante',
    activo: true,
    numero_documento: '123456789',
  };

  const supabaseAdmin = {
    from: () => ({
      select() {
        return this;
      },
      eq() {
        return this;
      },
      update() {
        llamadas.actualizarPerfil++;
        return this;
      },
      async maybeSingle() {
        if (llamadas.actualizarPerfil > 0) {
          return escenario.actualizacion || {
            data: { id: usuarioId },
            error: null,
          };
        }

        return {
          data: perfil,
          error: null,
        };
      },
    }),
  };

  const eventosAuditoria = [];

  const registrarAuditoria = async (evento) => {
    llamadas.registrarAuditoria++;
    eventosAuditoria.push(evento);

    if (escenario.errorAuditoria) {
      throw new Error('Fallo simulado de auditoria');
    }

    if (escenario.auditoriaDevuelveFalse) {
      return false;
    }

    return true;
  };

  const cargarMock = function(request, parent, isMain) {
    if (
      parent?.filename === rutaServicio &&
      request === '../services/auditService'
    ) {
      return { registrarAuditoria };
    }
    if (
      parent?.filename === rutaServicio &&
      request === '@supabase/supabase-js'
    ) {
      return {
        createClient: () => clienteAuth,
      };
    }

    if (
      parent?.filename === rutaServicio &&
      request === '../config/supabase'
    ) {
      return { supabaseAdmin };
    }

    return cargaOriginal.apply(this, arguments);
  };

  const anteriorUrl = process.env.SUPABASE_URL;
  const anteriorKey = process.env.SUPABASE_ANON_KEY;

  try {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'clave-simulada';

    Module._load = cargarMock;

    delete require.cache[rutaServicio];

    const servicio = require(rutaServicio);

    Module._load = cargaOriginal;

    await ejecutar(
      servicio.recuperarPasswordSeguro,
      llamadas,
      eventosAuditoria
    );
  } finally {
    Module._load = cargaOriginal;
    delete require.cache[rutaServicio];

    if (anteriorUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = anteriorUrl;
    }

    if (anteriorKey === undefined) {
      delete process.env.SUPABASE_ANON_KEY;
    } else {
      process.env.SUPABASE_ANON_KEY = anteriorKey;
    }
  }
};

const datosValidos = {
  correo: 'prueba@example.com',
  codigo: '123456',
  nuevaContrasena: 'AulaSegura2026',
  confirmarContrasena: 'AulaSegura2026',
};

test('Recuperación correcta', async () => {
  await ejecutarConMocks({}, async (recuperar, llamadas) => {
    const resultado = await recuperar(datosValidos);

    assert.equal(resultado.usuarioId, 'usuario-prueba-001');
    assert.equal(llamadas.verificarOtp, 1);
    assert.equal(llamadas.cambiarPassword, 1);
    assert.equal(llamadas.actualizarPerfil, 1);
  });
});

test('Rechaza contraseña insegura antes del OTP', async () => {
  await ejecutarConMocks({}, async (recuperar, llamadas) => {
    await assert.rejects(
      recuperar({
        ...datosValidos,
        nuevaContrasena: '123',
        confirmarContrasena: '123',
      }),
      { code: 'INVALID_PASSWORD' }
    );

    assert.equal(llamadas.verificarOtp, 0);
    assert.equal(llamadas.actualizarPerfil, 0);
  });
});

test('Rechaza OTP inválido', async () => {
  await ejecutarConMocks(
    {
      otp: {
        data: null,
        error: new Error('OTP inválido'),
      },
    },
    async (recuperar, llamadas) => {
      await assert.rejects(
        recuperar(datosValidos),
        { code: 'INVALID_RECOVERY_CODE' }
      );

      assert.equal(llamadas.cambiarPassword, 0);
      assert.equal(llamadas.actualizarPerfil, 0);
    }
  );
});

test('Rechaza usuario institucional inactivo', async () => {
  await ejecutarConMocks(
    {
      perfil: {
        id: 'usuario-prueba-001',
        correo: 'prueba@example.com',
        rol: 'estudiante',
        activo: false,
        numero_documento: '123456789',
      },
    },
    async (recuperar, llamadas) => {
      await assert.rejects(
        recuperar(datosValidos),
        { code: 'INVALID_INSTITUTIONAL_ACCOUNT' }
      );

      assert.equal(llamadas.cambiarPassword, 0);
      assert.equal(llamadas.actualizarPerfil, 0);
    }
  );
});

test('No actualiza perfil si falla la contraseña', async () => {
  await ejecutarConMocks(
    {
      password: {
        data: null,
        error: new Error('Error de Auth'),
      },
    },
    async (recuperar, llamadas) => {
      await assert.rejects(
        recuperar(datosValidos),
        { code: 'PASSWORD_UPDATE_FAILED' }
      );

      assert.equal(llamadas.actualizarPerfil, 0);
    }
  );
});

test('Detecta fallo al actualizar perfil', async () => {
  await ejecutarConMocks(
    {
      actualizacion: {
        data: null,
        error: new Error('Error de base de datos'),
      },
    },
    async (recuperar, llamadas) => {
      await assert.rejects(
        recuperar(datosValidos),
        { code: 'PROFILE_UPDATE_FAILED' }
      );

      assert.equal(llamadas.cambiarPassword, 1);
      assert.equal(llamadas.actualizarPerfil, 1);
    }
  );
});

test('Rechaza contraseña igual al documento', async () => {
  await ejecutarConMocks(
    {
      perfil: {
        id: 'usuario-prueba-001',
        correo: 'prueba@example.com',
        rol: 'estudiante',
        activo: true,
        numero_documento: 'AulaSegura2026',
      },
    },
    async (recuperar, llamadas) => {
      await assert.rejects(
        recuperar(datosValidos),
        { code: 'DOCUMENT_PASSWORD_NOT_ALLOWED' }
      );

      assert.equal(llamadas.cambiarPassword, 0);
      assert.equal(llamadas.actualizarPerfil, 0);
    }
  );
});

test('Rechaza OTP sin sesión válida', async () => {
  await ejecutarConMocks(
    {
      otp: {
        data: {
          user: { id: 'usuario-prueba-001' },
          session: null,
        },
        error: null,
      },
    },
    async (recuperar, llamadas) => {
      await assert.rejects(
        recuperar(datosValidos),
        { code: 'INVALID_RECOVERY_CODE' }
      );

      assert.equal(llamadas.cambiarPassword, 0);
      assert.equal(llamadas.actualizarPerfil, 0);
    }
  );
});

test('No actualiza perfil si Auth devuelve otro usuario', async () => {
  await ejecutarConMocks(
    {
      password: {
        data: {
          user: { id: 'usuario-diferente' },
        },
        error: null,
      },
    },
    async (recuperar, llamadas) => {
      await assert.rejects(
        recuperar(datosValidos),
        { code: 'PASSWORD_UPDATE_FAILED' }
      );

      assert.equal(llamadas.actualizarPerfil, 0);
    }
  );
});

test('Auditoría de fallo parcial', async () => {
  await ejecutarConMocks(
    {
      actualizacion: {
        data: null,
        error: new Error('Fallo de PostgreSQL'),
      },
    },
    async (recuperar, llamadas, eventosAuditoria) => {
      await assert.rejects(
        recuperar(datosValidos),
        { code: 'PROFILE_UPDATE_FAILED' }
      );

      assert.equal(llamadas.registrarAuditoria, 1);
      assert.equal(eventosAuditoria.length, 1);

      const evento = eventosAuditoria[0];

      assert.equal(
        evento.evento,
        'PASSWORD_RECOVERY_PARTIAL_FAILURE'
      );

      assert.equal(
        evento.usuarioId,
        'usuario-prueba-001'
      );

      const registro = JSON.stringify(evento);

      assert.equal(
        registro.includes(datosValidos.nuevaContrasena),
        false
      );

      assert.equal(
        registro.includes(datosValidos.codigo),
        false
      );
    }
  );
});

test('No registra fallo parcial cuando termina correctamente', async () => {
  await ejecutarConMocks(
    {},
    async (recuperar, llamadas) => {
      await recuperar(datosValidos);

      assert.equal(llamadas.registrarAuditoria, 0);
    }
  );
});

test('Un fallo de auditoría no debe ocultar el error del perfil', async () => {
  await ejecutarConMocks(
    {
      actualizacion: {
        data: null,
        error: new Error('Fallo de PostgreSQL'),
      },
      errorAuditoria: true,
    },
    async (recuperar, llamadas) => {
      await assert.rejects(
        recuperar(datosValidos),
        { code: 'PROFILE_UPDATE_FAILED' }
      );

      assert.equal(llamadas.registrarAuditoria, 1);
    }
  );
});

test('Conserva error del perfil cuando auditoria devuelve false', async () => {
  await ejecutarConMocks(
    {
      actualizacion: {
        data: null,
        error: new Error('Fallo simulado de PostgreSQL'),
      },
      auditoriaDevuelveFalse: true,
    },
    async (recuperar, llamadas, eventosAuditoria) => {
      await assert.rejects(
        recuperar(datosValidos),
        { code: 'PROFILE_UPDATE_FAILED' }
      );

      assert.equal(llamadas.registrarAuditoria, 1);
      assert.equal(eventosAuditoria.length, 1);
    }
  );
});