'use strict';

const cron = require('node-cron');

const {
  asegurarAsignacionesPeriodoActual,
} = require('../services/academicPeriodService');

let procesandoCambioPeriodo = false;

const ejecutarCambioPeriodo = async () => {
  if (procesandoCambioPeriodo) {
    return;
  }

  procesandoCambioPeriodo = true;

  try {
    const resultado =
      await asegurarAsignacionesPeriodoActual();

    if (resultado.asignacionesCreadas > 0) {
      console.info(
        '[HU-14] Asignaciones creadas para el período vigente:',
        resultado.asignacionesCreadas
      );
    }
  } catch (error) {
    console.error(
      '[HU-14] No fue posible preparar las asignaciones del período vigente:',
      error.message
    );
  } finally {
    procesandoCambioPeriodo = false;
  }
};

const iniciarActualizacionPeriodoAcademico = () => {
  void ejecutarCambioPeriodo();

  cron.schedule(
    '*/5 * * * *',
    ejecutarCambioPeriodo
  );
};

module.exports = {
  iniciarActualizacionPeriodoAcademico,
};
