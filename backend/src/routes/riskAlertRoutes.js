
'use strict';

// ======================================================
// AULA-AI | HU-10
// RUTAS DE ALERTAS DE RIESGO ACADÉMICO
// ======================================================

const express = require('express');

const {
  verificarToken,
  permitirRoles,
} = require('../middleware/authMiddleware');

const {
  listarAlertasOrientador,
  obtenerAlertaOrientador,
  crearSeguimientoOrientador,
  obtenerSeguimientosOrientador,
  iniciarSeguimientoAlerta,
  cerrarAlertaAcademica,
} = require('../controllers/riskAlertController');

const router = express.Router();

// ======================================================
// SEGURIDAD GENERAL DEL MÓDULO
// ======================================================

router.use(verificarToken);
router.use(permitirRoles('orientador'));

// ======================================================
// LISTAR ALERTAS DEL ORIENTADOR
// ======================================================

// GET /api/risk-alerts/orientador
// GET /api/risk-alerts/orientador?pagina=2

router.get(
  '/orientador',
  listarAlertasOrientador
);

// ======================================================
// CONSULTAR UNA ALERTA ESPECÍFICA
// ======================================================

// GET /api/risk-alerts/orientador/:alertaId

router.get(
  '/orientador/:alertaId',
  obtenerAlertaOrientador
);

// ======================================================
// REGISTRAR SEGUIMIENTO ACADÉMICO
// ======================================================

// POST /api/risk-alerts/orientador/:alertaId/seguimientos

router.post(
  '/orientador/:alertaId/seguimientos',
  crearSeguimientoOrientador
);

router.get(
  '/orientador/:alertaId/seguimientos',
  obtenerSeguimientosOrientador
);

// ======================================================
// HU-10 | INICIAR SEGUIMIENTO ACADÉMICO
// ======================================================

router.patch(
  '/orientador/:alertaId/iniciar-seguimiento',
  iniciarSeguimientoAlerta
);

// ======================================================
// HU-10 | CIERRE MANUAL DE ALERTAS
// ======================================================

router.patch(
  '/orientador/:alertaId/cerrar',
  cerrarAlertaAcademica
);

// ======================================================
// EXPORTACIÓN
// ======================================================

module.exports = router;
