const {
  supabaseAdmin,
} = require('../config/supabase');

const obtenerFechaAcademicaActual = () => {
  const partes =
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

  const fecha = Object.fromEntries(
    partes
      .filter((parte) =>
        ['year', 'month', 'day'].includes(
          parte.type
        )
      )
      .map((parte) => [
        parte.type,
        parte.value,
      ])
  );

  return `${fecha.year}-${fecha.month}-${fecha.day}`;
};

/**
 * Retorna los grados activos.
 */
const listarGrados = async (req, res) => {
  try {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from('grados')
      .select('id, nombre')
      .eq('activo', true)
      .order('id', { ascending: true });

    if (error) {
      console.error(
        'Error consultando grados:',
        error.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible consultar los grados.',
      });
    }

    return res.status(200).json({
      success: true,
      grados: data,
    });
  } catch (error) {
    console.error(
      'Error inesperado consultando grados:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Ocurrió un error al consultar los grados.',
    });
  }
};

/**
 * Retorna los grupos activos de un grado.
 */
const listarGruposPorGrado = async (
  req,
  res
) => {
  try {
    const { gradoId } = req.params;

    if (!gradoId) {
      return res.status(400).json({
        success: false,
        message:
          'Debe indicar el grado.',
      });
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from('grupos')
      .select('id, nombre, grado_id')
      .eq('grado_id', gradoId)
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (error) {
      console.error(
        'Error consultando grupos:',
        error.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible consultar los grupos.',
      });
    }

    return res.status(200).json({
      success: true,
      grupos: data,
    });
  } catch (error) {
    console.error(
      'Error inesperado consultando grupos:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Ocurrió un error al consultar los grupos.',
    });
  }
};

const listarPeriodos = async (req, res) => {
  try {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from('periodos_academicos')
      .select(
        'id, nombre, fecha_inicio, fecha_fin'
      )
      .eq('activo', true)
      .order('fecha_inicio', {
        ascending: true,
      });

    if (error) {
      console.error(
        'Error consultando periodos:',
        error.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible consultar los periodos académicos.',
      });
    }

    return res.status(200).json({
      success: true,
      periodos: data || [],
    });
  } catch (error) {
    console.error(
      'Error inesperado consultando periodos:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Ocurrió un error al consultar los periodos académicos.',
    });
  }
};

const obtenerPeriodoActual = async (req, res) => {
  try {
    const hoy =
      obtenerFechaAcademicaActual();

    const {
      data: periodo,
      error,
    } = await supabaseAdmin
      .from('periodos_academicos')
      .select(`
        id,
        nombre,
        fecha_inicio,
        fecha_fin,
        activo
      `)
      .eq('activo', true)
      .lte('fecha_inicio', hoy)
      .gte('fecha_fin', hoy)
      .order('fecha_inicio', {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        'Error consultando periodo actual:',
        error.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible consultar el periodo académico actual.',
      });
    }

    if (!periodo) {
      return res.status(200).json({
        success: true,
        periodo: null,
        message:
          'No hay un periodo académico vigente para la fecha actual.',
      });
    }

    return res.status(200).json({
      success: true,
      periodo,
    });
  } catch (error) {
    console.error(
      'Error inesperado consultando periodo actual:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Ocurrió un error al consultar el periodo académico actual.',
    });
  }
};

const listarPeriodosAcademicos = async (req, res) => {
  try {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from('periodos_academicos')
      .select(`
        id,
        nombre,
        fecha_inicio,
        fecha_fin,
        activo,
        created_at,
        updated_at
      `)
      .order('id', {
        ascending: true,
      });

    if (error) {
      console.error(
        'Error consultando periodos académicos:',
        error.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible consultar los periodos académicos.',
      });
    }

    return res.status(200).json({
      success: true,
      periodos: data || [],
    });
  } catch (error) {
    console.error(
      'Error inesperado consultando periodos académicos:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Ocurrió un error al consultar los periodos académicos.',
    });
  }
};

const listarPeriodosDisponibles = async (req, res) => {
  try {
    const hoy =
      obtenerFechaAcademicaActual();

    const {
      data,
      error,
    } = await supabaseAdmin
      .from('periodos_academicos')
      .select(`
        id,
        nombre,
        fecha_inicio,
        fecha_fin,
        activo
      `)
      .eq('activo', true)
      .order('fecha_inicio', {
        ascending: true,
      });

    if (error) {
      console.error(
        'Error consultando periodos disponibles:',
        error.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible consultar los periodos académicos.',
      });
    }

    const periodosActivos =
      data || [];

    const periodoActual =
      [...periodosActivos]
        .filter(
          (periodo) =>
            periodo.fecha_inicio <= hoy &&
            periodo.fecha_fin >= hoy
        )
        .sort((a, b) =>
          b.fecha_inicio.localeCompare(
            a.fecha_inicio
          )
        )[0];

    const periodos =
      periodosActivos.map(
        (periodo) => ({
          ...periodo,

          esActual:
            periodo.id ===
            periodoActual?.id,

          finalizado:
            periodo.fecha_fin < hoy,

          futuro:
            periodo.fecha_inicio > hoy,
        })
      );

    return res.status(200).json({
      success: true,
      periodos,
    });
  } catch (error) {
    console.error(
      'Error inesperado consultando periodos disponibles:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Ocurrió un error al consultar los periodos académicos.',
    });
  }
};

const actualizarPeriodoAcademico = async (req, res) => {
  try {
    const periodoId = Number(
      req.params.periodoId
    );

    const {
      fechaInicio,
      fechaFin,
    } = req.body;

    if (
      !periodoId ||
      !fechaInicio ||
      !fechaFin
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Debe indicar el periodo, la fecha de inicio y la fecha de finalización.',
      });
    }

    if (
      new Date(fechaInicio) >
      new Date(fechaFin)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'La fecha de inicio no puede ser posterior a la fecha de finalización.',
      });
    }

    const {
      data: periodoExistente,
      error: periodoError,
    } = await supabaseAdmin
      .from('periodos_academicos')
      .select(`
        id,
        nombre,
        fecha_inicio,
        fecha_fin,
        activo
      `)
      .eq('id', periodoId)
      .maybeSingle();

    if (periodoError) {
      console.error(
        'Error consultando periodo académico:',
        periodoError.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible consultar el periodo académico.',
      });
    }

    if (!periodoExistente) {
      return res.status(404).json({
        success: false,
        message:
          'El periodo académico no existe.',
      });
    }

    const {
      data: periodosSuperpuestos,
      error: superposicionError,
    } = await supabaseAdmin
      .from('periodos_academicos')
      .select(`
        id,
        nombre,
        fecha_inicio,
        fecha_fin
      `)
      .neq('id', periodoId)
      .eq('activo', true)
      .lte(
        'fecha_inicio',
        fechaFin
      )
      .gte(
        'fecha_fin',
        fechaInicio
      );

    if (superposicionError) {
      console.error(
        'Error validando periodos:',
        superposicionError.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible validar las fechas del periodo.',
      });
    }

    if (
      periodosSuperpuestos &&
      periodosSuperpuestos.length > 0
    ) {
      return res.status(409).json({
        success: false,
        message:
          `Las fechas se cruzan con ${periodosSuperpuestos[0].nombre}.`,
      });
    }

    const {
      data: periodoActualizado,
      error: updateError,
    } = await supabaseAdmin
      .from('periodos_academicos')
      .update({
        fecha_inicio:
          fechaInicio,

        fecha_fin:
          fechaFin,

        updated_at:
          new Date().toISOString(),
      })
      .eq('id', periodoId)
      .select(`
        id,
        nombre,
        fecha_inicio,
        fecha_fin,
        activo,
        updated_at
      `)
      .single();

    if (updateError) {
      console.error(
        'Error actualizando periodo:',
        updateError.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible actualizar el periodo académico.',
      });
    }

    return res.status(200).json({
      success: true,
      message:
        'Periodo académico actualizado correctamente.',
      periodo:
        periodoActualizado,
    });
  } catch (error) {
    console.error(
      'Error inesperado actualizando periodo:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Ocurrió un error al actualizar el periodo académico.',
    });
  }
};

const listarDocentes = async (req, res) => {
  try {
    const termino =
      req.query.q?.trim() || '';

    let consulta = supabaseAdmin
      .from('usuarios')
      .select(`
        id,
        nombres,
        apellidos,
        numero_documento,
        correo
      `)
      .eq('rol', 'docente')
      .eq('activo', true);

    // Si el usuario escribió algo,
    // filtramos desde PostgreSQL.
    if (termino.length >= 2) {
      consulta = consulta.or(
        `nombres.ilike.%${termino}%,apellidos.ilike.%${termino}%,numero_documento.ilike.%${termino}%,correo.ilike.%${termino}%`
      );
    }

    const {
      data,
      error,
    } = await consulta
      .order('nombres', {
        ascending: true,
      })
      .limit(20);

    if (error) {
      console.error(
        'Error consultando docentes:',
        error.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible consultar los docentes.',
      });
    }

    return res.status(200).json({
      success: true,
      docentes: data || [],
    });
  } catch (error) {
    console.error(
      'Error inesperado consultando docentes:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Ocurrió un error al consultar los docentes.',
    });
  }
};

module.exports = {
  listarGrados,
  listarGruposPorGrado,
  listarPeriodos,
  obtenerPeriodoActual,
  listarPeriodosAcademicos,
  listarPeriodosDisponibles,
  actualizarPeriodoAcademico,
  listarDocentes,
};