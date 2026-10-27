'use strict';

// ======================================================
// AULA-AI | HU-12
// SERVICIO DE CONSULTA DE NOTIFICACIONES
// ======================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

// ======================================================
// 1. CONFIGURACION DE PAGINACION
// ======================================================

const PAGINA_PREDETERMINADA = 1;
const LIMITE_PREDETERMINADO = 20;
const LIMITE_MAXIMO = 100;

// ======================================================
// 2. VALIDAR NUMEROS ENTEROS POSITIVOS
// ======================================================

function normalizarEnteroPositivo(
  valor,
  valorPredeterminado
) {
  if (
    valor === undefined ||
    valor === null ||
    valor === ''
  ) {
    return valorPredeterminado;
  }

  const numero = Number(valor);

  if (
    !Number.isSafeInteger(numero) ||
    numero <= 0
  ) {
    return null;
  }

  return numero;
}

// ======================================================
// 3. NORMALIZAR PAGINACION
// ======================================================

function normalizarPaginacion({
  pagina,
  limite,
} = {}) {
  const paginaNormalizada =
    normalizarEnteroPositivo(
      pagina,
      PAGINA_PREDETERMINADA
    );

  const limiteNormalizado =
    normalizarEnteroPositivo(
      limite,
      LIMITE_PREDETERMINADO
    );

  if (
    paginaNormalizada === null ||
    limiteNormalizado === null ||
    limiteNormalizado > LIMITE_MAXIMO
  ) {
    const error = new Error(
      'Los parámetros de paginación no son válidos.'
    );

    error.statusCode = 400;

    throw error;
  }

  const desplazamiento =
    (paginaNormalizada - 1) *
    limiteNormalizado;

  if (!Number.isSafeInteger(desplazamiento)) {
    const error = new Error(
      'La página solicitada está fuera del rango permitido.'
    );

    error.statusCode = 400;

    throw error;
  }

  return {
    pagina: paginaNormalizada,
    limite: limiteNormalizado,
    desplazamiento,
  };
}

// ======================================================
// 4. CONSULTAR NOTIFICACIONES DEL USUARIO
// ======================================================

async function consultarMisNotificaciones({
  usuarioId,
  pagina = PAGINA_PREDETERMINADA,
  limite = LIMITE_PREDETERMINADO,
} = {}) {
  // ----------------------------------------------------
  // VALIDAR USUARIO
  // ----------------------------------------------------

  if (
    typeof usuarioId !== 'string' ||
    !usuarioId.trim()
  ) {
    const error = new Error(
      'El identificador del usuario es obligatorio.'
    );

    error.statusCode = 400;

    throw error;
  }

  // ----------------------------------------------------
  // VALIDAR PAGINACION
  // ----------------------------------------------------

  const paginacion = normalizarPaginacion({
    pagina,
    limite,
  });

  const desde = paginacion.desplazamiento;

  const hasta =
    desde + paginacion.limite - 1;

  if (!Number.isSafeInteger(hasta)) {
    const error = new Error(
      'El rango de consulta no es válido.'
    );

    error.statusCode = 400;

    throw error;
  }

  // ----------------------------------------------------
  // CONSULTAR SUPABASE
  // ----------------------------------------------------

  const {
    data,
    error,
    count,
  } = await supabaseAdmin
    .from('notificaciones')
    .select(
      [
        'id',
        'usuario_id',
        'tipo',
        'titulo',
        'mensaje',
        'recurso_tipo',
        'recurso_id',
        'comunicado_id',
        'evento_clave',
        'estado',
        'fecha_creacion',
        'fecha_lectura',
      ].join(','),
      {
        count: 'exact',
      }
    )
    .eq('usuario_id', usuarioId)
    .order('fecha_creacion', {
      ascending: false,
    })
    .order('id', {
      ascending: false,
    })
    .range(desde, hasta);

  if (error) {
    console.error(
      '[HU-12] Error consultando notificaciones:',
      error.message
    );

    throw error;
  }

  // ----------------------------------------------------
  // NORMALIZAR RESPUESTA
  // ----------------------------------------------------

  const notificaciones = (
    Array.isArray(data) ? data : []
  ).map((registro) => ({
    id: registro.id,

    tipo: registro.tipo,

    titulo: registro.titulo,

    mensaje: registro.mensaje,

    recursoTipo: registro.recurso_tipo,

    recursoId: registro.recurso_id,

    comunicadoId: registro.comunicado_id,

    eventoClave: registro.evento_clave,

    estado: registro.estado,

    fechaCreacion: registro.fecha_creacion,

    fechaLectura: registro.fecha_lectura,

    leida:
      registro.fecha_lectura !== null,
  }));

  const total = count ?? 0;

  // ----------------------------------------------------
  // RETORNAR RESULTADOS
  // ----------------------------------------------------

  return {
    notificaciones,

    paginacion: {
      pagina: paginacion.pagina,

      limite: paginacion.limite,

      total,

      totalPaginas:
        Math.ceil(total / paginacion.limite),
    },
  };
}

// ======================================================
// 5. EXPORTACIONES
// ======================================================

module.exports = {
  consultarMisNotificaciones,
  normalizarPaginacion,
};
