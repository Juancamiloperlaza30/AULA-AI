const express = require('express');

const {
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

const {
  requireAcademicAccess,
} = require('../middleware/requireAcademicAccess');
const {
  medirTiempoRespuestaAsistencia,
} = require('../middleware/attendanceResponseTimeMiddleware');
const router = express.Router();

// ==========================================
// AUTENTICACIÓN
// HU-06 Y HU-07
// Todas las rutas requieren sesión válida.
// ==========================================

router.use(requireAcademicAccess);

// ==========================================
// HU-07 - ESTUDIANTE
// CONSULTAR SU PROPIO HISTORIAL
// ==========================================

router.get(
  '/mi-historial',
  permitirRoles('estudiante'),
  medirTiempoRespuestaAsistencia('historial-estudiante'),
  consultarMiHistorial
);

// ==========================================
// DOCENTE - CONSULTAR ASIGNACIONES
// ==========================================

router.get(
  '/mis-asignaciones',
  permitirRoles('docente'),
  medirTiempoRespuestaAsistencia('asignaciones-docente'),
  listarAsignaciones
);

// ==========================================
// DOCENTE - CONSULTAR ESTUDIANTES
// ==========================================

router.get(
  '/asignaciones/:asignacionId/estudiantes',
  permitirRoles('docente'),
  medirTiempoRespuestaAsistencia('estudiantes-asignacion'),
  listarEstudiantes
);

// ==========================================
// DOCENTE - CONSULTAR SESIONES
// ==========================================

router.get(
  '/asignaciones/:asignacionId/sesiones',
  permitirRoles('docente'),
  medirTiempoRespuestaAsistencia('sesiones-asignacion'),
  listarSesiones
);

// ==========================================
// DOCENTE - CREAR SESIÓN
// ==========================================

router.post(
  '/sesiones',
  permitirRoles('docente'),
  medirTiempoRespuestaAsistencia('crear-sesion'),
  crearSesion
);

// ==========================================
// DOCENTE - SINCRONIZAR ASISTENCIAS OFFLINE
// ==========================================

router.post(
  '/sincronizar-offline',
  permitirRoles('docente'),
  medirTiempoRespuestaAsistencia('sincronizar-offline'),
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
  medirTiempoRespuestaAsistencia('consultar-sesion'),
  consultarSesion
);

// ==========================================
// DOCENTE - REGISTRAR ASISTENCIA
// ==========================================

router.post(
  '/sesiones/:sesionId/asistencias',
  permitirRoles('docente'),
  medirTiempoRespuestaAsistencia('registrar-asistencias'),
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
  medirTiempoRespuestaAsistencia('listar-sesiones-administrativas'),
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
  medirTiempoRespuestaAsistencia('consultar-sesion-administrativa'),
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
  medirTiempoRespuestaAsistencia('corregir-asistencia'),
  corregirAsistencia
);

module.exports = router;
