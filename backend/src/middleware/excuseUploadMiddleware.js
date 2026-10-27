'use strict';

// =====================================================
// AULA-AI | HU-09 | PASO 52.20
// RECEPCION SEGURA DE SOPORTES ACADEMICOS
//
// - Maximo 1 archivo por solicitud (primera version)
// - Maximo 5 MB
// - JPG, PNG, WebP y PDF
// - Verificacion de firma del archivo
// - Almacenamiento temporal en memoria
// - Sin exposicion publica de documentos
// =====================================================

const multer = require('multer');

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const MIME_PERMITIDOS = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const responderError = (res, mensaje, codigo = 400) =>
  res.status(codigo).json({
    success: false,
    message: mensaje,
  });

// =====================================================
// IDENTIFICAR EL TIPO REAL DEL ARCHIVO
// =====================================================

function detectarTipoArchivo(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return {
      mime: 'image/jpeg',
      extension: 'jpg',
    };
  }

  // PNG: firma de 8 bytes
  const firmaPng = Buffer.from([
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  if (buffer.subarray(0, 8).equals(firmaPng)) {
    return {
      mime: 'image/png',
      extension: 'png',
    };
  }

  // WebP: RIFF + WEBP
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return {
      mime: 'image/webp',
      extension: 'webp',
    };
  }

  // PDF: %PDF-
  if (
    buffer.toString('ascii', 0, 5) === '%PDF-'
  ) {
    return {
      mime: 'application/pdf',
      extension: 'pdf',
    };
  }

  return null;
}

// =====================================================
// CONFIGURAR MULTER
// =====================================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 4,
    parts: 5,
  },

  fileFilter: (req, file, callback) => {
    if (!MIME_PERMITIDOS.has(file.mimetype)) {
      return callback(
        new Error('TIPO_ARCHIVO_NO_PERMITIDO')
      );
    }

    callback(null, true);
  },
}).single('soporte');

// =====================================================
// MIDDLEWARE DE VALIDACION
// =====================================================

function recibirSoporteExcusa(req, res, next) {
  upload(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return responderError(
            res,
            'El soporte no puede superar los 5 MB.',
            413
          );
        }

        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
          return responderError(
            res,
            'Debe adjuntar un solo archivo en el campo soporte.'
          );
        }

        return responderError(
          res,
          'La cantidad de archivos o campos enviados supera el límite permitido.'
        );
      }

      if (
        error.message === 'TIPO_ARCHIVO_NO_PERMITIDO'
      ) {
        return responderError(
          res,
          'Formato no permitido. Adjunta JPG, PNG, WebP o PDF.'
        );
      }

      console.error(
        'HU-09 - Error recibiendo soporte:',
        error.message
      );

      return responderError(
        res,
        'No fue posible procesar el archivo.',
        400
      );
    }

    // En esta primera version exigiremos un soporte.
    if (!req.file) {
      return responderError(
        res,
        'Debes adjuntar un soporte para enviar la excusa.'
      );
    }

    if (
      !req.file.buffer ||
      req.file.size < 1 ||
      req.file.size > MAX_FILE_SIZE
    ) {
      return responderError(
        res,
        'El soporte está vacío o supera el tamaño permitido.'
      );
    }

    const tipoReal = detectarTipoArchivo(
      req.file.buffer
    );

    if (
      !tipoReal ||
      tipoReal.mime !== req.file.mimetype
    ) {
      return responderError(
        res,
        'El contenido del archivo no coincide con un formato permitido.'
      );
    }

    // Información verificada para el controlador.
    req.soporteValidado = {
      buffer: req.file.buffer,
      nombreOriginal: req.file.originalname,
      mime: tipoReal.mime,
      extension: tipoReal.extension,
      tamanoBytes: req.file.size,
    };

    return next();
  });
}

module.exports = {
  recibirSoporteExcusa,
  detectarTipoArchivo,
  MAX_FILE_SIZE,
};
