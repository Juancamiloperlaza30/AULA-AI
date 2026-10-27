'use strict';

// =====================================================
// AULA-AI | HU-09 | PASO 52.62
// CONSULTA Y SEGUIMIENTO DE EXCUSAS
//
// - JWT y rol acudiente desde guardianRoutes
// - Vinculacion activa y verificada
// - Informacion separada por estudiante
// - Estados y observaciones institucionales
// - Sin exponer rutas privadas de Storage
// - Solo lectura
// =====================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const responderError = (res, status, message) =>
  res.status(status).json({
    success: false,
    message,
  });

async function listarExcusasAcudiente(req, res) {
  try {
    const acudienteId = req.usuario?.id;
    const estudianteId = req.params.estudianteId;

    // 1. Identidad y rol.
    if (
      !UUID_REGEX.test(String(acudienteId || '')) ||
      req.usuario?.rol !== 'acudiente'
    ) {
      return responderError(
        res,
        403,
        'No está autorizado para consultar excusas.'
      );
    }

    if (
      !UUID_REGEX.test(String(estudianteId || ''))
    ) {
      return responderError(
        res,
        400,
        'El identificador del estudiante no es válido.'
      );
    }

    // 2. Vinculacion vigente.
    const {
      data: vinculacion,
      error: errorVinculacion,
    } = await supabaseAdmin
      .from('acudiente_estudiante')
      .select('id')
      .eq('acudiente_id', acudienteId)
      .eq('estudiante_id', estudianteId)
      .eq('activo', true)
      .eq('verificado', true)
      .maybeSingle();

    if (errorVinculacion) {
      throw errorVinculacion;
    }

    if (!vinculacion) {
      return responderError(
        res,
        403,
        'No tiene autorización vigente sobre este estudiante.'
      );
    }

    // 3. Estudiante activo.
    const {
      data: estudiante,
      error: errorEstudiante,
    } = await supabaseAdmin
      .from('usuarios')
      .select('id, nombres, apellidos')
      .eq('id', estudianteId)
      .eq('rol', 'estudiante')
      .eq('activo', true)
      .maybeSingle();

    if (errorEstudiante) {
      throw errorEstudiante;
    }

    if (!estudiante) {
      return responderError(
        res,
        404,
        'El estudiante no está disponible.'
      );
    }

    // 4. Consultar solicitudes exclusivamente
    // del acudiente y estudiante autorizados.
    // La paginacion limita la respuesta.
    const paginaRaw = String(req.query.pagina ?? '1');
    const limiteRaw = String(req.query.limite ?? '20');

    if (
      !/^[1-9]\d*$/.test(paginaRaw) ||
      !/^[1-9]\d*$/.test(limiteRaw)
    ) {
      return responderError(
        res,
        400,
        'La paginación no es válida.'
      );
    }

    const pagina = Number(paginaRaw);
    const limite = Number(limiteRaw);

    if (
      !Number.isSafeInteger(pagina) ||
      !Number.isSafeInteger(limite) ||
      limite > 50 ||
      (pagina - 1) * limite > 100000
    ) {
      return responderError(
        res,
        400,
        'La paginación solicitada no es válida.'
      );
    }

    const desde = (pagina - 1) * limite;

    const {
      data: excusas,
      count,
      error: errorExcusas,
    } = await supabaseAdmin
      .from('excusas')
      .select(
        `id, asistencia_id, motivo, estado,
         observacion_revision, revisado_at, created_at`,
        { count: 'exact' }
      )
      .eq('acudiente_id', acudienteId)
      .eq('estudiante_id', estudianteId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(desde, desde + limite - 1);

    if (errorExcusas) {
      throw errorExcusas;
    }

    const solicitudes = excusas || [];

    if (solicitudes.length === 0) {
      return res.status(200).json({
        success: true,
        estudiante: {
          id: estudiante.id,
          nombreCompleto: [
            estudiante.nombres,
            estudiante.apellidos,
          ].filter(Boolean).join(' '),
        },
        paginacion: {
          pagina,
          limite,
          total: count || 0,
        },
        excusas: [],
        message:
          'Todavía no existen solicitudes de excusas para este estudiante.',
      });
    }

    // 5. Recuperar fechas de inasistencia.
    const asistenciaIds = solicitudes.map(
      (excusa) => excusa.asistencia_id
    );

    const {
      data: asistencias,
      error: errorAsistencias,
    } = await supabaseAdmin
      .from('asistencias')
      .select(
        'id, fecha, estado, materia_grupo_periodo_id'
      )
      .eq('estudiante_id', estudianteId)
      .in('id', asistenciaIds);

    if (errorAsistencias) {
      throw errorAsistencias;
    }

    const asistenciasMap = new Map(
      (asistencias || []).map((item) => [
        String(item.id),
        item,
      ])
    );

    const asignacionIds = [
      ...new Set(
        (asistencias || []).map(
          (item) => item.materia_grupo_periodo_id
        )
      ),
    ];

    // 6. Consultar materias.
    let asignaciones = [];

    if (asignacionIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('materia_grupo_periodo')
        .select(`
          id,
          periodo_id,
          materia:materias (
            nombre
          )
        `)
        .in('id', asignacionIds);

      if (error) {
        throw error;
      }

      asignaciones = data || [];
    }

    const asignacionesMap = new Map(
      asignaciones.map((item) => [
        String(item.id),
        item,
      ])
    );

    // 7. Consultar si existe soporte registrado.
    // No devolver rutas ni enlaces privados.
    const excusaIds = solicitudes.map(
      (excusa) => excusa.id
    );

    const {
      data: soportes,
      error: errorSoportes,
    } = await supabaseAdmin
      .from('excusas_soportes')
      .select('id, excusa_id')
      .in('excusa_id', excusaIds);

    if (errorSoportes) {
      throw errorSoportes;
    }

    const soportesMap = new Map();

    for (const soporte of soportes || []) {
      const clave = String(soporte.excusa_id);

      if (!soportesMap.has(clave)) {
        soportesMap.set(clave, []);
      }

      soportesMap.get(clave).push({
        id: soporte.id,
      });
    }

    // 8. Preparar respuesta segura.
    const resultado = solicitudes.map((excusa) => {
      const asistencia = asistenciasMap.get(
        String(excusa.asistencia_id)
      );

      const asignacion = asistencia
        ? asignacionesMap.get(
            String(asistencia.materia_grupo_periodo_id)
          )
        : null;

      const relacionMateria = asignacion?.materia;
      const materia = Array.isArray(relacionMateria)
        ? relacionMateria[0]
        : relacionMateria;

      return {
        id: excusa.id,
        motivo: excusa.motivo,
        estado: excusa.estado,
        observacionRevision:
          excusa.observacion_revision,
        fechaEnvio: excusa.created_at,
        fechaRevision: excusa.revisado_at,

        asistencia: {
          id: excusa.asistencia_id,
          fecha: asistencia?.fecha ?? null,
          estado: asistencia?.estado ?? null,
          materia: materia?.nombre ?? null,
          periodoId: asignacion?.periodo_id ?? null,
        },

        cantidadSoportes:
          (soportesMap.get(String(excusa.id)) || []).length,

        soportes:
          soportesMap.get(String(excusa.id)) || [],
      };
    });

    return res.status(200).json({
      success: true,

      estudiante: {
        id: estudiante.id,
        nombreCompleto: [
          estudiante.nombres,
          estudiante.apellidos,
        ].filter(Boolean).join(' '),
      },

      paginacion: {
        pagina,
        limite,
        total: count || 0,
      },

      excusas: resultado,
    });

  } catch (error) {
    console.error(
      'HU-09 - Error consultando seguimiento:',
      error?.message || error
    );

    return responderError(
      res,
      500,
      'No fue posible consultar el seguimiento de las excusas.'
    );
  }
}

module.exports = {
  listarExcusasAcudiente,
};
