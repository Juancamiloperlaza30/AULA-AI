'use strict';

const cron = require('node-cron');

const {
  ejecutarColaAlertasAsistencia,
} = require('../services/attendanceAlertQueueService');

let procesandoAlertas = false;

const iniciarColaAlertasAsistencia = () => {
  cron.schedule('* * * * *', async () => {
    if (procesandoAlertas) {
      return;
    }

    procesandoAlertas = true;

    try {
      const resultado =
        await ejecutarColaAlertasAsistencia();

      if (
        resultado.procesados > 0 ||
        resultado.fallidos > 0
      ) {
        console.info(
          '[AULA-AI][RNF-06] Resultado de alertas de asistencia:',
          resultado
        );
      }
    } catch (error) {
      console.error(
        '[AULA-AI][RNF-06] Error procesando alertas de asistencia:',
        error.message
      );
    } finally {
      procesandoAlertas = false;
    }
  });
};

module.exports = {
  iniciarColaAlertasAsistencia,
};
