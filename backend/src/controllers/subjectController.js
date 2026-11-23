const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  registrarAuditoria,
} = require('../services/auditService');

const normalizarIdEnteroPositivo = (valor) => {
  const texto = String(valor ?? '');

  if (!/^[1-9]\d*$/.test(texto)) {
    return null;
  }

  const id = Number(texto);

  return Number.isSafeInteger(id)
    ? id
    : null;
};

const normalizarIdsEnteros = (valores) => {
  if (!Array.isArray(valores) || valores.length === 0) {
    return null;
  }

  const ids = valores.map(
    normalizarIdEnteroPositivo
  );

  if (
    ids.some((id) => id === null) ||
    new Set(ids).size !== ids.length
  ) {
    return null;
  }

  return ids;
};

const normalizarIdsUuid = (valores) => {
  const uuidRegex =
    /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

  if (
    !Array.isArray(valores) ||
    valores.length === 0 ||
    valores.some(
      (id) =>
        typeof id !== 'string' ||
        !uuidRegex.test(id)
    ) ||
    new Set(valores).size !== valores.length
  ) {
    return null;
  }

  return valores;
};

const TAMANO_PAGINA_MATERIAS = 500;

const consultarTodasLasPaginas = async (
  crearConsulta
) => {
  const registros = [];
  let inicio = 0;

  while (true) {
    const {
      data,
      error,
    } = await crearConsulta().range(
      inicio,
      inicio + TAMANO_PAGINA_MATERIAS - 1
    );

    if (error) {
      return {
        data: null,
        error,
      };
    }

    const pagina = data || [];
    registros.push(...pagina);

    if (pagina.length < TAMANO_PAGINA_MATERIAS) {
      return {
        data: registros,
        error: null,
      };
    }

    inicio += TAMANO_PAGINA_MATERIAS;
  }
};

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
    if (
      !req.body ||
      typeof req.body !== 'object' ||
      Array.isArray(req.body)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Los datos enviados para la materia no son válidos.',
      });
    }

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

    const nombreNormalizado =
      typeof nombre === 'string'
        ? nombre.trim()
        : '';
    const gradoIdNormalizado =
      normalizarIdEnteroPositivo(gradoId);
    const gruposIdsNormalizados =
      normalizarIdsEnteros(gruposIds);
    const docentesIdsNormalizados =
      normalizarIdsUuid(docentesIds);
    const periodoIdNormalizado =
      normalizarIdEnteroPositivo(periodoId);

    if (!nombreNormalizado) {
      return res.status(400).json({
        success: false,
        message:
          'El nombre de la materia es obligatorio.',
      });
    }

    if (gradoIdNormalizado === null) {
      return res.status(400).json({
        success: false,
        message:
          'Debe seleccionar un grado válido.',
      });
    }

    if (!gruposIdsNormalizados) {
      return res.status(400).json({
        success: false,
        message:
          'Seleccione grupos válidos y sin duplicados.',
      });
    }

    if (!docentesIdsNormalizados) {
      return res.status(400).json({
        success: false,
        message:
          'Seleccione docentes responsables válidos y sin duplicados.',
      });
    }

    if (periodoIdNormalizado === null) {
      return res.status(400).json({
        success: false,
        message:
          'Debe seleccionar un periodo académico válido.',
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
      .in('id', gruposIdsNormalizados);

    if (gruposError) {
      console.error(
        'Error consultando grupos para registrar materia:',
        gruposError.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible validar los grupos seleccionados.',
      });
    }

    if (
      !grupos ||
      grupos.length !== gruposIdsNormalizados.length ||
      grupos.some(
        (grupo) =>
          Number(grupo.grado_id) !==
            gradoIdNormalizado ||
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
      gradoId: gradoIdNormalizado,
      gruposIds: gruposIdsNormalizados,
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
      .in('id', docentesIdsNormalizados);

    if (docentesError) {
      console.error(
        'Error consultando docentes para registrar materia:',
        docentesError.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible validar los docentes seleccionados.',
      });
    }

    if (
      !docentes ||
      docentes.length !== docentesIdsNormalizados.length ||
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
      .eq('id', periodoIdNormalizado)
      .maybeSingle();

    if (periodoError) {
      console.error(
        'Error consultando periodo para registrar materia:',
        periodoError.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible validar el periodo académico seleccionado.',
      });
    }

    if (!periodo || !periodo.activo) {
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
        p_nombre: nombreNormalizado,
        p_grado_id: gradoIdNormalizado,
        p_grupos_ids: gruposIdsNormalizados,
        p_docentes_ids: docentesIdsNormalizados,
        p_periodo_id: periodoIdNormalizado,
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
          'No fue posible registrar la materia.',
      });
    }

    await registrarAuditoria({
      usuarioId: req.usuario.id,
      correo: req.usuario.correo,
      evento: 'MATERIA_REGISTRADA',
      descripcion:
        `Se registró la materia ${nombreNormalizado}.`,
      rol: req.usuario.rol,
      direccionIp: req.ip,
      dispositivo:
        req.headers['user-agent'] || null,
      metadata: {
        materiaId,
        nombre: nombreNormalizado,
        gradoId: gradoIdNormalizado,
        gruposIds: gruposIdsNormalizados,
        docentesIds: docentesIdsNormalizados,
        periodoId: periodoIdNormalizado,
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
    const asignacionId =
      normalizarIdEnteroPositivo(req.params.id);

    if (
      !req.body ||
      typeof req.body !== 'object' ||
      Array.isArray(req.body)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Los datos enviados para la materia no son válidos.',
      });
    }

    const {
      nombre,
      gradoId,
      grupoId,
      periodoId,
      docentesIds,
      estado,
    } = req.body;

    const nombreNormalizado =
      typeof nombre === 'string'
        ? nombre.trim()
        : '';
    const gradoIdNormalizado =
      normalizarIdEnteroPositivo(gradoId);
    const grupoIdNormalizado =
      normalizarIdEnteroPositivo(grupoId);
    const periodoIdNormalizado =
      normalizarIdEnteroPositivo(periodoId);
    const docentesIdsNormalizados =
      normalizarIdsUuid(docentesIds);

    if (asignacionId === null) {
      return res.status(400).json({
        success: false,
        message:
          'La asignación de la materia no es válida.',
      });
    }

    if (
      !nombreNormalizado ||
      gradoIdNormalizado === null ||
      grupoIdNormalizado === null ||
      periodoIdNormalizado === null ||
      !docentesIdsNormalizados ||
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

    const {
      data: gruposDestino,
      error: gruposDestinoError,
    } = await supabaseAdmin
      .from('grupos')
      .select('id, grado_id, activo')
      .eq('id', grupoIdNormalizado);

    if (gruposDestinoError) {
      console.error(
        'Error validando el grupo destino de la materia:',
        gruposDestinoError.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible validar el grupo seleccionado.',
      });
    }

    if (
      !gruposDestino ||
      gruposDestino.length !== 1 ||
      Number(gruposDestino[0].grado_id) !==
        gradoIdNormalizado ||
      !gruposDestino[0].activo
    ) {
      return res.status(400).json({
        success: false,
        message:
          'El grupo seleccionado no corresponde al grado o no está activo.',
      });
    }

    const {
      data: docentesDestino,
      error: docentesDestinoError,
    } = await supabaseAdmin
      .from('usuarios')
      .select('id, rol, activo')
      .in('id', docentesIdsNormalizados);

    if (docentesDestinoError) {
      console.error(
        'Error validando los docentes de la materia:',
        docentesDestinoError.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible validar los docentes seleccionados.',
      });
    }

    if (
      !docentesDestino ||
      docentesDestino.length !==
        docentesIdsNormalizados.length ||
      docentesDestino.some(
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

    const {
      data: periodoDestino,
      error: periodoDestinoError,
    } = await supabaseAdmin
      .from('periodos_academicos')
      .select('id, activo')
      .eq('id', periodoIdNormalizado)
      .maybeSingle();

    if (periodoDestinoError) {
      console.error(
        'Error validando el periodo de la materia:',
        periodoDestinoError.message
      );

      return res.status(500).json({
        success: false,
        message:
          'No fue posible validar el periodo académico seleccionado.',
      });
    }

    if (!periodoDestino || !periodoDestino.activo) {
      return res.status(400).json({
        success: false,
        message:
          'El periodo académico seleccionado no es válido.',
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
      gradoId: gradoIdNormalizado,
      gruposIds: [grupoIdNormalizado],
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
        p_nombre: nombreNormalizado,
        p_grado_id: gradoIdNormalizado,
        p_grupo_id: grupoIdNormalizado,
        p_periodo_id: periodoIdNormalizado,
        p_docentes_ids: docentesIdsNormalizados,
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
        nombre: nombreNormalizado,
        gradoId: gradoIdNormalizado,
        grupoId: grupoIdNormalizado,
        periodoId: periodoIdNormalizado,
        docentesIds: docentesIdsNormalizados,
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
    const periodoSolicitado = req.query?.periodoId;
    const periodoId =
      periodoSolicitado === undefined
        ? null
        : normalizarIdEnteroPositivo(
            periodoSolicitado
          );

    if (
      periodoSolicitado !== undefined &&
      periodoId === null
    ) {
      return res.status(400).json({
        success: false,
        message:
          'El periodo académico solicitado no es válido.',
      });
    }

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

    const {
      data,
      error,
    } = await consultarTodasLasPaginas(() => {
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
        .eq('grado_id', estudiante.grado_id)
        .eq('grupo_id', estudiante.grupo_id)
        .eq('estado', 'activa')
        .order('id', { ascending: true });

      if (periodoId) {
        consulta = consulta.eq(
          'periodo_id',
          periodoId
        );
      }

      return consulta;
    });

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
