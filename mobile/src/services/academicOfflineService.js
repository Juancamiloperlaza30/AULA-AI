import { iniciarBaseLocal } from '../../database/localDatabase';

// =====================================================
// AULA-AI - HU-14
// CONSULTAS ACADEMICAS OFFLINE
// =====================================================

// Solo se permite consultar estas tablas.
const TABLAS_PERMITIDAS = [
  'materias_locales',
  'actividades_locales',
  'calificaciones_locales',
];

const validarUsuarioId = (usuarioId) => {
  if (
    typeof usuarioId !== 'string' ||
    usuarioId.trim().length === 0
  ) {
    throw new Error(
      'El identificador del usuario no es valido.'
    );
  }

  return usuarioId.trim();
};

const consultarTabla = async (tabla, usuarioId) => {
  const id = validarUsuarioId(usuarioId);

  if (!TABLAS_PERMITIDAS.includes(tabla)) {
    throw new Error('Consulta local no autorizada.');
  }

  const db = await iniciarBaseLocal();

  return db.getAllAsync(
    `SELECT * FROM ${tabla} WHERE usuario_id = ?`,
    [id]
  );
};

export const consultarMateriasOffline = async (
  usuarioId
) => {
  return consultarTabla('materias_locales', usuarioId);
};

export const consultarActividadesOffline = async (
  usuarioId
) => {
  return consultarTabla('actividades_locales', usuarioId);
};

export const consultarCalificacionesOffline = async (
  usuarioId
) => {
  return consultarTabla(
    'calificaciones_locales',
    usuarioId
  );
};

export const consultarResumenAcademicoOffline = async (
  usuarioId
) => {
  const id = validarUsuarioId(usuarioId);

  const [materias, actividades, calificaciones] =
    await Promise.all([
      consultarMateriasOffline(id),
      consultarActividadesOffline(id),
      consultarCalificacionesOffline(id),
    ]);

  const fechas = [
    ...materias,
    ...actividades,
    ...calificaciones,
  ]
    .map((registro) => registro.sincronizado_en)
    .filter(Boolean)
    .map((fecha) => new Date(fecha).getTime())
    .filter(Number.isFinite);

  return {
    usuarioId: id,
    materias,
    actividades,
    calificaciones,
    totales: {
      materias: materias.length,
      actividades: actividades.length,
      calificaciones: calificaciones.length,
    },
    ultimaSincronizacion:
      fechas.length > 0
        ? new Date(Math.max(...fechas)).toISOString()
        : null,
    disponible:
      materias.length > 0 ||
      actividades.length > 0 ||
      calificaciones.length > 0,
  };
};