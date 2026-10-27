'use strict';

// ======================================================
// AULA-AI | HU-12
// SERVICIO MOVIL DE COMUNICADOS INSTITUCIONALES
// ======================================================

// ------------------------------------------------------
// CONFIGURACION
// ------------------------------------------------------

const TIMEOUT_MS = 15000;

const validarConfiguracion = (apiUrl, accessToken) => {
  if (typeof apiUrl !== 'string' || !apiUrl.trim()) {
    throw new Error('La URL del servidor no está configurada.');
  }

  if (typeof accessToken !== 'string' || !accessToken.trim()) {
    throw new Error('Debes iniciar sesión para consultar los comunicados.');
  }
};

const validarIdComunicado = (id) => {
  const valor = String(id ?? '');

  if (!/^[1-9]\d*$/.test(valor)) {
    throw new Error('El identificador del comunicado no es válido.');
  }

  const numero = Number(valor);

  if (!Number.isSafeInteger(numero)) {
    throw new Error('El identificador del comunicado no es válido.');
  }

  return numero;
};

// ------------------------------------------------------
// SOLICITUD HTTP AUTENTICADA
// ------------------------------------------------------

const realizarSolicitud = async ({
  apiUrl,
  accessToken,
  ruta,
  metodo = 'GET',
}) => {
  validarConfiguracion(apiUrl, accessToken);

  const controlador = new AbortController();

  const temporizador = setTimeout(() => {
    controlador.abort();
  }, TIMEOUT_MS);

  try {
    const baseUrl = apiUrl.trim().replace(/\/+$/, '');

    const respuesta = await fetch(`${baseUrl}${ruta}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      signal: controlador.signal,
    });

    const resultado = await respuesta.json();

    if (!respuesta.ok || resultado?.success === false) {
      throw new Error(
        resultado?.message ||
          'No fue posible completar la solicitud.'
      );
    }

    return resultado;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(
        'El servidor tardó demasiado en responder. Inténtalo nuevamente.'
      );
    }

    throw error;
  } finally {
    clearTimeout(temporizador);
  }
};

// ------------------------------------------------------
// 1. CONSULTAR MIS COMUNICADOS
// GET /api/comunicados
// ------------------------------------------------------

export const consultarMisComunicados = async ({
  apiUrl,
  accessToken,
  pagina = 1,
  limite = 20,
}) => {
  if (
    !Number.isSafeInteger(pagina) ||
    pagina < 1 ||
    !Number.isSafeInteger(limite) ||
    limite < 1 ||
    limite > 50
  ) {
    throw new Error('Los parámetros de paginación no son válidos.');
  }

  const resultado = await realizarSolicitud({
    apiUrl,
    accessToken,
    ruta: `/api/comunicados?pagina=${pagina}&limite=${limite}`,
  });

  return {
    comunicados: Array.isArray(resultado?.data)
      ? resultado.data
      : [],
    paginacion: resultado?.paginacion ?? null,
  };
};

// ------------------------------------------------------
// 2. CONSULTAR DETALLE DE UN COMUNICADO
// GET /api/comunicados/:id
// ------------------------------------------------------

export const consultarDetalleComunicado = async ({
  apiUrl,
  accessToken,
  comunicadoId,
}) => {
  const id = validarIdComunicado(comunicadoId);

  const resultado = await realizarSolicitud({
    apiUrl,
    accessToken,
    ruta: `/api/comunicados/${id}`,
  });

  if (!resultado?.data || typeof resultado.data !== 'object') {
    throw new Error('No se encontró información del comunicado.');
  }

  return resultado.data;
};

// ------------------------------------------------------
// 3. MARCAR COMUNICADO COMO LEIDO
// POST /api/comunicados/:id/lectura
// ------------------------------------------------------

export const marcarComunicadoComoLeido = async ({
  apiUrl,
  accessToken,
  comunicadoId,
}) => {
  const id = validarIdComunicado(comunicadoId);

  const resultado = await realizarSolicitud({
    apiUrl,
    accessToken,
    ruta: `/api/comunicados/${id}/lectura`,
    metodo: 'POST',
  });

  if (!resultado?.data || typeof resultado.data !== 'object') {
    throw new Error(
      'El servidor no devolvió el resultado de la lectura.'
    );
  }

  return resultado.data;
};

// ======================================================
// FIN DEL SERVICIO MOVIL HU-12
// ======================================================

// ======================================================
// AULA-AI | HU-12
// PUBLICAR COMUNICADO INSTITUCIONAL
// ======================================================

export const publicarComunicado = async ({
  apiUrl,
  accessToken,
  titulo,
  contenido,
  alcanceTipo,
  alcanceRoles = [],
  gradoId = null,
  grupoId = null,
}) => {
  validarConfiguracion(apiUrl, accessToken);

  // ----------------------------------------------------
  // 1. VALIDAR TITULO Y CONTENIDO
  // ----------------------------------------------------

  const tituloLimpio =
    typeof titulo === 'string'
      ? titulo.trim()
      : '';

  const contenidoLimpio =
    typeof contenido === 'string'
      ? contenido.trim()
      : '';

  if (!tituloLimpio) {
    throw new Error(
      'Debes ingresar el título del comunicado.'
    );
  }

  if (!contenidoLimpio) {
    throw new Error(
      'Debes ingresar el contenido del comunicado.'
    );
  }

  // ----------------------------------------------------
  // 2. VALIDAR TIPO DE ALCANCE
  // ----------------------------------------------------

  const alcancesPermitidos = [
    'general',
    'roles',
    'grado',
    'grupo',
  ];

  if (!alcancesPermitidos.includes(alcanceTipo)) {
    throw new Error(
      'Selecciona un tipo de destinatario válido.'
    );
  }

  // ----------------------------------------------------
  // 3. PREPARAR DATOS DE PUBLICACION
  // ----------------------------------------------------

  const datos = {
    titulo: tituloLimpio,
    contenido: contenidoLimpio,
    alcanceTipo,
  };

  if (alcanceTipo === 'roles') {
    if (
      !Array.isArray(alcanceRoles) ||
      alcanceRoles.length === 0
    ) {
      throw new Error(
        'Debes seleccionar al menos un rol destinatario.'
      );
    }

    datos.alcanceRoles = [
      ...new Set(alcanceRoles),
    ];
  }

  if (
    alcanceTipo === 'grado' ||
    alcanceTipo === 'grupo'
  ) {
    const gradoNumerico = Number(gradoId);

    if (
      !Number.isSafeInteger(gradoNumerico) ||
      gradoNumerico <= 0
    ) {
      throw new Error(
        'Debes seleccionar un grado válido.'
      );
    }

    datos.gradoId = gradoNumerico;
  }

  if (alcanceTipo === 'grupo') {
    const grupoNumerico = Number(grupoId);

    if (
      !Number.isSafeInteger(grupoNumerico) ||
      grupoNumerico <= 0
    ) {
      throw new Error(
        'Debes seleccionar un grupo válido.'
      );
    }

    datos.grupoId = grupoNumerico;
  }

  // ----------------------------------------------------
  // 4. PUBLICAR COMUNICADO
  // ----------------------------------------------------

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, TIMEOUT_MS);

  try {
    const baseUrl = apiUrl.trim().replace(/\/+$/, '');
    const response = await fetch(
      `${baseUrl}/api/comunicados`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(datos),
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
      resultado?.success === false
    ) {
      throw new Error(
        resultado?.message ||
          'No fue posible publicar el comunicado.'
      );
    }

    return resultado;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(
        'La solicitud tardó demasiado. Verifica si el comunicado fue publicado antes de volver a intentarlo.'
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};
