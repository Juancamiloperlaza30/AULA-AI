'use strict';

/**
 * HU-11
 * Recomendaciones académicas de respaldo.
 *
 * Este servicio:
 * - No utiliza OpenAI.
 * - No consulta Supabase.
 * - No modifica registros.
 * - No toma decisiones académicas definitivas.
 * - Utiliza únicamente indicadores disponibles.
 */

const generarRecomendacionesRespaldo = (contextoIA) => {
  if (
    !contextoIA ||
    typeof contextoIA !== 'object' ||
    !contextoIA.calificaciones ||
    !contextoIA.actividades ||
    !contextoIA.asistencia ||
    !contextoIA.riesgos
  ) {
    throw new Error(
      'El contexto académico para recomendaciones no es válido.'
    );
  }

  const recomendaciones = [];

  const agregarRecomendacion = ({
    categoria,
    prioridad,
    titulo,
    descripcion,
    acciones,
  }) => {
    recomendaciones.push({
      categoria,
      prioridad,
      titulo,
      descripcion,
      acciones,
    });
  };

  // 1. Actividades vencidas sin entrega válida.
  if (contextoIA.actividades.totalVencidas > 0) {
    agregarRecomendacion({
      categoria: 'actividades',
      prioridad: 'alta',
      titulo: 'Revisar actividades vencidas',
      descripcion:
        'Se identificaron actividades cuya fecha límite pasó sin una entrega válida registrada.',
      acciones: [
        'Consultar las actividades pendientes en AULA-AI.',
        'Verificar con el docente el estado de cada actividad.',
        'Organizar un plan para ponerse al día cuando sea posible.',
      ],
    });
  }

  // 2. Actividades pendientes dentro del plazo.
  if (contextoIA.actividades.totalEnPlazo > 0) {
    agregarRecomendacion({
      categoria: 'organizacion',
      prioridad: 'media',
      titulo: 'Organizar las actividades próximas',
      descripcion:
        'Existen actividades sin entrega registrada que todavía se encuentran dentro del plazo.',
      acciones: [
        'Revisar las fechas límite de las actividades.',
        'Organizar un horario de estudio.',
        'Priorizar las actividades con vencimiento más cercano.',
      ],
    });
  }

  // 3. Inasistencias registradas.
  if (
    contextoIA.asistencia.hayRegistros &&
    contextoIA.asistencia.totalAusencias > 0
  ) {
    agregarRecomendacion({
      categoria: 'asistencia',
      prioridad: 'media',
      titulo: 'Fortalecer la asistencia a clases',
      descripcion:
        'Se identificaron registros de inasistencia que conviene revisar.',
      acciones: [
        'Consultar las fechas de inasistencia.',
        'Verificar si existen excusas pendientes de revisión.',
        'Solicitar orientación sobre los contenidos trabajados.',
      ],
    });
  }

  // 4. Llegadas tarde registradas.
  if (
    contextoIA.asistencia.hayRegistros &&
    contextoIA.asistencia.totalLlegadasTarde > 0
  ) {
    agregarRecomendacion({
      categoria: 'puntualidad',
      prioridad: 'media',
      titulo: 'Mejorar la puntualidad',
      descripcion:
        'Se identificaron registros de llegadas tarde.',
      acciones: [
        'Revisar los horarios de clase.',
        'Preparar con anticipación los materiales necesarios.',
        'Establecer una rutina para llegar a tiempo.',
      ],
    });
  }

  // 5. Alertas académicas pendientes.
  if (contextoIA.riesgos.totalPendientesAtencion > 0) {
    const existeRiesgoAlto =
      contextoIA.riesgos.pendientesPorNivel?.alta > 0;

    agregarRecomendacion({
      categoria: 'acompanamiento',
      prioridad: existeRiesgoAlto ? 'alta' : 'media',
      titulo: 'Continuar el acompañamiento académico',
      descripcion:
        'Existen alertas académicas activas o en seguimiento que requieren atención.',
      acciones: [
        'Revisar las alertas académicas disponibles.',
        'Consultar las recomendaciones del orientador.',
        'Dar continuidad a las acciones de acompañamiento.',
      ],
    });
  }

  // 6. Calificaciones disponibles.
  if (contextoIA.calificaciones.cantidadCalificaciones > 0) {
    agregarRecomendacion({
      categoria: 'estudio',
      prioridad: 'media',
      titulo: 'Revisar el desempeño académico',
      descripcion:
        'Existen calificaciones registradas que pueden utilizarse para orientar hábitos de estudio. El promedio disponible no representa necesariamente la nota oficial.',
      acciones: [
        'Revisar las calificaciones de las actividades.',
        'Identificar los temas que requieren refuerzo.',
        'Consultar al docente cuando existan dificultades.',
      ],
    });
  }

  // 7. Ausencia de indicadores suficientes.
  if (recomendaciones.length === 0) {
    agregarRecomendacion({
      categoria: 'general',
      prioridad: 'baja',
      titulo: 'Mantener hábitos de estudio',
      descripcion:
        'Actualmente no existen indicadores suficientes para identificar necesidades académicas específicas.',
      acciones: [
        'Mantener un horario de estudio.',
        'Consultar periódicamente las actividades.',
        'Solicitar acompañamiento cuando sea necesario.',
      ],
    });
  }

  // 8. Ordenar recomendaciones por prioridad.
  const ordenPrioridad = {
    alta: 1,
    media: 2,
    baja: 3,
  };

  recomendaciones.sort(
    (a, b) =>
      ordenPrioridad[a.prioridad] -
      ordenPrioridad[b.prioridad]
  );

  return {
    origen: 'plantilla',
    version: 1,

    aviso:
      'Sugerencia académica generada mediante reglas predefinidas. Requiere revisión y seguimiento según corresponda.',

    notaOrigen:
      'Estas recomendaciones fueron generadas mediante reglas académicas predefinidas, sin utilizar inteligencia artificial.',

    recomendaciones,
  };
};

module.exports = {
  generarRecomendacionesRespaldo,
};
