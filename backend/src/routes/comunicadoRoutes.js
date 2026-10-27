
'use strict';

// ======================================================
// AULA-AI | HU-12
// RUTAS DE COMUNICADOS INSTITUCIONALES
// ======================================================

const express = require('express');

const {
  verificarToken,
  permitirRoles,
} = require('../middleware/authMiddleware');

const {
  publicarComunicado,
  listarMisComunicados,
  obtenerDetalleComunicado,
  marcarComunicadoComoLeido,
} = require('../controllers/comunicadoController');

const router = express.Router();

// ======================================================
// CONSULTAR MIS COMUNICADOS
// GET /api/comunicados
// ======================================================

router.get(
  '/',
  verificarToken,
  listarMisComunicados
);

// ======================================================
// CONSULTAR UN COMUNICADO ESPECÍFICO
// GET /api/comunicados/:id
// ======================================================

router.get(
  '/:id',
  verificarToken,
  obtenerDetalleComunicado
);

// ======================================================
// REGISTRAR LECTURA DE UN COMUNICADO
// POST /api/comunicados/:id/lectura
// ======================================================

router.post(
  '/:id/lectura',
  verificarToken,
  marcarComunicadoComoLeido
);

// ======================================================
// PUBLICAR COMUNICADO INSTITUCIONAL
// POST /api/comunicados
// ======================================================

router.post(
  '/',
  verificarToken,
  permitirRoles('administrador', 'coordinador'),
  publicarComunicado
);

// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = router;
