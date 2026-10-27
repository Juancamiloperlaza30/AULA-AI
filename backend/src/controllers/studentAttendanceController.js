'use strict';

// AULA-AI | HU-07
// Consulta de asistencia del estudiante.
// El identificador del estudiante se obtiene
// exclusivamente del JWT validado.

const {
  supabaseAdmin,
} = require('../config/supabase');

const responderError = (res, codigo, mensaje) => {
  return res.status(codigo).json({
    success: false,
    message: mensaje,
  });
};

const consultarMiHistorial = async (req, res) => {
  try {
    const estudianteId = req.usuario?.id;

    if (!estudianteId) {
      return responderError(
        res,
        401,
        'No existe una sesión válida.'
      );
    }

    // Periodo opcional, para permitir filtros
    // desde la aplicación móvil.
    const periodoRaw = req.query.periodoId;
    let periodoId = null;

    if (periodoRaw !== undefined) {
      const valor = String(periodoRaw);

      if (
        !/^[1-9]\d*$/.test(valor) ||
        !Number.isSafeInteger(Number(valor))
      ) {
        return responderError(
          res,
          400,
          'El periodo académico no es válido.'
        );
      }

      periodoId = Number(valor);
    }

    // 1. Identificar al estudiante autenticado.
    const {
      data: estudiante,
      error: errorEstudiante,
    } = await supabaseAdmin
      .from('estudiantes')
      .select('usuario_id, grado_id, grupo_id')
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

    // 2. Consultar las asignaciones que
    // corresponden a su grado y grupo.
    let consultaAsignaciones = supabaseAdmin
      .from('materia_grupo_periodo')
      .select(`
        id,
        periodo_id,
        materia:materias (
          id,
          nombre
        )
      `)
      .eq('grado_id', estudiante.grado_id)
      .eq('grupo_id', estudiante.grupo_id);

    if (periodoId !== null) {
      consultaAsignaciones =
        consultaAsignaciones.eq(
          'periodo_id',
          periodoId
        );
    }

    const {
      data: asignaciones,
      error: errorAsignaciones,
    } = await consultaAsignaciones;

    if (errorAsignaciones) {
      throw errorAsignaciones;
    }

    const asignacionesPorId = new Map(
      (asignaciones || []).map((item) => [
        Number(item.id),
        item,
      ])
    );

    const asignacionIds = [
      ...asignacionesPorId.keys(),
    ];

    let asistencias = [];

    // 3. Consultar exclusivamente las
    // asistencias del usuario autenticado.
    if (asignacionIds.length > 0) {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from('asistencias')
        .select(`
          id,
          estado,
          observacion,
          sesion_clase_id,
          materia_grupo_periodo_id
        `)
        .eq('estudiante_id', estudianteId)
        .in(
          'materia_grupo_periodo_id',
          asignacionIds
        )
        .order('id', {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      asistencias = data || [];
    }

    // 4. Obtener las fechas de las sesiones
    // vinculadas con las asistencias propias.
    const sesionIds = [
      ...new Set(
        asistencias.map((item) =>
          Number(item.sesion_clase_id)
        )
      ),
    ];

    const sesionesPorId = new Map();

    if (sesionIds.length > 0) {
      const {
        data: sesiones,
        error: errorSesiones,
      } = await supabaseAdmin
        .from('sesiones_clase')
        .select(`
          id,
          materia_grupo_periodo_id,
          fecha,
          numero_sesion
        `)
        .in('id', sesionIds);

      if (errorSesiones) {
        throw errorSesiones;
      }

      for (const sesion of sesiones || []) {
        sesionesPorId.set(
          Number(sesion.id),
          sesion
        );
      }
    }

    // 5. Preparar registros y resumen.
    const resumen = {
      totalRegistros: 0,
      presentes: 0,
      ausentes: 0,
      llegadasTarde: 0,
    };

    const historial = [];

    for (const asistencia of asistencias) {
      const asignacionId = Number(
        asistencia.materia_grupo_periodo_id
      );

      const asignacion =
        asignacionesPorId.get(asignacionId);

      const sesion = sesionesPorId.get(
        Number(asistencia.sesion_clase_id)
      );

      // Protección adicional de consistencia:
      // no mostrar registros sin relación válida.
      if (
        !asignacion ||
        !sesion ||
        Number(sesion.materia_grupo_periodo_id) !==
          asignacionId
      ) {
        continue;
      }

      historial.push({
        asistenciaId: asistencia.id,
        sesionId: sesion.id,
        asignacionId,
        periodoId: asignacion.periodo_id,
        materia: asignacion.materia?.nombre || null,
        fecha: sesion.fecha,
        numeroSesion: sesion.numero_sesion,
        estado: asistencia.estado,
        observacion: asistencia.observacion,
      });

      resumen.totalRegistros += 1;

      if (asistencia.estado === 'presente') {
        resumen.presentes += 1;
      } else if (asistencia.estado === 'ausente') {
        resumen.ausentes += 1;
      } else if (asistencia.estado === 'tarde') {
        resumen.llegadasTarde += 1;
      }
    }

    historial.sort((a, b) => {
      const porFecha = String(b.fecha).localeCompare(
        String(a.fecha)
      );

      if (porFecha !== 0) {
        return porFecha;
      }

      return (
        Number(b.numeroSesion) -
        Number(a.numeroSesion)
      );
    });

    return res.status(200).json({
      success: true,
      resumen,
      asistencias: historial,
    });
  } catch (error) {
    console.error(
      'HU-07 - Error consultando asistencia:',
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
  consultarMiHistorial,
};
