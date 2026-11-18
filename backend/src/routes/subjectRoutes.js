const express = require('express');
const { performance } = require('node:perf_hooks');

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

const medirTiempoRespuesta = (operacion) => (
  req,
  res,
  next
) => {
  const inicio = performance.now();

  res.once('finish', () => {
    console.info('[RNF-03.4] Tiempo de respuesta (ms):', {
      operacion,
      estado: res.statusCode,
      total: Math.round(performance.now() - inicio),
    });
  });

  next();
};

router.get(
  '/mis-materias',
  medirTiempoRespuesta('listar_materias_docente'),
  verificarToken,
  permitirRoles('docente'),
  listarMateriasDocente
);

router.get(
  '/mis-materias-estudiante',
  medirTiempoRespuesta('listar_materias_estudiante'),
  verificarToken,
  permitirRoles('estudiante'),
  listarMateriasEstudiante
);

router.get(
  '/',
  medirTiempoRespuesta('listar_materias'),
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
  medirTiempoRespuesta('registrar_materia'),
  verificarToken,
  permitirRoles(
    'administrador',
    'coordinador'
  ),
  registrarMateria
);

router.put(
  '/:id',
  medirTiempoRespuesta('actualizar_materia'),
  verificarToken,
  permitirRoles(
    'administrador',
    'coordinador'
  ),
  actualizarMateria
);

module.exports = router;
