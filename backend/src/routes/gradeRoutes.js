const express =
  require('express');

const router =
  express.Router();

const {
  verificarToken,
  permitirRoles,
} =
  require('../middleware/authMiddleware');

const {
  listarActividadesCalificablesDocente,
  listarEstudiantesActividadDocente,
  registrarCalificacionesMasivas,
  actualizarCalificacionAdministrativa,
  listarCalificacionesEstudiante,
} =
  require('../controllers/gradeController');

router.get(
  '/docente/actividades',
  verificarToken,
  permitirRoles('docente'),
  listarActividadesCalificablesDocente
);

router.get(
  '/docente/actividades/:actividadId/estudiantes',
  verificarToken,
  permitirRoles('docente'),
  listarEstudiantesActividadDocente
);

router.post(
  '/docente/calificaciones',
  verificarToken,
  permitirRoles('docente'),
  registrarCalificacionesMasivas
);

router.put(
  '/administrativas/:calificacionId',
  verificarToken,
  permitirRoles(
    'administrador',
    'coordinador'
  ),
  actualizarCalificacionAdministrativa
);

router.get(
  '/estudiante/mis-calificaciones',
  verificarToken,
  permitirRoles('estudiante'),
  listarCalificacionesEstudiante
);

module.exports = router;
