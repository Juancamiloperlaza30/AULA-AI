'use strict';

require('dotenv').config({ quiet: true });

const {
  obtenerContextoAcademicoEstudiante,
} = require('../src/services/academicStudentContextService');

const {
  prepararContextoParaIA,
} = require('../src/services/academicAIContextService');

const {
  generarRecomendacionesAcademicas,
} = require('../src/services/academicOpenAIService');

const {
  guardarRecomendacionAcademica,
} = require('../src/services/academicRecommendationPersistenceService');

const ESTUDIANTE_PRUEBA =
  '85fb51da-83cb-4eed-b818-95aa7426d2f6';

const ejecutarPrueba = async () => {
  console.log('====================================');
  console.log('AULA-AI - HU-11');
  console.log('PRUEBA DE ALMACENAMIENTO');
  console.log('====================================');

  if (process.env.OPENAI_ENABLED !== 'false') {
    throw new Error(
      'La prueba requiere OPENAI_ENABLED=false.'
    );
  }

  // Obtener los indicadores académicos.
  const contexto =
    await obtenerContextoAcademicoEstudiante({
      estudianteId: ESTUDIANTE_PRUEBA,
    });

  // Preparar exclusivamente los indicadores permitidos.
  const contextoIA =
    prepararContextoParaIA(contexto);

  // Generar recomendaciones mediante plantillas.
  const resultado =
    await generarRecomendacionesAcademicas(
      contextoIA
    );

  if (resultado.origen !== 'plantilla') {
    throw new Error(
      'La prueba esperaba recomendaciones de plantilla.'
    );
  }

  console.log(
    'Origen:',
    resultado.origen
  );

  console.log(
    'Recomendaciones generadas:',
    resultado.recomendaciones.length
  );

  // Guardar la recomendación.
  const guardada =
    await guardarRecomendacionAcademica({
      estudianteId: ESTUDIANTE_PRUEBA,
      alertaId: null,
      contextoIA,
      resultado,
    });

  console.log('------------------------------------');

  console.log(
    'ID del registro:',
    guardada.id
  );

  console.log(
    'Estudiante:',
    guardada.estudiante_id
  );

  console.log(
    'Origen guardado:',
    guardada.origen
  );

  console.log(
    'Estado:',
    guardada.estado
  );

  console.log(
    'Registro existente:',
    guardada.registroExistente
  );

  console.log('------------------------------------');
  console.log('PRUEBA FINALIZADA');
};

ejecutarPrueba().catch((error) => {
  console.error(
    'ERROR HU-11:',
    error.message
  );

  process.exitCode = 1;
});
