'use strict';

// ======================================================
// AULA-AI | HU-11
// MOTOR DE RECOMENDACIONES ACADÉMICAS CON OPENAI
// Y MECANISMO DE RESPALDO
// ======================================================

const OpenAI = require('openai');

const {
  generarRecomendacionesRespaldo,
} = require('./academicRecommendationFallbackService');

const AVISO_IA =
  'Sugerencia generada por IA como apoyo orientativo. No constituye una decisión definitiva.';

const timeoutConfigurado = Number(
  process.env.OPENAI_TIMEOUT_MS || 4000
);

const TIMEOUT_MAXIMO_MS =
  Number.isSafeInteger(timeoutConfigurado) &&
  timeoutConfigurado >= 1000 &&
  timeoutConfigurado <= 20000
    ? timeoutConfigurado
    : 4000;
const MAXIMO_FALLOS = 3;
const TIEMPO_RECUPERACION_MS = 60000;

let fallosConsecutivos = 0;
let circuitoAbiertoHasta = 0;

const categoriasPermitidas = new Set([
  'actividades',
  'organizacion',
  'asistencia',
  'puntualidad',
  'acompanamiento',
  'estudio',
  'general',
]);

const prioridadesPermitidas = new Set([
  'alta',
  'media',
  'baja',
]);

// ======================================================
// CLIENTE OPENAI
// ======================================================

const obtenerClienteOpenAI = () => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      'OPENAI_API_KEY no está configurada.'
    );
  }

  return new OpenAI({
    apiKey,
    timeout: TIMEOUT_MAXIMO_MS,
    maxRetries: 0,
  });
};

// ======================================================
// VALIDACIONES
// ======================================================

const validarTexto = (valor, maximo) => {
  if (typeof valor !== 'string') {
    return null;
  }

  const texto = valor.trim();

  if (!texto || texto.length > maximo) {
    return null;
  }

  return texto;
};

const validarRecomendacionesIA = (contenido) => {
  if (
    !contenido ||
    typeof contenido !== 'object' ||
    !Array.isArray(contenido.recomendaciones)
  ) {
    throw new Error(
      'La IA devolvió una estructura inválida.'
    );
  }

  if (
    contenido.recomendaciones.length < 1 ||
    contenido.recomendaciones.length > 5
  ) {
    throw new Error(
      'La IA devolvió una cantidad inválida de recomendaciones.'
    );
  }

  const recomendaciones = contenido.recomendaciones.map(
    (recomendacion) => {
      const categoria = recomendacion?.categoria;
      const prioridad = recomendacion?.prioridad;

      const titulo = validarTexto(
        recomendacion?.titulo,
        120
      );

      const descripcion = validarTexto(
        recomendacion?.descripcion,
        600
      );

      const accionesOriginales = recomendacion?.acciones;

      if (
        !categoriasPermitidas.has(categoria) ||
        !prioridadesPermitidas.has(prioridad) ||
        !titulo ||
        !descripcion ||
        !Array.isArray(accionesOriginales) ||
        accionesOriginales.length < 1 ||
        accionesOriginales.length > 5
      ) {
        throw new Error(
          'Una recomendación generada por IA no cumple las validaciones.'
        );
      }

      const acciones = accionesOriginales.map(
        (accion) => validarTexto(accion, 250)
      );

      if (acciones.some((accion) => !accion)) {
        throw new Error(
          'La IA devolvió una acción inválida.'
        );
      }

      return {
        categoria,
        prioridad,
        titulo,
        descripcion,
        acciones,
      };
    }
  );

  return {
    origen: 'ia',
    version: 1,
    aviso: AVISO_IA,
    recomendaciones,
  };
};

// ======================================================
// RESPALDO ACADÉMICO
// ======================================================

const generarConRespaldo = (
  contextoIA,
  motivo = 'IA_NO_DISPONIBLE'
) => {
  const respaldo =
    generarRecomendacionesRespaldo(contextoIA);

  return {
    ...respaldo,
    motivoRespaldo: motivo,
  };
};

// ======================================================
// GENERACIÓN DE RECOMENDACIONES
// ======================================================

const generarRecomendacionesAcademicas = async (
  contextoIA
) => {
  if (
    !contextoIA ||
    typeof contextoIA !== 'object' ||
    Array.isArray(contextoIA) ||
    !contextoIA.calificaciones ||
    !contextoIA.actividades ||
    !contextoIA.asistencia ||
    !contextoIA.riesgos
  ) {
    throw new Error(
      'El contexto académico es inválido.'
    );
  }

  // Respaldo cuando la IA está desactivada.
  if (process.env.OPENAI_ENABLED !== 'true') {
    return generarConRespaldo(
      contextoIA,
      'OPENAI_DESACTIVADO'
    );
  }

  // Circuit Breaker.
  if (Date.now() < circuitoAbiertoHasta) {
    return generarConRespaldo(
      contextoIA,
      'CIRCUITO_ABIERTO'
    );
  }

  try {
    const cliente = obtenerClienteOpenAI();

    const modelo =
      process.env.OPENAI_MODEL ||
      'gpt-4.1-mini';

    // ================================================
    // INSTRUCCIONES ACADÉMICAS
    // ================================================

    const instrucciones = `
Eres un asistente de acompañamiento académico
para una institución educativa.

Genera entre 1 y 5 recomendaciones académicas
orientativas utilizando exclusivamente los
indicadores proporcionados.

REGLAS OBLIGATORIAS:

- Responde en español.
- Devuelve exclusivamente JSON válido.
- No inventes calificaciones.
- No inventes fechas ni plazos.
- No supongas que un promedio es una nota oficial.
- No clasifiques una calificación como aprobada
  o reprobada sin conocer la escala institucional.
- Si no existen registros de asistencia, no afirmes
  que el estudiante tiene buena o mala asistencia.
- No tomes decisiones académicas definitivas.
- No emitas diagnósticos psicológicos o médicos.
- No solicites datos personales.
- Propón acciones concretas y respetuosas.
- Prioriza las necesidades según los indicadores.
- No atribuyas hechos que no estén respaldados
  por los datos disponibles.

La respuesta debe ser un objeto JSON
con exactamente esta estructura:

{
  "recomendaciones": [
    {
      "categoria": "estudio",
      "prioridad": "media",
      "titulo": "Título breve",
      "descripcion": "Explicación orientativa",
      "acciones": [
        "Primera acción",
        "Segunda acción"
      ]
    }
  ]
}

Categorías permitidas:
actividades, organizacion, asistencia,
puntualidad, acompanamiento, estudio, general.

Prioridades permitidas:
alta, media, baja.
`;

    // ================================================
    // SOLICITUD A OPENAI
    // ================================================

    const respuesta = await cliente.responses.create({
      model: modelo,

      // CORRECCIÓN 1:
      // Utilizar la variable realmente definida.
      instructions: instrucciones,

      // CORRECCIÓN 2:
      // Solicitar explícitamente JSON también
      // en el contenido de entrada.
      input:
        'Genera exclusivamente un objeto JSON válido ' +
        'con recomendaciones académicas a partir ' +
        'de los siguientes indicadores anónimos:\n' +
        JSON.stringify(contextoIA),

      max_output_tokens: 1200,

      text: {
        format: {
          type: 'json_object',
        },
      },
    });

    // ================================================
    // VALIDAR RESPUESTA
    // ================================================

    if (
      respuesta.status === 'incomplete' ||
      !respuesta.output_text ||
      !respuesta.output_text.trim()
    ) {
      throw new Error(
        'OpenAI no devolvió una respuesta completa.'
      );
    }

    let contenido;

    try {
      contenido = JSON.parse(
        respuesta.output_text
      );
    } catch (_error) {
      throw new Error(
        'OpenAI devolvió un JSON inválido.'
      );
    }

    const resultado =
      validarRecomendacionesIA(contenido);

    // Reiniciar el circuito tras una respuesta válida.
    fallosConsecutivos = 0;
    circuitoAbiertoHasta = 0;

    console.log(
      '[HU-11] Recomendaciones OpenAI validadas correctamente.'
    );

    return {
      ...resultado,
      modeloIA: modelo,
    };

  } catch (error) {
    fallosConsecutivos += 1;

    if (fallosConsecutivos >= MAXIMO_FALLOS) {
      circuitoAbiertoHasta =
        Date.now() + TIEMPO_RECUPERACION_MS;
    }

    const mensajeInterno = String(error?.message || '');

    let causa = 'ERROR_NO_CLASIFICADO';

    if (
      error?.name === 'APIConnectionTimeoutError' ||
      /timed out|timeout|tiempo de espera/i.test(
        mensajeInterno
      )
    ) {
      causa = 'TIMEOUT_OPENAI';
    } else if (error?.status === 401) {
      causa = 'AUTENTICACION_API';
    } else if (error?.status === 429) {
      causa = 'CUOTA_O_LIMITE_API';
    } else if (error?.status === 400) {
      causa = 'PARAMETROS_API';
    } else if (
      mensajeInterno.includes('OPENAI_API_KEY no está configurada')
    ) {
      causa = 'API_KEY_NO_CONFIGURADA';
    } else if (
      mensajeInterno.includes('estructura inválida') ||
      mensajeInterno.includes('cantidad inválida') ||
      mensajeInterno.includes('no cumple las validaciones') ||
      mensajeInterno.includes('acción inválida')
    ) {
      causa = 'VALIDACION_RECOMENDACIONES';
    } else if (
      mensajeInterno.includes('JSON inválido')
    ) {
      causa = 'JSON_INVALIDO';
    } else if (
      mensajeInterno.includes('respuesta completa') ||
      mensajeInterno.includes('no devolvió contenido')
    ) {
      causa = 'RESPUESTA_INCOMPLETA';
    }

    const mensajeSeguro = mensajeInterno
      .replace(/\bsk-[A-Za-z0-9_-]+\b/g, '[CLAVE_REDACTADA]')
      .replace(/\bBearer\s+\S+/gi, 'Bearer [TOKEN_REDACTADO]')
      .replace(
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
        '[UUID_REDACTADO]'
      )
      .slice(0, 240);

    console.error('[HU-11] Diagnóstico OpenAI:', {
      causa,
      tipo: error?.name || 'Desconocido',
      estadoHTTP: error?.status ?? null,
      codigo:
        typeof error?.code === 'string'
          ? error.code
          : null,
      detalle: mensajeSeguro || null,
    });

    return generarConRespaldo(
      contextoIA,
      'ERROR_OPENAI'
    );
  }
};

module.exports = {
  generarRecomendacionesAcademicas,
};
