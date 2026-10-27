
'use strict';

// ======================================================
// AULA-AI | HU-08
// CONSULTA DE CALIFICACIONES DEL ACUDIENTE
//
// - Consulta de solo lectura.
// - Verifica la identidad del acudiente.
// - Comprueba vinculación activa y verificada.
// - Valida que el estudiante esté activo.
// - Conserva la estructura académica de HU-07.
// ======================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const obtenerRelacion = (valor) => {
  if (Array.isArray(valor)) {
    return valor[0] || null;
  }

  return valor || null;
};

// ======================================================
// GET /api/guardian/estudiantes/:estudianteId/calificaciones
// ======================================================

const listarCalificacionesAcudiente = async (
  req,
  res
) => {
  try {
    const acudienteId = req.usuario?.id;
    const estudianteId = req.params.estudianteId;
    const periodoId = req.query.periodoId;

    // ==================================================
    // 1. VALIDAR SESIÓN Y PARÁMETROS
    // ==================================================

    if (
      !acudienteId ||
      req.usuario?.rol !== 'acudiente'
    ) {
      return res.status(403).json({
        success: false,
        message:
          'No está autorizado para consultar calificaciones.',
      });
    }

    if (
      typeof estudianteId !== 'string' ||
      !UUID_REGEX.test(estudianteId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'El identificador del estudiante no es válido.',
      });
    }

    let periodoIdSolicitado = null;

    if (periodoId !== undefined) {
      const valor = String(periodoId);

      if (!/^[1-9]\d*$/.test(valor)) {
        return res.status(400).json({
          success: false,
          message:
            'El período académico no es válido.',
        });
      }

      periodoIdSolicitado = Number(valor);

      if (
        !Number.isSafeInteger(
          periodoIdSolicitado
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            'El período académico no es válido.',
        });
      }
    }

    // ==================================================
    // 2. VERIFICAR VINCULACIÓN DEL ACUDIENTE
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
        'HU-08: error verificando vinculación:',
        errorVinculacion.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible verificar la autorización del acudiente.',
      });
    }

    if (!vinculacion) {
      return res.status(403).json({
        success: false,
        message:
          'No tiene autorización para consultar las calificaciones de este estudiante.',
      });
    }

    // ==================================================
    // 3. VALIDAR CUENTA DEL ESTUDIANTE
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
      return res.status(404).json({
        success: false,
        message:
          'El estudiante no está disponible.',
      });
    }

    const {
      data: estudianteAcademico,
      error: errorEstudiante,
    } = await supabaseAdmin
      .from('estudiantes')
      .select('usuario_id, grado_id, grupo_id')
      .eq('usuario_id', estudianteId)
      .maybeSingle();

    if (errorEstudiante) {
      throw errorEstudiante;
    }

    if (!estudianteAcademico) {
      return res.status(404).json({
        success: false,
        message:
          'No se encontró información académica del estudiante.',
      });
    }

    // ==================================================
    // 4. OBTENER PERÍODOS ACADÉMICOS
    // ==================================================

    const {
      data: periodos,
      error: errorPeriodos,
    } = await supabaseAdmin
      .from('periodos_academicos')
      .select(`
        id,
        nombre,
        fecha_inicio,
        fecha_fin,
        activo
      `)
      .order('fecha_inicio', {
        ascending: true,
      });

    if (errorPeriodos) {
      throw errorPeriodos;
    }

    const listaPeriodos = periodos || [];

    if (
      periodoIdSolicitado &&
      !listaPeriodos.some(
        (periodo) =>
          Number(periodo.id) ===
          periodoIdSolicitado
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          'El período académico solicitado no existe.',
      });
    }

    // ==================================================
    // 5. IDENTIFICAR PERÍODO ACTUAL
    // ==================================================

    const hoy = new Date();

    let periodoActual = null;

    if (periodoIdSolicitado) {
      periodoActual =
        listaPeriodos.find(
          (periodo) =>
            Number(periodo.id) ===
            periodoIdSolicitado
        ) || null;
    } else {
      periodoActual =
        listaPeriodos.find(
          (periodo) => {
            const inicio = new Date(
              `${periodo.fecha_inicio}T00:00:00`
            );

            const fin = new Date(
              `${periodo.fecha_fin}T23:59:59`
            );

            return (
              hoy >= inicio &&
              hoy <= fin
            );
          }
        ) || null;
    }

    // ==================================================
    // 6. CONSULTAR CALIFICACIONES REGISTRADAS
    // ==================================================

    const {
      data: calificaciones,
      error: errorCalificaciones,
    } = await supabaseAdmin
      .from('calificaciones')
      .select(`
        id,
        valor,
        retroalimentacion,
        estado,
        created_at,
        updated_at,
        actividad:actividades_academicas (
          id,
          tipo,
          titulo,
          descripcion,
          fecha_publicacion,
          fecha_entrega,
          materia_grupo_periodo:materia_grupo_periodo_id (
            id,
            periodo_id,
            materia:materias (
              id,
              nombre
            ),
            grado:grados (
              id,
              nombre
            ),
            grupo:grupos (
              id,
              nombre
            )
          )
        )
      `)
      .eq('estudiante_id', estudianteId)
      .eq('estado', 'registrada')
      .order('created_at', {
        ascending: false,
      });

    if (errorCalificaciones) {
      console.error(
        'HU-08: error consultando notas:',
        errorCalificaciones.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible consultar las calificaciones del estudiante.',
      });
    }

    const listaCalificaciones =
      calificaciones || [];

    // ==================================================
    // 7. AGRUPAR CALIFICACIONES POR PERÍODO Y MATERIA
    // ==================================================

    const grupos = {};

    for (const calificacion of listaCalificaciones) {
      const actividad = obtenerRelacion(
        calificacion.actividad
      );

      const asignacion = obtenerRelacion(
        actividad?.materia_grupo_periodo
      );

      const materia = obtenerRelacion(
        asignacion?.materia
      );

      const idPeriodo = Number(
        asignacion?.periodo_id
      );

      const materiaId = materia?.id;
      const valor = Number(calificacion.valor);

      if (
        !idPeriodo ||
        !materiaId ||
        !Number.isFinite(valor)
      ) {
        continue;
      }

      if (!grupos[idPeriodo]) {
        grupos[idPeriodo] = {};
      }

      if (!grupos[idPeriodo][materiaId]) {
        grupos[idPeriodo][materiaId] = {
          materiaId,
          materiaNombre: materia.nombre,
          notas: [],
        };
      }

      grupos[idPeriodo][materiaId].notas.push(
        valor
      );
    }

    // ==================================================
    // 8. CALCULAR PROMEDIOS POR MATERIA Y PERÍODO
    // ==================================================

    const promediosPeriodos = listaPeriodos.map(
      (periodo) => {
        const materiasPeriodo =
          grupos[Number(periodo.id)] || {};

        const materias = Object.values(
          materiasPeriodo
        ).map((materia) => {
          const suma = materia.notas.reduce(
            (acumulado, nota) =>
              acumulado + nota,
            0
          );

          const promedio =
            materia.notas.length > 0
              ? Number(
                  (
                    suma /
                    materia.notas.length
                  ).toFixed(2)
                )
              : null;

          return {
            materiaId: materia.materiaId,
            materia: materia.materiaNombre,
            cantidadNotas: materia.notas.length,
            promedio,
          };
        });

        const promediosValidos = materias
          .map((materia) => materia.promedio)
          .filter(Number.isFinite);

        const promedioPeriodo =
          promediosValidos.length > 0
            ? Number(
                (
                  promediosValidos.reduce(
                    (total, nota) =>
                      total + nota,
                    0
                  ) /
                  promediosValidos.length
                ).toFixed(2)
              )
            : null;

        return {
          periodoId: periodo.id,
          nombre: periodo.nombre,
          anio:
            String(
              periodo.fecha_inicio || ''
            ).slice(0, 4) || null,
          fechaInicio: periodo.fecha_inicio,
          fechaFin: periodo.fecha_fin,
          promedio: promedioPeriodo,
          materias,
        };
      }
    );

    // ==================================================
    // 9. CALCULAR RESUMEN ACADÉMICO
    // ==================================================

    const resumenPeriodoActual =
      periodoActual
        ? promediosPeriodos.find(
            (periodo) =>
              Number(periodo.periodoId) ===
              Number(periodoActual.id)
          )
        : null;

    const promedioPeriodoActual =
      resumenPeriodoActual?.promedio ?? null;

    const periodosConNota =
      promediosPeriodos.filter(
        (periodo) =>
          Number.isFinite(periodo.promedio)
      );

    let promedioAnual = null;

    // Se conserva el criterio actual de HU-07:
    // cuatro períodos con calificaciones.
    if (
      listaPeriodos.length >= 4 &&
      periodosConNota.length >= 4
    ) {
      const cuatroPeriodos =
        periodosConNota.slice(0, 4);

      promedioAnual = Number(
        (
          cuatroPeriodos.reduce(
            (total, periodo) =>
              total + periodo.promedio,
            0
          ) /
          cuatroPeriodos.length
        ).toFixed(2)
      );
    }

    // ==================================================
    // 10. FILTRAR NOTAS DEL PERÍODO SOLICITADO
    // ==================================================

    let calificacionesRespuesta =
      listaCalificaciones;

    if (periodoIdSolicitado) {
      calificacionesRespuesta =
        listaCalificaciones.filter(
          (calificacion) => {
            const actividad = obtenerRelacion(
              calificacion.actividad
            );

            const asignacion = obtenerRelacion(
              actividad?.materia_grupo_periodo
            );

            return (
              Number(asignacion?.periodo_id) ===
              periodoIdSolicitado
            );
          }
        );
    }

    // ==================================================
    // 11. RESPUESTA FINAL DE SOLO LECTURA
    // ==================================================

    return res.status(200).json({
      success: true,

      estudiante: {
        id: usuarioEstudiante.id,
        nombres: usuarioEstudiante.nombres,
        apellidos: usuarioEstudiante.apellidos,
        nombreCompleto: [
          usuarioEstudiante.nombres,
          usuarioEstudiante.apellidos,
        ]
          .filter(Boolean)
          .join(' '),
      },

      periodoActual: periodoActual
        ? {
            id: periodoActual.id,
            nombre: periodoActual.nombre,
          }
        : null,

      calificaciones: calificacionesRespuesta,

      resumen: {
        totalCalificaciones:
          calificacionesRespuesta.length,
        promedio: promedioPeriodoActual,
        promedioPeriodoActual,
        promedioAnual,
      },

      promediosPeriodos,
    });
  } catch (error) {
    console.error(
      'HU-08: error en consulta de calificaciones del acudiente:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Ocurrió un error al consultar las calificaciones.',
    });
  }
};

module.exports = {
  listarCalificacionesAcudiente,
};
