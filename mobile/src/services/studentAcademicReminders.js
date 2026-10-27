/**
 * AULA-AI | HU-07
 * Motor de recordatorios académicos.
 *
 * Analiza actividades obtenidas del backend
 * o recuperadas desde SQLite.
 *
 * No modifica registros.
 * No envía notificaciones automáticamente.
 */

const ESTADOS_ENTREGA_COMPLETADA = new Set([
  'entregada',
  'entregada_tarde',
]);

const DIAS_ANTICIPACION = 3;
const MILISEGUNDOS_DIA = 24 * 60 * 60 * 1000;

const obtenerFechaValida = (valor) => {
  if (!valor) return null;

  const fecha = new Date(valor);

  return Number.isNaN(fecha.getTime())
    ? null
    : fecha;
};

const obtenerEntrega = (actividad) => {
  const entrega = actividad?.entrega;

  if (Array.isArray(entrega)) {
    return entrega[0] || null;
  }

  if (entrega && typeof entrega === 'object') {
    return entrega;
  }

  // Compatibilidad con registros SQLite
  // que todavía no han sido adaptados.
  if (actividad?.entrega_id) {
    return {
      id: actividad.entrega_id,
      estado: actividad.entrega_estado,
    };
  }

  return null;
};

const obtenerMateria = (actividad) => {
  const asignacion =
    actividad?.materia_grupo_periodo;

  const materia = Array.isArray(asignacion)
    ? asignacion[0]?.materia
    : asignacion?.materia;

  const materiaReal = Array.isArray(materia)
    ? materia[0]
    : materia;

  return (
    materiaReal?.nombre ||
    actividad?.materia ||
    'Materia no disponible'
  );
};

/**
 * Generar recordatorios de un estudiante.
 *
 * @param {Array} actividades
 * Actividades previamente autorizadas y
 * obtenidas con el JWT del estudiante.
 *
 * @param {Date} fechaReferencia
 * Fecha actual; se puede establecer otra
 * fecha para pruebas.
 */
export const generarRecordatoriosAcademicos = (
  actividades = [],
  fechaReferencia = new Date()
) => {
  if (!Array.isArray(actividades)) {
    throw new Error(
      'La lista de actividades no es válida.'
    );
  }

  const ahora = obtenerFechaValida(
    fechaReferencia
  );

  if (!ahora) {
    throw new Error(
      'La fecha de referencia no es válida.'
    );
  }

  const recordatorios = [];

  for (const actividad of actividades) {
    if (!actividad?.id) {
      continue;
    }

    // No recordar actividades que ya no estén
    // publicadas, cuando se conoce su estado.
    if (
      actividad.estado &&
      actividad.estado !== 'publicada'
    ) {
      continue;
    }

    const entrega = obtenerEntrega(actividad);

    const entregaCompletada =
      ESTADOS_ENTREGA_COMPLETADA.has(
        String(entrega?.estado || '')
          .toLowerCase()
      );

    if (entregaCompletada) {
      continue;
    }

    const fechaLimite = obtenerFechaValida(
      actividad.fecha_entrega
    );

    if (!fechaLimite) {
      continue;
    }

    const diferencia =
      fechaLimite.getTime() -
      ahora.getTime();

    const tipo = String(
      actividad.tipo || 'actividad'
    ).toLowerCase();

    const esExamen =
      tipo === 'examen' ||
      tipo === 'exámen' ||
      tipo === 'evaluacion' ||
      tipo === 'evaluación';

    let categoria;
    let prioridad;

    if (diferencia < 0) {
      categoria = 'vencida';
      prioridad = 'alta';
    } else if (
      diferencia <=
      DIAS_ANTICIPACION *
        MILISEGUNDOS_DIA
    ) {
      categoria = esExamen
        ? 'examen_proximo'
        : 'proxima';

      prioridad = 'media';
    } else {
      // No generar recordatorios innecesarios
      // de actividades demasiado lejanas.
      continue;
    }

    recordatorios.push({
      id: `recordatorio-${actividad.id}`,
      actividadId: actividad.id,
      titulo: actividad.titulo ||
        'Actividad académica',
      materia: obtenerMateria(actividad),
      tipo,
      fechaEntrega:
        fechaLimite.toISOString(),
      categoria,
      prioridad,
      diasRestantes:
        diferencia < 0
          ? 0
          : Math.ceil(
              diferencia /
              MILISEGUNDOS_DIA
            ),
      estadoEntrega:
        entrega?.estado || 'sin_entregar',
    });
  }

  // Priorizar vencidas, luego próximas.
  const ordenPrioridad = {
    vencida: 0,
    examen_proximo: 1,
    proxima: 2,
  };

  recordatorios.sort((a, b) => {
    const prioridadA =
      ordenPrioridad[a.categoria] ?? 99;

    const prioridadB =
      ordenPrioridad[b.categoria] ?? 99;

    if (prioridadA !== prioridadB) {
      return prioridadA - prioridadB;
    }

    return (
      new Date(a.fechaEntrega).getTime() -
      new Date(b.fechaEntrega).getTime()
    );
  });

  return recordatorios;
};

export const resumirRecordatoriosAcademicos = (
  recordatorios = []
) => ({
  total: recordatorios.length,
  vencidas: recordatorios.filter(
    (item) =>
      item.categoria === 'vencida'
  ).length,
  proximas: recordatorios.filter(
    (item) =>
      item.categoria === 'proxima'
  ).length,
  examenesProximos: recordatorios.filter(
    (item) =>
      item.categoria === 'examen_proximo'
  ).length,
});
