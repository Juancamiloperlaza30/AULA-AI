
'use strict';

// ======================================================
// AULA-AI | HU-08
// MOTOR DE ALERTAS ACADÉMICAS
//
// Escala: 0.0 a 5.0
// Mínimo aprobatorio: 3.0
//
// Responsabilidades:
// - Clasificar rendimiento por materia.
// - Evaluar resultados académicos reales.
// - Identificar inasistencias y llegadas tarde.
// - Evitar alertas duplicadas.
// - Actualizar alertas cuando cambien los datos.
// - Resolver alertas si desaparece el riesgo.
//
// IMPORTANTE:
// Este servicio no calcula promoción anual.
// Este servicio no envía notificaciones push.
// Sus funciones se conectarán a los eventos
// académicos en los siguientes pasos.
// ======================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

// ======================================================
// CONFIGURACIÓN ACADÉMICA INICIAL
// ======================================================

const CONFIG = Object.freeze({
  notaMinima: 0,
  notaMaxima: 5,
  notaAprobatoria: 3,
  notaSeguimiento: 3.5,

  // Primera inasistencia o llegada tarde:
  // seguimiento inmediato.
  alertarPrimeraInasistencia: true,
  alertarPrimeraLlegadaTarde: true,
});

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TIPOS = Object.freeze({
  BAJO_RENDIMIENTO: 'bajo_rendimiento',
  INASISTENCIAS: 'inasistencias',
  LLEGADAS_TARDE: 'llegadas_tarde',
  ACTIVIDAD_INCUMPLIDA: 'actividad_incumplida',
});

const ESTADOS = Object.freeze({
  ACTIVA: 'activa',
  SEGUIMIENTO: 'en_seguimiento',
  RESUELTA: 'resuelta',
});

function validarUuid(valor, campo) {
  if (
    typeof valor !== 'string' ||
    !UUID_REGEX.test(valor)
  ) {
    throw new Error(
      `${campo} debe ser un UUID válido.`
    );
  }

  return valor;
}

function validarIdPositivo(valor, campo) {
  const numero = Number(valor);

  if (
    !Number.isSafeInteger(numero) ||
    numero <= 0
  ) {
    throw new Error(
      `${campo} debe ser un entero positivo.`
    );
  }

  return numero;
}

function validarNombre(valor, campo) {
  if (
    typeof valor !== 'string' ||
    !valor.trim()
  ) {
    throw new Error(
      `${campo} es obligatorio.`
    );
  }

  return valor.trim();
}

function validarNota(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    return null;
  }

  const nota = Number(valor);

  if (
    !Number.isFinite(nota) ||
    nota < CONFIG.notaMinima ||
    nota > CONFIG.notaMaxima
  ) {
    throw new Error(
      'La calificación debe estar entre 0.0 y 5.0.'
    );
  }

  return nota;
}

function porcentajeEscala(nota) {
  const porcentaje =
    (nota / CONFIG.notaMaxima) * 100;

  return Math.round(porcentaje * 100) / 100;
}

// ======================================================
// CLASIFICACIÓN DEL RENDIMIENTO
// ======================================================

function clasificarRendimiento({
  promedio,
  cantidadNotas,
}) {
  const cantidad = Number(cantidadNotas);

  if (
    !Number.isSafeInteger(cantidad) ||
    cantidad < 0
  ) {
    throw new Error(
      'La cantidad de notas es inválida.'
    );
  }

  // No asignar rendimiento a una materia
  // que todavía no tenga notas válidas.
  if (cantidad === 0) {
    return {
      estado: 'sin_datos',
      etiqueta: 'Sin calificaciones',
      color: 'gris',
      promedio: null,
      porcentaje: null,
      tieneRiesgo: false,
      requiereAtencion: false,
    };
  }

  const nota = validarNota(promedio);

  if (nota === null) {
    throw new Error(
      'El promedio es obligatorio si hay notas.'
    );
  }

  const base = {
    promedio: nota,
    porcentaje: porcentajeEscala(nota),
  };

  if (nota < CONFIG.notaAprobatoria) {
    return {
      ...base,
      estado: 'riesgo',
      etiqueta: 'Riesgo académico',
      color: 'rojo',
      tieneRiesgo: true,
      requiereAtencion: true,
    };
  }

  if (nota < CONFIG.notaSeguimiento) {
    return {
      ...base,
      estado: 'atencion',
      etiqueta: 'Requiere seguimiento',
      color: 'amarillo',
      tieneRiesgo: false,
      requiereAtencion: true,
    };
  }

  return {
    ...base,
    estado: 'favorable',
    etiqueta: 'Desempeño favorable',
    color: 'verde',
    tieneRiesgo: false,
    requiereAtencion: false,
  };
}

// ======================================================
// REGISTRO CONTROLADO DE ALERTAS
// ======================================================

function validarAlerta(alerta) {
  validarUuid(
    alerta.estudianteId,
    'estudianteId'
  );

  const clave = validarNombre(
    alerta.clave,
    'clave'
  );

  if (clave.length > 200) {
    throw new Error(
      'La clave de deduplicación es demasiado larga.'
    );
  }

  if (![
    'bajo_rendimiento',
    'inasistencias',
    'llegadas_tarde',
    'actividad_incumplida',
  ].includes(alerta.tipo)) {
    throw new Error(
      'El tipo de alerta es inválido.'
    );
  }

  if (![
    'baja',
    'media',
    'alta',
    'critica',
  ].includes(alerta.nivel)) {
    throw new Error(
      'El nivel de alerta es inválido.'
    );
  }

  if (
    ![
      ESTADOS.ACTIVA,
      ESTADOS.SEGUIMIENTO,
      ESTADOS.RESUELTA,
    ].includes(alerta.estado)
  ) {
    throw new Error(
      'El estado de alerta es inválido.'
    );
  }

  const titulo = validarNombre(
    alerta.titulo,
    'titulo'
  );

  const descripcion = validarNombre(
    alerta.descripcion,
    'descripcion'
  );

  if (
    titulo.length > 160 ||
    descripcion.length > 2000
  ) {
    throw new Error(
      'El texto de la alerta excede el límite.'
    );
  }

  if (
    alerta.detalles &&
    (
      typeof alerta.detalles !== 'object' ||
      Array.isArray(alerta.detalles)
    )
  ) {
    throw new Error(
      'Los detalles deben ser un objeto.'
    );
  }
}

async function buscarAlerta(
  estudianteId,
  clave
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from('alertas_academicas')
    .select(`
      id,
      estudiante_id,
      clave_deduplicacion,
      tipo,
      nivel,
      titulo,
      descripcion,
      estado,
      detalles,
      periodo_id,
      origen_tipo,
      origen_id,
      fecha_evento,
      resuelta_at
    `)
    .eq('estudiante_id', estudianteId)
    .eq('clave_deduplicacion', clave)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

function mismoContenido(actual, nuevo) {
  return (
    actual.tipo === nuevo.tipo &&
    actual.nivel === nuevo.nivel &&
    actual.titulo === nuevo.titulo &&
    actual.descripcion === nuevo.descripcion &&
    actual.estado === nuevo.estado &&
    JSON.stringify(actual.detalles || {}) ===
      JSON.stringify(nuevo.detalles || {}) &&
    String(actual.periodo_id ?? '') ===
      String(nuevo.periodo_id ?? '') &&
    actual.origen_tipo === nuevo.origen_tipo &&
    actual.origen_id === nuevo.origen_id &&
    actual.fecha_evento === nuevo.fecha_evento
  );
}

async function actualizarAlerta(actual, nuevo) {
  // ====================================================
  // HU-10 | PROTECCIÓN DEL SEGUIMIENTO DEL ORIENTADOR
  // ====================================================

  // Consultar el estado más reciente y la información
  // del seguimiento antes de actualizar la alerta.

  const { data: alertaActual, error: errorConsulta } =
    await supabaseAdmin
      .from('alertas_academicas')
      .select(`
        *,
        seguimiento_iniciado_at,
        seguimiento_iniciado_por,
        cierre_manual_at,
        cierre_manual_por,
        motivo_cierre
      `)
      .eq('id', actual.id)
      .eq('estudiante_id', nuevo.estudiante_id)
      .single();

  if (errorConsulta) {
    throw errorConsulta;
  }

  // Mantener los datos actuales como referencia.
  const anterior = alertaActual;

  let estadoFinal = nuevo.estado;

  // Si un orientador inició formalmente el seguimiento,
  // no regresar la alerta a "activa" mientras el riesgo
  // continúe presente.
  if (
    anterior.estado === ESTADOS.SEGUIMIENTO &&
    anterior.seguimiento_iniciado_at &&
    nuevo.estado === ESTADOS.ACTIVA
  ) {
    estadoFinal = ESTADOS.SEGUIMIENTO;
  }

  // ====================================================
  // HU-10 | PROTECCIÓN INTEGRAL DEL CIERRE MANUAL
  // ====================================================

  // Una alerta cerrada manualmente por un orientador
  // no debe ser reabierta ni modificada por el motor
  // académico durante una nueva evaluación.
  //
  // El registro conserva:
  // - Estado resuelta.
  // - Fecha de resolución.
  // - Fecha del cierre manual.
  // - Orientador responsable.
  // - Motivo del cierre.
  // - Información académica registrada al cerrarla.
  //
  // Una eventual reapertura requerirá un procedimiento
  // explícito y autorizado, no una actualización
  // automática del motor.

  if (
    anterior.estado === ESTADOS.RESUELTA &&
    anterior.cierre_manual_at
  ) {
    return {
      accion: 'cierre_manual_conservado',
      alerta: anterior,
      requiereNotificacion: false,
    };
  }

  const alertaNueva = {
    ...nuevo,
    estado: estadoFinal,
  };

  if (mismoContenido(anterior, alertaNueva)) {
    return {
      accion: 'sin_cambios',
      alerta: anterior,
      requiereNotificacion: false,
    };
  }

  const cambioSignificativo =
    anterior.estado !== estadoFinal ||
    anterior.nivel !== nuevo.nivel ||
    anterior.tipo !== nuevo.tipo;

  const { data, error } = await supabaseAdmin
    .from('alertas_academicas')
    .update({
      tipo: nuevo.tipo,
      nivel: nuevo.nivel,
      titulo: nuevo.titulo,
      descripcion: nuevo.descripcion,
      estado: estadoFinal,
      detalles: nuevo.detalles,
      periodo_id: nuevo.periodo_id,
      origen_tipo: nuevo.origen_tipo,
      origen_id: nuevo.origen_id,
      fecha_evento: nuevo.fecha_evento,
      resuelta_at:
        estadoFinal === ESTADOS.RESUELTA
          ? anterior.resuelta_at ||
            new Date().toISOString()
          : null,
    })
    .eq('id', anterior.id)
    .eq('estudiante_id', nuevo.estudiante_id)
    .eq('estado', anterior.estado)
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }

  // Si otro proceso modificó el estado entre la
  // consulta y la actualización, no sobrescribirlo.
  if (!data) {
    return {
      accion: 'actualizacion_concurrente',
      alerta: anterior,
      requiereNotificacion: false,
    };
  }

  return {
    accion: 'actualizada',
    alerta: data,
    requiereNotificacion:
      cambioSignificativo &&
      estadoFinal !== ESTADOS.RESUELTA,
  };
}

async function guardarAlerta(alerta) {
  validarAlerta(alerta);

  const nueva = {
    estudiante_id: alerta.estudianteId,
    clave_deduplicacion: alerta.clave,
    tipo: alerta.tipo,
    nivel: alerta.nivel,
    titulo: alerta.titulo,
    descripcion: alerta.descripcion,
    estado: alerta.estado,
    origen_tipo: alerta.origenTipo,
    origen_id: String(alerta.origenId),
    periodo_id: alerta.periodoId ?? null,
    detalles: alerta.detalles || {},
    fecha_evento: alerta.fechaEvento || null,
  };

  const existente = await buscarAlerta(
    alerta.estudianteId,
    alerta.clave
  );

  if (existente) {
    return actualizarAlerta(
      existente,
      nueva
    );
  }

  // No insertar una alerta resuelta
  // si nunca existió un riesgo previo.
  if (alerta.estado === ESTADOS.RESUELTA) {
    return {
      accion: 'sin_alerta_previa',
      alerta: null,
      requiereNotificacion: false,
    };
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from('alertas_academicas')
    .insert(nueva)
    .select('*')
    .single();

  if (error) {
    // Otra ejecución pudo crear la misma alerta.
    // Recuperarla permite evitar duplicaciones.
    if (error.code === '23505') {
      const concurrente = await buscarAlerta(
        alerta.estudianteId,
        alerta.clave
      );

      if (concurrente) {
        return actualizarAlerta(
          concurrente,
          nueva
        );
      }
    }

    throw error;
  }

  return {
    accion: 'creada',
    alerta: data,
    requiereNotificacion: true,
  };
}

// ======================================================
// ALERTAS DE RENDIMIENTO POR MATERIA
// ======================================================

async function evaluarRendimientoMateria({
  estudianteId,
  materiaId,
  materiaNombre,
  periodoId,
  promedio,
  cantidadNotas,
}) {
  validarUuid(
    estudianteId,
    'estudianteId'
  );

  const idMateria = validarIdPositivo(
    materiaId,
    'materiaId'
  );

  const idPeriodo = validarIdPositivo(
    periodoId,
    'periodoId'
  );

  const nombre = validarNombre(
    materiaNombre,
    'materiaNombre'
  );

  const resultado = clasificarRendimiento({
    promedio,
    cantidadNotas,
  });

  const clave =
    `rendimiento:${idMateria}:${idPeriodo}`;

  // HU-08:
  // Si ya no existen notas evaluables,
  // resolver una alerta anterior, si existe.
  if (resultado.estado === 'sin_datos') {
    const anterior = await buscarAlerta(
      estudianteId,
      clave
    );

    // No crear alertas nuevas cuando no hay notas.
    if (!anterior) {
      return {
        clasificacion: resultado,
        accion: 'sin_datos',
        alerta: null,
        requiereNotificacion: false,
      };
    }

    // Conservar intactas las alertas ya resueltas.
    if (anterior.estado === ESTADOS.RESUELTA) {
      return {
        clasificacion: resultado,
        accion: 'sin_cambios',
        alerta: anterior,
        requiereNotificacion: false,
      };
    }

    const operacion = await guardarAlerta({
      estudianteId,
      clave,
      tipo: TIPOS.BAJO_RENDIMIENTO,
      nivel: anterior.nivel,
      titulo: `Sin notas evaluables en ${nombre}`,
      descripcion:
        `Actualmente no existen calificaciones ` +
        `evaluables registradas en ${nombre} ` +
        `para este período. Por esta razón, ` +
        `la alerta de rendimiento anterior ` +
        `se ha resuelto. Esto no equivale ` +
        `a aprobar ni reprobar la materia.`,
      estado: ESTADOS.RESUELTA,
      origenTipo: 'regla_academica',
      origenId: `${idMateria}:${idPeriodo}`,
      periodoId: idPeriodo,
      detalles: {
        ...(anterior.detalles || {}),
        materiaId: idMateria,
        materia: nombre,
        promedio: null,
        cantidadNotas: 0,
        porcentaje: null,
        clasificacion: 'sin_datos',
        motivoResolucion: 'sin_notas_evaluables',
      },
    });

    return {
      clasificacion: resultado,
      ...operacion,
    };
  }

  const esRiesgo =
    resultado.estado === 'riesgo';

  const esAtencion =
    resultado.estado === 'atencion';

  const nivel = esRiesgo
    ? 'alta'
    : 'media';

  let titulo;
  let descripcion;
  let estado;

  if (esRiesgo) {
    titulo = `Riesgo académico en ${nombre}`;
    descripcion =
      `El promedio registrado en ${nombre} ` +
      `es ${resultado.promedio.toFixed(2)}, ` +
      `inferior al mínimo aprobatorio de ` +
      `${CONFIG.notaAprobatoria.toFixed(1)}. ` +
      `Se recomienda consultar las evaluaciones ` +
      `y contactar al docente.`;
    estado = ESTADOS.ACTIVA;
  } else if (esAtencion) {
    titulo =
      `Riesgo académico superado en ${nombre}`;
    descripcion =
      `El promedio de ${nombre} es ` +
      `${resultado.promedio.toFixed(2)}. ` +
      `La materia ya alcanza el mínimo ` +
      `aprobatorio de ` +
      `${CONFIG.notaAprobatoria.toFixed(1)}. ` +
      `Aunque el riesgo académico se resolvió, ` +
      `se recomienda seguimiento preventivo ` +
      `para mantener o mejorar el desempeño.`;
    estado = ESTADOS.RESUELTA;
  } else {
    titulo = `Rendimiento recuperado en ${nombre}`;
    descripcion =
      `El promedio de ${nombre} es ` +
      `${resultado.promedio.toFixed(2)}. ` +
      `La materia presenta un desempeño favorable.`;
    estado = ESTADOS.RESUELTA;
  }

  const operacion = await guardarAlerta({
    estudianteId,
    clave,
    tipo: TIPOS.BAJO_RENDIMIENTO,
    nivel,
    titulo,
    descripcion,
    estado,
    origenTipo: 'regla_academica',
    origenId: `${idMateria}:${idPeriodo}`,
    periodoId: idPeriodo,
    detalles: {
      materiaId: idMateria,
      materia: nombre,
      promedio: resultado.promedio,
      cantidadNotas: Number(cantidadNotas),
      porcentaje: resultado.porcentaje,
      clasificacion: resultado.estado,
      notaAprobatoria: CONFIG.notaAprobatoria,
      notaSeguimiento: CONFIG.notaSeguimiento,
    },
  });

  return {
    clasificacion: resultado,
    ...operacion,
  };
}

// ======================================================
// ALERTAS POR ASISTENCIA REAL
// ======================================================

async function evaluarRegistroAsistencia({
  estudianteId,
  asistenciaId,
  materiaNombre,
  estado,
  fecha,
  periodoId = null,
}) {
  validarUuid(
    estudianteId,
    'estudianteId'
  );

  const idAsistencia = validarIdPositivo(
    asistenciaId,
    'asistenciaId'
  );

  const nombre = validarNombre(
    materiaNombre,
    'materiaNombre'
  );

  if (
    ![
      'presente',
      'ausente',
      'tarde',
    ].includes(estado)
  ) {
    throw new Error(
      'Estado de asistencia inválido.'
    );
  }

  const fechaRegistro =
    fecha ? String(fecha).slice(0, 10) : null;

  if (
    !fechaRegistro ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      fechaRegistro
    )
  ) {
    throw new Error(
      'Fecha de asistencia inválida.'
    );
  }

  const idPeriodo =
    periodoId == null
      ? null
      : validarIdPositivo(
          periodoId,
          'periodoId'
        );

  const clave =
    `asistencia:${idAsistencia}`;

  // Si el docente corrigió a "presente",
  // resolver una alerta previa, si existe.
  if (estado === 'presente') {
    const anterior = await buscarAlerta(
      estudianteId,
      clave
    );

    if (!anterior) {
      return {
        accion: 'sin_incidencia',
        alerta: null,
        requiereNotificacion: false,
      };
    }

    return guardarAlerta({
      estudianteId,
      clave,
      tipo: anterior.tipo,
      nivel: anterior.nivel,
      titulo: `Incidencia corregida en ${nombre}`,
      descripcion:
        `La asistencia del ${fechaRegistro} ` +
        `en ${nombre} fue corregida a presente.`,
      estado: ESTADOS.RESUELTA,
      origenTipo: 'asistencia',
      origenId: idAsistencia,
      periodoId: idPeriodo ??
        anterior.periodo_id,
      fechaEvento:
        `${fechaRegistro}T12:00:00Z`,
      detalles: {
        materia: nombre,
        fecha: fechaRegistro,
        estadoActual: 'presente',
      },
    });
  }

  const esAusencia = estado === 'ausente';

  if (
    (esAusencia &&
      !CONFIG.alertarPrimeraInasistencia) ||
    (!esAusencia &&
      !CONFIG.alertarPrimeraLlegadaTarde)
  ) {
    return {
      accion: 'regla_desactivada',
      alerta: null,
      requiereNotificacion: false,
    };
  }

  const tipo = esAusencia
    ? TIPOS.INASISTENCIAS
    : TIPOS.LLEGADAS_TARDE;

  const nivel = esAusencia
    ? 'media'
    : 'baja';

  const titulo = esAusencia
    ? `Inasistencia en ${nombre}`
    : `Llegada tarde en ${nombre}`;

  const descripcion = esAusencia
    ? `Se registró una inasistencia ` +
      `el ${fechaRegistro} en ${nombre}. ` +
      `Consulta el detalle y, si corresponde, ` +
      `tramita la justificación institucional.`
    : `Se registró una llegada tarde ` +
      `el ${fechaRegistro} en ${nombre}. ` +
      `Se recomienda revisar la situación ` +
      `para prevenir nuevas llegadas tarde.`;

  return guardarAlerta({
    estudianteId,
    clave,
    tipo,
    nivel,
    titulo,
    descripcion,
    estado: ESTADOS.ACTIVA,
    origenTipo: 'asistencia',
    origenId: idAsistencia,
    periodoId: idPeriodo,
    fechaEvento:
      `${fechaRegistro}T12:00:00Z`,
    detalles: {
      asistenciaId: idAsistencia,
      materia: nombre,
      fecha: fechaRegistro,
      estadoActual: estado,
    },
  });
}

// ======================================================
// ALERTA POR ACTIVIDAD INCUMPLIDA
//
// Debe ser llamada únicamente cuando la capa
// académica haya comprobado:
// - Actividad vigente y publicada.
// - Fecha límite vencida.
// - Ausencia confirmada de entrega.
// - Estudiante perteneciente al grupo.
// ======================================================

async function registrarActividadIncumplida({
  estudianteId,
  actividadId,
  tituloActividad,
  materiaNombre,
  periodoId,
  fechaEntrega,
}) {
  validarUuid(
    estudianteId,
    'estudianteId'
  );

  const idActividad = validarIdPositivo(
    actividadId,
    'actividadId'
  );

  const idPeriodo = validarIdPositivo(
    periodoId,
    'periodoId'
  );

  const titulo = validarNombre(
    tituloActividad,
    'tituloActividad'
  );

  const materia = validarNombre(
    materiaNombre,
    'materiaNombre'
  );

  if (
    typeof fechaEntrega !== 'string' ||
    Number.isNaN(
      new Date(fechaEntrega).getTime()
    )
  ) {
    throw new Error(
      'La fecha de entrega es inválida.'
    );
  }

  if (
    new Date(fechaEntrega).getTime() >=
    Date.now()
  ) {
    return {
      accion: 'plazo_vigente',
      alerta: null,
      requiereNotificacion: false,
    };
  }

  const texto =
    `La actividad "${titulo}" de ${materia} ` +
    `tiene el plazo vencido y no presenta ` +
    `una entrega registrada. Se recomienda ` +
    `consultar al docente para conocer ` +
    `las opciones disponibles.`;

  return guardarAlerta({
    estudianteId,
    clave: `actividad:${idActividad}`,
    tipo: TIPOS.ACTIVIDAD_INCUMPLIDA,
    nivel: 'media',
    titulo: `Actividad pendiente en ${materia}`,
    descripcion: texto,
    estado: ESTADOS.ACTIVA,
    origenTipo: 'actividad',
    origenId: idActividad,
    periodoId: idPeriodo,
    fechaEvento:
      new Date(fechaEntrega).toISOString(),
    detalles: {
      actividadId: idActividad,
      actividad: titulo,
      materia,
      fechaEntrega,
    },
  });
}

// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {
  CONFIG,
  TIPOS,
  ESTADOS,

  clasificarRendimiento,
  porcentajeEscala,

  evaluarRendimientoMateria,
  evaluarRegistroAsistencia,
  registrarActividadIncumplida,
};
