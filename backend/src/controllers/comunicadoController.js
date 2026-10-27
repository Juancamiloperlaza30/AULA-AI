'use strict';

// ======================================================
// AULA-AI | HU-12
// CONTROLADOR DE COMUNICADOS INSTITUCIONALES
// ======================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  autorizarPublicacionComunicado,
} = require('../services/comunicadoAuthorizationService');

const {
  ROLES_DESTINATARIOS,
  resolverDestinatariosComunicado,
} = require('../services/comunicadoDestinatariosService');

const {
  registrarAuditoria,
} = require('../services/auditService');

// ======================================================
// HU-12 | CONSULTA DE COMUNICADOS RECIBIDOS
// ======================================================

const {
  consultarMisComunicados,
} = require('../services/comunicadoConsultaService');

// ======================================================
// HU-12 | CONSULTA INDIVIDUAL DE COMUNICADOS
// ======================================================

const {
  consultarDetalleComunicado,
  validarIdComunicado,
} = require('../services/comunicadoDetalleService');

const {
  registrarLecturaComunicado,
} = require('../services/comunicadoLecturaService');

const {
  notificarComunicadoPublicado,
} = require('../services/comunicadoPushService');

// ======================================================
// CONFIGURACIÓN
// ======================================================

const ALCANCES_PERMITIDOS = [
  'general',
  'roles',
  'grado',
  'grupo',
];

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

const esIdPositivo = (valor) => {
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
};

const normalizarId = (valor) => {
  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    return null;
  }

  return esIdPositivo(valor)
    ? Number(valor)
    : null;
};

const responderError = (
  res,
  codigo,
  mensaje
) => {
  return res.status(codigo).json({
    success: false,
    message: mensaje,
  });
};

// ======================================================
// PUBLICAR COMUNICADO
// POST /api/comunicados
// ======================================================

const publicarComunicado = async (
  req,
  res
) => {
  try {
    // --------------------------------------------------
    // 1. VERIFICAR USUARIO AUTENTICADO
    // --------------------------------------------------

    const usuario = req.usuario;

    if (!usuario || !usuario.id) {
      return responderError(
        res,
        401,
        'No se pudo identificar al usuario autenticado.'
      );
    }

    if (
      usuario.activo !== true ||
      ![
        'administrador',
        'coordinador',
      ].includes(usuario.rol)
    ) {
      return responderError(
        res,
        403,
        'No tienes permisos para publicar comunicados.'
      );
    }

    // --------------------------------------------------
    // 2. RECIBIR DATOS
    // --------------------------------------------------

    const {
      titulo,
      contenido,
      alcanceTipo,
      alcanceRoles = [],
      gradoId = null,
      grupoId = null,
    } = req.body || {};

    // --------------------------------------------------
    // 3. VALIDAR TÍTULO Y CONTENIDO
    // --------------------------------------------------

    if (
      typeof titulo !== 'string' ||
      !titulo.trim()
    ) {
      return responderError(
        res,
        400,
        'El título del comunicado es obligatorio.'
      );
    }

    if (
      typeof contenido !== 'string' ||
      !contenido.trim()
    ) {
      return responderError(
        res,
        400,
        'El contenido del comunicado es obligatorio.'
      );
    }

    // --------------------------------------------------
    // 4. VALIDAR ALCANCE
    // --------------------------------------------------

    if (
      !ALCANCES_PERMITIDOS.includes(
        alcanceTipo
      )
    ) {
      return responderError(
        res,
        400,
        'El alcance del comunicado no es válido.'
      );
    }

    if (!Array.isArray(alcanceRoles)) {
      return responderError(
        res,
        400,
        'Los roles destinatarios deben enviarse en una lista.'
      );
    }

    const rolesNormalizados = [
      ...new Set(alcanceRoles),
    ];

    if (
      rolesNormalizados.some(
        (rol) =>
          typeof rol !== 'string' ||
          !ROLES_DESTINATARIOS.includes(rol)
      )
    ) {
      return responderError(
        res,
        400,
        'La lista contiene roles destinatarios no válidos.'
      );
    }

    // --------------------------------------------------
    // 5. VALIDAR COHERENCIA DEL ALCANCE
    // --------------------------------------------------

    let gradoNormalizado = null;
    let grupoNormalizado = null;

    if (alcanceTipo === 'general') {
      if (
        rolesNormalizados.length > 0 ||
        gradoId !== null ||
        grupoId !== null
      ) {
        return responderError(
          res,
          400,
          'El alcance general no permite seleccionar roles, grados o grupos.'
        );
      }
    }

    if (alcanceTipo === 'roles') {
      if (
        rolesNormalizados.length === 0 ||
        gradoId !== null ||
        grupoId !== null
      ) {
        return responderError(
          res,
          400,
          'Debes seleccionar roles válidos sin especificar grados o grupos.'
        );
      }
    }

    if (alcanceTipo === 'grado') {
      gradoNormalizado = normalizarId(
        gradoId
      );

      if (
        gradoNormalizado === null ||
        grupoId !== null ||
        rolesNormalizados.length > 0
      ) {
        return responderError(
          res,
          400,
          'El alcance por grado requiere un grado válido y no permite seleccionar grupos o roles.'
        );
      }
    }

    if (alcanceTipo === 'grupo') {
      gradoNormalizado = normalizarId(
        gradoId
      );

      grupoNormalizado = normalizarId(
        grupoId
      );

      if (
        gradoNormalizado === null ||
        grupoNormalizado === null ||
        rolesNormalizados.length > 0
      ) {
        return responderError(
          res,
          400,
          'El alcance por grupo requiere un grado y un grupo válidos.'
        );
      }
    }

    // --------------------------------------------------
    // 6. AUTORIZAR PUBLICACIÓN
    // --------------------------------------------------

    const resultadoAutorizacion =
      await autorizarPublicacionComunicado({
        usuario,
        alcanceTipo,
        gradoId: gradoNormalizado,
        grupoId: grupoNormalizado,
      });

    if (
      !resultadoAutorizacion ||
      resultadoAutorizacion.autorizado !== true
    ) {
      const codigo =
        resultadoAutorizacion?.codigo === 400
          ? 400
          : 403;

      const mensaje =
        resultadoAutorizacion?.mensaje ||
        'No tienes autorización para publicar en el alcance seleccionado.';

      return responderError(
        res,
        codigo,
        mensaje
      );
    }

    // --------------------------------------------------
    // 7. RESOLVER DESTINATARIOS
    // --------------------------------------------------

    const destinatarios =
      await resolverDestinatariosComunicado({
        alcanceTipo,
        alcanceRoles: rolesNormalizados,
        gradoId: gradoNormalizado,
        grupoId: grupoNormalizado,
      });

    if (
      !Array.isArray(destinatarios) ||
      destinatarios.length === 0
    ) {
      return responderError(
        res,
        400,
        'No se encontraron destinatarios activos para este comunicado.'
      );
    }

    // --------------------------------------------------
    // 8. PUBLICAR EN UNA TRANSACCIÓN
    // --------------------------------------------------

    const {
      data: comunicadoId,
      error: errorPublicacion,
    } = await supabaseAdmin.rpc(
      'publicar_comunicado_hu12',
      {
        p_titulo: titulo.trim(),
        p_contenido: contenido.trim(),
        p_publicado_por: usuario.id,
        p_alcance_tipo: alcanceTipo,
        p_alcance_roles: rolesNormalizados,
        p_grado_id: gradoNormalizado,
        p_grupo_id: grupoNormalizado,
        p_destinatarios: destinatarios,
      }
    );

    if (errorPublicacion) {
      console.error(
        'HU-12 | Error publicando comunicado:',
        errorPublicacion
      );

      return responderError(
        res,
        500,
        'No fue posible publicar el comunicado.'
      );
    }

    // --------------------------------------------------
    // 9. REGISTRAR AUDITORÍA
    // --------------------------------------------------

    const auditoriaRegistrada =
      await registrarAuditoria({
        usuarioId: usuario.id,
        correo: usuario.correo,
        evento: 'COMUNICADO_PUBLICADO',
        descripcion:
          'Publicación de comunicado institucional.',
        rol: usuario.rol,
        direccionIp: req.ip || null,
        dispositivo:
          req.get('user-agent') || null,
        metadata: {
          comunicado_id: comunicadoId,
          alcance_tipo: alcanceTipo,
          grado_id: gradoNormalizado,
          grupo_id: grupoNormalizado,
          alcance_roles: rolesNormalizados,
          total_destinatarios:
            destinatarios.length,
        },
      });

    if (!auditoriaRegistrada) {
      console.error(
        'HU-12 | Comunicado publicado, pero no se pudo registrar su auditoría:',
        comunicadoId
      );
    }

    // --------------------------------------------------
    // 10. NOTIFICAR DESTINATARIOS MEDIANTE FCM
    // --------------------------------------------------

    try {
      const resultadoPush =
        await notificarComunicadoPublicado({
          comunicadoId,
          titulo: titulo.trim(),
          destinatarios,
        });

      console.log(
        '[HU-12 PUSH] Publicación procesada:',
        {
          comunicadoId,
          dispositivos:
            resultadoPush.dispositivos,
          enviados:
            resultadoPush.enviados,
          fallidos:
            resultadoPush.fallidos,
          error:
            resultadoPush.error === true,
        }
      );
    } catch (errorPush) {
      // El comunicado ya fue publicado.
      // Un fallo de FCM no debe anularlo.
      console.error(
        '[HU-12 PUSH] Error posterior a la publicación:',
        errorPush
      );
    }

    // --------------------------------------------------
    // 11. RESPONDER
    // --------------------------------------------------

    return res.status(201).json({
      success: true,
      message:
        'Comunicado institucional publicado correctamente.',
      data: {
        id: comunicadoId,
        alcanceTipo,
        totalDestinatarios:
          destinatarios.length,
        auditoriaRegistrada,
      },
    });
  } catch (error) {
    console.error(
      'HU-12 | Error inesperado publicando comunicado:',
      error
    );

    return responderError(
      res,
      500,
      'Ocurrió un error al procesar la publicación del comunicado.'
    );
  }
};

// ======================================================
// HU-12 | LISTAR MIS COMUNICADOS
// GET /api/comunicados
// ======================================================

const listarMisComunicados = async (req, res) => {
  try {
    // --------------------------------------------------
    // 1. VERIFICAR USUARIO AUTENTICADO
    // --------------------------------------------------

    const usuario = req.usuario;

    if (!usuario || !usuario.id) {
      return responderError(
        res,
        401,
        'No se pudo identificar al usuario autenticado.'
      );
    }

    if (usuario.activo !== true) {
      return responderError(
        res,
        403,
        'El usuario no se encuentra activo.'
      );
    }

    // --------------------------------------------------
    // 2. RECIBIR Y VALIDAR PAGINACIÓN
    // --------------------------------------------------

    const pagina = req.query.pagina ?? 1;
    const limite = req.query.limite ?? 20;

    const numeroPagina = Number(pagina);
    const numeroLimite = Number(limite);

    if (
      !Number.isSafeInteger(numeroPagina) ||
      numeroPagina < 1 ||
      !Number.isSafeInteger(numeroLimite) ||
      numeroLimite < 1 ||
      numeroLimite > 50
    ) {
      return responderError(
        res,
        400,
        'Los parámetros de paginación no son válidos.'
      );
    }

    // --------------------------------------------------
    // 3. CONSULTAR COMUNICADOS DEL USUARIO
    // --------------------------------------------------

    const resultado = await consultarMisComunicados({
      usuarioId: usuario.id,
      pagina: numeroPagina,
      limite: numeroLimite,
    });

    // --------------------------------------------------
    // 4. RESPONDER
    // --------------------------------------------------

    return res.status(200).json({
      success: true,
      message: 'Comunicados consultados correctamente.',
      data: resultado.comunicados,
      paginacion: resultado.paginacion,
    });
  } catch (error) {
    console.error(
      'HU-12 | Error consultando comunicados:',
      error
    );

    return responderError(
      res,
      500,
      'No fue posible consultar los comunicados institucionales.'
    );
  }
};

// ======================================================
// HU-12 | OBTENER DETALLE DE UN COMUNICADO
// GET /api/comunicados/:id
// ======================================================

const obtenerDetalleComunicado = async (req, res) => {
  try {
    // --------------------------------------------------
    // 1. VERIFICAR USUARIO AUTENTICADO
    // --------------------------------------------------

    const usuario = req.usuario;

    if (!usuario || !usuario.id) {
      return responderError(
        res,
        401,
        'No se pudo identificar al usuario autenticado.'
      );
    }

    if (usuario.activo !== true) {
      return responderError(
        res,
        403,
        'El usuario no se encuentra activo.'
      );
    }

    // --------------------------------------------------
    // 2. VALIDAR IDENTIFICADOR DEL COMUNICADO
    // --------------------------------------------------

    const comunicadoId = validarIdComunicado(
      req.params.id
    );

    if (!comunicadoId) {
      return responderError(
        res,
        400,
        'El identificador del comunicado no es válido.'
      );
    }

    // --------------------------------------------------
    // 3. CONSULTAR COMUNICADO AUTORIZADO
    // --------------------------------------------------

    // El identificador del usuario se obtiene
    // exclusivamente de la sesión autenticada.

    const comunicado = await consultarDetalleComunicado({
      comunicadoId,
      usuarioId: usuario.id,
    });

    // --------------------------------------------------
    // 4. VERIFICAR EXISTENCIA Y AUTORIZACIÓN
    // --------------------------------------------------

    if (!comunicado) {
      return responderError(
        res,
        404,
        'El comunicado no existe o no está disponible.'
      );
    }

    // --------------------------------------------------
    // 5. DEVOLVER COMUNICADO
    // --------------------------------------------------

    return res.status(200).json({
      success: true,
      message: 'Comunicado consultado correctamente.',
      data: comunicado,
    });
  } catch (error) {
    console.error(
      'HU-12 | Error consultando detalle del comunicado:',
      error
    );

    return responderError(
      res,
      500,
      'No fue posible consultar el comunicado institucional.'
    );
  }
};

// ======================================================
// AULA-AI | HU-12
// CONTROLADOR: REGISTRAR LECTURA DE COMUNICADO
// ======================================================

const marcarComunicadoComoLeido = async (req, res) => {
  try {
    // --------------------------------------------------
    // 1. VERIFICAR USUARIO AUTENTICADO
    // --------------------------------------------------

    const usuario = req.usuario;

    if (!usuario || !usuario.id) {
      return responderError(
        res,
        401,
        'No se pudo identificar al usuario autenticado.'
      );
    }

    // --------------------------------------------------
    // 2. VERIFICAR USUARIO ACTIVO
    // --------------------------------------------------

    if (usuario.activo !== true) {
      return responderError(
        res,
        403,
        'El usuario no se encuentra activo.'
      );
    }

    // --------------------------------------------------
    // 3. REGISTRAR LECTURA
    // --------------------------------------------------

    const resultado = await registrarLecturaComunicado({
      comunicadoId: req.params.id,
      usuarioId: usuario.id,
    });

    // --------------------------------------------------
    // 4. DEVOLVER RESPUESTA
    // --------------------------------------------------

    return res.status(200).json({
      success: true,
      message: resultado.lecturaRegistrada
        ? 'Lectura del comunicado registrada correctamente.'
        : 'El comunicado ya estaba marcado como leído.',
      data: resultado,
    });
  } catch (error) {
    // --------------------------------------------------
    // 5. CONTROLAR ERRORES CONOCIDOS
    // --------------------------------------------------

    if (
      error.codigo === 400 ||
      error.codigo === 401 ||
      error.codigo === 404
    ) {
      return responderError(
        res,
        error.codigo,
        error.message
      );
    }

    console.error(
      'HU-12 | Error registrando lectura:',
      error
    );

    return responderError(
      res,
      500,
      'No fue posible registrar la lectura del comunicado.'
    );
  }
};

// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {
  publicarComunicado,
  listarMisComunicados,
  obtenerDetalleComunicado,
  marcarComunicadoComoLeido,
};
