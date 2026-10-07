const express = require('express');

const router = express.Router();

const {
  verificarToken,
  permitirRoles,
} = require('../middleware/authMiddleware');

const upload =
  require('../middleware/uploadMiddleware');

const {
  listarAsignacionesDocente,
  registrarActividad,
  listarActividadesDocente,
  listarActividadesEstudiante,
  listarActividadesAdministrativas,
  actualizarActividadAdministrativa,

  subirRecursoActividad,
  agregarEnlaceActividad,
  listarRecursosActividad,

  registrarEntregaEstudiante,
  subirRecursoEntrega,
  agregarEnlaceEntrega,
  deshacerEntregaEstudiante,
  consultarMiEntrega,

  listarEntregasActividadDocente,
} = require('../controllers/activityController');

// ======================================================
// DOCENTE - ASIGNACIONES
// ======================================================

router.get(
  '/mis-asignaciones',
  verificarToken,
  permitirRoles('docente'),
  listarAsignacionesDocente
);

// ======================================================
// DOCENTE - SUS ACTIVIDADES
// ======================================================

router.get(
  '/mis-actividades',
  verificarToken,
  permitirRoles('docente'),
  listarActividadesDocente
);

// ======================================================
// ESTUDIANTE - SUS ACTIVIDADES
// ======================================================

router.get(
  '/mis-actividades-estudiante',
  verificarToken,
  permitirRoles('estudiante'),
  listarActividadesEstudiante
);

// ======================================================
// ADMINISTRADOR / COORDINADOR
// ======================================================

router.get(
  '/administrativas',
  verificarToken,
  permitirRoles(
    'administrador',
    'coordinador'
  ),
  listarActividadesAdministrativas
);

// ======================================================
// RECURSOS DE UNA ACTIVIDAD
// DOCENTE / ESTUDIANTE / ADMIN / COORDINADOR
// ======================================================

router.get(
  '/:id/recursos',
  verificarToken,
  permitirRoles(
    'docente',
    'estudiante',
    'administrador',
    'coordinador'
  ),
  listarRecursosActividad
);

// ======================================================
// DOCENTE - SUBIR ARCHIVO A ACTIVIDAD
// ======================================================

router.post(
  '/:id/recursos',
  verificarToken,
  permitirRoles('docente'),
  upload.single('archivo'),
  subirRecursoActividad
);

// ======================================================
// DOCENTE - AGREGAR ENLACE A ACTIVIDAD
// ======================================================

router.post(
  '/:id/enlaces',
  verificarToken,
  permitirRoles('docente'),
  agregarEnlaceActividad
);

// ======================================================
// ESTUDIANTE - REGISTRAR ENTREGA
// ======================================================

router.post(
  '/:id/entregas',
  verificarToken,
  permitirRoles('estudiante'),
  registrarEntregaEstudiante
);

// ======================================================
// ESTUDIANTE - SUBIR ARCHIVO A SU ENTREGA
// ======================================================

router.post(
  '/entregas/:entregaId/recursos',
  verificarToken,
  permitirRoles('estudiante'),
  upload.single('archivo'),
  subirRecursoEntrega
);

// ======================================================
// ESTUDIANTE - AGREGAR ENLACE A SU ENTREGA
// ======================================================

router.post(
  '/entregas/:entregaId/enlaces',
  verificarToken,
  permitirRoles('estudiante'),
  agregarEnlaceEntrega
);

// ======================================================
// ESTUDIANTE - DESHACER ENTREGA
// ======================================================

router.put(
  '/entregas/:entregaId/deshacer',
  verificarToken,
  permitirRoles('estudiante'),
  deshacerEntregaEstudiante
);

// ======================================================
// ESTUDIANTE - CONSULTAR SU ENTREGA
// ======================================================

router.get(
  '/entregas/:entregaId',
  verificarToken,
  permitirRoles('estudiante'),
  consultarMiEntrega
);

// ======================================================
// DOCENTE - VER ENTREGAS DE UNA ACTIVIDAD
// ======================================================

router.get(
  '/:id/entregas',
  verificarToken,
  permitirRoles('docente'),
  listarEntregasActividadDocente
);

// ======================================================
// ADMINISTRADOR / COORDINADOR - MODIFICAR ACTIVIDAD
// ======================================================

router.put(
  '/:id',
  verificarToken,
  permitirRoles(
    'administrador',
    'coordinador'
  ),
  actualizarActividadAdministrativa
);

// ======================================================
// DOCENTE - CREAR ACTIVIDAD
// IMPORTANTE: ESTA RUTA VA AL FINAL
// ======================================================

router.post(
  '/',
  verificarToken,
  permitirRoles('docente'),
  registrarActividad
);

module.exports = router;
