
'use strict';

// ======================================================
// AULA-AI | HU-10
// CONTROLADOR DE ALERTAS DEL ORIENTADOR
// ======================================================

const {
  supabaseAdmin,
} = require('../config/supabase');

const {
  verificarAccesoOrientadorAlerta,
} = require('../services/orientadorAuthorizationService');

const {
  registrarSeguimientoOrientador,
  listarSeguimientosOrientador,
} = require('../services/orientadorSeguimientoService');

const {
  iniciarSeguimientoOrientador,
  cerrarAlertaOrientador,
} = require('../services/orientadorEstadoService');

const CAMPOS_ALERTA = `
  id,
  estudiante_id,
  tipo,
  nivel,
  titulo,
  descripcion,
  estado,
  periodo_id,
  fecha_evento,
  created_at,
  updated_at
`;

const CAMPOS_ESTUDIANTE = `
  usuario_id,
  grado_id,
  grupo_id
`;

const CAMPOS_USUARIO = `
  id,
  nombres,
  apellidos
`;

const LIMITE_PAGINA = 50;

// ======================================================
// VALIDACIÓN DE SESIÓN DEL ORIENTADOR
// ======================================================

function validarOrientador(req, res) {
  if (!req.usuario?.id) {
    res.status(401).json({
      success: false,
      message: 'Usuario no autenticado.',
    });
    return null;
  }

  if (req.usuario.rol !== 'orientador') {
    res.status(403).json({
      success: false,
      message: 'No tiene permisos para consultar estas alertas.',
    });
    return null;
  }

  return req.usuario.id;
}

// ======================================================
// LISTAR ALERTAS AUTORIZADAS
// GET /api/risk-alerts/orientador
// ======================================================

const listarAlertasOrientador = async (req, res) => {
  try {
    const orientadorId = validarOrientador(req, res);

    if (!orientadorId) {
      return;
    }

    const paginaTexto = String(req.query.pagina ?? '1');

    if (!/^[1-9]\d*$/.test(paginaTexto)) {
      return res.status(400).json({
        success: false,
        message: 'La página solicitada no es válida.',
      });
    }

    const pagina = Number(paginaTexto);

    if (!Number.isSafeInteger(pagina)) {
      return res.status(400).json({
        success: false,
        message: 'La página solicitada no es válida.',
      });
    }

    // 1. Consultar exclusivamente los ámbitos
    // académicos activos del orientador.

    const {
      data: ambitos,
      error: errorAmbitos,
    } = await supabaseAdmin
      .from('orientador_ambito')
      .select('grado_id, grupo_id')
      .eq('orientador_id', orientadorId)
      .eq('activo', true);

    if (errorAmbitos) {
      throw errorAmbitos;
    }

    if (!ambitos?.length) {
      return res.status(200).json({
        success: true,
        alertas: [],
        paginacion: {
          pagina,
          limite: LIMITE_PAGINA,
          total: 0,
          totalPaginas: 0,
        },
      });
    }

    // 2. Obtener los estudiantes que pertenecen
    // a alguno de los ámbitos autorizados.
    //
    // Se consulta por grado y se filtra también
    // por grupo. Nunca se autoriza solo por grado.

    const grados = [
      ...new Set(
        ambitos.map((ambito) => ambito.grado_id)
      ),
    ];

    const {
      data: estudiantes,
      error: errorEstudiantes,
    } = await supabaseAdmin
      .from('estudiantes')
      .select(CAMPOS_ESTUDIANTE)
      .in('grado_id', grados);

    if (errorEstudiantes) {
      throw errorEstudiantes;
    }

    const clavesAutorizadas = new Set(
      ambitos.map(
        (ambito) =>
          `${ambito.grado_id}:${ambito.grupo_id}`
      )
    );

    const estudiantesAutorizados = (
      estudiantes || []
    ).filter((estudiante) =>
      clavesAutorizadas.has(
        `${estudiante.grado_id}:${estudiante.grupo_id}`
      )
    );

    const estudianteIds = [
      ...new Set(
        estudiantesAutorizados.map(
          (estudiante) => estudiante.usuario_id
        ).filter(Boolean)
      ),
    ];

    if (!estudianteIds.length) {
      return res.status(200).json({
        success: true,
        alertas: [],
        paginacion: {
          pagina,
          limite: LIMITE_PAGINA,
          total: 0,
          totalPaginas: 0,
        },
      });
    }

    // 3. Consultar únicamente alertas asociadas
    // a los estudiantes autorizados.

    const inicio = (pagina - 1) * LIMITE_PAGINA;
    const fin = inicio + LIMITE_PAGINA - 1;

    const {
      data: alertas,
      error: errorAlertas,
      count,
    } = await supabaseAdmin
      .from('alertas_academicas')
      .select(CAMPOS_ALERTA, {
        count: 'exact',
      })
      .in('estudiante_id', estudianteIds)
      .order('created_at', {
        ascending: false,
      })
      .order('id', {
        ascending: false,
      })
      .range(inicio, fin);

    if (errorAlertas) {
      throw errorAlertas;
    }

    // 4. Incorporar nombres para el listado,
    // sin devolver información sensible adicional.

    const idsEnPagina = [
      ...new Set(
        (alertas || []).map(
          (alerta) => alerta.estudiante_id
        )
      ),
    ];

    let usuarios = [];

    if (idsEnPagina.length) {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from('usuarios')
        .select(CAMPOS_USUARIO)
        .in('id', idsEnPagina);

      if (error) {
        throw error;
      }

      usuarios = data || [];
    }

    const usuariosPorId = new Map(
      usuarios.map((usuario) => [
        usuario.id,
        usuario,
      ])
    );

    const estudiantesPorId = new Map(
      estudiantesAutorizados.map((estudiante) => [
        estudiante.usuario_id,
        estudiante,
      ])
    );

    const resultado = (alertas || []).map(
      (alerta) => {
        const usuario = usuariosPorId.get(
          alerta.estudiante_id
        );

        const estudiante = estudiantesPorId.get(
          alerta.estudiante_id
        );

        return {
          ...alerta,
          estudiante: {
            id: alerta.estudiante_id,
            nombres: usuario?.nombres ?? null,
            apellidos: usuario?.apellidos ?? null,
            grado_id: estudiante?.grado_id ?? null,
            grupo_id: estudiante?.grupo_id ?? null,
          },
        };
      }
    );

    return res.status(200).json({
      success: true,
      alertas: resultado,
      paginacion: {
        pagina,
        limite: LIMITE_PAGINA,
        total: count ?? 0,
        totalPaginas: Math.ceil(
          (count ?? 0) / LIMITE_PAGINA
        ),
      },
    });
  } catch (error) {
    console.error(
      'HU-10 | Error listando alertas del orientador:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'No fue posible consultar las alertas académicas.',
    });
  }
};

// ======================================================
// CONSULTAR UNA ALERTA ESPECÍFICA
// GET /api/risk-alerts/orientador/:alertaId
// ======================================================

const obtenerAlertaOrientador = async (req, res) => {
  try {
    const orientadorId = validarOrientador(req, res);

    if (!orientadorId) {
      return;
    }

    const { alertaId } = req.params;

    if (!/^[1-9]\d*$/.test(String(alertaId || ''))) {
      return res.status(400).json({
        success: false,
        message: 'El identificador de la alerta no es válido.',
      });
    }

    const acceso = await verificarAccesoOrientadorAlerta({
      orientadorId,
      alertaId,
    });

    if (!acceso.autorizado) {
      return res.status(404).json({
        success: false,
        message: 'Alerta no encontrada o no autorizada.',
      });
    }

    const {
      data: alerta,
      error,
    } = await supabaseAdmin
      .from('alertas_academicas')
      .select(CAMPOS_ALERTA)
      .eq('id', alertaId)
      .eq('estudiante_id', acceso.estudianteId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!alerta) {
      return res.status(404).json({
        success: false,
        message: 'Alerta no encontrada o no autorizada.',
      });
    }

    return res.status(200).json({
      success: true,
      alerta,
    });
  } catch (error) {
    console.error(
      'HU-10 | Error consultando alerta del orientador:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'No fue posible consultar la alerta académica.',
    });
  }
};

// ======================================================
// HU-10 | REGISTRAR SEGUIMIENTO DEL ORIENTADOR
// POST /api/risk-alerts/orientador/:alertaId/seguimientos
// ======================================================

const crearSeguimientoOrientador = async (req, res) => {
  try {
    const orientadorId = req.usuario?.id;

    if (!orientadorId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado.',
      });
    }

    if (req.usuario.rol !== 'orientador') {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para registrar seguimientos.',
      });
    }

    const resultado = await registrarSeguimientoOrientador({
      orientadorId,
      alertaId: req.params.alertaId,
      datos: req.body,
    });

    if (resultado.status !== 201) {
      return res.status(resultado.status).json({
        success: false,
        message: resultado.mensaje,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Seguimiento registrado correctamente.',
      seguimiento: resultado.seguimiento,
    });
  } catch (error) {
    console.error(
      'HU-10 | Error registrando seguimiento:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'No fue posible registrar el seguimiento académico.',
    });
  }
};

const obtenerSeguimientosOrientador = async (req, res) => {
  try {
    const orientadorId = req.usuario?.id;

    if (!orientadorId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado.',
      });
    }

    if (req.usuario.rol !== 'orientador') {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para consultar seguimientos.',
      });
    }

    const resultado = await listarSeguimientosOrientador({
      orientadorId,
      alertaId: req.params.alertaId,
    });

    if (resultado.status !== 200) {
      return res.status(resultado.status).json({
        success: false,
        message: resultado.mensaje,
      });
    }

    return res.status(200).json({
      success: true,
      seguimientos: resultado.seguimientos,
      total: resultado.seguimientos.length,
      limite: 100,
    });
  } catch (error) {
    console.error(
      'HU-10 | Error consultando seguimientos:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'No fue posible consultar los seguimientos.',
    });
  }
};

/**
 * HU-10 | Iniciar seguimiento académico
 *
 * PATCH /api/risk-alerts/orientador/:alertaId/iniciar-seguimiento
 */
const iniciarSeguimientoAlerta = async (req, res) => {
  try {
    const orientadorId = req.usuario?.id;

    if (!orientadorId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado.',
      });
    }

    if (req.usuario.rol !== 'orientador') {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para iniciar seguimientos.',
      });
    }

    const resultado = await iniciarSeguimientoOrientador({
      orientadorId,
      alertaId: req.params.alertaId,
    });

    if (resultado.status !== 200) {
      return res.status(resultado.status).json({
        success: false,
        message: resultado.mensaje,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Seguimiento académico iniciado correctamente.',
      alerta: resultado.alerta,
    });
  } catch (error) {
    console.error(
      'HU-10 | Error iniciando seguimiento:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'No fue posible iniciar el seguimiento académico.',
    });
  }
};

/**
 * ======================================================
 * AULA-AI | HU-10
 * CIERRE MANUAL DE ALERTAS ACADÉMICAS
 *
 * PATCH /api/risk-alerts/orientador/:alertaId/cerrar
 * ======================================================
 */

const cerrarAlertaAcademica = async (req, res) => {
  try {
    const orientadorId = req.usuario?.id;

    // Verificar autenticación.
    if (!orientadorId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado.',
      });
    }

    // Verificar rol.
    if (req.usuario.rol !== 'orientador') {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para cerrar alertas.',
      });
    }

    // Obtener el motivo del cierre.
    const motivo = req.body?.motivo;

    // Ejecutar el servicio de cierre.
    const resultado = await cerrarAlertaOrientador({
      orientadorId,
      alertaId: req.params.alertaId,
      motivo,
    });

    // Gestionar errores de validación y autorización.
    if (resultado.status !== 200) {
      return res.status(resultado.status).json({
        success: false,
        message: resultado.mensaje,
      });
    }

    // Respuesta exitosa.
    return res.status(200).json({
      success: true,
      message: 'Alerta académica cerrada correctamente.',
      alerta: resultado.alerta,
    });
  } catch (error) {
    console.error(
      'HU-10 | Error cerrando alerta académica:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'No fue posible cerrar la alerta académica.',
    });
  }
};

module.exports = {
  listarAlertasOrientador,
  obtenerAlertaOrientador,
  crearSeguimientoOrientador,
  obtenerSeguimientosOrientador,
  iniciarSeguimientoAlerta,
  cerrarAlertaAcademica,
};
