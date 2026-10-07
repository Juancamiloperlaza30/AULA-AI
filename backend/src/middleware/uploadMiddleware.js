const multer = require('multer');

const storage = multer.memoryStorage();

const upload = multer({
  storage,

  limits: {
    fileSize: 50 * 1024 * 1024,
  },

  fileFilter: (
    req,
    file,
    callback
  ) => {
    const tiposPermitidos = [
      // PDF
      'application/pdf',

      // Word
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

      // Excel
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

      // PowerPoint
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',

      // Texto
      'text/plain',

      // Imágenes
      'image/jpeg',
      'image/png',
      'image/webp',

      // Videos
      'video/mp4',
      'video/quicktime',
      'video/webm',

      // ZIP
      'application/zip',
      'application/x-zip-compressed',
    ];

    if (
      tiposPermitidos.includes(
        file.mimetype
      )
    ) {
      return callback(
        null,
        true
      );
    }

    return callback(
      new Error(
        'Tipo de archivo no permitido.'
      ),
      false
    );
  },
});

module.exports = upload;
