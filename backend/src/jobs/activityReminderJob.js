const cron = require('node-cron');

const {
  ejecutarRecordatoriosActividades,
} = require('../services/activityReminderService');

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
};

module.exports = {
  iniciarRecordatoriosActividades,
};
