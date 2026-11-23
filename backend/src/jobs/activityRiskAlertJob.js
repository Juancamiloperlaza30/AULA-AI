'use strict';

const cron = require('node-cron');

const {
  ejecutarColaAlertasActividades,
} = require('../services/activityRiskAlertQueueService');

let procesandoAlertas = false;

const iniciarColaAlertasActividades = () => {
  cron.schedule('* * * * *', async () => {
    if (procesandoAlertas) {
      return;
    }

    procesandoAlertas = true;

    try {
      const resultado =
        await ejecutarColaAlertasActividades();

      if (resultado.procesados > 0 || resultado.fallidos > 0) {
        console.info(
          '[RNF-10] Resultado de alertas por actividades vencidas:',
          resultado
        );
      }
    } catch (error) {
      console.error(
        '[RNF-10] Error procesando alertas por actividades vencidas:',
        error.message
      );
    } finally {
      procesandoAlertas = false;
    }
  });
};

module.exports = {
  iniciarColaAlertasActividades,
};
