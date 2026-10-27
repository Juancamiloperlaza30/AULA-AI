const express = require('express');

const {
  verificarToken,
  permitirRoles,
} = require('../middleware/authMiddleware');

const {
  listarAsignaciones,
  listarEstudiantes,
  crearSesion,
  listarSesiones,
  registrarAsistencias,
  consultarSesion,
  corregirAsistencia,
  listarSesionesAdministrativas,
  consultarSesionAdministrativa,
} = require('../controllers/attendanceController');

const {
  sincronizarAsistenciaOffline,
} = require('../controllers/attendanceOfflineController');

// ==========================================
// HU-07 - CONSULTA DE ASISTENCIA
// DEL ESTUDIANTE
// ==========================================

const {
  consultarMiHistorial,
} = require('../controllers/studentAttendanceController');

const router = express.Router();

// ==========================================
// AUTENTICACIÓN
// HU-06 Y HU-07
// Todas las rutas requieren sesión válida.
// ==========================================

router.use(verificarToken);

// ==========================================
// HU-07 - ESTUDIANTE
// CONSULTAR SU PROPIO HISTORIAL
// ==========================================

router.get(
  '/mi-historial',
  permitirRoles('estudiante'),
  consultarMiHistorial
);

// ==========================================
// DOCENTE - CONSULTAR ASIGNACIONES
// ==========================================

router.get(
  '/mis-asignaciones',
  permitirRoles('docente'),
  listarAsignaciones
);

// ==========================================
// DOCENTE - CONSULTAR ESTUDIANTES
// ==========================================

router.get(
  '/asignaciones/:asignacionId/estudiantes',
  permitirRoles('docente'),
  listarEstudiantes
);

// ==========================================
// DOCENTE - CONSULTAR SESIONES
// ==========================================

router.get(
  '/asignaciones/:asignacionId/sesiones',
  permitirRoles('docente'),
  listarSesiones
);

// ==========================================
// DOCENTE - CREAR SESIÓN
// ==========================================

router.post(
  '/sesiones',
  permitirRoles('docente'),
  crearSesion
);

// ==========================================
// DOCENTE - SINCRONIZAR ASISTENCIAS OFFLINE
// ==========================================

router.post(
  '/sincronizar-offline',
  permitirRoles('docente'),
  sincronizarAsistenciaOffline
);

// ==========================================
// CONSULTAR ASISTENCIAS DE UNA SESIÓN
// ==========================================

router.get(
  '/sesiones/:sesionId',
  permitirRoles(
    'docente',
    'administrador',
    'coordinador'
  ),
  consultarSesion
);

// ==========================================
// DOCENTE - REGISTRAR ASISTENCIA
// ==========================================

router.post(
  '/sesiones/:sesionId/asistencias',
  permitirRoles('docente'),
  registrarAsistencias
);

// ==========================================
// ADMINISTRADOR Y COORDINADOR
// LISTAR SESIONES
// ==========================================

router.get(
  '/administracion/sesiones',
  permitirRoles(
    'administrador',
    'coordinador'
  ),
  listarSesionesAdministrativas
);

// ==========================================
// ADMINISTRADOR Y COORDINADOR
// CONSULTAR DETALLE DE SESIÓN
// ==========================================

router.get(
  '/administracion/sesiones/:sesionId',
  permitirRoles(
    'administrador',
    'coordinador'
  ),
  consultarSesionAdministrativa
);

// ==========================================
// CORRECCIÓN DE ASISTENCIA
//
// Docente:
// Solo puede corregir registros propios.
//
// Administrador:
// Puede corregir registros institucionales.
//
// Coordinador:
// Solo dentro de su ámbito autorizado.
//
// El controlador y la función SQL realizan
// las comprobaciones adicionales.
// ==========================================

router.patch(
  '/asistencias/:asistenciaId',
  permitirRoles(
    'docente',
    'administrador',
    'coordinador'
  ),
  corregirAsistencia
);

module.exports = router;
