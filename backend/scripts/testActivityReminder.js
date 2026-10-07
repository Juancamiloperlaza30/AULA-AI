require('dotenv').config();

const {
  ejecutarRecordatoriosActividades,
} = require('../src/services/activityReminderService');

const ejecutar = async () => {
  const resultado =
    await ejecutarRecordatoriosActividades();

  console.log(
    'RESULTADO RECORDATORIOS:',
    resultado
  );

  process.exit(
    resultado.success ? 0 : 1
  );
};

ejecutar();
