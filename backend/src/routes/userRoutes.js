const express = require('express');

const {
  registrarUsuario,
  activarCuenta,
  buscarEstudiantes,
} = require('../controllers/userController');

const {
  listarUsuarios,
  obtenerResumenUsuarios,
  obtenerDetalleUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
} = require('../controllers/adminUserController');

const {
  listarEventosAuditoria,
} = require('../controllers/adminAuditController');

const {
  verificarToken,
  permitirRoles,
} = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * ============================================
 * AULA-AI — GESTIÓN DE USUARIOS
 * ============================================
 *
 * Administrador:
 * - Registrar usuarios.
 * - Consultar usuarios.
 * - Buscar y filtrar usuarios.
 * - Consultar detalles.
 * - Editar información personal.
 * - Activar y desactivar cuentas.
 * - Consultar estadísticas.
 * - Consultar eventos de auditoría.
 *
 * Coordinador:
 * - Registrar usuarios según las validaciones
 *   existentes del controlador.
 * - Buscar estudiantes.
 *
 * Los demás roles no pueden acceder
 * a las operaciones administrativas.
 */


/**
 * ============================================
 * 1. BUSCAR ESTUDIANTES
 * ============================================
 *
 * GET /api/users/estudiantes/buscar?q=
 *
 * Administrador y Coordinador.
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


/**
 * ============================================
 * 2. RESUMEN DE USUARIOS
 * ============================================
 *
 * GET /api/users/resumen
 *
 * Exclusivo para Administrador.
 */
router.get(
  '/resumen',
  verificarToken,
  permitirRoles('administrador'),
  obtenerResumenUsuarios
);

/**
 * ============================================
 * MONITOREO DEL SISTEMA — AUDITORÍA
 * ============================================
 *
 * GET /api/users/auditoria
 *
 * Exclusivo para Administrador.
 */
router.get(
  '/auditoria',
  verificarToken,
  permitirRoles('administrador'),
  listarEventosAuditoria
);


/**
 * ============================================
 * 3. LISTAR USUARIOS
 * ============================================
 *
 * GET /api/users
 *
 * Parámetros opcionales:
 * - pagina
 * - limite
 * - busqueda
 * - rol
 * - estado
 *
 * Exclusivo para Administrador.
 */
router.get(
  '/',
  verificarToken,
  permitirRoles('administrador'),
  listarUsuarios
);


/**
 * ============================================
 * 4. REGISTRAR USUARIO
 * ============================================
 *
 * POST /api/users
 *
 * Administrador y Coordinador.
 */
router.post(
  '/',
  verificarToken,
  permitirRoles(
    'administrador',
    'coordinador'
  ),
  registrarUsuario
);


/**
 * ============================================
 * 5. ACTIVACIÓN INICIAL DE CUENTA
 * ============================================
 *
 * POST /api/users/activar-cuenta
 *
 * Conserva el funcionamiento existente.
 *
 * La validación del token de activación
 * se realiza dentro del controlador.
 */
/*
 * AUDITORIA DE SEGURIDAD - AULA-AI
 *
 * Ruta de activacion deshabilitada temporalmente.
 * Un accessToken valido no demuestra que exista
 * una invitacion de activacion pendiente.
 *
 * No reactivar sin implementar una validacion
 * especifica de activacion y pruebas de seguridad.
 *
router.post(
  '/activar-cuenta',
  activarCuenta
);
*/


/**
 * ============================================
 * 6. CONSULTAR DETALLE DE USUARIO
 * ============================================
 *
 * GET /api/users/:id
 *
 * Exclusivo para Administrador.
 */
router.get(
  '/:id',
  verificarToken,
  permitirRoles('administrador'),
  obtenerDetalleUsuario
);


/**
 * ============================================
 * 7. EDITAR USUARIO
 * ============================================
 *
 * PATCH /api/users/:id
 *
 * Exclusivo para Administrador.
 *
 * Permite modificar únicamente los campos
 * autorizados por adminUserController.
 */
router.patch(
  '/:id',
  verificarToken,
  permitirRoles('administrador'),
  actualizarUsuario
);


/**
 * ============================================
 * 8. ACTIVAR O DESACTIVAR USUARIO
 * ============================================
 *
 * PATCH /api/users/:id/estado
 *
 * Exclusivo para Administrador.
 */
router.patch(
  '/:id/estado',
  verificarToken,
  permitirRoles('administrador'),
  cambiarEstadoUsuario
);


module.exports = router;