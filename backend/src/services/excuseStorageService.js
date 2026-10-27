'use strict';

// =====================================================
// AULA-AI | HU-09 | PASO 52.21
// SERVICIO DE SOPORTES PRIVADOS
//
// - Supabase Storage
// - Bucket privado
// - Nombres aleatorios de archivos
// - Validacion de datos recibidos
// - Eliminacion compensatoria ante errores
//
// IMPORTANTE:
// Este servicio solo debe llamarse desde controladores
// que ya hayan validado JWT, rol y vinculacion.
// =====================================================

const { randomUUID } = require('node:crypto');

const {
  supabaseAdmin,
} = require('../config/supabase');

const BUCKET = 'excusas-soportes';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TIPOS_PERMITIDOS = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
});

// =====================================================
// VALIDAR INFORMACION DEL SOPORTE
// =====================================================

function validarSoporte(soporte) {
  if (!soporte || typeof soporte !== 'object') {
    throw new Error('SOPORTE_INVALIDO');
  }

  if (!Buffer.isBuffer(soporte.buffer)) {
    throw new Error('SOPORTE_INVALIDO');
  }

  if (
    !Number.isSafeInteger(soporte.tamanoBytes) ||
    soporte.tamanoBytes < 1 ||
    soporte.tamanoBytes > MAX_FILE_SIZE ||
    soporte.buffer.length !== soporte.tamanoBytes
  ) {
    throw new Error('TAMANO_SOPORTE_INVALIDO');
  }

  const extension = TIPOS_PERMITIDOS[soporte.mime];

  if (
    !extension ||
    soporte.extension !== extension
  ) {
    throw new Error('TIPO_SOPORTE_INVALIDO');
  }

  return extension;
}

// =====================================================
// GENERAR RUTA PRIVADA
// =====================================================

function generarRutaSoporte({
  acudienteId,
  estudianteId,
  extension,
}) {
  if (
    !UUID_REGEX.test(String(acudienteId || '')) ||
    !UUID_REGEX.test(String(estudianteId || ''))
  ) {
    throw new Error('IDENTIFICADORES_INVALIDOS');
  }

  return [
    'hu09',
    estudianteId,
    acudienteId,
    `${randomUUID()}.${extension}`,
  ].join('/');
}

// =====================================================
// CARGAR SOPORTE EN STORAGE
// =====================================================

async function guardarSoporteExcusa({
  acudienteId,
  estudianteId,
  soporte,
}) {
  const extension = validarSoporte(soporte);

  const storagePath = generarRutaSoporte({
    acudienteId,
    estudianteId,
    extension,
  });

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, soporte.buffer, {
      contentType: soporte.mime,
      upsert: false,
      cacheControl: '0',
    });

  if (error) {
    console.error(
      'HU-09 - Error cargando soporte:',
      error.message
    );

    throw new Error('ERROR_CARGA_SOPORTE');
  }

  if (!data?.path) {
    throw new Error('CARGA_SIN_CONFIRMACION');
  }

  return {
    storageBucket: BUCKET,
    storagePath: data.path,
    nombreArchivo:
      String(soporte.nombreOriginal || 'soporte')
        .replace(/[\/\\]/g, '_')
        .slice(0, 180),
    tipoMime: soporte.mime,
    tamanoBytes: soporte.tamanoBytes,
  };
}

// =====================================================
// ELIMINAR UN SOPORTE ANTE UNA OPERACION FALLIDA
//
// La ruta debe provenir de una carga realizada
// por nuestro backend, nunca de un valor libre
// enviado directamente por el cliente.
// =====================================================

async function eliminarSoporteExcusa(storagePath) {
  if (
    typeof storagePath !== 'string' ||
    !/^hu09\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/i
      .test(storagePath)
  ) {
    throw new Error('RUTA_SOPORTE_INVALIDA');
  }

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .remove([storagePath]);

  if (error) {
    console.error(
      'HU-09 - Error eliminando soporte:',
      error.message
    );

    throw new Error('ERROR_ELIMINACION_SOPORTE');
  }

  return {
    success: true,
    data,
  };
}

module.exports = {
  BUCKET,
  guardarSoporteExcusa,
  eliminarSoporteExcusa,
};
