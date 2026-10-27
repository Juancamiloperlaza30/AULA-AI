// ============================================================
// AULA-AI
// HU-12 - COMUNICADOS Y NOTIFICACIONES INSTITUCIONALES
//
// Servicio de autorización para publicar comunicados.
// ============================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

// ============================================================
// ROLES AUTORIZADOS
// ============================================================

const ROLES_PUBLICADORES = [
  'administrador',
  'coordinador',
];

// ============================================================
// VALIDAR IDENTIFICADORES
// ============================================================

function esIdPositivo(valor) {
  if (
    valor === null ||
    valor === undefined ||
    typeof valor === 'boolean' ||
    (typeof valor === 'string' && valor.trim() === '')
  ) {
    return false;
  }

  const numero = Number(valor);

  return (
    Number.isSafeInteger(numero) &&
    numero > 0
  );
}

// ============================================================
// VALIDAR ROL DEL PUBLICADOR
// ============================================================

function puedePublicarComunicados(usuario) {
  if (!usuario || !usuario.id) {
    return false;
  }

  if (usuario.activo !== true) {
    return false;
  }

  return ROLES_PUBLICADORES.includes(
    usuario.rol
  );
}

// ============================================================
// VERIFICAR ÁMBITO DEL COORDINADOR
// ============================================================

async function verificarAmbitoCoordinador({
  coordinadorId,
  gradoId,
  grupoId,
}) {
  if (
    !coordinadorId ||
    !esIdPositivo(gradoId) ||
    !esIdPositivo(grupoId)
  ) {
    return false;
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from('coordinador_ambito')
    .select('id')
    .eq('coordinador_id', coordinadorId)
    .eq('grado_id', Number(gradoId))
    .eq('grupo_id', Number(grupoId))
    .eq('activo', true)
    .limit(1);

  if (error) {
    throw error;
  }

  return (
    Array.isArray(data) &&
    data.length > 0
  );
}

// ============================================================
// VERIFICAR EXISTENCIA DE UN GRADO ACTIVO
// ============================================================

async function verificarGradoActivo(gradoId) {
  if (!esIdPositivo(gradoId)) {
    return false;
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from('grados')
    .select('id')
    .eq('id', Number(gradoId))
    .eq('activo', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

// ============================================================
// VALIDAR EXISTENCIA Y RELACIÓN GRADO-GRUPO
// ============================================================

async function verificarGradoGrupo({
  gradoId,
  grupoId,
}) {
  if (
    !esIdPositivo(gradoId) ||
    !esIdPositivo(grupoId)
  ) {
    return false;
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from('grupos')
    .select('id')
    .eq('id', Number(grupoId))
    .eq('grado_id', Number(gradoId))
    .eq('activo', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return false;
  }

  return verificarGradoActivo(gradoId);
}

// ============================================================
// CONSULTAR TODOS LOS GRUPOS ACTIVOS DE UN GRADO
// ============================================================

async function consultarGruposActivosGrado(gradoId) {
  const grupos = [];
  const tamanoPagina = 500;

  let inicio = 0;

  while (true) {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from('grupos')
      .select('id')
      .eq('grado_id', Number(gradoId))
      .eq('activo', true)
      .order('id', {
        ascending: true,
      })
      .range(
        inicio,
        inicio + tamanoPagina - 1
      );

    if (error) {
      throw error;
    }

    const pagina = data || [];

    grupos.push(...pagina);

    if (pagina.length < tamanoPagina) {
      break;
    }

    inicio += tamanoPagina;
  }

  return grupos;
}

// ============================================================
// CONSULTAR TODOS LOS ÁMBITOS ACTIVOS DEL COORDINADOR
// PARA UN GRADO DETERMINADO
// ============================================================

async function consultarAmbitosCoordinadorGrado({
  coordinadorId,
  gradoId,
}) {
  const ambitos = [];
  const tamanoPagina = 500;

  let inicio = 0;

  while (true) {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from('coordinador_ambito')
      .select('grupo_id')
      .eq('coordinador_id', coordinadorId)
      .eq('grado_id', Number(gradoId))
      .eq('activo', true)
      .order('grupo_id', {
        ascending: true,
      })
      .range(
        inicio,
        inicio + tamanoPagina - 1
      );

    if (error) {
      throw error;
    }

    const pagina = data || [];

    ambitos.push(...pagina);

    if (pagina.length < tamanoPagina) {
      break;
    }

    inicio += tamanoPagina;
  }

  return ambitos;
}

// ============================================================
// RESPUESTAS DE AUTORIZACIÓN
// ============================================================

function respuestaAutorizada(mensaje) {
  return {
    autorizado: true,
    codigo: 200,
    mensaje,
  };
}

function respuestaDenegada(codigo, mensaje) {
  return {
    autorizado: false,
    codigo,
    mensaje,
  };
}

// ============================================================
// VERIFICAR AUTORIZACIÓN DE PUBLICACIÓN
// ============================================================

async function autorizarPublicacionComunicado({
  usuario,
  alcanceTipo,
  gradoId = null,
  grupoId = null,
}) {
  // ----------------------------------------------------------
  // 1. VERIFICAR USUARIO Y ROL
  // ----------------------------------------------------------

  if (!puedePublicarComunicados(usuario)) {
    return respuestaDenegada(
      403,
      'No tiene permisos para publicar comunicados institucionales.'
    );
  }

  // ----------------------------------------------------------
  // 2. VALIDAR TIPO DE ALCANCE
  // ----------------------------------------------------------

  const alcancesValidos = [
    'general',
    'roles',
    'grado',
    'grupo',
  ];

  if (!alcancesValidos.includes(alcanceTipo)) {
    return respuestaDenegada(
      400,
      'El alcance del comunicado no es válido.'
    );
  }

  // ----------------------------------------------------------
  // 3. VALIDAR CONSISTENCIA DEL ALCANCE
  // ----------------------------------------------------------

  if (
    (alcanceTipo === 'general' ||
      alcanceTipo === 'roles') &&
    (gradoId !== null || grupoId !== null)
  ) {
    return respuestaDenegada(
      400,
      'El alcance seleccionado no permite indicar grado o grupo.'
    );
  }

  if (
    alcanceTipo === 'grado' &&
    grupoId !== null
  ) {
    return respuestaDenegada(
      400,
      'Un comunicado dirigido a un grado no debe incluir un grupo específico.'
    );
  }

  // ----------------------------------------------------------
  // 4. ADMINISTRADOR
  // ----------------------------------------------------------

  if (usuario.rol === 'administrador') {
    // Comunicados generales o por roles.
    if (
      alcanceTipo === 'general' ||
      alcanceTipo === 'roles'
    ) {
      return respuestaAutorizada(
        'Publicación autorizada para el Administrador.'
      );
    }

    // Comunicados por grado.
    if (alcanceTipo === 'grado') {
      if (!esIdPositivo(gradoId)) {
        return respuestaDenegada(
          400,
          'Debe indicar un grado válido.'
        );
      }

      const gradoValido =
        await verificarGradoActivo(gradoId);

      if (!gradoValido) {
        return respuestaDenegada(
          400,
          'El grado seleccionado no existe o está inactivo.'
        );
      }

      return respuestaAutorizada(
        'Publicación autorizada para el grado seleccionado.'
      );
    }

    // Comunicados por grupo.
    if (alcanceTipo === 'grupo') {
      const grupoValido =
        await verificarGradoGrupo({
          gradoId,
          grupoId,
        });

      if (!grupoValido) {
        return respuestaDenegada(
          400,
          'El grupo no pertenece al grado indicado o está inactivo.'
        );
      }

      return respuestaAutorizada(
        'Publicación autorizada para el grupo seleccionado.'
      );
    }
  }

  // ----------------------------------------------------------
  // 5. COORDINADOR: RESTRINGIR ALCANCES INSTITUCIONALES
  // ----------------------------------------------------------

  if (
    alcanceTipo === 'general' ||
    alcanceTipo === 'roles'
  ) {
    return respuestaDenegada(
      403,
      'El Coordinador solo puede publicar comunicados para sus grados y grupos autorizados.'
    );
  }

  // ----------------------------------------------------------
  // 6. COORDINADOR: PUBLICACIÓN POR GRADO
  // ----------------------------------------------------------

  if (alcanceTipo === 'grado') {
    if (!esIdPositivo(gradoId)) {
      return respuestaDenegada(
        400,
        'Debe indicar un grado válido.'
      );
    }

    const gradoValido =
      await verificarGradoActivo(gradoId);

    if (!gradoValido) {
      return respuestaDenegada(
        400,
        'El grado seleccionado no existe o está inactivo.'
      );
    }

    // Consultar todos los grupos activos del grado.
    const grupos =
      await consultarGruposActivosGrado(gradoId);

    if (grupos.length === 0) {
      return respuestaDenegada(
        400,
        'El grado seleccionado no tiene grupos activos.'
      );
    }

    // Consultar grupos asignados al Coordinador.
    const ambitos =
      await consultarAmbitosCoordinadorGrado({
        coordinadorId: usuario.id,
        gradoId,
      });

    const gruposAutorizados = new Set(
      ambitos.map(
        (ambito) => String(ambito.grupo_id)
      )
    );

    // El Coordinador debe tener autorización
    // sobre todos los grupos activos del grado.
    const todosAutorizados = grupos.every(
      (grupo) =>
        gruposAutorizados.has(
          String(grupo.id)
        )
    );

    if (!todosAutorizados) {
      return respuestaDenegada(
        403,
        'El Coordinador no tiene autorización para todos los grupos activos de este grado.'
      );
    }

    return respuestaAutorizada(
      'Publicación autorizada para el grado asignado.'
    );
  }

  // ----------------------------------------------------------
  // 7. COORDINADOR: PUBLICACIÓN POR GRUPO
  // ----------------------------------------------------------

  if (alcanceTipo === 'grupo') {
    const grupoValido =
      await verificarGradoGrupo({
        gradoId,
        grupoId,
      });

    if (!grupoValido) {
      return respuestaDenegada(
        400,
        'El grado o grupo seleccionado no es válido.'
      );
    }

    const autorizado =
      await verificarAmbitoCoordinador({
        coordinadorId: usuario.id,
        gradoId,
        grupoId,
      });

    if (!autorizado) {
      return respuestaDenegada(
        403,
        'El Coordinador no tiene autorización para publicar en este grupo.'
      );
    }

    return respuestaAutorizada(
      'Publicación autorizada para el grupo asignado.'
    );
  }

  // ----------------------------------------------------------
  // 8. DENEGAR CUALQUIER OTRO CASO
  // ----------------------------------------------------------

  return respuestaDenegada(
    403,
    'No tiene autorización para publicar este comunicado.'
  );
}

// ============================================================
// EXPORTACIONES
// ============================================================

module.exports = {
  ROLES_PUBLICADORES,
  esIdPositivo,
  puedePublicarComunicados,
  verificarAmbitoCoordinador,
  verificarGradoActivo,
  verificarGradoGrupo,
  consultarGruposActivosGrado,
  consultarAmbitosCoordinadorGrado,
  autorizarPublicacionComunicado,
};