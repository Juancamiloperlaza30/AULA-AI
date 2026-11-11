const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  registrarAuditoria,
} = require('../services/auditService');

const verificarAmbitoCoordinador = async ({
  usuario,
  gradoId,
  gruposIds,
}) => {
  if (usuario?.rol !== 'coordinador') {
    return {
      autorizado: true,
      error: null,
    };
  }

  const gruposUnicos = [...new Set(gruposIds)];

  const {
    data: ambitos,
    error,
  } = await supabaseAdmin
    .from('coordinador_ambito')
    .select('grupo_id')
    .eq('coordinador_id', usuario.id)
    .eq('grado_id', gradoId)
    .eq('activo', true)
    .in('grupo_id', gruposUnicos);

  if (error) {
    return {
      autorizado: false,
      error,
    };
  }

  const gruposAutorizados = new Set(
    (ambitos || []).map((ambito) => ambito.grupo_id)
  );

  return {
    autorizado: gruposUnicos.every((grupoId) =>
      gruposAutorizados.has(grupoId)
    ),
    error: null,
  };
};

const registrarMateria = async (req, res) => {
  try {
    const {
      nombre,
      gradoId,
      gruposIds = [],
      docentesIds = [],
      periodoId,
      estado = 'activa',
    } = req.body;

    // =====================================
    // 1. Validar campos obligatorios
    // =====================================

    if (!nombre?.trim()) {
      return res.status(400).json({
        success: false,
        message:
          'El nombre de la materia es obligatorio.',
      });
    }

    if (!gradoId) {
      return res.status(400).json({
        success: false,
        message:
          'Debe seleccionar un grado.',
      });
    }

    if (
      !Array.isArray(gruposIds) ||
      gruposIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Debe seleccionar al menos un grupo.',
      });
    }

    if (
      !Array.isArray(docentesIds) ||
      docentesIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Debe seleccionar al menos un docente responsable.',
      });
    }

    if (!periodoId) {
      return res.status(400).json({
        success: false,
        message:
          'Debe seleccionar un periodo académico.',
      });
    }

    if (
      estado !== 'activa' &&
      estado !== 'inactiva'
    ) {
      return res.status(400).json({
        success: false,
        message:
          'El estado de la materia no es válido.',
      });
    }

    // =====================================
    // 2. Validar grupos del grado
    // =====================================

    const {
      data: grupos,
      error: gruposError,
    } = await supabaseAdmin
      .from('grupos')
      .select('id, grado_id, activo')
      .in('id', gruposIds);

    if (
      gruposError ||
      !grupos ||
      grupos.length !== gruposIds.length ||
      grupos.some(
        (grupo) =>
          grupo.grado_id !== gradoId ||
          !grupo.activo
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Uno o más grupos no corresponden al grado seleccionado.',
      });
    }

    const permisoAmbito = await verificarAmbitoCoordinador({
      usuario: req.usuario,
      gradoId,
      gruposIds,
    });

    if (permisoAmbito.error) {
      console.error(
        'Error verificando el ámbito del coordinador para materias:',
        permisoAmbito.error
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible verificar los grupos asignables.',
      });
    }

    if (!permisoAmbito.autorizado) {
      return res.status(403).json({
        success: false,
        message:
          'No tiene autorización para asignar materias a uno o más grupos seleccionados.',
      });
    }

    // =====================================
    // 3. Validar docentes
    // =====================================

    const {
      data: docentes,
      error: docentesError,
    } = await supabaseAdmin
      .from('usuarios')
      .select('id, rol, activo')
      .in('id', docentesIds);

    if (
      docentesError ||
      !docentes ||
      docentes.length !== docentesIds.length ||
      docentes.some(
        (docente) =>
          docente.rol !== 'docente' ||
          !docente.activo
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Uno o más docentes seleccionados no son válidos.',
      });
    }

    // =====================================
    // 4. Validar periodo
    // =====================================

    const {
      data: periodo,
      error: periodoError,
    } = await supabaseAdmin
      .from('periodos_academicos')
      .select('id, activo')
      .eq('id', periodoId)
      .maybeSingle();

    if (
      periodoError ||
      !periodo ||
      !periodo.activo
    ) {
      return res.status(400).json({
        success: false,
        message:
          'El periodo académico seleccionado no es válido.',
      });
    }

    const {
      data: materiaId,
      error: errorRegistro,
    } = await supabaseAdmin.rpc(
      'registrar_materia_transaccional',
      {
        p_nombre: nombre.trim(),
        p_grado_id: gradoId,
        p_grupos_ids: gruposIds,
        p_docentes_ids: docentesIds,
        p_periodo_id: periodoId,
        p_estado: estado || 'activa',
      }
    );

    if (errorRegistro) {
      console.error(
        'Error registrando materia:',
        errorRegistro.message
      );

      // Duplicado materia + grupo + periodo
      if (
        errorRegistro.code === '23505'
      ) {
        return res.status(409).json({
          success: false,
          message:
            'La materia ya se encuentra registrada para uno de los grupos seleccionados en este periodo académico.',
        });
      }

      return res.status(500).json({
        success: false,
        message:
          errorRegistro.message ||
          'No fue posible registrar la materia.',
      });
    }

    await registrarAuditoria({
      usuarioId: req.usuario.id,
      correo: req.usuario.correo,
      evento: 'MATERIA_REGISTRADA',
      descripcion:
        `Se registró la materia ${nombre.trim()}.`,
      rol: req.usuario.rol,
      direccionIp: req.ip,
      dispositivo:
        req.headers['user-agent'] || null,
      metadata: {
        materiaId,
        nombre: nombre.trim(),
        gradoId,
        gruposIds,
        docentesIds,
        periodoId,
      },
    });

    return res.status(201).json({
      success: true,
      message:
        'Materia registrada con éxito.',
      materiaId,
    });
  } catch (error) {
    console.error(
      'Error inesperado registrando materia:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'No fue posible completar el registro de la materia.',
    });
  }
};

const listarMaterias = async (req, res) => {
  try {
    let consulta = supabaseAdmin
      .from('materia_grupo_periodo')
      .select(`
        id,
        estado,
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
        ),
        docentes:materia_docente (
          docente:usuarios (
            id,
            nombres,
            apellidos,
            correo
          )
        )
      `);

    if (req.usuario?.rol === 'coordinador') {
      const {
        data: ambitos,
        error: ambitosError,
      } = await supabaseAdmin
        .from('coordinador_ambito')
        .select('grupo_id')
        .eq('coordinador_id', req.usuario.id)
        .eq('activo', true);

      if (ambitosError) {
        console.error(
          'Error consultando los grupos del ámbito del coordinador:',
          ambitosError.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible consultar las materias de su ámbito.',
        });
      }

      const gruposIds = [
        ...new Set(
          (ambitos || []).map(
            ({ grupo_id }) => grupo_id
          )
        ),
      ];

      if (gruposIds.length === 0) {
        return res.status(200).json({
          success: true,
          materias: [],
        });
      }

      consulta = consulta.in('grupo_id', gruposIds);
    }

    const {
      data,
      error,
    } = await consulta.order('created_at', {
      ascending: false,
    });

    if (error) {
      console.error(
        'Error consultando materias:',
        error.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible consultar las materias.',
      });
    }

    return res.status(200).json({
      success: true,
      materias: data || [],
    });
  } catch (error) {
    console.error(
      'Error inesperado consultando materias:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Ocurrió un error al consultar las materias.',
    });
  }
};

const actualizarMateria = async (req, res) => {
  try {
    const asignacionId = Number(req.params.id);

    const {
      nombre,
      gradoId,
      grupoId,
      periodoId,
      docentesIds,
      estado,
    } = req.body;

    // Validaciones
    if (!asignacionId) {
      return res.status(400).json({
        success: false,
        message:
          'La asignación de la materia no es válida.',
      });
    }

    if (
      !nombre?.trim() ||
      !gradoId ||
      !grupoId ||
      !periodoId ||
      !Array.isArray(docentesIds) ||
      docentesIds.length === 0 ||
      !estado
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Complete todos los campos obligatorios.',
      });
    }

    if (
      !['activa', 'inactiva'].includes(estado)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'El estado seleccionado no es válido.',
      });
    }

    if (req.usuario?.rol === 'coordinador') {
      const {
        data: asignacionActual,
        error: asignacionActualError,
      } = await supabaseAdmin
        .from('materia_grupo_periodo')
        .select('grado_id, grupo_id')
        .eq('id', asignacionId)
        .maybeSingle();

      if (asignacionActualError) {
        console.error(
          'Error consultando la asignación actual de la materia:',
          asignacionActualError.message
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible verificar la materia que desea actualizar.',
        });
      }

      if (!asignacionActual) {
        return res.status(404).json({
          success: false,
          message:
            'No se encontró la materia que desea actualizar.',
        });
      }

      const permisoAsignacionActual =
        await verificarAmbitoCoordinador({
          usuario: req.usuario,
          gradoId: asignacionActual.grado_id,
          gruposIds: [asignacionActual.grupo_id],
        });

      if (permisoAsignacionActual.error) {
        console.error(
          'Error verificando el ámbito de la materia actual:',
          permisoAsignacionActual.error
        );

        return res.status(500).json({
          success: false,
          message:
            'No fue posible verificar el ámbito de la materia actual.',
        });
      }

      if (!permisoAsignacionActual.autorizado) {
        return res.status(403).json({
          success: false,
          message:
            'No tiene autorización para actualizar una materia fuera de su ámbito.',
        });
      }
    }

    const permisoAmbito = await verificarAmbitoCoordinador({
      usuario: req.usuario,
      gradoId,
      gruposIds: [grupoId],
    });

    if (permisoAmbito.error) {
      console.error(
        'Error verificando el ámbito del coordinador para actualizar materias:',
        permisoAmbito.error
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible verificar el grupo asignable.',
      });
    }

    if (!permisoAmbito.autorizado) {
      return res.status(403).json({
        success: false,
        message:
          'No tiene autorización para asignar materias a este grupo.',
      });
    }

    const {
      data: materiaId,
      error,
    } = await supabaseAdmin.rpc(
      'actualizar_asignacion_materia',
      {
        p_asignacion_id: asignacionId,
        p_nombre: nombre.trim(),
        p_grado_id: gradoId,
        p_grupo_id: grupoId,
        p_periodo_id: periodoId,
        p_docentes_ids: docentesIds,
        p_estado: estado,
      }
    );

    if (error) {
      console.error(
        'Error actualizando materia:',
        error.message
      );

      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message:
            'Ya existe esta materia para el grupo y periodo seleccionados.',
        });
      }

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          'No fue posible actualizar la materia.',
      });
    }

    await registrarAuditoria({
      usuarioId: req.usuario.id,
      correo: req.usuario.correo,
      evento: 'MATERIA_MODIFICADA',
      descripcion:
        `Se actualizó la asignación de materia ${materiaId}.`,
      rol: req.usuario.rol,
      direccionIp: req.ip,
      dispositivo:
        req.headers['user-agent'] || null,
      metadata: {
        asignacionId,
        materiaId,
        nombre: nombre.trim(),
        gradoId,
        grupoId,
        periodoId,
        docentesIds,
        estado,
      },
    });

    return res.status(200).json({
      success: true,
      message:
        'Materia actualizada con éxito.',
    });
  } catch (error) {
    console.error(
      'Error inesperado actualizando materia:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Ocurrió un error al actualizar la materia.',
    });
  }
};

const listarMateriasDocente = async (req, res) => {
  try {
    const docenteId = req.usuario.id;

    const {
      data,
      error,
    } = await supabaseAdmin
      .from('materia_docente')
      .select(`
        materia_grupo_periodo_id,
        asignacion:materia_grupo_periodo (
          id,
          estado,
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
      .eq('docente_id', docenteId);

    if (error) {
      console.error(
        'Error consultando materias del docente:',
        error.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible consultar las materias asignadas.',
      });
    }

    const materias = (data || []).map(
      (item) => item.asignacion
    );

    return res.status(200).json({
      success: true,
      materias,
    });
  } catch (error) {
    console.error(
      'Error inesperado consultando materias del docente:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Ocurrió un error al consultar las materias asignadas.',
    });
  }
};

const listarMateriasEstudiante = async (req, res) => {
  try {
    const estudianteId = req.usuario.id;
    const periodoId = req.query.periodoId
      ? Number(req.query.periodoId)
      : null;

    // =====================================
    // 1. Obtener grado y grupo del estudiante
    // =====================================

    const {
      data: estudiante,
      error: estudianteError,
    } = await supabaseAdmin
      .from('estudiantes')
      .select(`
        usuario_id,
        grado_id,
        grupo_id,
        grado:grados (
          id,
          nombre
        ),
        grupo:grupos (
          id,
          nombre
        )
      `)
      .eq('usuario_id', estudianteId)
      .maybeSingle();

    if (
      estudianteError ||
      !estudiante
    ) {
      return res.status(404).json({
        success: false,
        message:
          'No se encontró la información académica del estudiante.',
      });
    }

    // =====================================
    // 2. Consultar solamente las materias
    //    de su grado y grupo
    // =====================================

    let consulta = supabaseAdmin
      .from('materia_grupo_periodo')
      .select(`
        id,
        periodo_id,
        estado,
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
        ),
        docentes:materia_docente (
          docente:usuarios (
            id,
            nombres,
            apellidos
          )
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
      .eq('estado', 'activa');

    if (periodoId) {
      consulta = consulta.eq(
        'periodo_id',
        periodoId
      );
    }

    const {
      data,
      error,
    } = await consulta;

    if (error) {
      console.error(
        'Error consultando materias del estudiante:',
        error.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible consultar las materias del estudiante.',
      });
    }

    return res.status(200).json({
      success: true,

      resumenAcademico: {
        grado:
          estudiante.grado?.nombre || null,

        grupo:
          estudiante.grupo?.nombre || null,

        totalMaterias:
          data?.length || 0,

        periodo:
          data?.[0]?.periodo?.nombre || null,
      },

      materias: data || [],
    });
  } catch (error) {
    console.error(
      'Error inesperado consultando materias del estudiante:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Ocurrió un error al consultar las materias del estudiante.',
    });
  }
};

module.exports = {
  registrarMateria,
  listarMaterias,
  actualizarMateria,
  listarMateriasDocente,
  listarMateriasEstudiante,
};
