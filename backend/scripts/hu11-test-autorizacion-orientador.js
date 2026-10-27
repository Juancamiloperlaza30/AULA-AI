'use strict';

// =====================================================
// AULA-AI | HU-11
// PRUEBA DE AUTORIZACIÓN DEL ORIENTADOR
// =====================================================

const path = require('node:path');

require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
});

const { createClient } = require('@supabase/supabase-js');

// =====================================================
// CONFIGURACIÓN
// =====================================================

const API_URL = 'http://127.0.0.1:3000';

const ESTUDIANTE_AUTORIZADO =
  '85fb51da-83cb-4eed-b818-95aa7426d2f6';

const ESTUDIANTE_NO_AUTORIZADO =
  'eef3b0d4-bb71-486c-ad19-b77dc7b4dfcd';

// Identificador ficticio para evitar apuntar
// a un plan existente.
const PLAN_ID_FICTICIO = 999999999;

// =====================================================
// FUNCIÓN PARA REALIZAR SOLICITUDES
// =====================================================

async function realizarSolicitud(
  token,
  metodo,
  ruta,
  cuerpo = null
) {
  const opciones = {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (cuerpo !== null) {
    opciones.body = JSON.stringify(cuerpo);
  }

  const respuesta = await fetch(
    `${API_URL}${ruta}`,
    opciones
  );

  let resultado;

  try {
    resultado = await respuesta.json();
  } catch {
    resultado = {
      message: 'El servidor no devolvió JSON.',
    };
  }

  return {
    status: respuesta.status,
    resultado,
  };
}

// =====================================================
// FUNCIÓN PARA EVALUAR RESULTADOS
// =====================================================

function evaluarPrueba(
  nombre,
  respuesta,
  codigoEsperado
) {
  const aprobada =
    respuesta.status === codigoEsperado;

  console.log('\n-----------------------------------');
  console.log(nombre);
  console.log('HTTP obtenido:', respuesta.status);
  console.log('HTTP esperado:', codigoEsperado);

  console.log(
    'Resultado:',
    aprobada ? 'APROBADA' : 'NO SUPERADA'
  );

  if (!aprobada) {
    console.log(
      'Respuesta del servidor:',
      JSON.stringify(respuesta.resultado, null, 2)
    );

    process.exitCode = 1;
  }

  return aprobada;
}

// =====================================================
// EJECUCIÓN PRINCIPAL
// =====================================================

async function iniciar() {
  const {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    HU11_TEST_ORIENTADOR_EMAIL,
    HU11_TEST_ORIENTADOR_PASSWORD,
  } = process.env;

  if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY ||
    !HU11_TEST_ORIENTADOR_EMAIL ||
    !HU11_TEST_ORIENTADOR_PASSWORD
  ) {
    throw new Error(
      'Faltan variables de configuración del Orientador.'
    );
  }

  console.log('\n===================================');
  console.log('AULA-AI | HU-11');
  console.log('PRUEBA DE AUTORIZACIÓN DEL ORIENTADOR');
  console.log('===================================\n');

  // =====================================================
  // 1. AUTENTICACIÓN
  // =====================================================

  const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: HU11_TEST_ORIENTADOR_EMAIL,
      password: HU11_TEST_ORIENTADOR_PASSWORD,
    });

  if (error || !data.session?.access_token) {
    throw new Error(
      'No fue posible autenticar al Orientador.'
    );
  }

  const token = data.session.access_token;

  // Evita ejecutar pruebas con otra cuenta
  // que no sea el orientador seleccionado.
  const ORIENTADOR_ESPERADO =
    '45018aa1-4519-41a1-95e2-3536592134d6';

  if (data.user.id !== ORIENTADOR_ESPERADO) {
    throw new Error(
      'La cuenta autenticada no corresponde al Orientador de prueba.'
    );
  }

  console.log('Autenticación: correcta.');
  console.log('Identidad del Orientador: validada.');

  // =====================================================
  // 2. CONSULTAR PLANES AUTORIZADOS
  // =====================================================

  const prueba1 = await realizarSolicitud(
    token,
    'GET',
    `/api/planes-acompanamiento/estudiante/${ESTUDIANTE_AUTORIZADO}`
  );

  evaluarPrueba(
    'PRUEBA 1: Consultar planes autorizados',
    prueba1,
    200
  );

  // =====================================================
  // 3. CONSULTAR PLANES NO AUTORIZADOS
  // =====================================================

  const prueba2 = await realizarSolicitud(
    token,
    'GET',
    `/api/planes-acompanamiento/estudiante/${ESTUDIANTE_NO_AUTORIZADO}`
  );

  evaluarPrueba(
    'PRUEBA 2: Consultar planes no autorizados',
    prueba2,
    403
  );

  // =====================================================
  // 4. CREAR PLAN NO AUTORIZADO
  // =====================================================

  // Se envían datos válidos para que la solicitud
  // llegue a la comprobación de permisos. El servicio
  // deniega el acceso antes de consultar o guardar datos.

  const prueba3 = await realizarSolicitud(
    token,
    'POST',
    `/api/planes-acompanamiento/estudiante/${ESTUDIANTE_NO_AUTORIZADO}`,
    {
      recomendacionId: 1,
      objetivo: 'PRUEBA DE SEGURIDAD HU-11',
      acciones: [],
      indicadoresProgreso: [],
    }
  );

  evaluarPrueba(
    'PRUEBA 3: Crear plan no autorizado',
    prueba3,
    403
  );

  // =====================================================
  // 5. MODIFICAR PLAN NO AUTORIZADO
  // =====================================================

  const prueba4 = await realizarSolicitud(
    token,
    'PATCH',
    `/api/planes-acompanamiento/estudiante/${ESTUDIANTE_NO_AUTORIZADO}/${PLAN_ID_FICTICIO}`,
    {
      objetivo: 'PRUEBA DE SEGURIDAD HU-11',
    }
  );

  evaluarPrueba(
    'PRUEBA 4: Modificar plan no autorizado',
    prueba4,
    403
  );

  // =====================================================
  // 6. RESUMEN
  // =====================================================

  console.log('\n===================================');

  if (!process.exitCode) {
    console.log(
      'PRUEBAS SUPERADAS: autorización del Orientador.'
    );
  } else {
    console.log(
      'EXISTEN PRUEBAS PENDIENTES DE REVISIÓN.'
    );
  }

  console.log('===================================\n');
}

// =====================================================
// EJECUCIÓN
// =====================================================

iniciar().catch((error) => {
  console.error('\nERROR:', error.message);
  process.exitCode = 1;
});
