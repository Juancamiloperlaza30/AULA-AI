'use strict';

const { supabaseAdmin } = require('../config/supabase');

/**
 * HU-11
 * Indicadores de riesgo académico.
 *
 * Consulta las alertas generadas por HU-10.
 *
 * - No modifica alertas.
 * - No cambia estados.
 * - No registra seguimientos.
 * - No consulta información confidencial
 *   del orientador.
 * - No utiliza OpenAI.
 *
 * Este servicio debe utilizarse únicamente
 * desde rutas que verifiquen los permisos
 * del usuario autenticado.
 */

const obtenerIndicadoresRiesgo = async ({
  estudianteId,
}) => {
  if (
    typeof estudianteId !== 'string' ||
    !estudianteId.trim()
  ) {
    throw new Error(
      'El identificador del estudiante es obligatorio.'
    );
  }

  // 1. Verificar que el estudiante exista.
  const {
    data: estudiante,
    error: errorEstudiante,
  } = await supabaseAdmin
    .from('estudiantes')
    .select('usuario_id')
    .eq('usuario_id', estudianteId)
    .maybeSingle();

  if (errorEstudiante) {
    throw new Error(
      `Error consultando estudiante: ${errorEstudiante.message}`
    );
  }

  if (!estudiante) {
    return {
      encontrado: false,
      motivo: 'ESTUDIANTE_NO_ENCONTRADO',
    };
  }

  // 2. Consultar únicamente los campos
  // académicos necesarios de las alertas.
  const {
    data: alertas,
    error: errorAlertas,
  } = await supabaseAdmin
    .from('alertas_academicas')
    .select(
      'id, tipo, nivel, estado, periodo_id, fecha_evento'
    )
    .eq('estudiante_id', estudianteId)
    .order('id', { ascending: false });

  if (errorAlertas) {
    throw new Error(
      `Error consultando alertas académicas: ${errorAlertas.message}`
    );
  }

  const registros = alertas || [];

  // 3. Separar alertas según su estado.
  const activas = registros.filter(
    (alerta) => alerta.estado === 'activa'
  );

  const enSeguimiento = registros.filter(
    (alerta) => alerta.estado === 'en_seguimiento'
  );

  const resueltas = registros.filter(
    (alerta) => alerta.estado === 'resuelta'
  );

  const pendientesAtencion = [
    ...activas,
    ...enSeguimiento,
  ];

  // 4. Calcular cantidades por nivel.
  const porNivel = {
    baja: 0,
    media: 0,
    alta: 0,
  };

  for (const alerta of pendientesAtencion) {
    if (
      Object.prototype.hasOwnProperty.call(
        porNivel,
        alerta.nivel
      )
    ) {
      porNivel[alerta.nivel] += 1;
    }
  }

  // 5. Preparar un resumen académico.
  // No incluir descripciones confidenciales,
  // observaciones ni datos personales.
  const resumenAlertas = pendientesAtencion.map(
    (alerta) => ({
      alertaId: alerta.id,
      tipo: alerta.tipo,
      nivel: alerta.nivel,
      estado: alerta.estado,
      periodoId: alerta.periodo_id,
      fechaEvento: alerta.fecha_evento,
    })
  );

  // 6. Devolver indicadores.
  return {
    encontrado: true,

    estudianteId: estudiante.usuario_id,

    indicadores: {
      totalAlertasRegistradas: registros.length,

      totalActivas: activas.length,

      totalEnSeguimiento: enSeguimiento.length,

      totalResueltas: resueltas.length,

      totalPendientesAtencion:
        pendientesAtencion.length,

      alertasPendientesPorNivel: porNivel,

      alertasPendientes: resumenAlertas,
    },

    informacionDisponible: {
      tieneAlertasRegistradas:
        registros.length > 0,

      tieneAlertasPendientes:
        pendientesAtencion.length > 0,
    },
  };
};

module.exports = {
  obtenerIndicadoresRiesgo,
};
