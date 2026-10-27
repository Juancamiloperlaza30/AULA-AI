
'use strict';

// ======================================================
// AULA-AI | HU-05 + HU-08
// RUTAS DE CALIFICACIONES Y ALERTAS ACADÉMICAS
//
// HU-05:
// - Actividades calificables del docente.
// - Estudiantes por actividad.
// - Registro masivo de calificaciones.
// - Correcciones administrativas.
// - Consulta de calificaciones del estudiante.
//
// HU-08:
// - Evaluación automática tras guardar notas.
// - Recálculo por estudiante, materia y período.
// - Detección de riesgo académico.
// - Actualización de alertas existentes.
//
// Seguridad:
// - Token JWT obligatorio.
// - Validación de roles por ruta.
// - Conservación de permisos existentes.
// ======================================================

const express = require('express');

const router = express.Router();

// ======================================================
// MIDDLEWARE DE AUTENTICACIÓN
// ======================================================

const {
  verificarToken,
  permitirRoles,
} = require('../middleware/authMiddleware');

// ======================================================
// CONTROLADOR DE CALIFICACIONES
// ======================================================

const {
  listarActividadesCalificablesDocente,
  listarEstudiantesActividadDocente,
  registrarCalificacionesMasivas,
  actualizarCalificacionAdministrativa,
  listarCalificacionesEstudiante,
} = require('../controllers/gradeController');

// ======================================================
// HU-08 | MIDDLEWARE DE ALERTAS ACADÉMICAS
// ======================================================

const {
  alertasTrasRegistroDocente,
  alertasTrasCorreccionAdministrativa,
} = require('../middleware/gradeAlertMiddleware');

// ======================================================
// DOCENTE | ACTIVIDADES CALIFICABLES
// ======================================================

router.get(
  '/docente/actividades',
  verificarToken,
  permitirRoles('docente'),
  listarActividadesCalificablesDocente
);

// ======================================================
// DOCENTE | ESTUDIANTES DE UNA ACTIVIDAD
// ======================================================

router.get(
  '/docente/actividades/:actividadId/estudiantes',
  verificarToken,
  permitirRoles('docente'),
  listarEstudiantesActividadDocente
);

// ======================================================
// DOCENTE | REGISTRAR Y ACTUALIZAR CALIFICACIONES
//
// Primero:
// - Autenticar.
// - Validar rol.
//
// Después:
// - Preparar evaluación automática.
//
// Finalmente:
// - Ejecutar el controlador original.
//
// El middleware evaluará las alertas únicamente
// cuando la respuesta del controlador sea exitosa.
// ======================================================

router.post(
  '/docente/calificaciones',
  verificarToken,
  permitirRoles('docente'),
  alertasTrasRegistroDocente,
  registrarCalificacionesMasivas
);

// ======================================================
// ADMINISTRADOR / COORDINADOR
// CORRECCIÓN DE CALIFICACIONES
//
// Se conservan las validaciones originales,
// el historial y el registro de auditoría.
//
// Al finalizar correctamente la modificación,
// se recalcula el rendimiento del estudiante.
// ======================================================

router.put(
  '/administrativas/:calificacionId',
  verificarToken,
  permitirRoles(
    'administrador',
    'coordinador'
  ),
  alertasTrasCorreccionAdministrativa,
  actualizarCalificacionAdministrativa
);

// ======================================================
// ESTUDIANTE | CONSULTAR CALIFICACIONES
//
// Esta ruta permanece sin cambios funcionales.
// ======================================================

router.get(
  '/estudiante/mis-calificaciones',
  verificarToken,
  permitirRoles('estudiante'),
  listarCalificacionesEstudiante
);

// ======================================================
// EXPORTAR ROUTER
// ======================================================

module.exports = router;
