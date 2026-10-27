'use strict';

// AULA-AI | HU-11
// Rutas de recomendaciones académicas.

const express = require('express');

const {
  verificarToken,
  permitirRoles,
} = require('../middleware/authMiddleware');

const {
  listarRecomendacionesEstudiante,
  obtenerRecomendacionEstudiante,
} = require(
  '../controllers/academicRecommendationController'
);

const {
  generarRecomendacionEstudiante,
} = require(
  '../controllers/academicRecommendationGenerationController'
);

const router = express.Router();

// Todas las rutas requieren autenticación.
router.use(verificarToken);

// Los roles autorizados pueden acceder al módulo.
// Cada controlador valida el estudiante solicitado.
router.use(
  permitirRoles(
    'estudiante',
    'orientador',
    'coordinador'
  )
);

// Consultar recomendaciones almacenadas.
router.get(
  '/estudiante/:estudianteId',
  listarRecomendacionesEstudiante
);

// Consultar una recomendación específica.
router.get(
  '/estudiante/:estudianteId/:recomendacionId',
  obtenerRecomendacionEstudiante
);

// Generar y guardar recomendaciones académicas.
router.post(
  '/estudiante/:estudianteId/generar',
  permitirRoles('estudiante', 'orientador'),
  generarRecomendacionEstudiante
);

module.exports = router;
