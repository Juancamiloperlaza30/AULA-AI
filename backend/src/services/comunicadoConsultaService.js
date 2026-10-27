'use strict';

// ============================================================
// AULA-AI
// HU-12 - COMUNICADOS INSTITUCIONALES
// SERVICIO DE CONSULTA DE COMUNICADOS
// ============================================================

const { supabaseAdmin } = require('../config/supabase');

// ============================================================
// CONFIGURACIÓN DE PAGINACIÓN
// ============================================================

const LIMITE_PREDETERMINADO = 20;
const LIMITE_MAXIMO = 50;

// ============================================================
// NORMALIZAR Y VALIDAR PAGINACIÓN
// ============================================================

function normalizarPaginacion({
  pagina = 1,
  limite = LIMITE_PREDETERMINADO,
} = {}) {
  const numeroPagina = Number(pagina);
  const numeroLimite = Number(limite);

  if (
    !Number.isSafeInteger(numeroPagina) ||
    numeroPagina < 1 ||
    !Number.isSafeInteger(numeroLimite) ||
    numeroLimite < 1 ||
    numeroLimite > LIMITE_MAXIMO
  ) {
    throw new Error(
      'Los parámetros de paginación no son válidos.'
    );
  }

  const desde = (numeroPagina - 1) * numeroLimite;

  if (
    !Number.isSafeInteger(desde) ||
    desde > 2147483647
  ) {
    throw new Error(
      'Los parámetros de paginación no son válidos.'
    );
  }

  return {
    pagina: numeroPagina,
    limite: numeroLimite,
    desde,
  };
}

// ============================================================
// CONSULTAR COMUNICADOS DEL USUARIO AUTENTICADO
// ============================================================

async function consultarMisComunicados({
  usuarioId,
  pagina = 1,
  limite = LIMITE_PREDETERMINADO,
}) {
  // ----------------------------------------------------------
  // 1. VALIDAR IDENTIFICADOR
  // ----------------------------------------------------------

  if (
    typeof usuarioId !== 'string' ||
    !usuarioId.trim()
  ) {
    throw new Error(
      'El identificador del usuario es obligatorio.'
    );
  }

  // ----------------------------------------------------------
  // 2. VALIDAR PAGINACIÓN
  // ----------------------------------------------------------

  const paginacion = normalizarPaginacion({
    pagina,
    limite,
  });

  // ----------------------------------------------------------
  // 3. CONSULTAR FUNCIÓN SQL
  // ----------------------------------------------------------

  const { data, error } = await supabaseAdmin.rpc(
    'consultar_mis_comunicados_hu12',
    {
      p_usuario_id: usuarioId,
      p_pagina: paginacion.pagina,
      p_limite: paginacion.limite,
    }
  );

  if (error) {
    console.error(
      '[HU-12] Error consultando comunicados:',
      error.message
    );

    throw error;
  }

  // ----------------------------------------------------------
  // 4. NORMALIZAR RESULTADOS
  // ----------------------------------------------------------

  const registros = Array.isArray(data)
    ? data
    : [];

  const comunicados = registros.map((registro) => ({
    id: registro.id,
    titulo: registro.titulo,
    contenido: registro.contenido,
    alcanceTipo: registro.alcance_tipo,
    fechaPublicacion: registro.fecha_publicacion,
    publicadoPor: registro.publicado_por,

    // Nuevos campos de HU-12
    leido: false,
    fechaLectura: null,
  }));

  // ----------------------------------------------------------
  // 5. CONSULTAR LECTURAS DE LA PÁGINA ACTUAL
  // ----------------------------------------------------------

  if (comunicados.length > 0) {
    const comunicadosIds = comunicados.map(
      (comunicado) => comunicado.id
    );

    const {
      data: lecturas,
      error: errorLecturas,
    } = await supabaseAdmin
      .from('comunicados_lecturas')
      .select(
        'comunicado_id, leido, fecha_lectura'
      )
      .eq('usuario_id', usuarioId)
      .in('comunicado_id', comunicadosIds);

    if (errorLecturas) {
      console.error(
        '[HU-12] Error consultando lecturas:',
        errorLecturas.message
      );

      throw errorLecturas;
    }

    // Crear un mapa para asociar las lecturas
    // sin consultar individualmente cada comunicado.
    const mapaLecturas = new Map();

    for (const lectura of lecturas || []) {
      mapaLecturas.set(
        String(lectura.comunicado_id),
        lectura
      );
    }

    for (const comunicado of comunicados) {
      const lectura = mapaLecturas.get(
        String(comunicado.id)
      );

      if (lectura && lectura.leido === true) {
        comunicado.leido = true;
        comunicado.fechaLectura =
          lectura.fecha_lectura;
      }
    }
  }

  // ----------------------------------------------------------
  // 6. OBTENER TOTAL DE REGISTROS
  // ----------------------------------------------------------

  let total = 0;

  if (registros.length > 0) {
    total = Number(registros[0].total_registros) || 0;
  } else {
    // Una página vacía no contiene el COUNT(*) OVER()
    // de la función SQL, por lo que conservamos el
    // conteo alternativo de comunicados publicados.

    const { count, error: errorConteo } =
      await supabaseAdmin
        .from('comunicados_destinatarios')
        .select(
          'comunicado_id, comunicados!inner(id)',
          {
            count: 'exact',
            head: true,
          }
        )
        .eq('usuario_id', usuarioId)
        .eq('comunicados.estado', 'publicado');

    if (errorConteo) {
      console.error(
        '[HU-12] Error contando comunicados:',
        errorConteo.message
      );

      throw errorConteo;
    }

    total = count || 0;
  }

  // ----------------------------------------------------------
  // 7. DEVOLVER RESULTADOS PAGINADOS
  // ----------------------------------------------------------

  return {
    comunicados,

    paginacion: {
      pagina: paginacion.pagina,
      limite: paginacion.limite,
      total,
      totalPaginas: Math.ceil(
        total / paginacion.limite
      ),
    },
  };
}

// ============================================================
// EXPORTACIONES
// ============================================================

module.exports = {
  consultarMisComunicados,
  normalizarPaginacion,
};
