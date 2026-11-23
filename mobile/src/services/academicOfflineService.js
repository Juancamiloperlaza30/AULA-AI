import {
  iniciarBaseLocal,
  obtenerEstadosCacheAcademicaLocales,
  obtenerRecursoEstudianteLocal,
} from '../../database/localDatabase';

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

  const resultados = await Promise.allSettled([
    consultarMateriasOffline(id),
    consultarActividadesOffline(id),
    consultarCalificacionesOffline(id),
    obtenerRecursoEstudianteLocal(
      id,
      'planes_refuerzo'
    ),
    obtenerRecursoEstudianteLocal(
      id,
      'recomendaciones'
    ),
    obtenerEstadosCacheAcademicaLocales(id),
  ]);

  const valor = (indice, alternativa) =>
    resultados[indice].status === 'fulfilled'
      ? resultados[indice].value
      : alternativa;

  const errores = {};
  const nombres = [
    'materias',
    'actividades',
    'calificaciones',
    'planesRefuerzo',
    'recomendaciones',
    'sincronizaciones',
  ];

  resultados.forEach((resultado, indice) => {
    if (resultado.status === 'rejected') {
      errores[nombres[indice]] =
        resultado.reason?.message ||
        'No fue posible leer la copia local.';
    }
  });

  const materias = valor(0, []);
  const actividades = valor(1, []);
  const calificaciones = valor(2, []);
  const planes = valor(3, null);
  const recomendaciones = valor(4, null);
  const estadosCache = valor(5, []);

  const fechasActualizacion = {};

  const registrarFecha = (recurso, fecha) => {
    if (!fecha) return;

    const actual = fechasActualizacion[recurso];
    const fechaActual = actual
      ? new Date(actual).getTime()
      : 0;
    const fechaNueva = new Date(fecha).getTime();

    if (
      Number.isFinite(fechaNueva) &&
      fechaNueva > fechaActual
    ) {
      fechasActualizacion[recurso] = fecha;
    }
  };

  estadosCache.forEach((estado) => {
    registrarFecha(
      estado.recurso,
      estado.sincronizado_en
    );
  });

  materias.forEach((item) =>
    registrarFecha('materias', item.sincronizado_en)
  );
  actividades.forEach((item) =>
    registrarFecha('actividades', item.sincronizado_en)
  );
  calificaciones.forEach((item) =>
    registrarFecha(
      'calificaciones',
      item.sincronizado_en
    )
  );
  registrarFecha('planesRefuerzo', planes?.sincronizadoEn);
  registrarFecha(
    'recomendaciones',
    recomendaciones?.sincronizadoEn
  );

  const fechas = Object.values(fechasActualizacion)
    .map((fecha) => new Date(fecha).getTime())
    .filter(Number.isFinite);

  return {
    usuarioId: id,
    materias,
    actividades,
    calificaciones,
    planesRefuerzo: planes?.datos ?? [],
    recomendaciones: recomendaciones?.datos ?? [],
    disponibilidad: {
      materias:
        Boolean(fechasActualizacion.materias) ||
        materias.length > 0,
      actividades:
        Boolean(fechasActualizacion.actividades) ||
        actividades.length > 0,
      calificaciones:
        Boolean(fechasActualizacion.calificaciones) ||
        calificaciones.length > 0,
      planesRefuerzo: planes !== null,
      recomendaciones: recomendaciones !== null,
    },
    fechasActualizacion,
    errores,
    totales: {
      materias: materias.length,
      actividades: actividades.length,
      calificaciones: calificaciones.length,
      planesRefuerzo:
        planes?.datos?.length ?? 0,
      recomendaciones:
        recomendaciones?.datos?.length ?? 0,
    },
    ultimaSincronizacion:
      fechas.length > 0
        ? new Date(Math.max(...fechas)).toISOString()
        : null,
    disponible:
      materias.length > 0 ||
      actividades.length > 0 ||
      calificaciones.length > 0 ||
      planes !== null ||
      recomendaciones !== null ||
      Object.keys(fechasActualizacion).length > 0,
  };
};