const cron = require('node-cron');

const {
  ejecutarRecordatoriosActividades,
} = require('../services/activityReminderService');

const {
  ejecutarNotificacionesPublicacionesProgramadas,
} = require('../services/activityPublicationService');

let procesandoPublicaciones = false;

const iniciarRecordatoriosActividades = () => {
  cron.schedule(
    '0 * * * *',
    async () => {
      console.log(
        'Ejecutando revisión de recordatorios de actividades...'
      );

      const resultado =
        await ejecutarRecordatoriosActividades();

      console.log(
        'Resultado recordatorios:',
        resultado
      );
    }
  );

  cron.schedule(
    '*/5 * * * *',
    async () => {
      if (procesandoPublicaciones) {
        return;
      }

      procesandoPublicaciones = true;

      try {
        const resultado =
          await ejecutarNotificacionesPublicacionesProgramadas();

        console.log(
          'Resultado publicaciones programadas:',
          resultado
        );
      } catch (error) {
        console.error(
          'Error procesando publicaciones programadas:',
          error.message
        );
      } finally {
        procesandoPublicaciones = false;
      }
    }
  );
};

module.exports = {
  iniciarRecordatoriosActividades,
};
