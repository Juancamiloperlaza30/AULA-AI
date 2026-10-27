'use strict';

// ======================================================
// AULA-AI | HU-09
// RUTAS DE REVISION DE EXCUSAS ACADEMICAS
//
// Roles autorizados:
// - docente
// - coordinador
//
// La autorizacion por estudiante y la asignacion
// de la revision se verifican en el controlador.
// ======================================================

const express = require('express');

const router = express.Router();

const {
  verificarToken,
  permitirRoles,
} = require('../middleware/authMiddleware');

const {
  listarExcusasRevision,
  obtenerDetalleExcusa,
  asumirRevisionExcusa,
  resolverExcusa,
} = require('../controllers/excuseReviewController');

const {
  listarSoportesRevision,
  descargarSoporteRevision,
} = require('../controllers/excuseReviewSupportController');

// Autenticacion y autorizacion obligatorias.
router.use(verificarToken);

router.use(
  permitirRoles('docente', 'coordinador')
);

// Consultar excusas autorizadas.
router.get(
  '/',
  listarExcusasRevision
);

// Consultar detalle y registrar visualizacion.
router.get(
  '/:excusaId',
  obtenerDetalleExcusa
);

router.get(
  '/:excusaId/soportes',
  listarSoportesRevision
);

router.get(
  '/:excusaId/soportes/:soporteId/descargar',
  descargarSoporteRevision
);

// Asumir la revision de una excusa pendiente.
router.post(
  '/:excusaId/asumir',
  asumirRevisionExcusa
);

// Aprobar o rechazar una excusa.
router.post(
  '/:excusaId/resolver',
  resolverExcusa
);

module.exports = router;
