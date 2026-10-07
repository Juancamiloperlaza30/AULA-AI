const express = require('express');

const {
  listarGrados,
  listarGruposPorGrado,
  obtenerPeriodoActual,
  listarPeriodosAcademicos,
  listarPeriodosDisponibles,
  actualizarPeriodoAcademico,
  listarDocentes,
} = require('../controllers/academicController');

const {
  verificarToken,
  permitirRoles,
} = require('../middleware/authMiddleware');

const router = express.Router();

router.get(
  '/periodos',
  verificarToken,
  permitirRoles(
    'administrador',
    'coordinador'
  ),
  listarPeriodosAcademicos
);

router.put(
  '/periodos/:periodoId',
  verificarToken,
  permitirRoles(
    'administrador',
    'coordinador'
  ),
  actualizarPeriodoAcademico
);

router.get(
  '/periodo-actual',
  verificarToken,
  obtenerPeriodoActual
);

router.get(
  '/periodos-disponibles',
  verificarToken,
  permitirRoles(
    'estudiante',
    'acudiente'
  ),
  listarPeriodosDisponibles
);

router.get(
  '/docentes',
  verificarToken,
  listarDocentes
);

/**
 * Solo usuarios autenticados pueden consultar
 * la estructura académica.
 */
router.get(
  '/grados',
  verificarToken,
  listarGrados
);

router.get(
  '/grados/:gradoId/grupos',
  verificarToken,
  listarGruposPorGrado
);

module.exports = router;