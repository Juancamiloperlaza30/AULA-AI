'use strict';

// ======================================================
// AULA-AI | HU-11
// SERVICIO MÓVIL DE RECOMENDACIONES ACADÉMICAS
// ======================================================

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ======================================================
// VALIDACIÓN DEL ESTUDIANTE
// ======================================================

const validarEstudianteId = (estudianteId) => {
  if (
    typeof estudianteId !== 'string' ||
    !UUID_REGEX.test(estudianteId)
  ) {
    throw new Error(
      'El identificador del estudiante es inválido.'
    );
  }
};

// ======================================================
// SOLICITUD AUTENTICADA AL BACKEND
// ======================================================

const realizarSolicitud = async ({
  apiUrl,
  accessToken,
  endpoint,
  method = 'GET',
  body = undefined,
}) => {
  if (
    typeof apiUrl !== 'string' ||
    !apiUrl.trim()
  ) {
    throw new Error(
      'La dirección del servidor no está configurada.'
    );
  }

  if (
    typeof accessToken !== 'string' ||
    !accessToken.trim()
  ) {
    throw new Error(
      'No existe una sesión válida. Inicie sesión nuevamente.'
    );
  }

  if (!['GET', 'POST'].includes(method)) {
    throw new Error(
      'El método de solicitud no está permitido.'
    );
  }

  const controller = new AbortController();
  const timeoutMs =
    method === 'POST' ? 30000 : 15000;

  const timeoutId = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(
      `${apiUrl.replace(/\/+$/, '')}${endpoint}`,
      {
        method,
        headers,
        ...(body !== undefined
          ? { body: JSON.stringify(body) }
          : {}),
        signal: controller.signal,
      }
    );

    let resultado;

    try {
      resultado = await response.json();
    } catch {
      throw new Error(
        'El servidor devolvió una respuesta inválida.'
      );
    }

    if (
      !response.ok ||
      resultado.success === false
    ) {
      throw new Error(
        resultado.message ||
        'No fue posible completar la solicitud.'
      );
    }

    return resultado;
  } catch (error) {
    if (
      error.name === 'AbortError' ||
      /request has been canceled|fetch request has been canceled/i.test(
        String(error.message || '')
      )
    ) {
      throw new Error(
        'La generación está tardando más de lo esperado. ' +
        'Consulta el historial antes de volver a intentarlo, ' +
        'porque la recomendación podría haberse guardado.'
      );
    }

    if (error instanceof TypeError) {
      throw new Error(
        'No fue posible establecer conexión con el servidor de AULA-AI.'
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

// ======================================================
// CONSULTAR RECOMENDACIONES DE UN ESTUDIANTE
// ======================================================

export const listarRecomendacionesEstudiante = async ({
  apiUrl,
  accessToken,
  estudianteId,
}) => {
  validarEstudianteId(estudianteId);

  const respuesta = await realizarSolicitud({
    apiUrl,
    accessToken,
    method: 'GET',
    endpoint:
      `/api/recomendaciones/estudiante/${estudianteId}`,
  });

  if (
    !respuesta.data ||
    !Array.isArray(respuesta.data.recomendaciones)
  ) {
    throw new Error(
      'El servidor devolvió un formato de recomendaciones inválido.'
    );
  }

  return respuesta.data;
};

// ======================================================
// CONSULTAR UNA RECOMENDACIÓN ESPECÍFICA
// ======================================================

export const obtenerRecomendacionEstudiante = async ({
  apiUrl,
  accessToken,
  estudianteId,
  recomendacionId,
}) => {
  validarEstudianteId(estudianteId);

  const id = Number(recomendacionId);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    throw new Error(
      'El identificador de la recomendación es inválido.'
    );
  }

  const respuesta = await realizarSolicitud({
    apiUrl,
    accessToken,
    method: 'GET',
    endpoint:
      `/api/recomendaciones/estudiante/${estudianteId}/${id}`,
  });

  if (
    !respuesta.data ||
    typeof respuesta.data !== 'object' ||
    Array.isArray(respuesta.data)
  ) {
    throw new Error(
      'El servidor devolvió un formato de recomendación inválido.'
    );
  }

  return respuesta.data;
};

// ======================================================
// HU-11 | GENERAR RECOMENDACIÓN ACADÉMICA
// ======================================================

export const generarRecomendacionEstudiante = async ({
  apiUrl,
  accessToken,
  estudianteId,
}) => {
  validarEstudianteId(estudianteId);

  const respuesta = await realizarSolicitud({
    apiUrl,
    accessToken,
    method: 'POST',
    endpoint:
      `/api/recomendaciones/estudiante/${estudianteId}/generar`,
    body: {},
  });

  if (
    !respuesta.data ||
    typeof respuesta.data !== 'object' ||
    Array.isArray(respuesta.data) ||
    !Number.isSafeInteger(
      Number(respuesta.data.id)
    ) ||
    Number(respuesta.data.id) <= 0
  ) {
    throw new Error(
      'El servidor no confirmó una recomendación guardada válida.'
    );
  }

  return respuesta.data;
};
