'use strict';

// ======================================================
// AULA-AI | HU-11
// RUTAS DE PLANES DE ACOMPAÑAMIENTO ACADÉMICO
// ======================================================

const express = require('express');

const {
  verificarToken,
  permitirRoles,
} = require('../middleware/authMiddleware');

const {
  listarPlanesEstudiante,
  obtenerPlanEstudiante,
  registrarPlanAcompanamiento,
  modificarPlanAcompanamiento,
} = require('../controllers/academicPlanController');

const router = express.Router();

// ======================================================
// SEGURIDAD GENERAL
// ======================================================

// Todas las rutas requieren un JWT válido.
router.use(verificarToken);

// ======================================================
// CONSULTAR PLANES DE UN ESTUDIANTE
// ======================================================

// GET /api/planes-acompanamiento/estudiante/:estudianteId

router.get(
  '/estudiante/:estudianteId',
  permitirRoles(
    'estudiante',
    'orientador',
    'coordinador'
  ),
  listarPlanesEstudiante
);

// ======================================================
// CONSULTAR UN PLAN ESPECÍFICO
// ======================================================

// GET /api/planes-acompanamiento/estudiante/:estudianteId/:planId

router.get(
  '/estudiante/:estudianteId/:planId',
  permitirRoles(
    'estudiante',
    'orientador',
    'coordinador'
  ),
  obtenerPlanEstudiante
);

// ======================================================
// CREAR PLAN DE ACOMPAÑAMIENTO
// ======================================================

// POST /api/planes-acompanamiento/estudiante/:estudianteId

router.post(
  '/estudiante/:estudianteId',
  permitirRoles('orientador'),
  registrarPlanAcompanamiento
);

// ======================================================
// ACTUALIZAR PLAN DE ACOMPAÑAMIENTO
// ======================================================

// PATCH /api/planes-acompanamiento/estudiante/:estudianteId/:planId

router.patch(
  '/estudiante/:estudianteId/:planId',
  permitirRoles('orientador'),
  modificarPlanAcompanamiento
);

// ======================================================
// EXPORTACIÓN
// ======================================================

module.exports = router;
