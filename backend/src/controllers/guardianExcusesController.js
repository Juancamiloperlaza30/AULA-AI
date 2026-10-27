'use strict';

// =====================================================
// AULA-AI | HU-09 | PASO 52.12
// CONSULTA DE INASISTENCIAS PARA EXCUSAS
//
// Seguridad:
// - Acudiente autenticado.
// - Vinculación activa y verificada.
// - Estudiante activo.
// - Solo inasistencias reales.
// - Control de solicitudes duplicadas.
// - Consultas de solo lectura.
// =====================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ESTADOS_EXCUSA_ACTIVA = [
  'pendiente_revision',
  'aprobada',
  'requiere_correccion',
];

const responderError = (res, codigo, mensaje) =>
  res.status(codigo).json({
    success: false,
    message: mensaje,
  });

const obtenerRelacion = (valor) =>
  Array.isArray(valor)
    ? valor[0] || null
    : valor || null;

// =====================================================
// AUXILIAR: CONSULTAR TODAS LAS PAGINAS
// =====================================================

async function consultarPaginas(crearConsulta) {
  const registros = [];
  const tamanoPagina = 500;
  let desde = 0;

  while (true) {
    const { data, error } = await crearConsulta()
      .range(desde, desde + tamanoPagina - 1);

    if (error) {
      throw error;
    }

    const pagina = data || [];
    registros.push(...pagina);

    if (pagina.length < tamanoPagina) {
      break;
    }

    desde += tamanoPagina;
  }

  return registros;
}

// =====================================================
// GET /api/guardian/estudiantes/:estudianteId/
//     excusas/inasistencias
// =====================================================

const listarInasistenciasParaExcusas = async (
  req,
  res
) => {
  try {
    const acudienteId = req.usuario?.id;
    const estudianteId = req.params.estudianteId;

    // 1. VALIDAR AUTENTICACION Y ROL
    if (
      !acudienteId ||
      req.usuario?.rol !== 'acudiente'
    ) {
      return responderError(
        res,
        403,
        'No está autorizado para consultar inasistencias.'
      );
    }

    if (
      typeof estudianteId !== 'string' ||
      !UUID_REGEX.test(estudianteId)
    ) {
      return responderError(
        res,
        400,
        'El identificador del estudiante no es válido.'
      );
    }

    // 2. VERIFICAR VINCULACION
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
        'No tiene autorización para consultar las inasistencias de este estudiante.'
      );
    }

    // 3. VERIFICAR ESTUDIANTE ACTIVO
    const {
      data: estudiante,
      error: errorEstudiante,
    } = await supabaseAdmin
      .from('usuarios')
      .select('id, nombres, apellidos, rol, activo')
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

    // 4. CONSULTAR INASISTENCIAS REALES
    const asistencias = await consultarPaginas(
      () =>
        supabaseAdmin
          .from('asistencias')
          .select(`
            id,
            estudiante_id,
            materia_grupo_periodo_id,
            sesion_clase_id,
            fecha,
            estado,
            observacion
          `)
          .eq('estudiante_id', estudianteId)
          .eq('estado', 'ausente')
          .order('fecha', { ascending: false })
          .order('id', { ascending: false })
    );

    if (asistencias.length === 0) {
      return res.status(200).json({
        success: true,
        estudiante: {
          id: estudiante.id,
          nombres: estudiante.nombres,
          apellidos: estudiante.apellidos,
        },
        resumen: {
          totalInasistencias: 0,
          disponibles: 0,
          conSolicitudActiva: 0,
        },
        inasistencias: [],
        message:
          'Este estudiante no tiene inasistencias registradas.',
      });
    }

    // 5. CONSULTAR MATERIAS Y PERIODOS
    const asignacionIds = [
      ...new Set(
        asistencias.map(
          (item) => item.materia_grupo_periodo_id
        )
      ),
    ];

    const asignaciones = await consultarPaginas(
      () =>
        supabaseAdmin
          .from('materia_grupo_periodo')
          .select(`
            id,
            periodo_id,
            materia:materias (
              id,
              nombre
            )
          `)
          .in('id', asignacionIds)
    );

    const asignacionesPorId = new Map(
      asignaciones.map((item) => [
        String(item.id),
        item,
      ])
    );

    // 6. IDENTIFICAR EXCUSAS ACTIVAS
    const asistenciasConExcusa = new Map();

    const idsAsistencias = asistencias.map(
      (item) => item.id
    );

    // Consultas en lotes para evitar listas IN
    // demasiado extensas.
    const tamanoLote = 200;

    for (
      let inicio = 0;
      inicio < idsAsistencias.length;
      inicio += tamanoLote
    ) {
      const lote = idsAsistencias.slice(
        inicio,
        inicio + tamanoLote
      );

      const excusas = await consultarPaginas(
        () =>
          supabaseAdmin
            .from('excusas')
            .select('id, asistencia_id, estado')
            .in('asistencia_id', lote)
            .in('estado', ESTADOS_EXCUSA_ACTIVA)
      );

      for (const excusa of excusas) {
        asistenciasConExcusa.set(
          String(excusa.asistencia_id),
          excusa
        );
      }
    }

    // 7. CONSTRUIR RESPUESTA
    const inasistencias = asistencias.map(
      (asistencia) => {
        const asignacion = asignacionesPorId.get(
          String(
            asistencia.materia_grupo_periodo_id
          )
        );

        const materia = obtenerRelacion(
          asignacion?.materia
        );

        const excusaExistente =
          asistenciasConExcusa.get(
            String(asistencia.id)
          ) || null;

        return {
          asistenciaId: asistencia.id,
          fecha: asistencia.fecha,
          estado: asistencia.estado,
          observacion: asistencia.observacion,
          sesionClaseId:
            asistencia.sesion_clase_id,
          materiaGrupoPeriodoId:
            asistencia.materia_grupo_periodo_id,
          periodoId: asignacion?.periodo_id ?? null,
          materia: materia?.nombre ?? null,

          disponibleParaExcusa:
            excusaExistente === null,

          excusa: excusaExistente
            ? {
                id: excusaExistente.id,
                estado: excusaExistente.estado,
              }
            : null,
        };
      }
    );

    const disponibles = inasistencias.filter(
      (item) => item.disponibleParaExcusa
    ).length;

    // 8. RESPUESTA FINAL
    return res.status(200).json({
      success: true,

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

      resumen: {
        totalInasistencias: inasistencias.length,
        disponibles,
        conSolicitudActiva:
          inasistencias.length - disponibles,
      },

      inasistencias,
    });
  } catch (error) {
    console.error(
      'HU-09 - Error consultando inasistencias:',
      error?.message || error
    );

    return responderError(
      res,
      500,
      'No fue posible consultar las inasistencias disponibles.'
    );
  }
};

module.exports = {
  listarInasistenciasParaExcusas,
};
