const express = require('express');

const {
  registrarMateria,
  listarMaterias,
  actualizarMateria,
  listarMateriasDocente,
  listarMateriasEstudiante,
} = require('../controllers/subjectController');

const {
  verificarToken,
  permitirRoles,
} = require('../middleware/authMiddleware');

const router = express.Router();

router.get(
  '/mis-materias',
  verificarToken,
  permitirRoles('docente'),
  listarMateriasDocente
);

router.get(
  '/mis-materias-estudiante',
  verificarToken,
  permitirRoles('estudiante'),
  listarMateriasEstudiante
);

router.get(
  '/',
  verificarToken,
  permitirRoles(
    'administrador',
    'coordinador'
  ),
  listarMaterias
);

/**
 * Registrar una nueva materia.
 *
 * Solo pueden hacerlo:
 * - Administrador
 * - Coordinador
 */
router.post(
  '/',
  verificarToken,
  permitirRoles(
    'administrador',
    'coordinador'
  ),
  registrarMateria
);

router.put(
  '/:id',
  verificarToken,
  permitirRoles(
    'administrador',
    'coordinador'
  ),
  actualizarMateria
);

module.exports = router;
