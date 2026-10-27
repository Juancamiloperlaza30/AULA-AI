
const { supabaseAdmin } = require('../config/supabase');

const fail = (res, status, message) =>
  res.status(status).json({
    success: false,
    message,
  });

const validId = (v) =>
  Number.isSafeInteger(Number(v)) &&
  Number(v) > 0;

const validDate = (s) =>
  typeof s === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) &&
  new Date(`${s}T12:00:00Z`)
    .toISOString()
    .slice(0, 10) === s;

const validTime = (t) =>
  t == null ||
  (
    typeof t === 'string' &&
    /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(t)
  );

const validState = (v) =>
  ['presente', 'ausente', 'tarde'].includes(v);

const dbError = (res, error) => {
  console.error('HU-06:', error?.message || error);

  if (error?.code === '23505') {
    return fail(
      res,
      409,
      'La asistencia o sesión ya existe.'
    );
  }

  if (error?.code === '42501') {
    return fail(
      res,
      403,
      'No tiene permisos para esta operación.'
    );
  }

  if (
    error?.code === '22023' ||
    error?.code === '23514' ||
    error?.code === '23503'
  ) {
    return fail(
      res,
      400,
      error.message || 'Datos inválidos.'
    );
  }

  return fail(
    res,
    500,
    'No fue posible completar la operación.'
  );
};

// ==========================================
// COMPROBAR ASIGNACIÓN ACTIVA DEL DOCENTE
// ==========================================

async function asignacionDocente(
  docenteId,
  asignacionId
) {
  const { data, error } = await supabaseAdmin
    .from('materia_docente')
    .select(`
      materia_grupo_periodo_id,
      asignacion:materia_grupo_periodo(
        id,
        grado_id,
        grupo_id,
        estado,
        periodo:periodos_academicos(
          id,
          activo,
          fecha_inicio,
          fecha_fin
        ),
        grupo:grupos(
          id,
          activo
        )
      )
    `)
    .eq('docente_id', docenteId)
    .eq(
      'materia_grupo_periodo_id',
      asignacionId
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (
    data?.asignacion?.estado === 'activa' &&
    data.asignacion.periodo?.activo &&
    data.asignacion.grupo?.activo
  )
    ? data.asignacion
    : null;
}

// ==========================================
// LISTAR MATERIAS ASIGNADAS AL DOCENTE
// ==========================================

async function listarAsignaciones(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('materia_docente')
      .select(`
        materia_grupo_periodo_id,
        asignacion:materia_grupo_periodo(
          id,
          estado,
          materia:materias(
            id,
            nombre
          ),
          grado:grados(
            id,
            nombre
          ),
          grupo:grupos(
            id,
            nombre,
            activo
          ),
          periodo:periodos_academicos(
            id,
            nombre,
            activo
          )
        )
      `)
      .eq('docente_id', req.usuario.id);

    if (error) {
      return dbError(res, error);
    }

    const asignaciones = (data || [])
      .map((item) => item.asignacion)
      .filter(
        (item) =>
          item &&
          item.estado === 'activa' &&
          item.grupo?.activo &&
          item.periodo?.activo
      );

    return res.json({
      success: true,
      asignaciones,
    });
  } catch (error) {
    return dbError(res, error);
  }
}

// ==========================================
// LISTAR ESTUDIANTES DE UNA ASIGNACIÓN
// ==========================================

async function listarEstudiantes(req, res) {
  try {
    const id = Number(req.params.asignacionId);

    if (!validId(id)) {
      return fail(
        res,
        400,
        'Asignación inválida.'
      );
    }

    const asignacion = await asignacionDocente(
      req.usuario.id,
      id
    );

    if (!asignacion) {
      return fail(
        res,
        403,
        'No tiene asignación activa para este grupo.'
      );
    }

    const { data, error } = await supabaseAdmin
      .from('estudiantes')
      .select(`
        usuario_id,
        grado_id,
        grupo_id,
        usuario:usuarios!estudiantes_usuario_id_fkey(
          id,
          nombres,
          apellidos,
          activo,
          rol
        )
      `)
      .eq('grado_id', asignacion.grado_id)
      .eq('grupo_id', asignacion.grupo_id);

    if (error) {
      return dbError(res, error);
    }

    const estudiantes = (data || [])
      .filter(
        (item) =>
          item.usuario?.activo &&
          item.usuario?.rol === 'estudiante'
      )
      .map((item) => ({
        id: item.usuario_id,
        nombres: item.usuario.nombres,
        apellidos: item.usuario.apellidos,
      }))
      .sort((a, b) =>
        `${a.apellidos} ${a.nombres}`.localeCompare(
          `${b.apellidos} ${b.nombres}`,
          'es'
        )
      );

    return res.json({
      success: true,
      estudiantes,
    });
  } catch (error) {
    return dbError(res, error);
  }
}

// ==========================================
// CREAR SESIÓN DE CLASE
// ==========================================

async function crearSesion(req, res) {
  try {
    const {
      materiaGrupoPeriodoId,
      fecha,
      numeroSesion = 1,
      horaInicio = null,
      horaFin = null,
    } = req.body || {};

    if (
      !validId(materiaGrupoPeriodoId) ||
      !validDate(fecha) ||
      !validId(numeroSesion) ||
      !validTime(horaInicio) ||
      !validTime(horaFin) ||
      (
        horaInicio &&
        horaFin &&
        horaFin <= horaInicio
      )
    ) {
      return fail(
        res,
        400,
        'Datos de sesión inválidos.'
      );
    }

    const asignacion = await asignacionDocente(
      req.usuario.id,
      Number(materiaGrupoPeriodoId)
    );

    if (!asignacion) {
      return fail(
        res,
        403,
        'No tiene asignación activa para esta materia.'
      );
    }

    if (
      fecha < asignacion.periodo.fecha_inicio ||
      fecha > asignacion.periodo.fecha_fin
    ) {
      return fail(
        res,
        400,
        'Fecha fuera del período académico.'
      );
    }

    const { data, error } = await supabaseAdmin
      .from('sesiones_clase')
      .insert({
        materia_grupo_periodo_id:
          Number(materiaGrupoPeriodoId),
        docente_id: req.usuario.id,
        fecha,
        numero_sesion: Number(numeroSesion),
        hora_inicio: horaInicio,
        hora_fin: horaFin,
      })
      .select('*')
      .single();

    if (error) {
      return dbError(res, error);
    }

    return res.status(201).json({
      success: true,
      sesion: data,
    });
  } catch (error) {
    return dbError(res, error);
  }
}

// ==========================================
// CONSULTAR SESIONES DEL DOCENTE
// ==========================================

async function listarSesiones(req, res) {
  try {
    const asignacionId = Number(
      req.params.asignacionId
    );

    if (!validId(asignacionId)) {
      return fail(
        res,
        400,
        'Asignación inválida.'
      );
    }

    const asignacion = await asignacionDocente(
      req.usuario.id,
      asignacionId
    );

    if (!asignacion) {
      return fail(
        res,
        403,
        'No tiene asignación activa.'
      );
    }

    const { data, error } = await supabaseAdmin
      .from('sesiones_clase')
      .select('*')
      .eq(
        'materia_grupo_periodo_id',
        asignacionId
      )
      .eq('docente_id', req.usuario.id)
      .order('fecha', {
        ascending: false,
      })
      .order('numero_sesion', {
        ascending: true,
      });

    if (error) {
      return dbError(res, error);
    }

    return res.json({
      success: true,
      sesiones: data || [],
    });
  } catch (error) {
    return dbError(res, error);
  }
}

// ==========================================
// REGISTRAR ASISTENCIAS
// ==========================================

async function registrarAsistencias(req, res) {
  try {
    const sesionId = Number(
      req.params.sesionId
    );

    const registros = req.body?.registros;

    if (
      !validId(sesionId) ||
      !Array.isArray(registros) ||
      !registros.length ||
      registros.length > 100 ||
      registros.some(
        (item) =>
          !item ||
          typeof item.estudianteId !== 'string' ||
          !validState(item.estado) ||
          (
            item.observacion != null &&
            (
              typeof item.observacion !== 'string' ||
              item.observacion.length > 1000
            )
          )
      )
    ) {
      return fail(
        res,
        400,
        'Debe enviar una lista válida de asistencias (máximo 100 estudiantes).'
      );
    }

    const {
      data: sesion,
      error: sesionError,
    } = await supabaseAdmin
      .from('sesiones_clase')
      .select(`
        id,
        materia_grupo_periodo_id,
        docente_id
      `)
      .eq('id', sesionId)
      .maybeSingle();

    if (sesionError) {
      return dbError(res, sesionError);
    }

    if (!sesion) {
      return fail(
        res,
        404,
        'Sesión no encontrada.'
      );
    }

    if (
      sesion.docente_id !== req.usuario.id ||
      !(
        await asignacionDocente(
          req.usuario.id,
          sesion.materia_grupo_periodo_id
        )
      )
    ) {
      return fail(
        res,
        403,
        'No está autorizado para registrar asistencia en esta sesión.'
      );
    }

    const { data, error } = await supabaseAdmin
      .rpc('hu06_registrar_asistencias', {
        p_sesion_id: sesionId,
        p_docente_id: req.usuario.id,
        p_registros: registros,
      });

    if (error) {
      return dbError(res, error);
    }

    return res.status(201).json({
      success: true,
      message:
        'Asistencia registrada correctamente',
      cantidad: data,
    });
  } catch (error) {
    return dbError(res, error);
  }
}

// ==========================================
// SINCRONIZAR REGISTRO OFFLINE
// La clave natural de la operación es
// asignación + fecha + número de sesión.
// ==========================================

async function sincronizarAsistenciaOffline(req, res) {
  try {
    const {
      asignacionId,
      fecha,
      numeroSesion = 1,
      registros: registrosRecibidos,
    } = req.body || {};

    if (
      !validId(asignacionId) ||
      !validDate(fecha) ||
      !validId(numeroSesion) ||
      !Array.isArray(registrosRecibidos) ||
      registrosRecibidos.length === 0 ||
      registrosRecibidos.length > 100
    ) {
      return fail(
        res,
        400,
        'Asignación, fecha, sesión o lista de asistencias inválida.'
      );
    }

    const estudiantes = new Set();
    const registros = [];

    for (const item of registrosRecibidos) {
      if (
        !item ||
        typeof item.estudianteId !== 'string' ||
        !item.estudianteId.trim() ||
        !validState(item.estado) ||
        (
          item.observacion != null &&
          (
            typeof item.observacion !== 'string' ||
            item.observacion.length > 1000
          )
        )
      ) {
        return fail(
          res,
          400,
          'La lista contiene una asistencia inválida.'
        );
      }

      const estudianteId =
        item.estudianteId.trim();

      if (estudiantes.has(estudianteId)) {
        return fail(
          res,
          400,
          'Un estudiante aparece más de una vez.'
        );
      }

      estudiantes.add(estudianteId);
      const observacion =
        item.observacion == null
          ? null
          : item.observacion.trim();

      if (
        observacion &&
        observacion.length > 1000
      ) {
        return fail(
          res,
          400,
          'Una observación supera los 1000 caracteres.'
        );
      }

      registros.push({
        estudianteId,
        estado: item.estado,
        observacion: observacion || null,
      });
    }

    const docenteId = req.usuario.id;
    const idAsignacion = Number(asignacionId);
    const sesionNumero = Number(numeroSesion);
    const asignacion = await asignacionDocente(
      docenteId,
      idAsignacion
    );

    if (!asignacion) {
      return fail(
        res,
        403,
        'No tiene asignación activa para esta materia.'
      );
    }

    if (
      fecha < asignacion.periodo.fecha_inicio ||
      fecha > asignacion.periodo.fecha_fin
    ) {
      return fail(
        res,
        400,
        'Fecha fuera del período académico.'
      );
    }

    const buscarSesion = async () => {
      const { data, error } = await supabaseAdmin
        .from('sesiones_clase')
        .select(`
          id,
          materia_grupo_periodo_id,
          docente_id,
          fecha,
          numero_sesion
        `)
        .eq(
          'materia_grupo_periodo_id',
          idAsignacion
        )
        .eq('fecha', fecha)
        .eq('numero_sesion', sesionNumero)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    };

    let sesion = await buscarSesion();

    if (sesion && sesion.docente_id !== docenteId) {
      return fail(
        res,
        409,
        'Ya existe una sesión equivalente creada por otro docente.'
      );
    }

    if (!sesion) {
      const { data, error } = await supabaseAdmin
        .from('sesiones_clase')
        .insert({
          materia_grupo_periodo_id: idAsignacion,
          docente_id: docenteId,
          fecha,
          numero_sesion: sesionNumero,
          hora_inicio: null,
          hora_fin: null,
        })
        .select(`
          id,
          materia_grupo_periodo_id,
          docente_id,
          fecha,
          numero_sesion
        `)
        .single();

      if (error && error.code !== '23505') {
        return dbError(res, error);
      }

      // Otro intento puede haber creado la misma sesión
      // entre la consulta y el INSERT. Releerla hace que
      // los reintentos converjan en la misma operación.
      sesion = error
        ? await buscarSesion()
        : data;

      if (!sesion) {
        return error
          ? dbError(res, error)
          : fail(
            res,
            500,
            'No se pudo crear ni recuperar la sesión.'
          );
      }

      if (sesion.docente_id !== docenteId) {
        return fail(
          res,
          409,
          'Ya existe una sesión equivalente creada por otro docente.'
        );
      }
    }

    const consultarAsistencias = async () => {
      const { data, error } = await supabaseAdmin
        .from('asistencias')
        .select(
          'estudiante_id,estado,observacion'
        )
        .eq('sesion_clase_id', sesion.id);

      if (error) {
        throw error;
      }

      return data || [];
    };

    const mismasAsistencias = (existentes) => {
      if (existentes.length !== registros.length) {
        return false;
      }

      const existentesPorEstudiante = new Map(
        existentes.map((item) => [
          item.estudiante_id,
          item,
        ])
      );

      return registros.every((item) => {
        const existente =
          existentesPorEstudiante.get(
            item.estudianteId
          );

        return (
          existente &&
          existente.estado === item.estado &&
          (existente.observacion ?? null) ===
            (item.observacion ?? null)
        );
      });
    };

    const existentes = await consultarAsistencias();

    if (existentes.length) {
      if (mismasAsistencias(existentes)) {
        return res.json({
          success: true,
          duplicate: true,
          message:
            'Esta asistencia ya estaba sincronizada.',
          sesionId: sesion.id,
          cantidad: existentes.length,
        });
      }

      return fail(
        res,
        409,
        'La sesión ya tiene asistencias diferentes; no se sobrescribieron.'
      );
    }

    const { data, error } = await supabaseAdmin
      .rpc('hu06_registrar_asistencias', {
        p_sesion_id: sesion.id,
        p_docente_id: docenteId,
        p_registros: registros,
      });

    if (error) {
      if (error.code === '23505') {
        const trasConflicto =
          await consultarAsistencias();

        if (mismasAsistencias(trasConflicto)) {
          return res.json({
            success: true,
            duplicate: true,
            message:
              'Esta asistencia ya estaba sincronizada.',
            sesionId: sesion.id,
            cantidad: trasConflicto.length,
          });
        }

        if (trasConflicto.length) {
          return fail(
            res,
            409,
            'La sesión ya tiene asistencias diferentes; no se sobrescribieron.'
          );
        }
      }

      return dbError(res, error);
    }

    return res.status(201).json({
      success: true,
      duplicate: false,
      message:
        'Asistencia offline sincronizada correctamente.',
      sesionId: sesion.id,
      cantidad: data,
    });
  } catch (error) {
    return dbError(res, error);
  }
}

// ==========================================
// CONSULTAR ASISTENCIAS DE UNA SESIÓN
// ==========================================

async function consultarSesion(req, res) {
  try {
    const sesionId = Number(
      req.params.sesionId
    );

    if (!validId(sesionId)) {
      return fail(
        res,
        400,
        'Sesión inválida.'
      );
    }

    const {
      data: sesion,
      error,
    } = await supabaseAdmin
      .from('sesiones_clase')
      .select('*')
      .eq('id', sesionId)
      .maybeSingle();

    if (error) {
      return dbError(res, error);
    }

    if (!sesion) {
      return fail(
        res,
        404,
        'Sesión no encontrada.'
      );
    }

    const rol = req.usuario.rol;

    if (
      rol === 'docente' &&
      (
        sesion.docente_id !== req.usuario.id ||
        !(
          await asignacionDocente(
            req.usuario.id,
            sesion.materia_grupo_periodo_id
          )
        )
      )
    ) {
      return fail(
        res,
        403,
        'Sesión fuera de sus asignaciones.'
      );
    }

    if (rol === 'coordinador') {
      const {
        data: asignacion,
        error: asignacionError,
      } = await supabaseAdmin
        .from('materia_grupo_periodo')
        .select('grado_id,grupo_id')
        .eq(
          'id',
          sesion.materia_grupo_periodo_id
        )
        .single();

      if (asignacionError) {
        return dbError(
          res,
          asignacionError
        );
      }

      const {
        data: ambito,
        error: ambitoError,
      } = await supabaseAdmin
        .from('coordinador_ambito')
        .select('id')
        .eq(
          'coordinador_id',
          req.usuario.id
        )
        .eq(
          'grado_id',
          asignacion.grado_id
        )
        .eq(
          'grupo_id',
          asignacion.grupo_id
        )
        .eq('activo', true)
        .limit(1);

      if (ambitoError) {
        return dbError(
          res,
          ambitoError
        );
      }

      if (!ambito?.length) {
        return fail(
          res,
          403,
          'Sesión fuera del ámbito autorizado.'
        );
      }
    }

    const {
      data,
      error: asistenciasError,
    } = await supabaseAdmin
      .from('asistencias')
      .select(`
        id,
        estudiante_id,
        estado,
        observacion,
        fecha,
        created_at,
        updated_at
      `)
      .eq('sesion_clase_id', sesionId)
      .order('id');

    if (asistenciasError) {
      return dbError(
        res,
        asistenciasError
      );
    }

    return res.json({
      success: true,
      sesion,
      asistencias: data || [],
    });
  } catch (error) {
    return dbError(res, error);
  }
}

// ==========================================
// HU-06: CORREGIR ASISTENCIA
// DOCENTE PROPIETARIO / ADMIN / COORDINADOR
// ==========================================

async function corregirAsistencia(req, res) {
  try {
    const asistenciaId = Number(
      req.params.asistenciaId
    );

    const {
      estado,
      observacion = null,
      motivo,
    } = req.body || {};

    if (
      !validId(asistenciaId) ||
      !validState(estado) ||
      typeof motivo !== 'string' ||
      !motivo.trim() ||
      motivo.length > 1000 ||
      (
        observacion !== null &&
        (
          typeof observacion !== 'string' ||
          observacion.length > 1000
        )
      )
    ) {
      return fail(
        res,
        400,
        'Estado, observación o motivo inválido.'
      );
    }

    // Validar que el docente sea el propietario
    // del registro y de la sesión académica.

    if (req.usuario.rol === 'docente') {
      const {
        data: registro,
        error: registroError,
      } = await supabaseAdmin
        .from('asistencias')
        .select(`
          docente_id,
          materia_grupo_periodo_id,
          sesion_clase_id
        `)
        .eq('id', asistenciaId)
        .maybeSingle();

      if (registroError) {
        return dbError(
          res,
          registroError
        );
      }

      if (!registro) {
        return fail(
          res,
          404,
          'Asistencia inexistente.'
        );
      }

      if (
        registro.docente_id !== req.usuario.id ||
        !(
          await asignacionDocente(
            req.usuario.id,
            registro.materia_grupo_periodo_id
          )
        )
      ) {
        return fail(
          res,
          403,
          'Solo puede corregir asistencias registradas por usted en sus clases activas.'
        );
      }

      const {
        data: sesion,
        error: sesionError,
      } = await supabaseAdmin
        .from('sesiones_clase')
        .select(`
          docente_id,
          materia_grupo_periodo_id
        `)
        .eq(
          'id',
          registro.sesion_clase_id
        )
        .maybeSingle();

      if (sesionError) {
        return dbError(
          res,
          sesionError
        );
      }

      if (
        !sesion ||
        sesion.docente_id !== req.usuario.id ||
        sesion.materia_grupo_periodo_id !==
          registro.materia_grupo_periodo_id
      ) {
        return fail(
          res,
          403,
          'La sesión no pertenece al docente autenticado.'
        );
      }
    }

    // Utilizar siempre la identidad validada
    // por authMiddleware, nunca un ID del body.

    const { error } = await supabaseAdmin
      .rpc('hu06_corregir_asistencia', {
        p_asistencia_id: asistenciaId,
        p_usuario_id: req.usuario.id,
        p_estado: estado,
        p_observacion: observacion,
        p_motivo: motivo.trim(),
      });

    if (error) {
      return dbError(res, error);
    }

    return res.json({
      success: true,
      message:
        'Asistencia corregida correctamente.',
    });
  } catch (error) {
    return dbError(res, error);
  }
}

// ==========================================
// LISTAR SESIONES PARA ADMINISTRACIÓN
// ==========================================

async function listarSesionesAdministrativas(
  req,
  res
) {
  try {
    let asignacionesPermitidas = null;

    if (req.usuario.rol === 'coordinador') {
      const {
        data: ambitos,
        error: ambitoError,
      } = await supabaseAdmin
        .from('coordinador_ambito')
        .select('grado_id,grupo_id')
        .eq(
          'coordinador_id',
          req.usuario.id
        )
        .eq('activo', true);

      if (ambitoError) {
        return dbError(
          res,
          ambitoError
        );
      }

      if (!(ambitos || []).length) {
        return res.json({
          success: true,
          sesiones: [],
        });
      }

      const grupos = [
        ...new Set(
          ambitos.map(
            (item) => item.grupo_id
          )
        ),
      ];

      const {
        data: relaciones,
        error: relacionesError,
      } = await supabaseAdmin
        .from('materia_grupo_periodo')
        .select('id,grado_id,grupo_id')
        .in('grupo_id', grupos);

      if (relacionesError) {
        return dbError(
          res,
          relacionesError
        );
      }

      asignacionesPermitidas = (
        relaciones || []
      )
        .filter((relacion) =>
          ambitos.some(
            (ambito) =>
              ambito.grado_id ===
                relacion.grado_id &&
              ambito.grupo_id ===
                relacion.grupo_id
          )
        )
        .map(
          (relacion) => relacion.id
        );

      if (!asignacionesPermitidas.length) {
        return res.json({
          success: true,
          sesiones: [],
        });
      }
    }

    let consulta = supabaseAdmin
      .from('sesiones_clase')
      .select(`
        id,
        fecha,
        numero_sesion,
        materia_grupo_periodo_id,
        docente_id,
        asignacion:materia_grupo_periodo(
          materia:materias(nombre),
          grupo:grupos(nombre),
          grado:grados(nombre)
        )
      `)
      .order('fecha', {
        ascending: false,
      })
      .order('id', {
        ascending: false,
      })
      .limit(100);

    if (asignacionesPermitidas) {
      consulta = consulta.in(
        'materia_grupo_periodo_id',
        asignacionesPermitidas
      );
    }

    const {
      data,
      error,
    } = await consulta;

    if (error) {
      return dbError(res, error);
    }

    return res.json({
      success: true,
      sesiones: data || [],
    });
  } catch (error) {
    return dbError(res, error);
  }
}

// ==========================================
// CONSULTAR SESIÓN ADMINISTRATIVA
// ==========================================

async function consultarSesionAdministrativa(
  req,
  res
) {
  try {
    const sesionId = Number(
      req.params.sesionId
    );

    if (!validId(sesionId)) {
      return fail(
        res,
        400,
        'Sesión inválida.'
      );
    }

    const {
      data: sesion,
      error,
    } = await supabaseAdmin
      .from('sesiones_clase')
      .select('*')
      .eq('id', sesionId)
      .maybeSingle();

    if (error) {
      return dbError(res, error);
    }

    if (!sesion) {
      return fail(
        res,
        404,
        'Sesión inexistente.'
      );
    }

    if (req.usuario.rol === 'coordinador') {
      const {
        data: asignacion,
        error: asignacionError,
      } = await supabaseAdmin
        .from('materia_grupo_periodo')
        .select('grado_id,grupo_id')
        .eq(
          'id',
          sesion.materia_grupo_periodo_id
        )
        .single();

      if (asignacionError) {
        return dbError(
          res,
          asignacionError
        );
      }

      const {
        data: ambito,
        error: ambitoError,
      } = await supabaseAdmin
        .from('coordinador_ambito')
        .select('id')
        .eq(
          'coordinador_id',
          req.usuario.id
        )
        .eq(
          'grado_id',
          asignacion.grado_id
        )
        .eq(
          'grupo_id',
          asignacion.grupo_id
        )
        .eq('activo', true)
        .limit(1);

      if (ambitoError) {
        return dbError(
          res,
          ambitoError
        );
      }

      if (!ambito?.length) {
        return fail(
          res,
          403,
          'Fuera del ámbito autorizado.'
        );
      }
    }

    const {
      data: asistencias,
      error: asistenciasError,
    } = await supabaseAdmin
      .from('asistencias')
      .select(`
        id,
        estudiante_id,
        estado,
        observacion,
        fecha
      `)
      .eq('sesion_clase_id', sesionId)
      .order('id');

    if (asistenciasError) {
      return dbError(
        res,
        asistenciasError
      );
    }

    const estudiantesIds = (
      asistencias || []
    ).map(
      (item) => item.estudiante_id
    );

    let estudiantes = [];

    if (estudiantesIds.length) {
      const {
        data,
        error: estudiantesError,
      } = await supabaseAdmin
        .from('usuarios')
        .select('id,nombres,apellidos')
        .in(
          'id',
          estudiantesIds
        );

      if (estudiantesError) {
        return dbError(
          res,
          estudiantesError
        );
      }

      estudiantes = data || [];
    }

    return res.json({
      success: true,
      sesion,
      asistencias: asistencias || [],
      estudiantes,
    });
  } catch (error) {
    return dbError(res, error);
  }
}

// ==========================================
// EXPORTAR FUNCIONES HU-06
// ==========================================

module.exports = {
  listarAsignaciones,
  listarEstudiantes,
  crearSesion,
  listarSesiones,
  registrarAsistencias,
  sincronizarAsistenciaOffline,
  consultarSesion,
  corregirAsistencia,
  listarSesionesAdministrativas,
  consultarSesionAdministrativa,
};
