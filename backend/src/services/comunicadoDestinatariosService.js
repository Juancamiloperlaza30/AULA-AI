// ============================================================
// AULA-AI
// HU-12 - COMUNICADOS Y NOTIFICACIONES INSTITUCIONALES
//
// Servicio de selección de destinatarios.
// ============================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  esIdPositivo,
} = require('./comunicadoAuthorizationService');

// ============================================================
// CONFIGURACIÓN
// ============================================================

const TAMANO_PAGINA = 500;

const ROLES_DESTINATARIOS = [
  'administrador',
  'coordinador',
  'docente',
  'orientador',
  'estudiante',
  'acudiente',
];

// ============================================================
// CONSULTAS PAGINADAS
// ============================================================

async function consultarTodasLasPaginas(
  crearConsulta,
  campoOrden = 'id'
) {
  const resultados = [];

  let inicio = 0;

  while (true) {
    const consulta = crearConsulta()
      .order(campoOrden, {
        ascending: true,
      })
      .range(
        inicio,
        inicio + TAMANO_PAGINA - 1
      );

    const {
      data,
      error,
    } = await consulta;

    if (error) {
      throw error;
    }

    const pagina = data || [];

    resultados.push(...pagina);

    if (pagina.length < TAMANO_PAGINA) {
      break;
    }

    inicio += TAMANO_PAGINA;
  }

  return resultados;
}

// ============================================================
// CONSULTAR USUARIOS ACTIVOS
// ============================================================

async function consultarUsuariosActivos() {
  return consultarTodasLasPaginas(
    () =>
      supabaseAdmin
        .from('usuarios')
        .select('id, rol')
        .eq('activo', true),
    'id'
  );
}

// ============================================================
// CONSULTAR USUARIOS ACTIVOS POR ROL
// ============================================================

async function consultarUsuariosPorRoles(roles) {
  if (
    !Array.isArray(roles) ||
    roles.length === 0
  ) {
    throw new Error(
      'Debe seleccionar al menos un rol destinatario.'
    );
  }

  const rolesNormalizados = [
    ...new Set(roles),
  ];

  const rolesValidos =
    rolesNormalizados.every(
      (rol) =>
        ROLES_DESTINATARIOS.includes(rol)
    );

  if (!rolesValidos) {
    throw new Error(
      'Se proporcionaron roles destinatarios no válidos.'
    );
  }

  return consultarTodasLasPaginas(
    () =>
      supabaseAdmin
        .from('usuarios')
        .select('id, rol')
        .eq('activo', true)
        .in('rol', rolesNormalizados),
    'id'
  );
}

// ============================================================
// CONSULTAR ESTUDIANTES DE UN GRADO
// ============================================================

async function consultarEstudiantesGrado(gradoId) {
  if (!esIdPositivo(gradoId)) {
    throw new Error(
      'El identificador del grado no es válido.'
    );
  }

  return consultarTodasLasPaginas(
    () =>
      supabaseAdmin
        .from('estudiantes')
        .select('usuario_id')
        .eq('grado_id', Number(gradoId)),
    'usuario_id'
  );
}

// ============================================================
// CONSULTAR ESTUDIANTES DE UN GRUPO
// ============================================================

async function consultarEstudiantesGrupo({
  gradoId,
  grupoId,
}) {
  if (
    !esIdPositivo(gradoId) ||
    !esIdPositivo(grupoId)
  ) {
    throw new Error(
      'Los identificadores del grado o grupo no son válidos.'
    );
  }

  return consultarTodasLasPaginas(
    () =>
      supabaseAdmin
        .from('estudiantes')
        .select('usuario_id')
        .eq('grado_id', Number(gradoId))
        .eq('grupo_id', Number(grupoId)),
    'usuario_id'
  );
}

// ============================================================
// CONSULTAR ACUDIENTES ACTIVOS Y VERIFICADOS
// ============================================================

async function consultarAcudientesEstudiantes(
  estudiantesIds
) {
  if (
    !Array.isArray(estudiantesIds) ||
    estudiantesIds.length === 0
  ) {
    return [];
  }

  const acudientes = [];

  // Dividir las consultas para evitar filtros
  // excesivamente grandes.
  for (
    let inicio = 0;
    inicio < estudiantesIds.length;
    inicio += 100
  ) {
    const lote = estudiantesIds.slice(
      inicio,
      inicio + 100
    );

    const vinculaciones =
      await consultarTodasLasPaginas(
        () =>
          supabaseAdmin
            .from('acudiente_estudiante')
            .select(
              'id, acudiente_id, estudiante_id'
            )
            .in('estudiante_id', lote)
            .eq('activo', true)
            .eq('verificado', true),
        'id'
      );

    acudientes.push(...vinculaciones);
  }

  return acudientes;
}

// ============================================================
// CONSULTAR DESTINATARIOS DE GRADO O GRUPO
// ============================================================

async function consultarDestinatariosAcademicos({
  gradoId,
  grupoId = null,
}) {
  const estudiantes =
    grupoId === null
      ? await consultarEstudiantesGrado(
          gradoId
        )
      : await consultarEstudiantesGrupo({
          gradoId,
          grupoId,
        });

  const estudiantesIds = [
    ...new Set(
      estudiantes
        .map(
          (estudiante) =>
            estudiante.usuario_id
        )
        .filter(Boolean)
    ),
  ];

  const vinculaciones =
    await consultarAcudientesEstudiantes(
      estudiantesIds
    );

  const destinatariosPotenciales = new Set(
    estudiantesIds
  );

  for (const vinculacion of vinculaciones) {
    if (vinculacion.acudiente_id) {
      destinatariosPotenciales.add(
        vinculacion.acudiente_id
      );
    }
  }

  if (destinatariosPotenciales.size === 0) {
    return [];
  }

  // Verificar que los usuarios existan,
  // estén activos y tengan el rol esperado.
  const destinatariosActivos = [];

  const ids = [
    ...destinatariosPotenciales,
  ];

  for (
    let inicio = 0;
    inicio < ids.length;
    inicio += 100
  ) {
    const lote = ids.slice(
      inicio,
      inicio + 100
    );

    const {
      data,
      error,
    } = await supabaseAdmin
      .from('usuarios')
      .select('id, rol')
      .in('id', lote)
      .eq('activo', true);

    if (error) {
      throw error;
    }

    for (const usuario of data || []) {
      const esEstudiante =
        usuario.rol === 'estudiante' &&
        estudiantesIds.includes(usuario.id);

      const esAcudiente =
        usuario.rol === 'acudiente' &&
        vinculaciones.some(
          (vinculacion) =>
            vinculacion.acudiente_id ===
            usuario.id
        );

      if (esEstudiante || esAcudiente) {
        destinatariosActivos.push(
          usuario.id
        );
      }
    }
  }

  return [
    ...new Set(destinatariosActivos),
  ];
}

// ============================================================
// RESOLVER DESTINATARIOS DEL COMUNICADO
// ============================================================

async function resolverDestinatariosComunicado({
  alcanceTipo,
  alcanceRoles = [],
  gradoId = null,
  grupoId = null,
}) {
  let destinatarios = [];

  // ----------------------------------------------------------
  // COMUNICADO GENERAL
  // ----------------------------------------------------------

  if (alcanceTipo === 'general') {
    const usuarios =
      await consultarUsuariosActivos();

    destinatarios = usuarios.map(
      (usuario) => usuario.id
    );
  }

  // ----------------------------------------------------------
  // COMUNICADO POR ROLES
  // ----------------------------------------------------------

  else if (alcanceTipo === 'roles') {
    const usuarios =
      await consultarUsuariosPorRoles(
        alcanceRoles
      );

    destinatarios = usuarios.map(
      (usuario) => usuario.id
    );
  }

  // ----------------------------------------------------------
  // COMUNICADO POR GRADO
  // ----------------------------------------------------------

  else if (alcanceTipo === 'grado') {
    destinatarios =
      await consultarDestinatariosAcademicos({
        gradoId,
      });
  }

  // ----------------------------------------------------------
  // COMUNICADO POR GRUPO
  // ----------------------------------------------------------

  else if (alcanceTipo === 'grupo') {
    destinatarios =
      await consultarDestinatariosAcademicos({
        gradoId,
        grupoId,
      });
  }

  // ----------------------------------------------------------
  // ALCANCE NO VÁLIDO
  // ----------------------------------------------------------

  else {
    throw new Error(
      'El alcance del comunicado no es válido.'
    );
  }

  return [
    ...new Set(
      destinatarios.filter(Boolean)
    ),
  ];
}

// ============================================================
// EXPORTACIONES
// ============================================================

module.exports = {
  ROLES_DESTINATARIOS,
  consultarUsuariosActivos,
  consultarUsuariosPorRoles,
  consultarEstudiantesGrado,
  consultarEstudiantesGrupo,
  consultarAcudientesEstudiantes,
  consultarDestinatariosAcademicos,
  resolverDestinatariosComunicado,
};
