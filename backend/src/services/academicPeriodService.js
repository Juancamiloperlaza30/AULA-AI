'use strict';

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

const asegurarAsignacionesPeriodoActual =
  async () => {
    const fechaActual =
      obtenerFechaAcademicaActual();

    const {
      data,
      error,
    } = await supabaseAdmin.rpc(
      'hu14_asegurar_asignaciones_periodo_actual',
      {
        p_fecha_actual: fechaActual,
      }
    );

    if (error) {
      console.error(
        'Error preparando asignaciones del período vigente:',
        error.message
      );

      throw new Error(
        'No fue posible preparar las asignaciones del período académico vigente.'
      );
    }

    return {
      fechaActual,
      asignacionesCreadas: Number(data) || 0,
    };
  };

module.exports = {
  asegurarAsignacionesPeriodoActual,
  obtenerFechaAcademicaActual,
};
