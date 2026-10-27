'use strict';

// =====================================================
// AULA-AI | HU-09 | PASO 52.65
// DESCARGA PROTEGIDA DE SOPORTES DE EXCUSAS
// =====================================================

const { supabaseAdmin } = require('../config/supabase');

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BUCKET_PERMITIDO = 'excusas-soportes';
const MAX_ARCHIVO_BYTES = 5 * 1024 * 1024;

const MIME_PERMITIDOS = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function responderError(res, status, message) {
  return res.status(status).json({
    success: false,
    message,
  });
}

function esIdPositivo(valor) {
  return /^[1-9]\d*$/.test(String(valor || '')) &&
    Number.isSafeInteger(Number(valor));
}

function nombreSeguro(nombre) {
  const valor = String(nombre || 'soporte')
    .replace(/[\r\n\\/]/g, '_')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim();

  return valor.slice(0, 150) || 'soporte';
}

async function descargarSoporteExcusa(req, res) {
  try {
    const acudienteId = req.usuario?.id;
    const estudianteId = req.params.estudianteId;
    const excusaId = req.params.excusaId;
    const soporteId = req.params.soporteId;

    // 1. Identidad y rol.
    if (
      !UUID_REGEX.test(String(acudienteId || '')) ||
      req.usuario?.rol !== 'acudiente'
    ) {
      return responderError(
        res,
        403,
        'No está autorizado para descargar soportes.'
      );
    }

    // 2. Parámetros.
    if (!UUID_REGEX.test(String(estudianteId || ''))) {
      return responderError(
        res,
        400,
        'El identificador del estudiante no es válido.'
      );
    }

    if (
      !esIdPositivo(excusaId) ||
      !esIdPositivo(soporteId)
    ) {
      return responderError(
        res,
        400,
        'Los identificadores de excusa o soporte no son válidos.'
      );
    }

    // 3. Vinculación activa y verificada.
    const {
      data: vinculacion,
      error: errorVinculacion,
    } = await supabaseAdmin
      .from('acudiente_estudiante')
      .select('id')
      .eq('acudiente_id', acudienteId)
      .eq('estudiante_id', estudianteId)
      .eq('activo', true)
      .eq('verificado', true)
      .maybeSingle();

    if (errorVinculacion) {
      throw errorVinculacion;
    }

    if (!vinculacion) {
      return responderError(
        res,
        403,
        'No tiene autorización vigente sobre este estudiante.'
      );
    }

    // 4. La excusa debe pertenecer al acudiente
    // y al estudiante de la solicitud.
    const {
      data: excusa,
      error: errorExcusa,
    } = await supabaseAdmin
      .from('excusas')
      .select('id')
      .eq('id', excusaId)
      .eq('acudiente_id', acudienteId)
      .eq('estudiante_id', estudianteId)
      .maybeSingle();

    if (errorExcusa) {
      throw errorExcusa;
    }

    if (!excusa) {
      return responderError(
        res,
        404,
        'La excusa solicitada no está disponible.'
      );
    }

    // 5. Recuperar solamente el soporte
    // perteneciente a la excusa autorizada.
    const {
      data: soporte,
      error: errorSoporte,
    } = await supabaseAdmin
      .from('excusas_soportes')
      .select(`
        id,
        excusa_id,
        storage_bucket,
        storage_path,
        nombre_archivo,
        tipo_mime,
        tamano_bytes
      `)
      .eq('id', soporteId)
      .eq('excusa_id', excusa.id)
      .maybeSingle();

    if (errorSoporte) {
      throw errorSoporte;
    }

    if (!soporte) {
      return responderError(
        res,
        404,
        'El soporte solicitado no está disponible.'
      );
    }

    // 6. Seguridad del archivo.
    if (
      soporte.storage_bucket !== BUCKET_PERMITIDO ||
      typeof soporte.storage_path !== 'string' ||
      !soporte.storage_path.trim() ||
      !MIME_PERMITIDOS.has(soporte.tipo_mime) ||
      !Number.isSafeInteger(Number(soporte.tamano_bytes)) ||
      Number(soporte.tamano_bytes) < 1 ||
      Number(soporte.tamano_bytes) > MAX_ARCHIVO_BYTES
    ) {
      return responderError(
        res,
        422,
        'Los metadatos del soporte no son válidos.'
      );
    }

    // 7. Descarga con el cliente administrativo.
    // Nunca enviar la ruta de Storage al usuario.
    const {
      data: archivo,
      error: errorDescarga,
    } = await supabaseAdmin.storage
      .from(BUCKET_PERMITIDO)
      .download(soporte.storage_path);

    if (errorDescarga || !archivo) {
      console.error(
        'HU-09: No fue posible recuperar el soporte.',
        errorDescarga?.message
      );

      return responderError(
        res,
        404,
        'El documento no está disponible.'
      );
    }

    // 8. Verificación del tamaño descargado.
    const contenido = Buffer.from(
      await archivo.arrayBuffer()
    );

    if (
      contenido.length < 1 ||
      contenido.length > MAX_ARCHIVO_BYTES
    ) {
      return responderError(
        res,
        422,
        'El documento descargado no cumple con el tamaño permitido.'
      );
    }

    // 9. Entrega del archivo sin revelar
    // credenciales ni rutas privadas.
    const nombre = nombreSeguro(soporte.nombre_archivo);

    res.setHeader('Content-Type', soporte.tipo_mime);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="soporte"; filename*=UTF-8''${encodeURIComponent(nombre)}`
    );

    res.setHeader('Content-Length', contenido.length);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return res.status(200).send(contenido);

  } catch (error) {
    console.error(
      'HU-09: Error descargando soporte:',
      error?.message || error
    );

    if (res.headersSent) {
      return;
    }

    return responderError(
      res,
      500,
      'No fue posible descargar el soporte académico.'
    );
  }
}

module.exports = {
  descargarSoporteExcusa,
};
