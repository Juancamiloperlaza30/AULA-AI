const { supabaseAdmin } = require('../config/supabase');

// ==========================================
// HU-06 - SINCRONIZACIÓN OFFLINE
// ==========================================

// Validación de identificadores enteros.
const esEnteroPositivo = (valor) => {
  const numero = Number(valor);

  return (
    Number.isSafeInteger(numero) &&
    numero > 0
  );
};

// Validación estricta de fecha.
const esFechaValida = (fecha) => {
  if (
    typeof fecha !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(fecha)
  ) {
    return false;
  }

  const fechaConvertida = new Date(
    `${fecha}T12:00:00Z`
  );

  return (
    !Number.isNaN(fechaConvertida.getTime()) &&
    fechaConvertida.toISOString().slice(0, 10) ===
      fecha
  );
};

// Validación de UUID.
const esUUID = (valor) =>
  typeof valor === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    valor
  );

// Validación de registros.
const validarRegistros = (registros) => {
  if (
    !Array.isArray(registros) ||
    registros.length < 1 ||
    registros.length > 100
  ) {
    return false;
  }

  const estudiantes = new Set();

  for (const registro of registros) {
    if (
      !registro ||
      typeof registro !== 'object' ||
      Array.isArray(registro)
    ) {
      return false;
    }

    if (!esUUID(registro.estudianteId)) {
      return false;
    }

    if (
      !['presente', 'ausente', 'tarde'].includes(
        registro.estado
      )
    ) {
      return false;
    }

    if (
      registro.observacion !== undefined &&
      registro.observacion !== null &&
      typeof registro.observacion !== 'string'
    ) {
      return false;
    }

    if (
      typeof registro.observacion === 'string' &&
      registro.observacion.length > 1000
    ) {
      return false;
    }

    const estudianteId =
      registro.estudianteId.toLowerCase();

    if (estudiantes.has(estudianteId)) {
      return false;
    }

    estudiantes.add(estudianteId);
  }

  return true;
};

// ==========================================
// MANEJO DE ERRORES
// ==========================================

const responderError = (res, error) => {
  console.error(
    'HU-06 sincronización offline:',
    error?.message || error
  );

  const codigo = error?.code;

  if (codigo === '42501') {
    return res.status(403).json({
      success: false,
      message:
        'No tiene autorización para sincronizar esta asistencia.',
    });
  }

  if (codigo === '23505') {
    return res.status(409).json({
      success: false,
      message:
        'La operación o sesión ya existe con información diferente.',
    });
  }

  if (
    codigo === '22023' ||
    codigo === '23514' ||
    codigo === '23503'
  ) {
    return res.status(400).json({
      success: false,
      message:
        error.message || 'Datos de asistencia inválidos.',
    });
  }

  return res.status(500).json({
    success: false,
    message:
      'No fue posible completar la sincronización.',
  });
};

// ==========================================
// POST /api/attendance/sincronizar-offline
// ==========================================

async function sincronizarAsistenciaOffline(
  req,
  res
) {
  try {
    // El docente se obtiene exclusivamente
    // del JWT validado por verificarToken.
    const docenteId = req.usuario?.id;

    if (!esUUID(docenteId)) {
      return res.status(401).json({
        success: false,
        message:
          'No se pudo identificar al docente autenticado.',
      });
    }

    const {
      operacionId,
      asignacionId,
      fecha,
      numeroSesion = 1,
      registros,
    } = req.body || {};

    // Validar identificador de operación.
    if (!esUUID(operacionId)) {
      return res.status(400).json({
        success: false,
        message:
          'El identificador de operación offline es inválido.',
      });
    }

    // Validar asignación.
    if (!esEnteroPositivo(asignacionId)) {
      return res.status(400).json({
        success: false,
        message:
          'La asignación académica es inválida.',
      });
    }

    // Validar fecha.
    if (!esFechaValida(fecha)) {
      return res.status(400).json({
        success: false,
        message:
          'La fecha debe tener el formato AAAA-MM-DD y ser válida.',
      });
    }

    // Validar número de sesión.
    if (!esEnteroPositivo(numeroSesion)) {
      return res.status(400).json({
        success: false,
        message:
          'El número de sesión es inválido.',
      });
    }

    // Validar estudiantes y estados.
    if (!validarRegistros(registros)) {
      return res.status(400).json({
        success: false,
        message:
          'Los registros de asistencia contienen información inválida.',
      });
    }

    // La función PostgreSQL comprueba
    // asignación, período, pertenencia al
    // grupo, duplicados e idempotencia.
    //
    // El docenteId no se toma del body.

    const { data, error } =
      await supabaseAdmin.rpc(
        'hu06_sincronizar_asistencia_offline',
        {
          p_operacion_id: operacionId,
          p_docente_id: docenteId,
          p_materia_grupo_periodo_id:
            Number(asignacionId),
          p_fecha: fecha,
          p_numero_sesion:
            Number(numeroSesion),
          p_registros: registros,
        }
      );

    if (error) {
      return responderError(res, error);
    }

    // Nunca confirmar una operación sin
    // un identificador de sesión válido.
    if (
      !data ||
      data.success !== true ||
      !esEnteroPositivo(data.sesionId) ||
      !esEnteroPositivo(data.cantidad) ||
      String(data.operacionId).toLowerCase() !==
        operacionId.toLowerCase()
    ) {
      console.error(
        'Respuesta inesperada del RPC offline:',
        data
      );

      return res.status(502).json({
        success: false,
        message:
          'El servidor no pudo confirmar el resultado de la sincronización.',
      });
    }

    return res.status(200).json({
      success: true,
      message: data.yaProcesada
        ? 'Esta operación ya estaba sincronizada.'
        : 'Asistencia sincronizada correctamente.',
      operacionId: data.operacionId,
      sesionId: data.sesionId,
      cantidad: data.cantidad,
      yaProcesada:
        data.yaProcesada === true,
    });
  } catch (error) {
    return responderError(res, error);
  }
}

module.exports = {
  sincronizarAsistenciaOffline,
};
