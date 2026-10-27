'use strict';

// =====================================================
// AULA-AI | HU-09 | PASO 52.32
// PRUEBA LOCAL DE ENVIO DE EXCUSA CON PDF
// =====================================================

require('dotenv').config();

const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Blob } = require('node:buffer');

const {
  createClient,
} = require('@supabase/supabase-js');

const ESTUDIANTE_ID =
  '1bb00dbf-ff4c-41eb-9b6c-ff6ed16574dd';

const ASISTENCIA_ID = 3;

async function iniciar() {
  const correo = process.env.HU09_TEST_EMAIL;
  const password = process.env.HU09_TEST_PASSWORD;

  if (!correo || !password) {
    throw new Error(
      'Configura HU09_TEST_EMAIL y HU09_TEST_PASSWORD en el entorno.'
    );
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const {
    data,
    error,
  } = await supabase.auth.signInWithPassword({
    email: correo,
    password,
  });

  if (error || !data.session?.access_token) {
    throw new Error(
      'No fue posible autenticar al acudiente.'
    );
  }

  const archivo = path.join(
    __dirname,
    'soporte-prueba-hu09.pdf'
  );

  const contenido = await fs.readFile(archivo);

  if (
    contenido.length === 0 ||
    contenido.length > 5 * 1024 * 1024
  ) {
    throw new Error(
      'El soporte debe tener entre 1 byte y 5 MB.'
    );
  }

  const formulario = new FormData();

  formulario.append(
    'asistenciaId',
    String(ASISTENCIA_ID)
  );

  formulario.append(
    'motivo',
    'Documento ficticio de prueba para validar el envío de excusas académicas.'
  );

  formulario.append(
    'claveIdempotencia',
    randomUUID()
  );

  formulario.append(
    'soporte',
    new Blob(
      [contenido],
      { type: 'application/pdf' }
    ),
    'soporte-prueba-hu09.pdf'
  );

  const url =
    `http://localhost:3000/api/guardian/estudiantes/${ESTUDIANTE_ID}/excusas`;

  const respuesta = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization:
        `Bearer ${data.session.access_token}`,
    },
    body: formulario,
  });

  const resultado = await respuesta.json();

  console.log('HTTP:', respuesta.status);
  console.log(
    JSON.stringify(resultado, null, 2)
  );
}

iniciar().catch((error) => {
  console.error(
    'ERROR DE PRUEBA:',
    error.message
  );
  process.exitCode = 1;
});
