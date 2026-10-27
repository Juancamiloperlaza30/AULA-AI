
'use strict';

// ======================================================
// AULA-AI | HU-08
// HISTORIAL DE ASISTENCIA DEL ACUDIENTE
//
// - Consulta autenticada y de solo lectura.
// - Verificación de vinculación activa y verificada.
// - Validación del estudiante activo.
// - Filtrado opcional por período académico.
// - Historial separado por estudiante.
// - Misma estructura de respuesta de HU-07.
// ======================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TAMANO_PAGINA = 500;
const TAMANO_LOTE = 200;

const responderError = (
  res,
  codigo,
  mensaje
) =>
  res.status(codigo).json({
    success: false,
    message: mensaje,
  });

const obtenerRelacion = (valor) =>
  Array.isArray(valor)
    ? valor[0] || null
    : valor || null;

// Supabase puede limitar las filas por respuesta.
// Este auxiliar recupera todas las páginas.
const consultarTodasLasPaginas = async (
  crearConsulta
) => {
  const registros = [];
  let desde = 0;

  while (true) {
    const {
      data,
      error,
    } = await crearConsulta().range(
      desde,
      desde + TAMANO_PAGINA - 1
    );

    if (error) {
      throw error;
    }

    const pagina = data || [];
    registros.push(...pagina);

    if (pagina.length < TAMANO_PAGINA) {
      break;
    }

    desde += TAMANO_PAGINA;
  }

  return registros;
};

// Divide identificadores en lotes para evitar
// consultas con filtros IN demasiado grandes.
const consultarPorLotes = async (
  ids,
  crearConsulta
) => {
  const resultados = [];

  for (
    let inicio = 0;
    inicio < ids.length;
    inicio += TAMANO_LOTE
  ) {
    const lote = ids.slice(
      inicio,
      inicio + TAMANO_LOTE
    );

    const registros =
      await consultarTodasLasPaginas(
        () => crearConsulta(lote)
      );

    resultados.push(...registros);
  }

  return resultados;
};

// ======================================================
// GET /api/guardian/estudiantes/:estudianteId/asistencia
//
// Filtro opcional: ?periodoId=1
// ======================================================

const consultarAsistenciaAcudiente = async (
  req,
  res
) => {
  try {
    const acudienteId = req.usuario?.id;
    const estudianteId =
      req.params.estudianteId;

    // ==================================================
    // 1. VALIDAR IDENTIDAD Y PARÁMETROS
    // ==================================================

    if (
      !acudienteId ||
      req.usuario?.rol !== 'acudiente'
    ) {
      return responderError(
        res,
        403,
        'No está autorizado para consultar asistencias.'
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

    const periodoRaw = req.query.periodoId;
    let periodoId = null;

    if (periodoRaw !== undefined) {
      if (
        typeof periodoRaw !== 'string' ||
        !/^[1-9]\d*$/.test(periodoRaw) ||
        !Number.isSafeInteger(
          Number(periodoRaw)
        )
      ) {
        return responderError(
          res,
          400,
          'El período académico no es válido.'
        );
      }

      periodoId = Number(periodoRaw);
    }

    // ==================================================
    // 2. VERIFICAR VINCULACIÓN AUTORIZADA
    // ==================================================

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
      console.error(
        'HU-08 - Error verificando vinculación:',
        errorVinculacion.message
      );

      return responderError(
        res,
        500,
        'No fue posible verificar la autorización.'
      );
    }

    if (!vinculacion) {
      return responderError(
        res,
        403,
        'No tiene autorización para consultar la asistencia de este estudiante.'
      );
    }

    // ==================================================
    // 3. VERIFICAR ESTUDIANTE ACTIVO
    // ==================================================

    const {
      data: usuarioEstudiante,
      error: errorUsuario,
    } = await supabaseAdmin
      .from('usuarios')
      .select(
        'id, nombres, apellidos, rol, activo'
      )
      .eq('id', estudianteId)
      .eq('rol', 'estudiante')
      .eq('activo', true)
      .maybeSingle();

    if (errorUsuario) {
      throw errorUsuario;
    }

    if (!usuarioEstudiante) {
      return responderError(
        res,
        404,
        'El estudiante no está disponible.'
      );
    }

    const {
      data: estudiante,
      error: errorEstudiante,
    } = await supabaseAdmin
      .from('estudiantes')
      .select(
        'usuario_id, grado_id, grupo_id'
      )
      .eq('usuario_id', estudianteId)
      .maybeSingle();

    if (errorEstudiante) {
      throw errorEstudiante;
    }

    if (!estudiante) {
      return responderError(
        res,
        404,
        'No se encontró la información académica del estudiante.'
      );
    }

    // ==================================================
    // 4. CONSULTAR ASIGNACIONES DE GRADO Y GRUPO
    // ==================================================

    const asignaciones =
      await consultarTodasLasPaginas(
        () => {
          let consulta = supabaseAdmin
            .from('materia_grupo_periodo')
            .select(`
              id,
              periodo_id,
              materia:materias (
                id,
                nombre
              )
            `)
            .eq(
              'grado_id',
              estudiante.grado_id
            )
            .eq(
              'grupo_id',
              estudiante.grupo_id
            )
            .order('id', {
              ascending: true,
            });

          if (periodoId !== null) {
            consulta = consulta.eq(
              'periodo_id',
              periodoId
            );
          }

          return consulta;
        }
      );

    const asignacionesPorId = new Map(
      asignaciones.map((item) => [
        String(item.id),
        item,
      ])
    );

    const asignacionIds =
      asignaciones.map((item) => item.id);

    // ==================================================
    // 5. CONSULTAR ASISTENCIAS DEL ESTUDIANTE
    // ==================================================

    let asistencias = [];

    if (asignacionIds.length > 0) {
      asistencias = await consultarPorLotes(
        asignacionIds,
        (lote) =>
          supabaseAdmin
            .from('asistencias')
            .select(`
              id,
              estado,
              observacion,
              sesion_clase_id,
              materia_grupo_periodo_id
            `)
            .eq(
              'estudiante_id',
              estudianteId
            )
            .in(
              'materia_grupo_periodo_id',
              lote
            )
            .order('id', {
              ascending: true,
            })
      );
    }

    // ==================================================
    // 6. CONSULTAR SESIONES DE CLASE
    // ==================================================

    const sesionIds = [
      ...new Set(
        asistencias
          .map(
            (item) => item.sesion_clase_id
          )
          .filter(
            (id) =>
              id !== null &&
              id !== undefined
          )
      ),
    ];

    let sesiones = [];

    if (sesionIds.length > 0) {
      sesiones = await consultarPorLotes(
        sesionIds,
        (lote) =>
          supabaseAdmin
            .from('sesiones_clase')
            .select(`
              id,
              materia_grupo_periodo_id,
              fecha,
              numero_sesion
            `)
            .in('id', lote)
            .order('id', {
              ascending: true,
            })
      );
    }

    const sesionesPorId = new Map(
      sesiones.map((sesion) => [
        String(sesion.id),
        sesion,
      ])
    );

    // ==================================================
    // 7. CONSTRUIR HISTORIAL Y RESUMEN
    // ==================================================

    const resumen = {
      totalRegistros: 0,
      presentes: 0,
      ausentes: 0,
      llegadasTarde: 0,
    };

    const historial = [];

    for (const asistencia of asistencias) {
      const asignacionId = String(
        asistencia.materia_grupo_periodo_id
      );

      const asignacion =
        asignacionesPorId.get(asignacionId);

      const sesion = sesionesPorId.get(
        String(asistencia.sesion_clase_id)
      );

      // Validación de consistencia académica.
      if (
        !asignacion ||
        !sesion ||
        String(
          sesion.materia_grupo_periodo_id
        ) !== asignacionId
      ) {
        continue;
      }

      const materia = obtenerRelacion(
        asignacion.materia
      );

      historial.push({
        asistenciaId: asistencia.id,
        sesionId: sesion.id,
        asignacionId:
          asistencia.materia_grupo_periodo_id,
        periodoId:
          asignacion.periodo_id,
        materia:
          materia?.nombre || null,
        fecha:
          sesion.fecha,
        numeroSesion:
          sesion.numero_sesion,
        estado:
          asistencia.estado,
        observacion:
          asistencia.observacion,
      });

      resumen.totalRegistros += 1;

      if (asistencia.estado === 'presente') {
        resumen.presentes += 1;
      } else if (
        asistencia.estado === 'ausente'
      ) {
        resumen.ausentes += 1;
      } else if (
        asistencia.estado === 'tarde'
      ) {
        resumen.llegadasTarde += 1;
      }
    }

    // ==================================================
    // 8. ORDENAR HISTORIAL
    // ==================================================

    historial.sort((a, b) => {
      const porFecha = String(
        b.fecha || ''
      ).localeCompare(
        String(a.fecha || '')
      );

      if (porFecha !== 0) {
        return porFecha;
      }

      return (
        Number(b.numeroSesion || 0) -
        Number(a.numeroSesion || 0)
      );
    });

    // ==================================================
    // 9. RESPUESTA FINAL DE SOLO LECTURA
    // ==================================================

    return res.status(200).json({
      success: true,

      estudiante: {
        id: usuarioEstudiante.id,
        nombres:
          usuarioEstudiante.nombres,
        apellidos:
          usuarioEstudiante.apellidos,
        nombreCompleto: [
          usuarioEstudiante.nombres,
          usuarioEstudiante.apellidos,
        ]
          .filter(Boolean)
          .join(' '),
      },

      periodoId,

      resumen,

      asistencias: historial,
    });
  } catch (error) {
    console.error(
      'HU-08 - Error consultando asistencia del acudiente:',
      error?.message || error
    );

    return responderError(
      res,
      500,
      'No fue posible consultar el historial de asistencia.'
    );
  }
};

module.exports = {
  consultarAsistenciaAcudiente,
};
