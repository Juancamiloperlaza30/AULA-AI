
'use strict';

// ======================================================
// AULA-AI | HU-08
// ACTIVIDADES Y EVALUACIONES DEL ACUDIENTE
//
// Consulta de solo lectura.
// Verifica cada vinculación en el backend.
// Mantiene los resultados separados por estudiante.
// Reutiliza la estructura académica de HU-07.
// ======================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TAMANO_PAGINA = 500;

const obtenerRelacion = (valor) => {
  if (Array.isArray(valor)) {
    return valor[0] || null;
  }

  return valor || null;
};

// Recuperar todos los registros, sin depender
// del límite habitual de resultados de Supabase.
const consultarTodos = async (crearConsulta) => {
  const registros = [];
  let inicio = 0;

  while (true) {
    const { data, error } = await crearConsulta()
      .range(
        inicio,
        inicio + TAMANO_PAGINA - 1
      );

    if (error) {
      throw error;
    }

    const pagina = data || [];

    registros.push(...pagina);

    if (pagina.length < TAMANO_PAGINA) {
      break;
    }

    inicio += TAMANO_PAGINA;
  }

  return registros;
};

// Consultas por lotes para evitar listas
// excesivamente grandes en el filtro IN.
const consultarPorLotes = async (
  ids,
  crearConsulta
) => {
  const registros = [];

  for (
    let inicio = 0;
    inicio < ids.length;
    inicio += TAMANO_PAGINA
  ) {
    const lote = ids.slice(
      inicio,
      inicio + TAMANO_PAGINA
    );

    const pagina = await consultarTodos(
      () => crearConsulta(lote)
    );

    registros.push(...pagina);
  }

  return registros;
};

// ======================================================
// GET /api/guardian/estudiantes/:estudianteId/actividades
// ======================================================

const listarActividadesAcudiente = async (
  req,
  res
) => {
  try {
    const acudienteId = req.usuario?.id;
    const estudianteId = req.params.estudianteId;

    // ==================================================
    // 1. VALIDAR IDENTIDAD Y PARÁMETROS
    // ==================================================

    if (
      !acudienteId ||
      req.usuario?.rol !== 'acudiente'
    ) {
      return res.status(403).json({
        success: false,
        message:
          'No tiene autorización para consultar actividades.',
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
        'HU-08: error verificando vinculación:',
        errorVinculacion.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible verificar la autorización.',
      });
    }

    if (!vinculacion) {
      return res.status(403).json({
        success: false,
        message:
          'No está autorizado para consultar las actividades de este estudiante.',
      });
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
      return res.status(404).json({
        success: false,
        message:
          'El estudiante no está disponible.',
      });
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
      return res.status(404).json({
        success: false,
        message:
          'No se encontró la información académica del estudiante.',
      });
    }

    // ==================================================
    // 4. OBTENER ASIGNACIONES ACTIVAS
    // ==================================================

    const asignaciones = await consultarTodos(
      () =>
        supabaseAdmin
          .from('materia_grupo_periodo')
          .select('id')
          .eq('grado_id', estudiante.grado_id)
          .eq('grupo_id', estudiante.grupo_id)
          .eq('estado', 'activa')
          .order('id', {
            ascending: true,
          })
    );

    const asignacionesIds =
      asignaciones
        .map((item) => item.id)
        .filter(
          (id) =>
            id !== null &&
            id !== undefined
        );

    if (asignacionesIds.length === 0) {
      return res.status(200).json({
        success: true,
        estudiante: {
          id: estudianteId,
          nombreCompleto: [
            usuarioEstudiante.nombres,
            usuarioEstudiante.apellidos,
          ]
            .filter(Boolean)
            .join(' '),
        },
        total: 0,
        resumen: {
          tareas: 0,
          actividades: 0,
          examenes: 0,
          conEntrega: 0,
          sinEntrega: 0,
          calificadas: 0,
        },
        actividades: [],
      });
    }

    // ==================================================
    // 5. OBTENER ACTIVIDADES PUBLICADAS
    // ==================================================

    const actividades = await consultarPorLotes(
      asignacionesIds,
      (lote) =>
        supabaseAdmin
          .from('actividades_academicas')
          .select(`
            id,
            tipo,
            titulo,
            descripcion,
            fecha_publicacion,
            fecha_entrega,
            estado,
            materia_grupo_periodo:materia_grupo_periodo_id (
              id,
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
              ),
              periodo:periodos_academicos (
                id,
                nombre
              )
            )
          `)
          .in(
            'materia_grupo_periodo_id',
            lote
          )
          .eq('estado', 'publicada')
          .order('id', {
            ascending: true,
          })
    );

    const actividadesOrdenadas = actividades.sort(
      (a, b) => {
        const fechaA =
          new Date(
            a.fecha_entrega || 0
          ).getTime();

        const fechaB =
          new Date(
            b.fecha_entrega || 0
          ).getTime();

        return fechaA - fechaB;
      }
    );

    const actividadesIds = actividadesOrdenadas
      .map((actividad) => actividad.id)
      .filter(
        (id) =>
          id !== null &&
          id !== undefined
      );

    // ==================================================
    // 6. OBTENER ENTREGAS DEL ESTUDIANTE
    // ==================================================

    let entregas = [];

    if (actividadesIds.length > 0) {
      entregas = await consultarPorLotes(
        actividadesIds,
        (lote) =>
          supabaseAdmin
            .from('entregas_actividades')
            .select(`
              id,
              actividad_id,
              comentario,
              estado,
              fecha_entrega,
              created_at,
              updated_at
            `)
            .eq(
              'estudiante_id',
              estudianteId
            )
            .in('actividad_id', lote)
            .order('created_at', {
              ascending: false,
            })
      );
    }

    const entregasPorActividad = new Map();

    for (const entrega of entregas) {
      if (entrega.estado === 'anulada') {
        continue;
      }

      const clave = String(
        entrega.actividad_id
      );

      if (!entregasPorActividad.has(clave)) {
        entregasPorActividad.set(
          clave,
          entrega
        );
      }
    }

    // ==================================================
    // 7. OBTENER CALIFICACIONES REGISTRADAS
    // ==================================================

    let calificaciones = [];

    if (actividadesIds.length > 0) {
      calificaciones = await consultarPorLotes(
        actividadesIds,
        (lote) =>
          supabaseAdmin
            .from('calificaciones')
            .select(`
              id,
              actividad_id,
              valor,
              retroalimentacion,
              estado,
              created_at,
              updated_at
            `)
            .eq(
              'estudiante_id',
              estudianteId
            )
            .in('actividad_id', lote)
            .eq('estado', 'registrada')
            .order('updated_at', {
              ascending: false,
            })
      );
    }

    const calificacionesPorActividad =
      new Map();

    for (const nota of calificaciones) {
      const clave = String(
        nota.actividad_id
      );

      if (!calificacionesPorActividad.has(clave)) {
        calificacionesPorActividad.set(
          clave,
          nota
        );
      }
    }

    // ==================================================
    // 8. CONSTRUIR ACTIVIDADES DE SOLO LECTURA
    // ==================================================

    const actividadesRespuesta =
      actividadesOrdenadas.map((actividad) => {
        const clave = String(actividad.id);

        const entrega =
          entregasPorActividad.get(clave) ||
          null;

        const calificacion =
          calificacionesPorActividad.get(clave) ||
          null;

        return {
          id: actividad.id,
          tipo: actividad.tipo,
          titulo: actividad.titulo,
          descripcion: actividad.descripcion,
          fecha_publicacion:
            actividad.fecha_publicacion,
          fecha_entrega:
            actividad.fecha_entrega,
          estado: actividad.estado,

          materia_grupo_periodo:
            obtenerRelacion(
              actividad.materia_grupo_periodo
            ),

          entrega: entrega
            ? {
                id: entrega.id,
                comentario:
                  entrega.comentario,
                estado: entrega.estado,
                fecha_entrega:
                  entrega.fecha_entrega,
                entregada_tarde:
                  entrega.estado ===
                  'entregada_tarde',
              }
            : null,

          calificacion: calificacion
            ? {
                id: calificacion.id,
                valor:
                  calificacion.valor,
                retroalimentacion:
                  calificacion.retroalimentacion,
                created_at:
                  calificacion.created_at,
                updated_at:
                  calificacion.updated_at,
              }
            : null,
        };
      });

    // ==================================================
    // 9. RESUMEN GENERAL
    // ==================================================

    const resumen = {
      tareas: actividadesRespuesta.filter(
        (item) => item.tipo === 'tarea'
      ).length,

      actividades:
        actividadesRespuesta.filter(
          (item) => item.tipo === 'actividad'
        ).length,

      examenes: actividadesRespuesta.filter(
        (item) => item.tipo === 'examen'
      ).length,

      conEntrega: actividadesRespuesta.filter(
        (item) => item.entrega !== null
      ).length,

      sinEntrega: actividadesRespuesta.filter(
        (item) => item.entrega === null
      ).length,

      calificadas: actividadesRespuesta.filter(
        (item) =>
          item.calificacion !== null
      ).length,
    };

    // ==================================================
    // 10. RESPUESTA FINAL
    // ==================================================

    return res.status(200).json({
      success: true,

      estudiante: {
        id: usuarioEstudiante.id,
        nombreCompleto: [
          usuarioEstudiante.nombres,
          usuarioEstudiante.apellidos,
        ]
          .filter(Boolean)
          .join(' '),
      },

      total: actividadesRespuesta.length,
      resumen,
      actividades: actividadesRespuesta,
    });
  } catch (error) {
    console.error(
      'HU-08: error consultando actividades del acudiente:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'No fue posible consultar las actividades académicas del estudiante.',
    });
  }
};

module.exports = {
  listarActividadesAcudiente,
};
