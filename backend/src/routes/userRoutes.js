const express = require('express');

const {
  registrarUsuario,
  activarCuenta,
  buscarEstudiantes,
} = require('../controllers/userController');

const {
  verificarToken,
  permitirRoles,
} = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * Registrar usuarios.
 *
 * Solo:
 * - Administrador
 * - Coordinador
 */
router.get(
  '/estudiantes/buscar',
  verificarToken,
  permitirRoles(
    'administrador',
    'coordinador'
  ),
  buscarEstudiantes
);

router.post(
  '/',
  verificarToken,
  permitirRoles(
    'administrador',
    'coordinador'
  ),
  registrarUsuario
);

router.post(
  '/activar-cuenta',
  activarCuenta
);

module.exports = router;