'use strict';

const cron = require('node-cron');

const {
  ejecutarColaAlertasCalificaciones,
} = require('../services/gradeAlertQueueService');

let procesandoAlertas = false;

const iniciarColaAlertasCalificaciones = () => {
  cron.schedule('* * * * *', async () => {
    if (procesandoAlertas) {
      return;
    }

    procesandoAlertas = true;

    try {
      const resultado =
        await ejecutarColaAlertasCalificaciones();

      if (resultado.procesados > 0 || resultado.fallidos > 0) {
        console.info(
          '[AULA-AI][HU-08] Resultado de alertas pendientes:',
          resultado
        );
      }
    } catch (error) {
      console.error(
        '[AULA-AI][HU-08] Error procesando alertas pendientes:',
        error.message
      );
    } finally {
      procesandoAlertas = false;
    }
  });
};

module.exports = {
  iniciarColaAlertasCalificaciones,
};
