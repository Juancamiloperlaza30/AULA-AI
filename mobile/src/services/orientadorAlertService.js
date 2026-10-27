'use strict';

// ======================================================
// AULA-AI | HU-10
// SERVICIO MÓVIL DE ALERTAS DEL ORIENTADOR
// ======================================================

import { API_URL } from '../config/apiConfig';

function validarSesion(accessToken) {
  if (
    typeof accessToken !== 'string' ||
    !accessToken.trim()
  ) {
    throw new Error(
      'La sesión ha expirado. Inicia sesión nuevamente.'
    );
  }

  return accessToken.trim();
}

function validarIdAlerta(alertaId) {
  const id = Number(alertaId);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    throw new Error(
      'El identificador de la alerta no es válido.'
    );
  }

  return id;
}

async function solicitar({
  apiUrl,
  accessToken,
  ruta,
  metodo = 'GET',
  datos,
}) {
  const token = validarSesion(accessToken);

  const baseUrl = (
    typeof apiUrl === 'string' && apiUrl.trim()
      ? apiUrl.trim()
      : API_URL
  ).replace(/\/+$/, '');

  const opciones = {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`,
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
      `${baseUrl}/api/risk-alerts${ruta}`,
      opciones
    );
  } catch (_error) {
    throw new Error(
      'No fue posible conectar con el servidor. ' +
      'Comprueba tu conexión a internet.'
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
        'La alerta no existe o no tienes acceso a ella.'
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

// Consultar alertas autorizadas del orientador.
export async function listarAlertasOrientador({
  apiUrl,
  accessToken,
}) {
  return solicitar({
    apiUrl,
    accessToken,
    ruta: '/orientador',
  });
}

// Consultar el detalle de una alerta.
export async function obtenerAlertaOrientador({
  apiUrl,
  accessToken,
  alertaId,
}) {
  const id = validarIdAlerta(alertaId);

  return solicitar({
    apiUrl,
    accessToken,
    ruta: `/orientador/${id}`,
  });
}

// Consultar historial de intervenciones.
export async function listarSeguimientosOrientador({
  apiUrl,
  accessToken,
  alertaId,
}) {
  const id = validarIdAlerta(alertaId);

  return solicitar({
    apiUrl,
    accessToken,
    ruta: `/orientador/${id}/seguimientos`,
  });
}

// Iniciar seguimiento formal.
export async function iniciarSeguimientoOrientador({
  apiUrl,
  accessToken,
  alertaId,
}) {
  const id = validarIdAlerta(alertaId);

  return solicitar({
    apiUrl,
    accessToken,
    ruta: `/orientador/${id}/iniciar-seguimiento`,
    metodo: 'PATCH',
  });
}

// Registrar una intervención.
export async function registrarSeguimientoOrientador({
  apiUrl,
  accessToken,
  alertaId,
  tipoIntervencion,
  observacion,
  proximaRevision = null,
}) {
  const id = validarIdAlerta(alertaId);

  if (
    typeof tipoIntervencion !== 'string' ||
    !tipoIntervencion.trim()
  ) {
    throw new Error(
      'Selecciona un tipo de intervención.'
    );
  }

  if (
    typeof observacion !== 'string' ||
    !observacion.trim()
  ) {
    throw new Error(
      'Escribe una observación.'
    );
  }

  return solicitar({
    apiUrl,
    accessToken,
    ruta: `/orientador/${id}/seguimientos`,
    metodo: 'POST',
    datos: {
      tipo_intervencion: tipoIntervencion.trim(),
      observacion: observacion.trim(),
      proxima_revision: proximaRevision || null,
    },
  });
}

// Cerrar manualmente una alerta.
export async function cerrarAlertaOrientador({
  apiUrl,
  accessToken,
  alertaId,
  motivo,
}) {
  const id = validarIdAlerta(alertaId);

  if (
    typeof motivo !== 'string' ||
    motivo.trim().length < 10 ||
    motivo.trim().length > 2000
  ) {
    throw new Error(
      'El motivo debe tener entre 10 y 2000 caracteres.'
    );
  }

  return solicitar({
    apiUrl,
    accessToken,
    ruta: `/orientador/${id}/cerrar`,
    metodo: 'PATCH',
    datos: {
      motivo: motivo.trim(),
    },
  });
}
