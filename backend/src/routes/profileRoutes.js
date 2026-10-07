const express =
  require('express');

const multer =
  require('multer');

const router =
  express.Router();

const upload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        5 * 1024 * 1024,
    },
  });

const {
  verificarToken,
} =
  require('../middleware/authMiddleware');

const {
  obtenerMiPerfil,
  actualizarFotoPerfil,
} =
  require('../controllers/profileController');

router.get(
  '/me',
  verificarToken,
  obtenerMiPerfil
);

router.put(
  '/me/foto',
  verificarToken,
  upload.single('foto'),
  actualizarFotoPerfil
);

module.exports = router;
