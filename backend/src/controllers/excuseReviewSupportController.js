'use strict';

const { supabaseAdmin } = require('../config/supabase');

const BUCKET_PERMITIDO = 'excusas-soportes';
const MAX_BYTES = 5 * 1024 * 1024;

const MIME_PERMITIDOS = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function idValido(valor) {
  return (
    /^[1-9]\d*$/.test(String(valor || '')) &&
    Number.isSafeInteger(Number(valor))
  );
}

function responder(res, estado, mensaje) {
  return res.status(estado).json({
    ok: false,
    mensaje,
  });
}

async function obtenerExcusaAutorizada(req, res) {
  const excusaId = req.params.excusaId;

  if (!idValido(excusaId)) {
    responder(res, 400, 'Identificador de excusa inválido.');
    return null;
  }

  const { data: excusa, error } = await supabaseAdmin
    .from('excusas')
    .select('id, asistencia_id, estudiante_id')
    .eq('id', Number(excusaId))
    .maybeSingle();

  if (error) throw error;

  if (!excusa) {
    responder(res, 404, 'La excusa no está disponible.');
    return null;
  }

  if (req.usuario?.rol === 'coordinador') {
    return excusa;
  }

  if (req.usuario?.rol !== 'docente') {
    responder(res, 403, 'No tienes autorización.');
    return null;
  }

  const { data: asistencia, error: errorAsistencia } =
    await supabaseAdmin
      .from('asistencias')
      .select('docente_id, estudiante_id')
      .eq('id', excusa.asistencia_id)
      .maybeSingle();

  if (errorAsistencia) throw errorAsistencia;

  if (
    !asistencia ||
    asistencia.docente_id !== req.usuario.id ||
    asistencia.estudiante_id !== excusa.estudiante_id
  ) {
    responder(
      res,
      403,
      'No tienes autorización sobre esta excusa.'
    );
    return null;
  }

  return excusa;
}

async function listarSoportesRevision(req, res) {
  try {
    const excusa = await obtenerExcusaAutorizada(req, res);

    if (!excusa) return;

    const { data, error } = await supabaseAdmin
      .from('excusas_soportes')
      .select(`
        id,
        excusa_id,
        nombre_archivo,
        tipo_mime,
        tamano_bytes,
        created_at
      `)
      .eq('excusa_id', excusa.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return res.json({
      ok: true,
      soportes: data || [],
    });
  } catch (error) {
    console.error('[HU-09] Error listando soportes:', error);

    return responder(
      res,
      500,
      'No fue posible consultar los soportes.'
    );
  }
}

async function descargarSoporteRevision(req, res) {
  try {
    const excusa = await obtenerExcusaAutorizada(req, res);

    if (!excusa) return;

    if (!idValido(req.params.soporteId)) {
      return responder(
        res,
        400,
        'Identificador de soporte inválido.'
      );
    }

    const { data: soporte, error } = await supabaseAdmin
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
      .eq('id', Number(req.params.soporteId))
      .eq('excusa_id', excusa.id)
      .maybeSingle();

    if (error) throw error;

    if (!soporte) {
      return responder(
        res,
        404,
        'El soporte no está disponible.'
      );
    }

    if (
      soporte.storage_bucket !== BUCKET_PERMITIDO ||
      typeof soporte.storage_path !== 'string' ||
      !soporte.storage_path.trim() ||
      !MIME_PERMITIDOS.has(soporte.tipo_mime) ||
      !Number.isSafeInteger(Number(soporte.tamano_bytes)) ||
      Number(soporte.tamano_bytes) < 1 ||
      Number(soporte.tamano_bytes) > MAX_BYTES
    ) {
      return responder(
        res,
        422,
        'Los metadatos del soporte no son válidos.'
      );
    }

    const { data: archivo, error: errorArchivo } =
      await supabaseAdmin.storage
        .from(BUCKET_PERMITIDO)
        .download(soporte.storage_path);

    if (errorArchivo || !archivo) {
      return responder(
        res,
        404,
        'No fue posible recuperar el documento.'
      );
    }

    const contenido = Buffer.from(
      await archivo.arrayBuffer()
    );

    if (
      contenido.length < 1 ||
      contenido.length > MAX_BYTES
    ) {
      return responder(
        res,
        422,
        'El archivo no cumple el tamaño permitido.'
      );
    }

    const nombre = String(
      soporte.nombre_archivo || 'soporte'
    )
      .replace(/[\r\n\\/]/g, '_')
      .replace(/[\x00-\x1f\x7f]/g, '')
      .trim()
      .slice(0, 150) || 'soporte';

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
    console.error('[HU-09] Error descargando soporte:', error);

    if (res.headersSent) return;

    return responder(
      res,
      500,
      'No fue posible descargar el soporte.'
    );
  }
}

module.exports = {
  listarSoportesRevision,
  descargarSoporteRevision,
};
