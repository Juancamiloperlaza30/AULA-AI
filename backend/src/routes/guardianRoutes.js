'use strict';

// ======================================================
// AULA-AI | HU-08
// RUTAS DE SEGUIMIENTO ACADÉMICO DEL ACUDIENTE
//
// Seguridad:
// - Token JWT obligatorio.
// - Rol acudiente obligatorio.
// - Vinculación activa y verificada.
// - Consultas académicas de solo lectura.
//
// La autorización por estudiante se verifica
// dentro de cada controlador.
// ======================================================

const express = require('express');

const router = express.Router();

// ======================================================
// AUTENTICACIÓN Y AUTORIZACIÓN
// ======================================================

const {
  verificarToken,
  permitirRoles,
} = require('../middleware/authMiddleware');

// ======================================================
// ESTUDIANTES VINCULADOS
// ======================================================

const {
  listarMisEstudiantes,
} = require('../controllers/guardianController');

// ======================================================
// CALIFICACIONES
// ======================================================

const {
  listarCalificacionesAcudiente,
} = require('../controllers/guardianGradesController');

// ======================================================
// ACTIVIDADES Y EVALUACIONES
// ======================================================

const {
  listarActividadesAcudiente,
} = require('../controllers/guardianActivitiesController');

// ======================================================
// ASISTENCIA
// ======================================================

const {
  consultarAsistenciaAcudiente,
} = require('../controllers/guardianAttendanceController');

// ======================================================
// HU-09 | EXCUSAS ACADÉMICAS
// ======================================================

const {
  listarInasistenciasParaExcusas,
} = require('../controllers/guardianExcusesController');

// ======================================================
// HU-09 | ENVIO DE EXCUSAS CON SOPORTE
// ======================================================

const {
  crearExcusaAcudiente,
} = require('../controllers/guardianExcuseSubmissionController');

const {
  recibirSoporteExcusa,
} = require('../middleware/excuseUploadMiddleware');

const {
  listarExcusasAcudiente,
} = require('../controllers/guardianExcuseTrackingController');

const {
  descargarSoporteExcusa,
} = require('../controllers/guardianExcuseSupportController');

// ======================================================
// ALERTAS E HISTORIAL ACADÉMICO
// ======================================================

const {
  listarAlertasAcudiente,
  listarHistorialAlertasAcudiente,
} = require('../controllers/guardianAlertsController');

// ======================================================
// PROTEGER TODAS LAS RUTAS DEL ACUDIENTE
// ======================================================

router.use(verificarToken);

router.use(
  permitirRoles('acudiente')
);

// ======================================================
// HU-08 | ESTUDIANTES AUTORIZADOS
//
// GET /api/guardian/mis-estudiantes
// ======================================================

router.get(
  '/mis-estudiantes',
  listarMisEstudiantes
);

// ======================================================
// HU-08 | CALIFICACIONES
//
// GET /api/guardian/estudiantes/:estudianteId/calificaciones
//
// Filtro opcional:
// ?periodoId=1
// ======================================================

router.get(
  '/estudiantes/:estudianteId/calificaciones',
  listarCalificacionesAcudiente
);

// ======================================================
// HU-08 | ACTIVIDADES Y EVALUACIONES
//
// GET /api/guardian/estudiantes/:estudianteId/actividades
// ======================================================

router.get(
  '/estudiantes/:estudianteId/actividades',
  listarActividadesAcudiente
);

// ======================================================
// HU-08 | HISTORIAL DE ASISTENCIA
//
// GET /api/guardian/estudiantes/:estudianteId/asistencia
//
// Filtro opcional:
// ?periodoId=1
// ======================================================

router.get(
  '/estudiantes/:estudianteId/asistencia',
  consultarAsistenciaAcudiente
);

// ======================================================
// HU-08 | HISTORIAL DE ALERTAS ACADÉMICAS
//
// GET /api/guardian/estudiantes/:estudianteId/alertas/historial
//
// Filtros opcionales:
//
// ?evento=creada
// ?evento=actualizada
// ?evento=resuelta
// ?evento=reabierta
//
// ?tipo=bajo_rendimiento
// ?tipo=inasistencias
// ?tipo=llegadas_tarde
// ?tipo=actividad_incumplida
//
// ?periodoId=1
// ?pagina=1
// ?limite=20
//
// El controlador comprueba que el acudiente
// tenga una vinculación activa y verificada
// con el estudiante solicitado.
//
// Consulta exclusivamente de lectura.
// ======================================================

router.get(
  '/estudiantes/:estudianteId/alertas/historial',
  listarHistorialAlertasAcudiente
);

// ======================================================
// HU-08 | ALERTAS ACADÉMICAS ACTUALES
//
// GET /api/guardian/estudiantes/:estudianteId/alertas
//
// Filtros opcionales:
//
// ?estado=activa
// ?estado=en_seguimiento
// ?estado=resuelta
//
// ?tipo=bajo_rendimiento
// ?tipo=inasistencias
// ?tipo=llegadas_tarde
// ?tipo=actividad_incumplida
//
// ?nivel=baja
// ?nivel=media
// ?nivel=alta
// ?nivel=critica
//
// ?pagina=1
// ?limite=20
//
// Consulta exclusivamente de lectura.
// ======================================================

router.get(
  '/estudiantes/:estudianteId/alertas',
  listarAlertasAcudiente
);

// ======================================================
// AULA-AI | HU-09
// CONSULTAR INASISTENCIAS PARA EXCUSAS
//
// GET /api/guardian/estudiantes/:estudianteId/excusas/inasistencias
//
// Seguridad:
// - JWT obligatorio.
// - Rol acudiente.
// - Vinculación activa y verificada.
// - Solo inasistencias registradas.
// ======================================================

router.get(
  '/estudiantes/:estudianteId/excusas/inasistencias',
  listarInasistenciasParaExcusas
);

// ======================================================
// AULA-AI | HU-09
// REGISTRO DE EXCUSAS ACADEMICAS
//
// POST /api/guardian/estudiantes/:estudianteId/excusas
//
// multipart/form-data:
// - asistenciaId
// - motivo
// - claveIdempotencia
// - soporte
// ======================================================

router.post(
  '/estudiantes/:estudianteId/excusas',
  recibirSoporteExcusa,
  crearExcusaAcudiente
);

// ======================================================
// HU-09 | SEGUIMIENTO DE EXCUSAS DEL ACUDIENTE
// ======================================================

router.get(
  '/estudiantes/:estudianteId/excusas',
  listarExcusasAcudiente
);

// =====================================================
// HU-09 | DESCARGA SEGURA DE SOPORTES
// =====================================================

router.get(
  '/estudiantes/:estudianteId/excusas/:excusaId/soportes/:soporteId/descargar',
  descargarSoporteExcusa
);

// ======================================================
// EXPORTAR RUTAS
// ======================================================

module.exports = router;
