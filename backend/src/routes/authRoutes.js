const express = require('express');

const {
	login,
	logout,
	recuperarPassword,
	renovarSesion,
	actualizarPassword,
	cambiarPasswordInicial,
	confirmarRecuperacionPassword,
} = require('../controllers/authController');

const {
	verificarToken,
} = require('../middleware/authMiddleware');

const {
  completarRecuperacionPassword,
} = require('../controllers/passwordRecoveryController');
const {
  limitarSolicitudRecuperacion,
  limitarCompletarRecuperacion,
} = require('../middleware/passwordRecoveryRateLimit');
const router = express.Router();

// Iniciar sesión
router.post('/login', login);

// Cerrar sesión
router.post(
	'/logout',
	verificarToken,
	logout
);

// Solicitar recuperación de contraseña
router.post(
  '/recuperar-password',
  limitarSolicitudRecuperacion,
  recuperarPassword
);

router.post(
	'/refresh',
	renovarSesion
);

router.post(
  '/completar-recuperacion-password',
  limitarCompletarRecuperacion,
  completarRecuperacionPassword
);
// Ruta /actualizar-password deshabilitada por seguridad.

router.put(
	'/cambiar-password-inicial',
	verificarToken,
	cambiarPasswordInicial
);

// Ruta /confirmar-recuperacion-password deshabilitada temporalmente por seguridad.

// Consultar la sesión y perfil actual del usuario
router.get(
	'/me',
	verificarToken,
	(req, res) => {
		return res.status(200).json({
			success: true,
			message: 'Sesión válida.',
			usuario: {
				id: req.usuario.id,
				nombres: req.usuario.nombres,
				apellidos: req.usuario.apellidos,
				correo: req.usuario.correo,
				rol: req.usuario.rol,
				activo: req.usuario.activo,
				debeCambiarPassword:
					req.usuario.debe_cambiar_password !== false,
				passwordCambiadoAt:
					req.usuario.password_cambiado_at || null,
			},
		});
	}
);

module.exports = router;