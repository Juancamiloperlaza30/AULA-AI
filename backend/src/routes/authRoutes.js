const express = require('express');

const {
	login,
	logout,
	recuperarPassword,
	renovarSesion,
	actualizarPassword,
} = require('../controllers/authController');

const {
	verificarToken,
} = require('../middleware/authMiddleware');

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
	recuperarPassword
);

router.post(
	'/refresh',
	renovarSesion
);

router.post(
	'/actualizar-password',
	actualizarPassword
);

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
			},
		});
	}
);

module.exports = router;