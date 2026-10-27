'use strict';

// ======================================================
// AULA-AI | HU-11
// MOTOR DE RECOMENDACIONES ACADÉMICAS CON GEMINI
// ======================================================

const { GoogleGenAI } = require('@google/genai');

const {
  generarRecomendacionesRespaldo,
} = require('./academicRecommendationFallbackService');

const AVISO_IA =
  'Sugerencia generada por IA como apoyo orientativo. ' +
  'No constituye una decisión académica definitiva.';

const CATEGORIAS = new Set([
  'actividades',
  'organizacion',
  'asistencia',
  'puntualidad',
  'acompanamiento',
  'estudio',
  'general',
]);

const PRIORIDADES = new Set([
  'alta',
  'media',
  'baja',
]);

const MAXIMO_FALLOS = 3;
const RECUPERACION_MS = 60000;

let fallosConsecutivos = 0;
let circuitoAbiertoHasta = 0;

// ======================================================
// CONFIGURACIÓN
// ======================================================

function obtenerTimeout() {
  const valor = Number(
    process.env.GEMINI_TIMEOUT_MS || 4000
  );

  return Number.isSafeInteger(valor) &&
    valor >= 1000 &&
    valor <= 20000
    ? valor
    : 4000;
}

function obtenerCliente() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    throw new Error('GEMINI_API_KEY_NO_CONFIGURADA');
  }

  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      timeout: obtenerTimeout(),
    },
  });
}

// ======================================================
// VALIDACIÓN DE RESULTADOS
// ======================================================

function validarTexto(valor, maximo) {
  if (typeof valor !== 'string') {
    return null;
  }

  const texto = valor.trim();

  return texto && texto.length <= maximo
    ? texto
    : null;
}

function validarRecomendaciones(contenido) {
  if (
    !contenido ||
    !Array.isArray(contenido.recomendaciones) ||
    contenido.recomendaciones.length < 1 ||
    contenido.recomendaciones.length > 5
  ) {
    throw new Error('ESTRUCTURA_IA_INVALIDA');
  }

  const recomendaciones =
    contenido.recomendaciones.map((item) => {
      const titulo = validarTexto(item?.titulo, 120);
      const descripcion = validarTexto(
        item?.descripcion,
        600
      );

      if (
        !CATEGORIAS.has(item?.categoria) ||
        !PRIORIDADES.has(item?.prioridad) ||
        !titulo ||
        !descripcion ||
        !Array.isArray(item?.acciones) ||
        item.acciones.length < 1 ||
        item.acciones.length > 5
      ) {
        throw new Error('RECOMENDACION_IA_INVALIDA');
      }

      const acciones = item.acciones.map(
        (accion) => validarTexto(accion, 250)
      );

      if (acciones.some((accion) => !accion)) {
        throw new Error('ACCIONES_IA_INVALIDAS');
      }

      return {
        categoria: item.categoria,
        prioridad: item.prioridad,
        titulo,
        descripcion,
        acciones,
      };
    });

  return {
    origen: 'ia',
    version: 1,
    aviso: AVISO_IA,
    recomendaciones,
  };
}

// ======================================================
// RESPALDO
// ======================================================

function generarConRespaldo(contextoIA, motivo) {
  return {
    ...generarRecomendacionesRespaldo(contextoIA),
    motivoRespaldo: motivo,
  };
}

// ======================================================
// INSTRUCCIONES ACADÉMICAS
// ======================================================

const INSTRUCCIONES = `
Eres un asistente de acompañamiento académico
para una institución educativa.

Analiza exclusivamente los indicadores académicos
proporcionados y genera entre 1 y 5 recomendaciones.

REGLAS OBLIGATORIAS:

- Responde únicamente en español.
- Devuelve exclusivamente un objeto JSON válido.
- No inventes calificaciones, fechas o actividades.
- No supongas que un promedio es una nota oficial.
- No clasifiques notas como aprobadas o reprobadas
  si no conoces la escala institucional.
- No inventes registros de asistencia.
- No emitas diagnósticos médicos o psicológicos.
- No solicites información personal.
- No tomes decisiones académicas definitivas.
- Las recomendaciones deben ser concretas,
  respetuosas y relacionadas con los indicadores.
- No inventes información faltante.

Devuelve exactamente esta estructura:

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

// ======================================================
// GENERACIÓN CON GEMINI
// ======================================================

async function generarRecomendacionesAcademicas(
  contextoIA
) {
  if (
    !contextoIA ||
    typeof contextoIA !== 'object' ||
    Array.isArray(contextoIA) ||
    !contextoIA.calificaciones ||
    !contextoIA.actividades ||
    !contextoIA.asistencia ||
    !contextoIA.riesgos
  ) {
    throw new Error('El contexto académico es inválido.');
  }

  if (process.env.GEMINI_ENABLED !== 'true') {
    return generarConRespaldo(
      contextoIA,
      'GEMINI_DESACTIVADO'
    );
  }

  if (Date.now() < circuitoAbiertoHasta) {
    return generarConRespaldo(
      contextoIA,
      'CIRCUITO_ABIERTO'
    );
  }

  const modelo =
    process.env.GEMINI_MODEL ||
    'gemini-3.5-flash-lite';

  const inicio = Date.now();

  try {
    const cliente = obtenerCliente();

    const respuesta = await cliente.models.generateContent({
      model: modelo,

      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                'Genera recomendaciones académicas ' +
                'utilizando los siguientes indicadores:\n' +
                JSON.stringify(contextoIA),
            },
          ],
        },
      ],

      config: {
        systemInstruction: INSTRUCCIONES,
        temperature: 0.2,
        maxOutputTokens: 1500,
        responseMimeType: 'application/json',
      },
    });

    const texto = respuesta.text?.trim();

    if (!texto) {
      throw new Error('RESPUESTA_IA_VACIA');
    }

    let contenido;

    try {
      contenido = JSON.parse(texto);
    } catch {
      throw new Error('JSON_IA_INVALIDO');
    }

    const resultado = validarRecomendaciones(contenido);

    fallosConsecutivos = 0;
    circuitoAbiertoHasta = 0;

    console.log('[HU-11] Gemini respondió correctamente:', {
      modelo,
      duracionMs: Date.now() - inicio,
      recomendaciones: resultado.recomendaciones.length,
    });

    return {
      ...resultado,
      modeloIA: modelo,
    };
  } catch (error) {
    fallosConsecutivos += 1;

    if (fallosConsecutivos >= MAXIMO_FALLOS) {
      circuitoAbiertoHasta =
        Date.now() + RECUPERACION_MS;
    }

    const estadoHTTP =
      typeof error?.status === 'number'
        ? error.status
        : null;

    const mensaje = String(error?.message || '');

    let causa = 'ERROR_GEMINI';

    if (
      /timeout|timed out|deadline exceeded/i.test(mensaje)
    ) {
      causa = 'TIMEOUT_GEMINI';
    } else if (estadoHTTP === 429) {
      causa = 'LIMITE_GEMINI';
    } else if (estadoHTTP === 401 || estadoHTTP === 403) {
      causa = 'AUTENTICACION_GEMINI';
    } else if (estadoHTTP === 404) {
      causa = 'MODELO_NO_DISPONIBLE';
    } else if (
      mensaje.includes('INVALIDO') ||
      mensaje.includes('INVALIDA')
    ) {
      causa = 'VALIDACION_GEMINI';
    } else if (mensaje === 'RESPUESTA_IA_VACIA') {
      causa = 'RESPUESTA_VACIA';
    }

    // Diagnóstico temporal de errores del proveedor.
    // No registrar claves API ni datos académicos.

    const mensajeProveedor = String(
      error?.message || 'Sin mensaje'
    );

    let detalleProveedor = mensajeProveedor;

    try {
      const errorParseado = JSON.parse(mensajeProveedor);

      detalleProveedor =
        errorParseado?.error?.message ||
        'Sin detalle disponible';
    } catch {
      // El proveedor devolvió texto en lugar de JSON.
    }

    const detalleSeguro = detalleProveedor
      .replace(
        /AIza[0-9A-Za-z_-]+/g,
        '[API_KEY_REDACTADA]'
      )
      .replace(
        /\b[0-9a-f]{8}-[0-9a-f-]{27,36}\b/gi,
        '[UUID_REDACTADO]'
      )
      .slice(0, 500);

    console.error('[HU-11] Diagnóstico Gemini:', {
      causa,
      estadoHTTP,
      duracionMs: Date.now() - inicio,
      detalle: detalleSeguro,
    });

    return generarConRespaldo(
      contextoIA,
      causa
    );
  }
}

module.exports = {
  generarRecomendacionesAcademicas,
};
