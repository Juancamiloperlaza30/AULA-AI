const express =
  require('express');

const router =
  express.Router();

const {
  verificarToken,
} =
  require('../middleware/authMiddleware');

const {
  registrarTokenPush,
  enviarNotificacionPrueba,
} =
  require('../controllers/pushController');

router.post(
  '/registrar-token',
  verificarToken,
  registrarTokenPush
);

router.post(
  '/prueba',
  verificarToken,
  enviarNotificacionPrueba
);

module.exports =
  router;
