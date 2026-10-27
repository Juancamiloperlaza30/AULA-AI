
'use strict';

const { supabaseAdmin } = require('../config/supabase');

// ======================================================
// AULA-AI | HU-08
// ALERTAS E HISTORIAL ACADÉMICO DEL ACUDIENTE
//
// Seguridad:
// - JWT y rol acudiente desde guardianRoutes.
// - Vinculación activa y verificada.
// - Estudiante activo.
// - Consultas de solo lectura.
// - Filtros y paginación validados.
// ======================================================

const TIPOS_PERMITIDOS = [
  'bajo_rendimiento',
  'inasistencias',
  'llegadas_tarde',
  'actividad_incumplida',
];

const ESTADOS_PERMITIDOS = [
  'activa',
  'en_seguimiento',
  'resuelta',
];

const NIVELES_PERMITIDOS = [
  'baja',
  'media',
  'alta',
  'critica',
];

const EVENTOS_PERMITIDOS = [
  'creada',
  'actualizada',
  'resuelta',
  'reabierta',
];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ======================================================
// RESPUESTAS Y VALIDACIONES
// ======================================================

function respuestaError(res, codigo, mensaje) {
  return res.status(codigo).json({
    success: false,
    message: mensaje,
  });
}

function errorBaseDatos(res, error) {
  console.error(
    '[AULA-AI][HU-08] Consulta de alertas:',
    error?.message || error
  );

  return respuestaError(
    res,
    500,
    'No fue posible consultar la información académica.'
  );
}

function validarEntero(valor, defecto, maximo) {
  if (valor === undefined) {
    return defecto;
  }

  if (
    typeof valor !== 'string' ||
    !/^[1-9]\d*$/.test(valor)
  ) {
    return null;
  }

  const numero = Number(valor);

  if (
    !Number.isSafeInteger(numero) ||
    numero > maximo
  ) {
    return null;
  }

  return numero;
}

function obtenerFiltrosPaginacion(req) {
  const pagina = validarEntero(
    req.query.pagina,
    1,
    10000
  );

  const limite = validarEntero(
    req.query.limite,
    20,
    50
  );

  if (pagina === null || limite === null) {
    return null;
  }

  return { pagina, limite };
}

function construirPaginacion(pagina, limite, count) {
  const total = count ?? 0;
  const totalPaginas = Math.ceil(total / limite);

  return {
    pagina,
    limite,
    total,
    totalPaginas,
    tieneSiguiente: pagina < totalPaginas,
    tieneAnterior: pagina > 1,
  };
}

// ======================================================
// VERIFICAR VINCULACIÓN ACTIVA
// ======================================================

async function verificarEstudianteAutorizado(
  acudienteId,
  estudianteId
) {
  const {
    data: vinculaciones,
    error: errorVinculo,
  } = await supabaseAdmin
    .from('acudiente_estudiante')
    .select('estudiante_id')
    .eq('acudiente_id', acudienteId)
    .eq('estudiante_id', estudianteId)
    .eq('activo', true)
    .eq('verificado', true)
    .limit(1);

  if (errorVinculo) {
    throw errorVinculo;
  }

  if (!vinculaciones?.length) {
    return null;
  }

  const {
    data: estudiante,
    error: errorEstudiante,
  } = await supabaseAdmin
    .from('usuarios')
    .select(`
      id,
      nombres,
      apellidos,
      rol,
      activo
    `)
    .eq('id', estudianteId)
    .eq('rol', 'estudiante')
    .eq('activo', true)
    .maybeSingle();

  if (errorEstudiante) {
    throw errorEstudiante;
  }

  return estudiante || null;
}

// ======================================================
// AUTORIZAR CONSULTA DEL ACUDIENTE
// ======================================================

async function autorizarConsulta(req, res) {
  const acudienteId = req.usuario?.id;
  const rol = req.usuario?.rol;

  if (
    rol !== 'acudiente' ||
    !UUID_REGEX.test(String(acudienteId || ''))
  ) {
    respuestaError(
      res,
      403,
      'No tiene autorización para consultar información académica.'
    );

    return null;
  }

  const estudianteId = req.params.estudianteId;

  if (
    typeof estudianteId !== 'string' ||
    !UUID_REGEX.test(estudianteId)
  ) {
    respuestaError(
      res,
      400,
      'El identificador del estudiante es inválido.'
    );

    return null;
  }

  const estudiante =
    await verificarEstudianteAutorizado(
      acudienteId,
      estudianteId
    );

  if (!estudiante) {
    respuestaError(
      res,
      403,
      'No tiene una vinculación activa y verificada con este estudiante.'
    );

    return null;
  }

  return {
    estudianteId,
    estudiante: {
      id: estudiante.id,
      nombres: estudiante.nombres,
      apellidos: estudiante.apellidos,
      nombreCompleto: [
        estudiante.nombres,
        estudiante.apellidos,
      ]
        .filter(Boolean)
        .join(' '),
    },
  };
}

// ======================================================
// CONSULTAR ALERTAS ACTUALES
//
// GET /api/guardian/estudiantes/:estudianteId/alertas
// ======================================================

async function listarAlertasAcudiente(req, res) {
  try {
    const estado =
      req.query.estado === undefined
        ? 'todos'
        : req.query.estado;

    const tipo =
      req.query.tipo === undefined
        ? 'todos'
        : req.query.tipo;

    const nivel =
      req.query.nivel === undefined
        ? 'todos'
        : req.query.nivel;

    const paginacion = obtenerFiltrosPaginacion(req);

    if (!paginacion) {
      return respuestaError(
        res,
        400,
        'La página o el límite de resultados es inválido.'
      );
    }

    if (
      estado !== 'todos' &&
      !ESTADOS_PERMITIDOS.includes(estado)
    ) {
      return respuestaError(
        res,
        400,
        'El filtro de estado es inválido.'
      );
    }

    if (
      tipo !== 'todos' &&
      !TIPOS_PERMITIDOS.includes(tipo)
    ) {
      return respuestaError(
        res,
        400,
        'El filtro de tipo es inválido.'
      );
    }

    if (
      nivel !== 'todos' &&
      !NIVELES_PERMITIDOS.includes(nivel)
    ) {
      return respuestaError(
        res,
        400,
        'El filtro de nivel es inválido.'
      );
    }

    const autorizacion =
      await autorizarConsulta(req, res);

    if (!autorizacion) {
      return;
    }

    const { estudianteId, estudiante } = autorizacion;
    const { pagina, limite } = paginacion;

    let consulta = supabaseAdmin
      .from('alertas_academicas')
      .select(
        `
          id,
          estudiante_id,
          tipo,
          nivel,
          titulo,
          descripcion,
          estado,
          origen_tipo,
          origen_id,
          periodo_id,
          detalles,
          fecha_evento,
          resuelta_at,
          created_at,
          updated_at
        `,
        { count: 'exact' }
      )
      .eq('estudiante_id', estudianteId);

    if (estado !== 'todos') {
      consulta = consulta.eq('estado', estado);
    }

    if (tipo !== 'todos') {
      consulta = consulta.eq('tipo', tipo);
    }

    if (nivel !== 'todos') {
      consulta = consulta.eq('nivel', nivel);
    }

    const inicio = (pagina - 1) * limite;
    const fin = inicio + limite - 1;

    const {
      data: alertas,
      count,
      error,
    } = await consulta
      .order('created_at', {
        ascending: false,
      })
      .order('id', {
        ascending: false,
      })
      .range(inicio, fin);

    if (error) {
      return errorBaseDatos(res, error);
    }

    return res.status(200).json({
      success: true,
      estudiante,

      filtros: {
        estado,
        tipo,
        nivel,
      },

      paginacion: construirPaginacion(
        pagina,
        limite,
        count
      ),

      alertas: alertas || [],
    });
  } catch (error) {
    return errorBaseDatos(res, error);
  }
}

// ======================================================
// CONSULTAR HISTORIAL DE ALERTAS
//
// GET /api/guardian/estudiantes/:estudianteId/alertas/historial
//
// Filtros opcionales:
// ?evento=creada
// ?evento=actualizada
// ?evento=resuelta
// ?evento=reabierta
// ?tipo=bajo_rendimiento
// ?periodoId=1
// ?pagina=1
// ?limite=20
//
// El historial es de solo lectura.
// ======================================================

async function listarHistorialAlertasAcudiente(req, res) {
  try {
    const evento =
      req.query.evento === undefined
        ? 'todos'
        : req.query.evento;

    const tipo =
      req.query.tipo === undefined
        ? 'todos'
        : req.query.tipo;

    const periodoId =
      req.query.periodoId === undefined
        ? null
        : validarEntero(
            req.query.periodoId,
            null,
            2147483647
          );

    const paginacion = obtenerFiltrosPaginacion(req);

    if (!paginacion) {
      return respuestaError(
        res,
        400,
        'La página o el límite de resultados es inválido.'
      );
    }

    if (
      evento !== 'todos' &&
      !EVENTOS_PERMITIDOS.includes(evento)
    ) {
      return respuestaError(
        res,
        400,
        'El filtro de evento es inválido.'
      );
    }

    if (
      tipo !== 'todos' &&
      !TIPOS_PERMITIDOS.includes(tipo)
    ) {
      return respuestaError(
        res,
        400,
        'El filtro de tipo es inválido.'
      );
    }

    if (
      req.query.periodoId !== undefined &&
      periodoId === null
    ) {
      return respuestaError(
        res,
        400,
        'El identificador del período es inválido.'
      );
    }

    // Verificar la vinculación antes de consultar
    // datos históricos.

    const autorizacion =
      await autorizarConsulta(req, res);

    if (!autorizacion) {
      return;
    }

    const { estudianteId, estudiante } = autorizacion;
    const { pagina, limite } = paginacion;

    // Consultar historial junto con su alerta
    // original. La relación es por alerta_id.
    //
    // !inner evita incluir eventos cuyo registro
    // original no pertenezca al estudiante.

    let consulta = supabaseAdmin
      .from('alertas_academicas_historial')
      .select(
        `
          id,
          alerta_id,
          estudiante_id,
          tipo_evento,
          estado_anterior,
          estado_nuevo,
          nivel_anterior,
          nivel_nuevo,
          promedio_anterior,
          promedio_nuevo,
          detalles_anteriores,
          detalles_nuevos,
          descripcion,
          created_at,
          alerta:alertas_academicas!inner (
            id,
            estudiante_id,
            tipo,
            titulo,
            descripcion,
            estado,
            nivel,
            periodo_id,
            origen_tipo,
            origen_id,
            created_at
          )
        `,
        { count: 'exact' }
      )
      .eq('estudiante_id', estudianteId)
      .eq('alerta.estudiante_id', estudianteId);

    if (evento !== 'todos') {
      consulta = consulta.eq('tipo_evento', evento);
    }

    if (tipo !== 'todos') {
      consulta = consulta.eq('alerta.tipo', tipo);
    }

    if (periodoId !== null) {
      consulta = consulta.eq(
        'alerta.periodo_id',
        periodoId
      );
    }

    const inicio = (pagina - 1) * limite;
    const fin = inicio + limite - 1;

    const {
      data: registros,
      count,
      error,
    } = await consulta
      .order('created_at', {
        ascending: false,
      })
      .order('id', {
        ascending: false,
      })
      .range(inicio, fin);

    if (error) {
      return errorBaseDatos(res, error);
    }

    const historial = (registros || []).map(
      (registro) => {
        const detallesNuevos =
          registro.detalles_nuevos || {};

        const detallesAnteriores =
          registro.detalles_anteriores || {};

        const alerta = registro.alerta || {};

        return {
          id: registro.id,
          alertaId: registro.alerta_id,

          tipoEvento: registro.tipo_evento,

          fecha: registro.created_at,

          descripcion: registro.descripcion,

          estadoAnterior: registro.estado_anterior,
          estadoNuevo: registro.estado_nuevo,

          nivelAnterior: registro.nivel_anterior,
          nivelNuevo: registro.nivel_nuevo,

          promedioAnterior: registro.promedio_anterior,
          promedioNuevo: registro.promedio_nuevo,

          materia:
            detallesNuevos.materia ||
            detallesAnteriores.materia ||
            null,

          materiaId:
            detallesNuevos.materiaId ||
            detallesAnteriores.materiaId ||
            null,

          periodoId: alerta.periodo_id,

          tituloAlerta: alerta.titulo,
          tipoAlerta: alerta.tipo,

          estadoActual: alerta.estado,
          nivelActual: alerta.nivel,

          detallesAnteriores,
          detallesNuevos,
        };
      }
    );

    return res.status(200).json({
      success: true,

      estudiante,

      filtros: {
        evento,
        tipo,
        periodoId,
      },

      paginacion: construirPaginacion(
        pagina,
        limite,
        count
      ),

      historial,
    });
  } catch (error) {
    return errorBaseDatos(res, error);
  }
}

// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {
  listarAlertasAcudiente,
  listarHistorialAlertasAcudiente,
};
