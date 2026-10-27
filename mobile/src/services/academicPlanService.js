'use strict';

// ======================================================
// AULA-AI | HU-11
// SERVICIO MÓVIL DE PLANES DE ACOMPAÑAMIENTO
// ======================================================

import { API_URL } from '../config/apiConfig';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ESTADOS = [
  'propuesto',
  'en_seguimiento',
  'completado',
  'cancelado',
];

const PRIORIDADES = [
  'baja',
  'media',
  'alta',
];

const CAMPOS_ACTUALIZABLES = [
  'objetivo',
  'acciones',
  'indicadoresProgreso',
  'prioridad',
  'estado',
  'fechaSeguimiento',
  'observacionesOrientador',
];

// ======================================================
// VALIDACIONES
// ======================================================

function validarEstudianteId(estudianteId) {
  if (
    typeof estudianteId !== 'string' ||
    !UUID_REGEX.test(estudianteId)
  ) {
    throw new Error(
      'El identificador del estudiante es inválido.'
    );
  }

  return estudianteId;
}

function validarIdPositivo(valor, nombre) {
  const id = Number(valor);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    throw new Error(
      `El identificador de ${nombre} es inválido.`
    );
  }

  return id;
}

function validarObjeto(valor, mensaje) {
  if (
    !valor ||
    typeof valor !== 'object' ||
    Array.isArray(valor)
  ) {
    throw new Error(mensaje);
  }

  return valor;
}

function validarFecha(fecha) {
  if (fecha === null) {
    return;
  }

  if (
    typeof fecha !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(fecha)
  ) {
    throw new Error(
      'La fecha de seguimiento debe tener el formato AAAA-MM-DD.'
    );
  }

  const valor = new Date(`${fecha}T00:00:00Z`);

  if (
    Number.isNaN(valor.getTime()) ||
    valor.toISOString().slice(0, 10) !== fecha
  ) {
    throw new Error(
      'La fecha de seguimiento no es válida.'
    );
  }
}

function validarCamposPlan(datos) {
  if (
    datos.objetivo !== undefined &&
    (
      typeof datos.objetivo !== 'string' ||
      !datos.objetivo.trim()
    )
  ) {
    throw new Error(
      'El objetivo del plan es obligatorio.'
    );
  }

  if (
    datos.acciones !== undefined &&
    !Array.isArray(datos.acciones)
  ) {
    throw new Error(
      'Las acciones deben ser un arreglo.'
    );
  }

  if (
    datos.indicadoresProgreso !== undefined &&
    !Array.isArray(datos.indicadoresProgreso)
  ) {
    throw new Error(
      'Los indicadores de progreso deben ser un arreglo.'
    );
  }

  if (
    datos.prioridad !== undefined &&
    !PRIORIDADES.includes(datos.prioridad)
  ) {
    throw new Error(
      'La prioridad del plan es inválida.'
    );
  }

  if (
    datos.estado !== undefined &&
    !ESTADOS.includes(datos.estado)
  ) {
    throw new Error(
      'El estado del plan es inválido.'
    );
  }

  if (datos.fechaSeguimiento !== undefined) {
    validarFecha(datos.fechaSeguimiento);
  }

  if (
    datos.observacionesOrientador !== undefined &&
    datos.observacionesOrientador !== null &&
    typeof datos.observacionesOrientador !== 'string'
  ) {
    throw new Error(
      'Las observaciones del orientador son inválidas.'
    );
  }
}

// ======================================================
// SOLICITUD HTTP
// ======================================================

async function solicitar({
  apiUrl,
  accessToken,
  ruta,
  metodo = 'GET',
  datos,
}) {
  if (
    typeof accessToken !== 'string' ||
    !accessToken.trim()
  ) {
    throw new Error(
      'La sesión ha expirado. Inicia sesión nuevamente.'
    );
  }

  const baseUrl = (
    typeof apiUrl === 'string' && apiUrl.trim()
      ? apiUrl.trim()
      : API_URL
  ).replace(/\/+$/, '');

  const opciones = {
    method: metodo,
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
      Accept: 'application/json',
    },
  };

  if (datos !== undefined) {
    opciones.headers['Content-Type'] =
      'application/json';

    opciones.body = JSON.stringify(datos);
  }

  let respuesta;

  try {
    respuesta = await fetch(
      `${baseUrl}/api/planes-acompanamiento${ruta}`,
      opciones
    );
  } catch (_error) {
    throw new Error(
      'No fue posible conectar con el servidor. Comprueba tu conexión a internet.'
    );
  }

  const texto = await respuesta.text();

  let resultado = {};

  if (texto) {
    try {
      resultado = JSON.parse(texto);
    } catch (_error) {
      throw new Error(
        'El servidor devolvió una respuesta no válida.'
      );
    }
  }

  if (!respuesta.ok || resultado.success === false) {
    if (respuesta.status === 401) {
      throw new Error(
        'La sesión ha expirado. Inicia sesión nuevamente.'
      );
    }

    if (respuesta.status === 403) {
      throw new Error(
        'No tienes permisos para realizar esta acción.'
      );
    }

    if (respuesta.status === 404) {
      throw new Error(
        resultado.message ||
        'El plan académico no existe o no tienes acceso a él.'
      );
    }

    if (respuesta.status === 409) {
      throw new Error(
        resultado.message ||
        'El plan no puede modificarse en su estado actual.'
      );
    }

    throw new Error(
      resultado.message ||
      resultado.error ||
      'No fue posible completar la operación.'
    );
  }

  return resultado;
}

// ======================================================
// CONSULTAR PLANES DEL ESTUDIANTE
// ======================================================

export async function listarPlanesEstudiante({
  apiUrl,
  accessToken,
  estudianteId,
  estado = null,
}) {
  validarEstudianteId(estudianteId);

  if (
    estado !== null &&
    !ESTADOS.includes(estado)
  ) {
    throw new Error(
      'El filtro de estado es inválido.'
    );
  }

  const filtro = estado
    ? `?estado=${encodeURIComponent(estado)}`
    : '';

  const respuesta = await solicitar({
    apiUrl,
    accessToken,
    ruta: `/estudiante/${estudianteId}${filtro}`,
  });

  return respuesta.data;
}

// ======================================================
// CONSULTAR UN PLAN ESPECÍFICO
// ======================================================

export async function obtenerPlanEstudiante({
  apiUrl,
  accessToken,
  estudianteId,
  planId,
}) {
  validarEstudianteId(estudianteId);

  const id = validarIdPositivo(planId, 'plan');

  const respuesta = await solicitar({
    apiUrl,
    accessToken,
    ruta: `/estudiante/${estudianteId}/${id}`,
  });

  return respuesta.data;
}

// ======================================================
// CREAR PLAN DE ACOMPAÑAMIENTO
// ======================================================

export async function crearPlanEstudiante({
  apiUrl,
  accessToken,
  estudianteId,
  recomendacionId,
  alertaId = null,
  objetivo,
  acciones = [],
  indicadoresProgreso = [],
  prioridad = 'media',
  fechaSeguimiento = null,
  observacionesOrientador = null,
}) {
  validarEstudianteId(estudianteId);

  const recomendacion =
    validarIdPositivo(recomendacionId, 'recomendación');

  const alerta = alertaId === null
    ? null
    : validarIdPositivo(alertaId, 'alerta');

  const datos = {
    recomendacionId: recomendacion,
    alertaId: alerta,
    objetivo,
    acciones,
    indicadoresProgreso,
    prioridad,
    fechaSeguimiento,
    observacionesOrientador,
  };

  validarCamposPlan(datos);

  const respuesta = await solicitar({
    apiUrl,
    accessToken,
    ruta: `/estudiante/${estudianteId}`,
    metodo: 'POST',
    datos,
  });

  return respuesta.data;
}

// ======================================================
// ACTUALIZAR PLAN DE ACOMPAÑAMIENTO
// ======================================================

export async function actualizarPlanEstudiante({
  apiUrl,
  accessToken,
  estudianteId,
  planId,
  cambios,
}) {
  validarEstudianteId(estudianteId);

  const id = validarIdPositivo(planId, 'plan');

  validarObjeto(
    cambios,
    'Debes proporcionar los cambios del plan.'
  );

  const campos = Object.keys(cambios);

  if (
    campos.length === 0 ||
    campos.some(
      (campo) => !CAMPOS_ACTUALIZABLES.includes(campo)
    )
  ) {
    throw new Error(
      'La actualización contiene campos no permitidos.'
    );
  }

  validarCamposPlan(cambios);

  const respuesta = await solicitar({
    apiUrl,
    accessToken,
    ruta: `/estudiante/${estudianteId}/${id}`,
    metodo: 'PATCH',
    datos: cambios,
  });

  return respuesta.data;
}
