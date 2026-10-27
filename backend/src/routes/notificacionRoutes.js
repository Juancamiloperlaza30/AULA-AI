'use strict';

// ======================================================
// AULA-AI | HU-12
// RUTAS DE NOTIFICACIONES INSTITUCIONALES
// ======================================================

const express = require('express');

// ======================================================
// MIDDLEWARE DE AUTENTICACION
// ======================================================

const {
  verificarToken,
} = require('../middleware/authMiddleware');

// ======================================================
// CONTROLADOR DE NOTIFICACIONES
// ======================================================

const {
  listarMisNotificaciones,
  marcarNotificacionComoLeida,
} = require('../controllers/notificacionController');

// ======================================================
// CONFIGURACION DEL ROUTER
// ======================================================

const router = express.Router();

// ======================================================
// HU-12 | CONSULTAR MIS NOTIFICACIONES
//
// GET /api/notificaciones
//
// Requiere:
// Authorization: Bearer <token>
//
// Parametros opcionales:
// ?pagina=1&limite=20
// ======================================================

router.get(
  '/',
  verificarToken,
  listarMisNotificaciones
);

// ======================================================
// HU-12 | MARCAR NOTIFICACION COMO LEIDA
//
// POST /api/notificaciones/:id/lectura
//
// Requiere:
// Authorization: Bearer <token>
//
// Parametro:
// id = identificador de la notificacion
//
// Seguridad:
// El usuario solo puede marcar sus propias notificaciones.
// ======================================================

router.post(
  '/:id/lectura',
  verificarToken,
  marcarNotificacionComoLeida
);

// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = router;
