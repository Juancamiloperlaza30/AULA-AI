const express = require('express');

const {
  verificarToken,
  permitirRoles,
} = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * Esta ruta solamente puede utilizarla
 * un usuario autenticado con rol administrador.
 */
router.get(
  '/panel',
  verificarToken,
  permitirRoles('administrador'),
  (req, res) => {
    return res.status(200).json({
      success: true,
      message:
        'Acceso autorizado al Panel de Administración.',
      usuario: {
        id: req.usuario.id,
        nombres: req.usuario.nombres,
        rol: req.usuario.rol,
      },
    });
  }
);

module.exports = router;